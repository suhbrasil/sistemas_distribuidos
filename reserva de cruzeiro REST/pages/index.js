import { useState } from 'react';
import SearchForm from '../components/SearchForm';
import ItineraryList from '../components/ItineraryList';
import ReservationForm from '../components/ReservationForm';
import PromoSubscription from '../components/PromoSubscription';

export default function Home() {
    const [itineraries, setItineraries] = useState([]);
    const [selected, setSelected] = useState(null);
    const [reservationInfo, setReservationInfo] = useState(null);

    const handleSearch = async (params) => {
        const query = new URLSearchParams(params).toString();
        console.log(query);
        // note: no more CORS since /api is same-origin
        const res = await fetch(`http://localhost:3000/itinerarios?${query}`);
        const data = await res.json();

        setItineraries(data);
        setSelected(null);
        setReservationInfo(null);
    };


    const handleSelect = (itinerary) => {
        setSelected(itinerary);
        setReservationInfo(null);
    };

    const handleReservation = (info) => {
        setReservationInfo(info);
    };

    return (
        <div className="container mx-auto p-4">
            <div>
                <PromoSubscription />
            </div>
            <div className="gap-8 mt-10">
                <div>
                    <div className="bg-white rounded-lg shadow-lg p-6 mb-8 ">
                        <h2 className="text-2xl font-bold text-indigo-800 mb-4">Buscar Itinerários</h2>
                        <SearchForm onSearch={handleSearch} />
                    </div>

                    <ItineraryList itineraries={itineraries} onSelect={handleSelect} />

                    {selected && !reservationInfo && (
                        <div className="mt-6">
                            <ReservationForm itinerary={selected} onSuccess={handleReservation} />
                        </div>
                    )}

                    {reservationInfo && (
                        <div className="mt-6 p-6 bg-green-100 rounded-lg shadow">
                            <h2 className="text-xl font-semibold text-green-800">Reserva Criada!</h2>
                            <p className="mt-2"><strong>ID:</strong> {reservationInfo.reservaId}</p>
                            <p className="mt-2">
                                <strong>Link de Pagamento:</strong>{' '}
                                <a
                                    href={reservationInfo.paymentLink}
                                    className="text-blue-600 hover:text-blue-800 underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {reservationInfo.paymentLink}
                                </a>
                            </p>
                        </div>
                    )}
                </div>


            </div>
        </div>
    );
}

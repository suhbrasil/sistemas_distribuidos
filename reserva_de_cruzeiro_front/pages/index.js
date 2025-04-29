import { useState } from 'react';
import SearchForm from '../components/SearchForm';
import ItineraryList from '../components/ItineraryList';
import ReservationForm from '../components/ReservationForm';

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
            <h1 className="text-2xl font-bold mb-4">Buscar Itinerários</h1>
            <SearchForm onSearch={handleSearch} />
            <ItineraryList itineraries={itineraries} onSelect={handleSelect} />
            {selected && !reservationInfo && (
                <ReservationForm itinerary={selected} onSuccess={handleReservation} />
            )}
            {reservationInfo && (
                <div className="mt-4 p-4 bg-green-100 rounded">
                    <h2 className="text-xl font-semibold">Reserva Criada!</h2>
                    <p>ID: {reservationInfo.reservaId}</p>
                    <p>
                        Link de Pagamento:{' '}
                        <a
                            href={reservationInfo.paymentLink}
                            className="text-blue-600 underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Pagar Agora
                        </a>
                    </p>
                </div>
            )}
        </div>
    );
}

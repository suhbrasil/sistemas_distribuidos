import { useState, useEffect } from 'react';
import SearchForm from '../components/SearchForm';
import ItineraryList from '../components/ItineraryList';
import ReservationForm from '../components/ReservationForm';
import PromoSubscription from '../components/PromoSubscription';

export default function Home() {
    const [itineraries, setItineraries] = useState([]);
    const [selected, setSelected] = useState(null);
    const [reservationInfo, setReservationInfo] = useState(null);
    const [reservationStatus, setReservationStatus] = useState(null);
    const [status, setStatus] = useState(null);

    // Add new useEffect to listen for reservation status updates
    useEffect(() => {
        // const eventSource = new EventSource(`http://localhost:3000/notifications/${clientId}`);
        if (reservationInfo?.reservaId) {
            const eventSource = new EventSource(`http://localhost:3000/notifications/${reservationInfo.reservaId}`);

            eventSource.addEventListener('reservation_status', (event) => {
                const status = JSON.parse(event.data);
                setReservationStatus(status);
            });

            return () => {
                eventSource.close();
            };
        }
    }, [reservationInfo]);

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
        console.log(info);
    };

    const handleCancel = async () => {
        try {
            const res = await fetch(`http://localhost:3000/reservas/${reservationInfo.reservaId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setStatus({ message: 'Reserva cancelada com sucesso!' });
                setId('');
            } else {
                setStatus({ error: 'Erro ao cancelar a reserva.' });
            }
        } catch (error) {
            setStatus({ error: 'Erro ao cancelar a reserva.' });
        }
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
                        <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-lg">
                            <h2 className="text-xl font-bold text-indigo-800 mb-4">Status da Reserva</h2>
                            <div className="space-y-4">
                                <div className="bg-white p-4 rounded-lg shadow border border-indigo-100">
                                    <p className="mt-2"><strong>ID da Reserva:</strong> {reservationInfo.reservaId}</p>
                                    {reservationStatus && (
                                        <>
                                            <p className="mt-2"><strong>Status:</strong> {reservationStatus.status}</p>
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
                                            {reservationStatus.status !== 'CANCELLED' && (
                                                <button
                                                    type="button"
                                                    onClick={handleCancel}
                                                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                                >
                                                    Cancelar Reserva
                                                </button>
                                            )}
                                        </>
                                    )}

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

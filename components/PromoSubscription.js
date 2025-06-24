import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function PromoSubscription() {
    const [destinations, setDestinations] = useState([]);
    const [submitted, setSubmitted] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [clientId] = useState(() => uuidv4());

    useEffect(() => {
        // Conecta ao SSE quando o componente monta
        const eventSource = new EventSource(`http://localhost:3000/notifications/${clientId}`);

        eventSource.onmessage = (event) => {
            console.log('Received message:', event.data);
        };

        eventSource.addEventListener('promotion', (event) => {
            const promotions = JSON.parse(event.data);
            // Se recebemos um array de promoções
            if (Array.isArray(promotions)) {
                const timestamp = new Date();
                const newNotifications = promotions.map(promotion => ({
                    type: 'promotion',
                    data: promotion,
                    id: uuidv4(),
                    timestamp
                }));
                setNotifications(prev => [...prev, ...newNotifications]);
            }
        });

        // Limpa a conexão quando o componente desmonta
        return () => {
            eventSource.close();
        };
    }, [clientId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`http://localhost:3000/interests/${clientId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    destinations: destinations
                }),
            });

            if (response.ok) {
                setSubmitted(true);
            } else {
                throw new Error('Falha ao registrar interesses');
            }
        } catch (error) {
            console.error('Erro ao salvar inscrição:', error);
        }
    };

    const handleUnsubscribe = async () => {
        try {
            const response = await fetch(`http://localhost:3000/interests/${clientId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setSubmitted(false);
                setNotifications([]);
                setDestinations([]);
            } else {
                throw new Error('Falha ao cancelar inscrição');
            }
        } catch (error) {
            console.error('Erro ao cancelar inscrição:', error);
        }
    };

    const handleDestinationToggle = (destination) => {
        setDestinations(prev =>
            prev.includes(destination)
                ? prev.filter(d => d !== destination)
                : [...prev, destination]
        );
    };

    const availableDestinations = [
        "Búzios",
        "João Pessoa",
        "Ilha Bela"
    ];

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-lg shadow-lg mx-auto my-8">
            <h2 className="text-xl font-bold text-indigo-800 mb-6">
                Receba notificações de promoções!
            </h2>

            {submitted ? (
                <div className="space-y-4">
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-medium">Inscrição realizada com sucesso!</p>
                                <p className="text-sm">Você receberá notificações de promoções para os destinos selecionados.</p>
                            </div>
                            <button
                                onClick={handleUnsubscribe}
                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                            >
                                Cancelar Inscrição
                            </button>
                        </div>
                    </div>

                    {notifications.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Promoções Disponíveis</h3>
                            <div className="space-y-2">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className="bg-white p-4 rounded-lg shadow border border-indigo-100"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium">
                                                    {notification.data.destination}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Cruzeiro: {notification.data.cruiseId}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Navio: {notification.data.shipName}
                                                </p>
                                                <p className="text-sm text-green-600 font-semibold">
                                                    Preço: R$ {notification.data.pricePerPerson}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Destinos de interesse
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {availableDestinations.map(destination => (
                                <label
                                    key={destination}
                                    className={`
                                        flex items-center p-3 rounded-lg cursor-pointer transition-colors
                                        ${destinations.includes(destination)
                                            ? 'bg-indigo-100 border-indigo-300'
                                            : 'bg-white border-gray-200'}
                                        border hover:bg-indigo-50
                                    `}
                                >
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-4 w-4 text-indigo-600"
                                        checked={destinations.includes(destination)}
                                        onChange={() => handleDestinationToggle(destination)}
                                    />
                                    <span className="ml-2 text-sm">{destination}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors duration-200"
                        disabled={destinations.length === 0}
                    >
                        Inscrever-se
                    </button>
                </form>
            )}
        </div>
    );
}

import { useState } from 'react';

export default function ReservationForm({ itinerary, onSuccess }) {
    const [passengers, setPassengers] = useState(1);
    const [cabins, setCabins] = useState(1);
    const [comprador, setComprador] = useState({ nome: '', email: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('http://localhost:3000/reservas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cruiseId: itinerary.cruiseId,
                embarkDate: itinerary.embarkDate,
                passengers: Number(passengers),
                cabins: Number(cabins),
                valor: itinerary.pricePerPerson,
                moeda: 'BRL',
                comprador: comprador,
            }),
        });
        const data = await res.json();
        onSuccess(data);
    };

    return (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 p-4 bg-gray-50 rounded">
            <h3 className="text-xl font-semibold">Nova Reserva</h3>
            <div>
                <label className="block mb-1">Passageiros</label>
                <input
                    type="number"
                    min="1"
                    value={passengers}
                    onChange={(e) => setPassengers(e.target.value)}
                    className="w-full border rounded p-2"
                    required
                />
            </div>
            <div>
                <label className="block mb-1">Cabines</label>
                <input
                    type="number"
                    min="1"
                    value={cabins}
                    onChange={(e) => setCabins(e.target.value)}
                    className="w-full border rounded p-2"
                    required
                />
            </div>
             <div>
                <label className="block mb-1">Nome do comprador</label>
                <input
                    type="text"
                    value={comprador.nome}
                    onChange={(e) =>
                        setComprador({ ...comprador, nome: e.target.value })
                    }
                    className="w-full border rounded p-2"
                    required
                />
            </div>
            <div>
                <label className="block mb-1">Email do comprador</label>
                <input
                    type="email"
                    value={comprador.email}
                    onChange={(e) =>
                        setComprador({ ...comprador, email: e.target.value })
                    }
                    className="w-full border rounded p-2"
                    required
                />
            </div>
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded">
                Confirmar Reserva
            </button>
        </form>
    );
}

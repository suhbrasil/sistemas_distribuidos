import { useState } from 'react';

export default function StatusChecker() {
    const [id, setId] = useState('');
    const [status, setStatus] = useState(null);

    const handleCheck = async (e) => {
        e.preventDefault();
        const res = await fetch(`http://localhost:3000/reservas/${id}`, {
            method: 'GET',
        });
        if (res.ok) {
            const data = await res.json();
            setStatus(data);
        } else {
            setStatus({ error: 'Reserva não encontrada.' });
        }
    };

    const handleCancel = async () => {
        try {
            const res = await fetch(`http://localhost:3000/reservas/${id}`, {
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
        <form onSubmit={handleCheck} className="space-y-4">
            <div>
                <label className="block mb-1">ID da Reserva</label>
                <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full border rounded p-2"
                    required
                />
            </div>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">
                Consultar
            </button>
            {status && (
                <div className="mt-4 p-4 border rounded bg-gray-100">
                    {status.error ? (
                        <p className="text-red-600">{status.error}</p>
                    ) : status.message ? (
                        <p className="text-green-600">{status.message}</p>
                    ) : (
                        <>
                            <p><strong>Status:</strong> {status.status}</p>
                            {status.ticketId && <p><strong>Bilhete:</strong> {status.ticketId}</p>}
                            {status.status !== 'CANCELLED' && (
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
            )}
        </form>
    );
}

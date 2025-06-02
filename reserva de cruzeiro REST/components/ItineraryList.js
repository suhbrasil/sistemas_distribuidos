export default function ItineraryList({ itineraries, onSelect }) {
    if (!itineraries.length) return null;
    return (
        <div className="space-y-4">
            {itineraries.map((it) => (
                <div key={it.cruiseId} className="p-4 border rounded">
                    <h2 className="font-semibold">{it.shipName}</h2>
                    <p>
                        {it.embarkPort} → {it.disembarkPort}
                    </p>
                    <p>Duração: {it.duration} noites</p>
                    <p>Preço por pessoa: R$ {it.pricePerPerson}</p>


                    {/* New field: visitedPlaces */}
                    <div className="mt-2">
                        <p className="font-medium">Lugares visitados:</p>
                        <ul className="list-disc list-inside">
                            {it.visitedPlaces.map((place) => (
                                <li key={place}>{place}</li>
                            ))}
                        </ul>
                    </div>

                    <button
                        onClick={() => onSelect(it)}
                        className="mt-2 px-3 py-1 bg-green-600 text-white rounded"
                    >
                        Reservar
                    </button>
                </div>
            ))}
        </div>
    );
}

import { useState } from 'react';

export default function SearchForm({ onSearch }) {
  const [destination, setDestination] = useState('');
  const [embarkDate, setEmbarkDate] = useState('');
  const [embarkPort, setEmbarkPort] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({ destination, embarkDate, embarkPort });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-6">
      <div>
        <label className="block mb-1">Destino</label>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>
      <div>
        <label className="block mb-1">Data de Embarque</label>
        <input
          type="date"
          value={embarkDate}
          onChange={(e) => setEmbarkDate(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block mb-1">Porto de Embarque</label>
        <input
          type="text"
          value={embarkPort}
          onChange={(e) => setEmbarkPort(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
        Buscar
      </button>
    </form>
  );
}

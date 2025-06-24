import { useState } from 'react';
import StatusChecker from '../components/StatusChecker';

export default function StatusPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Consultar Status de Reserva</h1>
      <StatusChecker />
    </div>
  );
}

const { signPayload } = require('./sign');
const { QUEUE_APPROVED, QUEUE_REJECTED } = require('./config');

/**
 * Simula a validação de pagamento.
 * Aqui você pode integrar com gateway real ou lógica de negócio.
 */
function validatePayment(reserva) {
  // Exemplo: aprovar se valor < 1000, senão recusar
  return reserva.valorPorPessoa * reserva.quantidadeCabines < 1000;
}

async function handleReservation(reserva, channel) {
  const isApproved = validatePayment(reserva);
  const outputQueue = isApproved ? QUEUE_APPROVED : QUEUE_REJECTED;

  // Monta objeto de resposta
  const response = {
    reservaId: reserva.id,
    status: isApproved ? 'APROVADO' : 'RECUSADO',
    timestamp: new Date().toISOString(),
  };

  // Assina o objeto
  const signed = signPayload(response);

  // Publica na fila adequada
  channel.sendToQueue(
    outputQueue,
    Buffer.from(JSON.stringify(signed)),
    { persistent: true }
  );
  console.log(`[+] Pagamento ${response.status} para reserva ${reserva.id}`);
}

module.exports = { handleReservation };

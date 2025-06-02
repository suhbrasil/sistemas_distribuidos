// ticket/processor.js
const { randomUUID }   = require('crypto');
// const { verifyPayload } = require('./verify');
const { QUEUE_OUT, EXCHANGE_NAME }     = require('./config');

/**
 * Recebe o objeto de pagamento-aprovado e
 * publica um bilhete na fila bilhete-gerado.
 */
async function handlePaymentApproval(msg, channel) {
  // 1) Verifica assinatura
//   const valid = await verifyPayload(msg);
//   if (!valid) {
//     throw new Error('Assinatura inválida em pagamento-aprovado');
//   }

  // 2) Gera o bilhete (dados mínimos)
  const ticket = {
    ticketId:    randomUUID(),
    reservaId:   msg.reservaId,
    issuedAt:    new Date().toISOString(),
    // você pode adicionar mais campos (assentos, cliente, etc.)
  };

  // 3) Publica na fila
  channel.publish(
    EXCHANGE_NAME,
    QUEUE_OUT,
    Buffer.from(JSON.stringify(ticket)),
    { persistent: true }
  );

  console.log(`[+] Bilhete gerado (${ticket.ticketId}) para reserva ${msg.reservaId}`);
}

module.exports = { handlePaymentApproval };

const { randomUUID }   = require('crypto');
const { QUEUE_OUT, EXCHANGE_NAME }     = require('./config');

async function handlePaymentApproval(msg, channel) {

  // Gera o bilhete (dados mínimos)
  const ticket = {
    ticketId:    randomUUID(),
    reservaId:   msg.reservaId,
    issuedAt:    new Date().toISOString(),
  };

  // Publica na fila
  channel.publish(
    EXCHANGE_NAME,
    QUEUE_OUT,
    Buffer.from(JSON.stringify(ticket)),
    { persistent: true }
  );

  console.log(`[>] Bilhete gerado (${ticket.ticketId}) para reserva ${msg.reservaId}`);
}

module.exports = { handlePaymentApproval };

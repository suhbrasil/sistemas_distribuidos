const { signPayload } = require('./sign');
const { QUEUE_APPROVED, QUEUE_REJECTED, EXCHANGE_NAME } = require('./config');

/**
 * Simula a validação de pagamento.
 * Aqui foi colocado somente a validacão se o pagamento é maior do que zero.
 * ver se precisa de outra validação
 */
function validatePayment(reserva) {
    return reserva.valorPorPessoa > 0;
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
    const signed = await signPayload(response);


    // Publica na fila de pagamentos aprovados ou recusados

    channel.publish(
        EXCHANGE_NAME,
        outputQueue,
        Buffer.from(JSON.stringify(signed)),
        { persistent: true }
    );

    console.log(`[+] Pagamento ${response.status} para reserva ${reserva.id}`);
}

module.exports = { handleReservation };

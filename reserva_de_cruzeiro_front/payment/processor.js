const { signPayload } = require('./sign');
const { QUEUE_APPROVED, QUEUE_REJECTED, EXCHANGE_NAME } = require('./config');


/**
 * Valida os campos da reserva antes de aprovar o pagamento:
 *  - embarkDate deve ser hoje ou no futuro
 *  - passengers deve ser integer > 0
 *  - cabins deve ser integer > 0
 */
function validatePayment(reserva) {
    // 1) Checa data de embarque
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const embark = new Date(reserva.embarkDate);
    if (isNaN(embark.getTime()) || embark < today) {
        console.warn(`[!] Data inválida: ${reserva.embarkDate}`);
        return false;
    }

    // 2) Checa número de passageiros
    if (!Number.isInteger(reserva.passengers) || reserva.passengers <= 0) {
        console.warn(`[!] Passengers inválido: ${reserva.passengers}`);
        return false;
    }

    // 3) Checa número de cabines
    if (!Number.isInteger(reserva.cabins) || reserva.cabins <= 0) {
        console.warn(`[!] Cabins inválido: ${reserva.cabins}`);
        return false;
    }

    return true;
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

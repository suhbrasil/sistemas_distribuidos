// Gerencia conexões SSE e interesses dos clientes
const clients = new Map(); // clientId -> response
const clientInterests = new Map(); // clientId -> Set of destinations

function addClient(clientId, response) {
    // Configura headers para SSE
    response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Mantém a conexão viva
    const keepAlive = setInterval(() => {
        response.write(':\n\n'); // comentário SSE para keep-alive
    }, 30000);

    // Limpa recursos quando cliente desconecta
    response.on('close', () => {
        clearInterval(keepAlive);
        clients.delete(clientId);
        clientInterests.delete(clientId);
        console.log(`[SSE] Cliente ${clientId} desconectado`);
    });

    clients.set(clientId, response);
    console.log(`[SSE] Cliente ${clientId} conectado`);
}

function registerInterests(clientId, destinations) {
    clientInterests.set(clientId, new Set(destinations));
    console.log(`[SSE] Interesses registrados para cliente ${clientId}:`, destinations);
}

function unregisterInterests(clientId) {
    const removed = clientInterests.delete(clientId);
    console.log(`[SSE] Interesses removidos para cliente ${clientId}`);
    return removed;
}

function notifyClient(clientId, event, data) {
    const client = clients.get(clientId);
    if (client) {
        client.write(`event: ${event}\n`);
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

function notifyPromotion(promotions) {
    // Para cada cliente conectado
    for (const [clientId, interests] of clientInterests.entries()) {
        // Filtra as promoções apenas para os destinos de interesse deste cliente específico
        const clientPromotions = promotions.filter(promo =>
            interests.has(promo.destination)
        );

        // Só notifica se houver promoções para os destinos de interesse do cliente
        if (clientPromotions.length > 0) {
            notifyClient(clientId, 'promotion', clientPromotions);
        }
    }
}

function notifyReservationStatus(reservationId, status, ticketId) {
    // Notifica apenas o cliente específico da reserva
    const client = clients.get(reservationId);
    if (client) {
        client.write(`event: reservation_status\n`);
        client.write(`data: ${JSON.stringify({ reservationId, status, ticketId })}\n\n`);
        console.log(`[SSE] Notificação de status enviada para reserva ${reservationId}: ${status}`);
    }
}

module.exports = {
    addClient,
    registerInterests,
    unregisterInterests,
    notifyPromotion,
    notifyReservationStatus
};

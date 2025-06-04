// reservation/index.js
const express = require('express');
const cors = require('cors');
const amqp = require('amqplib/callback_api');
const { v4: uuidv4 } = require('uuid');
const {
    RABBITMQ_URL,
    EXCHANGE_NAME,
    QUEUE_CREATE_RESERVATION,
    QUEUE_CANCEL_RESERVATION,
    QUEUE_APPROVED,
    QUEUE_REJECTED,
    QUEUE_TICKET
} = require('./config');
const { addClient, registerInterests, notifyPromotion, notifyReservationStatus } = require('./notifications');
const { normalizeDestination } = require('../utils');
// const { verifyPayload } = require('./verify');
const fetch = require('node-fetch');

// allow your frontend origin
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3001' }));

// Armazena reservas em memória
const reservations = new Map();

// Conecta ao RabbitMQ
amqp.connect(RABBITMQ_URL, (error0, conn) => {
    if (error0) {
        throw error0;
    }
    conn.createChannel((error1, ch) => {
        if (error1) {
            throw error1;
        }

        // Declara o direct exchange
        ch.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

        //
        // 1) Endpoints HTTP
        //

        // Consultar itinerários (nova implementação)
        app.get('/itinerarios', async (request, response) => {
            const { destination, embarkDate, embarkPort } = request.query;

            if (!destination && !embarkDate && !embarkPort) {
                return response.status(400).json({ error: '[*] Parâmetros de consulta inválidos' });
            }

            // Monta query string
            const params = new URLSearchParams({ destination, embarkDate, embarkPort });

            try {
                // Faz a requisição para o MS Itinerários (ajuste porta se necessário)
                const res = await fetch(`http://localhost:4000/itinerarios?${params.toString()}`);
                if (!res.ok) {
                    return response.status(502).json({ error: '[*] Erro ao consultar itinerários' });
                }
                const data = await res.json();
                return response.status(200).json(data);
            } catch (err) {
                console.error('[*] Erro ao consultar MS Itinerários:', err);
                return response.status(500).json({ error: '[*] Erro interno ao consultar itinerários' });
            }
        });

        // Criar reserva
        app.post('/reservas', async (req, res) => {
            const { cruiseId, embarkDate, passengers, cabins, value, currency, buyer } = req.body;
            if (!cruiseId || !embarkDate || !passengers || !cabins || !value || !currency || !buyer) {
                return res.status(400).json({ error: '[*] Campos faltando' });
            }
            const id = uuidv4();
            const r = { id, cruiseId, embarkDate, passengers, cabins, value, currency, buyer, status: 'PENDING' };
            reservations.set(id, r);

            // Publica evento reserva-criada
            ch.publish(
                EXCHANGE_NAME,
                QUEUE_CREATE_RESERVATION,
                Buffer.from(JSON.stringify(r)),
                { persistent: true }
            );
            console.log(`[*] Publicado reserva-criada: ${id}`);

            // Chama o MS Pagamento para obter o link
            try {
                const resp = await fetch('http://localhost:4001/pagamento', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reservaId: id,
                        value,
                        currency,
                        buyer
                    })
                });
                if (!resp.ok) {
                    throw new Error('[*] Falha ao solicitar link de pagamento');
                }
                const { paymentLink, transactionId } = await resp.json();

                r.transactionId = transactionId;

                return res.status(201).json({ reservaId: id, paymentLink });
            } catch (err) {
                console.error('[*] Erro ao integrar com MS Pagamento:', err);
                // Ainda retorna a reserva criada, mas sem link
                return res.status(201).json({ reservaId: id, paymentLink: null, error: '[*] Erro ao solicitar pagamento' });
            }
        });

        // Consultar status da reserva
        app.get('/reservas/:id', (req, res) => {
            const r = reservations.get(req.params.id);
            if (!r) return res.status(404).json({ error: '[*] Reserva não encontrada' });
            res.json(r);
        });

        // Cancelar reserva
        app.delete('/reservas/:id', (req, res) => {
            const id = req.params.id;
            const r = reservations.get(id);

            if (!r) {
                return res.status(404).json({ error: '[*] Reserva não encontrada' });
            }

            // Publica evento reserva-cancelada
            ch.publish(
                EXCHANGE_NAME,
                QUEUE_CANCEL_RESERVATION,
                Buffer.from(JSON.stringify(r)),
                { persistent: true }
            );
            console.log(`[*] Publicado reserva-cancelada: ${id}`);


            r.status = 'CANCELLED';

            return res.status(200).json({ message: 'Reserva cancelada com sucesso' });
        });

        // Endpoint SSE para notificações
        app.get('/notifications/:clientId', (req, res) => {
            const clientId = req.params.clientId;
            addClient(clientId, res);
        });

        // Endpoint para registrar interesse em promoções
        app.post('/interests/:clientId', (req, res) => {
            const { clientId } = req.params;
            const { destinations } = req.body;

            if (!destinations || !Array.isArray(destinations)) {
                return res.status(400).json({ error: '[*] Destinos inválidos' });
            }

            registerInterests(clientId, destinations);

            // Cria uma única fila para o cliente
            const queueName = `promocoes_${clientId}`;

            // Primeiro, garante que a fila existe
            ch.assertQueue(queueName, {
                exclusive: true
            }, (error, q) => {
                if (error) {
                    console.error('[*] Erro ao criar fila:', error);
                    return res.status(500).json({ error: '[*] Erro ao criar fila de promoções' });
                }

                // Bind a fila ao exchange com a routing key 'promocoes'
                ch.bindQueue(q.queue, EXCHANGE_NAME, 'promocoes', {}, (bindError) => {
                    if (bindError) {
                        console.error('[*] Erro ao fazer bind da fila:', bindError);
                        return res.status(500).json({ error: '[*] Erro ao configurar fila de promoções' });
                    }

                    // Consome mensagens da fila
                    ch.consume(q.queue, (msg) => {
                        if (msg !== null) {
                            try {
                                const promotions = JSON.parse(msg.content.toString());

                                // Filtra promoções apenas para os destinos de interesse do cliente
                                const clientPromotions = promotions.filter(promo => {
                                    const match = destinations.some(dest =>
                                        normalizeDestination(dest) === normalizeDestination(promo.destination)
                                    );
                                    return match;
                                });

                                if (clientPromotions.length > 0) {
                                    notifyPromotion(clientPromotions);
                                }
                            } catch (error) {
                                console.error('[*] Erro ao processar mensagem:', error);
                            }
                            ch.ack(msg);
                        }
                    }, { noAck: false });

                    res.status(200).json({
                        message: '[*] Interesses registrados com sucesso',
                        queueName: queueName
                    });
                });
            });
        });

        // Inicia HTTP
        const PORT = 3000;
        app.listen(PORT, () => console.log(`[*] MS Reserva na porta ${PORT}`));



        // pagamento-aprovado / pagamento-recusado / bilhete-gerado / reserva-cancelada
        [QUEUE_APPROVED, QUEUE_REJECTED, QUEUE_TICKET].forEach(queue => {
            // Garante fila e bind ao exchange usando routing key = nome da fila
            ch.assertQueue(queue, { durable: true });
            ch.bindQueue(queue, EXCHANGE_NAME, queue);

            ch.prefetch(1);

            ch.consume(
                queue,
                async msg => {
                    if (!msg) return ch.ack(msg);
                    let data;
                    try {
                        data = JSON.parse(msg.content.toString());
                    } catch {
                        console.error('[*] Payload inválido em', queue);
                        return ch.ack(msg);
                    }

                    // Atualiza estado local da reserva
                    const r = reservations.get(data.reservaId);
                    if (r) {
                        if (queue === QUEUE_APPROVED) {
                            r.status = 'PAID';
                        } else if (queue === QUEUE_REJECTED) {
                            r.status = 'CANCELLED';
                            // Publica evento reserva-cancelada
                            ch.publish(
                                EXCHANGE_NAME,
                                QUEUE_CANCEL_RESERVATION,
                                Buffer.from(JSON.stringify(r)),
                                { persistent: true }
                            );
                            console.log(`[*] Publicado reserva-cancelada: ${r.id}`);
                        } else if (queue === QUEUE_TICKET) {
                            r.status = 'APPROVED';
                            r.ticketId = data.ticketId;
                        }

                        // Notifica o cliente sobre a mudança de status
                        notifyReservationStatus(r.id, r.status);

                        console.log(`[*] Reserva ${r.id} atualizada: ${r.status}`);
                    }

                    ch.ack(msg);
                },
                { noAck: false }
            );
        });
    });
});

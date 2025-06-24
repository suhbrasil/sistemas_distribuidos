const express = require('express');
const cors = require('cors');
const amqp = require('amqplib/callback_api');
const { RABBITMQ_URL,
    EXCHANGE_NAME,
    QUEUE_CREATE_RESERVATION,
    QUEUE_CANCEL_RESERVATION,
    PORT
} = require('./config');
let cruises = require('./cruises.json');

const app = express();
app.use(cors({ origin: '*' })); // Libera para outros MSs
app.use(express.json());

// Expoe GET /itinerarios
app.get('/itinerarios', (req, res) => {
    const { destination, embarkDate, embarkPort } = req.query;
    const filtered = cruises.filter(cruise =>
        (!destination || cruise.visitedPlaces.includes(destination)) &&
        (!embarkDate || cruise.embarkDate === embarkDate) &&
        (!embarkPort || cruise.embarkPort === embarkPort &&
            cruise.cabinsAvailable > 0)
    );
    res.json(filtered);
});

// Inicia a API e o consumidor RabbitMQ
app.listen(PORT, () => {
    console.log('[-] MS Itinerários na porta', PORT);

    amqp.connect(RABBITMQ_URL, (err0, conn) => {
        if (err0) throw err0;
        conn.createChannel((err1, ch) => {
            if (err1) throw err1;
            ch.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

            [QUEUE_CREATE_RESERVATION, QUEUE_CANCEL_RESERVATION].forEach(queue => {
                ch.assertQueue(queue, { durable: true });

                const routingKey = queue === QUEUE_CANCEL_RESERVATION ? 'reserva-cancelada' : 'reserva-criada';
                ch.bindQueue(queue, EXCHANGE_NAME, routingKey);

                ch.consume(
                    queue,
                    async msg => {
                        if (!msg) return ch.ack(msg);
                        try {
                            const data = JSON.parse(msg.content.toString());
                            const { cruiseId, cabins } = data;

                            const cruise = cruises.find(c => c.cruiseId === cruiseId);
                            if (cruise) {
                                if (queue === QUEUE_CANCEL_RESERVATION) {
                                    cruise.cabinsAvailable += Number(cabins);
                                } else {
                                    cruise.cabinsAvailable -= Number(cabins);
                                }
                            } else {
                                console.log(`[*] Cruzeiro ${cruiseId} não encontrado`);
                            }
                        } catch (error) {
                            console.error(`[*] Erro ao processar mensagem:`, error);
                        }
                        ch.ack(msg);
                    },
                    { noAck: false }
                );
            });
        });
    });
});

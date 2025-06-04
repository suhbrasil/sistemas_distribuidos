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

            // Consome reserva-criada
            ch.assertQueue(QUEUE_CREATE_RESERVATION, { durable: true });
            ch.bindQueue(QUEUE_CREATE_RESERVATION, EXCHANGE_NAME, 'reserva-criada');

            // Processa 1 mensagem por vez
            ch.prefetch(1);


            ch.consume(
                QUEUE_CREATE_RESERVATION,
                msg => {
                    if (!msg) return;

                    const { cruiseId, cabins } = JSON.parse(msg.content.toString());

                    const cruise = cruises.find(c => c.cruiseId === cruiseId);
                    if (cruise) cruise.cabinsAvailable -= Number(cabins);

                    ch.ack(msg);
                },
                { noAck: false }
            );

            //   // Consome reserva-cancelada
            //   ch.assertQueue(QUEUE_CANCEL_RESERVATION, { durable: true });
            //   ch.bindQueue(QUEUE_CANCEL_RESERVATION, EXCHANGE_NAME, QUEUE_CANCEL_RESERVATION);
            //   ch.consume(QUEUE_CANCEL_RESERVATION, msg => {
            //     const { cruiseId, cabins } = JSON.parse(msg.content.toString());
            //     const cruise = cruises.find(c => c.cruiseId === cruiseId);
            //     if (cruise) cruise.cabinsAvailable += Number(cabins);
            //     ch.ack(msg);
            //   });
        });
    });
});

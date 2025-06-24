const amqp = require('amqplib/callback_api');
const fs = require('fs');
const path = require('path');
const { RABBITMQ_URL, EXCHANGE_NAME } = require('./config');

const promosPath = path.join(__dirname, 'promo.json');
const promos = JSON.parse(fs.readFileSync(promosPath, 'utf-8'));

amqp.connect(RABBITMQ_URL, (err0, connection) => {
    if (err0) throw err0;

    connection.createChannel((err1, channel) => {
        if (err1) throw err1;

        channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

        // Publica todas as promoções em uma única mensagem
        const routingKey = 'promocoes';
        channel.publish(
            EXCHANGE_NAME,
            routingKey,
            Buffer.from(JSON.stringify(promos)),
            { persistent: true }
        );

        console.log(`[Marketing] Promoções publicadas na fila '${routingKey}'`);

        setTimeout(() => {
            connection.close();
            process.exit(0);
        }, 500);
    });
});

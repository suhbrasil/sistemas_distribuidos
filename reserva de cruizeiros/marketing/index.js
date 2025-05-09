//marketing/index.js

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

    promos.forEach((promo) => {
      const routingKey = `promo_${promo.destination}`;
      const promoContent = JSON.stringify(promo);

      channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(promoContent));
      console.log(`Promo published to '${routingKey}': ${promoContent}`);
    });

    setTimeout(() => {
      connection.close();
      process.exit(0);
    }, 500); 
  });
});


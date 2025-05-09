// node subscriber/subscriber.js [promo_destination<X>] [promo_destination<Y>]

var amqp = require('amqplib/callback_api');

var { RABBITMQ_URL, EXCHANGE_NAME } = require('./config');

var args = process.argv.slice(2);

if (args.length == 0) {
  console.log("Usage: subscriber.js [promo_destination<X>] [promo_destination<Y>]");
  process.exit(1);
}

amqp.connect('amqp://localhost', (error0, connection) => {
    if (error0) {
        throw error0;
    }

    connection.createChannel( function (error1, channel) {
        if (error1) {
            throw error1;
        }

        channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

        channel.assertQueue('', {
            exclusive: true
        }, function (error2, q) {
            if (error2) {
                throw error2;
            }

            console.log(" [*] Waiting for promos. To exit press CTRL+C");

            args.forEach(function (promo) {
                channel.bindQueue(q.queue, EXCHANGE_NAME, promo);
            });

            channel.consume(q.queue, function (msg) {
                console.log(" [x] Received %s: %s", msg.fields.routingKey, msg.content.toString());
            }, {
                noAck: true
            });
        });   
    });
});
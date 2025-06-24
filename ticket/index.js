// ticket/index.js
const amqp = require('amqplib/callback_api');
const {
  RABBITMQ_URL,
  QUEUE_IN,
  EXCHANGE_NAME
} = require('./config');
const { handlePaymentApproval } = require('./processor');

amqp.connect(RABBITMQ_URL, (err0, connection) => {
  if (err0) {
    console.error('[>] Erro ao conectar RabbitMQ:', err0);
    process.exit(1);
  }

  connection.createChannel((err1, channel) => {
    if (err1) {
      console.error('[>] Erro ao criar canal:', err1);
      process.exit(1);
    }

    channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

    // Garante filas
    channel.assertQueue(QUEUE_IN,  { durable: true });
    channel.bindQueue(QUEUE_IN, EXCHANGE_NAME, 'pagamento-aprovado');


    channel.prefetch(1);

    console.log(`[>] MS Bilhete aguardando em ${QUEUE_IN} (exchange=${EXCHANGE_NAME})...`);

    channel.consume(
      QUEUE_IN,
      msg => {
        if (!msg) return;
        let data;
        try {
          data = JSON.parse(msg.content.toString());
        } catch {
          console.error('[>] Payload não é JSON válido');
          channel.ack(msg);
          return;
        }

        handlePaymentApproval(data, channel)
          .then(() => channel.ack(msg))
          .catch(err => {
            console.error('[>] Falha ao processar pagamento-aprovado:', err);
            // Ack mesmo em erro para não bloquear a fila
            channel.ack(msg);
          });
      },
      { noAck: false }
    );
  });
});

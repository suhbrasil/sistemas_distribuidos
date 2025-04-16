const amqp = require('amqplib/callback_api');
const {
  RABBITMQ_URL, QUEUE_IN, QUEUE_APPROVED, QUEUE_REJECTED
} = require('./config');
const { handleReservation } = require('./processor');


// Conecta ao RabbitMQ usando callbacks
amqp.connect(RABBITMQ_URL, (err0, connection) => {
    if (err0) {
      console.error('Falha ao conectar no RabbitMQ:', err0);
      process.exit(1);
    }

    // Cria canal via callback
    connection.createChannel((err1, channel) => {
      if (err1) {
        console.error('Falha ao criar canal:', err1);
        process.exit(1);
      }

      // Garante existência das filas
      channel.assertQueue(QUEUE_IN, { durable: true });
      channel.assertQueue(QUEUE_APPROVED, { durable: true });
      channel.assertQueue(QUEUE_REJECTED, { durable: true });

      // Processa 1 mensagem por vez
      channel.prefetch(1);

      console.log(`[*] MS Pagamento aguardando em ${QUEUE_IN}...`);

      // Consome mensagens
      channel.consume(
        QUEUE_IN,
        msg => {
          if (!msg) return;

          const data = JSON.parse(msg.content.toString());

          // Chama seu handler baseado em Promise
          handleReservation(data, channel)
            .then(() => {
              channel.ack(msg);
            })
            .catch(err => {
              console.error('Erro ao processar reserva:', err);
              // se quiser: channel.nack(msg, false, false);
            });
        },
        { noAck: false }
      );
    });
  });

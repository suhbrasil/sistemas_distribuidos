// reservation/config.js
module.exports = {
    RABBITMQ_URL: 'amqp://localhost',
    EXCHANGE_NAME: 'cruise-direct',

    QUEUE_OUT: 'reserva-criada',       // routing key / fila de saída
    // filas que este MS ouvirá :
    QUEUE_APPROVED: 'pagamento-aprovado',
    QUEUE_REJECTED: 'pagamento-recusado',
    QUEUE_TICKET:   'bilhete-gerado',
    PAYMENT_PUBLIC_JWK_PATH:
      __dirname + '/../payment/keys/public.jwk.json', // JWK público do MS Pagamento
  };

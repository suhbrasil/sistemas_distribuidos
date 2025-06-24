// reservation/config.js
module.exports = {
    RABBITMQ_URL: 'amqp://localhost',
    EXCHANGE_NAME: 'cruise-direct',

    QUEUE_CREATE_RESERVATION: 'reserva-criada',       // routing key / fila de saída
    // filas que este MS ouvirá :
    QUEUE_APPROVED: 'pagamento-aprovado',
    QUEUE_REJECTED: 'pagamento-recusado',
    QUEUE_TICKET:   'bilhete-gerado',
    QUEUE_CANCEL_RESERVATION: 'reserva-cancelada',
    PAYMENT_PUBLIC_JWK_PATH:
      __dirname + '/../payment/keys/public.jwk.json', // JWK público do MS Pagamento
  };

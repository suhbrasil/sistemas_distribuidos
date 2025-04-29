
module.exports = {
    RABBITMQ_URL: 'amqp://localhost',
    QUEUE_IN: 'pagamento-aprovado',    // fila que escutamos
    QUEUE_OUT: 'bilhete-gerado',       // onde publicaremos o bilhete
    EXCHANGE_NAME: 'cruise-direct',
    PAYMENT_PUBLIC_JWK_PATH:
      __dirname + '/../payment/keys/public.jwk.json', // JWK público do MS Pagamento
  };

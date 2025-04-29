module.exports = {
    RABBITMQ_URL: 'amqp://localhost',
    QUEUE_IN: 'reserva-criada', // fila onde o MS Pagamento escuta novas reservas
    QUEUE_APPROVED: 'pagamento-aprovado',
    QUEUE_REJECTED: 'pagamento-recusado', // filas para resultados assinados
    EXCHANGE_NAME: 'cruise-direct',
    PRIVATE_KEY_PATH: __dirname + '/keys/private.jwk.json',
  };

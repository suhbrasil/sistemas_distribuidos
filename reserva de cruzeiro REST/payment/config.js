module.exports = {
    RABBITMQ_URL: 'amqp://localhost',
    // Cada MS consumidor está declarando uma fila exclusiva, mas todas bindadas no exchange com a mesma routing key (reserva-criada).
    // para evitar conflito que estava acontecendo
    QUEUE_IN: 'reserva-criada-pagamento',
    QUEUE_APPROVED: 'pagamento-aprovado',
    QUEUE_REJECTED: 'pagamento-recusado', // filas para resultados assinados
    EXCHANGE_NAME: 'cruise-direct',
    PRIVATE_KEY_PATH: __dirname + '/keys/private.jwk.json',
  };

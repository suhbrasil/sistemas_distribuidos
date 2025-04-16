// sendTest.js
const amqp = require('amqplib');

async function test() {
  // conecta ao RabbitMQ em localhost
  const conn = await amqp.connect('amqp://localhost');
  const ch = await conn.createChannel();

  // garante que a fila exista
  await ch.assertQueue('reserva-criada', { durable: true });

  // envia uma reserva de teste
  const reservaTeste = {
    id: 'abc123',
    valorPorPessoa: 200,
    quantidadeCabines: 2
  };
  ch.sendToQueue('reserva-criada', Buffer.from(JSON.stringify(reservaTeste)), {
    persistent: true
  });

  console.log('[>] Mensagem de teste enviada:', reservaTeste);

  // fecha conexão após meio segundo
  setTimeout(() => conn.close(), 500);
}

test().catch(console.error);

// reservation/index.js
const express = require('express');
const cors    = require('cors');
const amqp    = require('amqplib/callback_api');
const { v4: uuidv4 } = require('uuid');
const {
  RABBITMQ_URL,
  EXCHANGE_NAME,
  QUEUE_OUT,
  QUEUE_APPROVED,
  QUEUE_REJECTED,
  QUEUE_TICKET
} = require('./config');
const { verifyPayload } = require('./verify');

const cruises = require('./data/cruises.json');

const app = express();
app.use(express.json());

// allow your frontend origin
app.use(cors({ origin: 'http://localhost:3001' }));
app.use(express.json());

// Armazena reservas em memória
const reservations = new Map();

// Conecta ao RabbitMQ
amqp.connect(RABBITMQ_URL, (error0, conn) => {
    if (error0) {
        throw error0;
    }
  conn.createChannel((error1, ch) => {
    if (error1) {
        throw error1;
    }

    // Declara o direct exchange
    ch.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

    //
    // 1) Endpoints HTTP
    //

    // Listar itinerários
    app.get('/itinerarios', (request, response) => {
      const { destination, embarkDate, embarkPort } = request.query;

      if(!destination && !embarkDate && !embarkPort) {
        return response.status(400).json({ error: 'Parâmetros de consulta inválidos' });
      }

      const filteredCruises = cruises.filter(cruise => {
        return (
          cruise.visitedPlaces.includes(destination) &&
          cruise.embarkDate === embarkDate &&
          cruise.embarkPort === embarkPort
        );
      });

      response.status(200).json(filteredCruises);
    });

    // Criar reserva
    app.post('/reservas', (req, res) => {
      const { cruiseId, embarkDate, passengers, cabins } = req.body;
      if (!cruiseId || !embarkDate || !passengers || !cabins) {
        return res.status(400).json({ error: 'Campos faltando' });
      }
      const id = uuidv4();
      const r = { id, cruiseId, embarkDate, passengers, cabins, status: 'PENDING' };
      reservations.set(id, r);

      // Publica evento reserva-criada
      ch.publish(
        EXCHANGE_NAME,
        QUEUE_OUT,
        Buffer.from(JSON.stringify(r)),
        { persistent: true }
      );
      console.log(`[>] Publicado reserva-criada: ${id}`);

      // Retorna link de pagamento
      const paymentLink = `http://localhost:3001/pagamento/${id}`;
      res.status(201).json({ reservaId: id, paymentLink });
    });

    // Consultar status da reserva
    app.get('/reservas/:id', (req, res) => {
      const r = reservations.get(req.params.id);
      if (!r) return res.status(404).json({ error: 'Reserva não encontrada' });
      res.json(r);
    });

    // Inicia HTTP
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`MS Reserva na porta ${PORT}`));

    //
    // 2) Subscriber: pagamento-aprovado / pagamento-recusado / bilhete-gerado
    //

    [QUEUE_APPROVED, QUEUE_REJECTED, QUEUE_TICKET].forEach(queue => {
      // Garante fila e bind ao exchange usando routing key = nome da fila
      ch.assertQueue(queue, { durable: true });
      ch.bindQueue(queue, EXCHANGE_NAME, queue);

      ch.consume(
        queue,
        async msg => {
          if (!msg) return ch.ack(msg);
          let data;
          try {
            data = JSON.parse(msg.content.toString());
          } catch {
            console.error('Payload inválido em', queue);
            return ch.ack(msg);
          }

          // Verifica assinatura nos eventos de pagamento
          if (queue === QUEUE_APPROVED || queue === QUEUE_REJECTED) {
            const ok = await verifyPayload(data);
            if (!ok) {
              console.error('Assinatura inválida em', queue, data);
              return ch.ack(msg);
            }
          }

          // Atualiza estado local da reserva
          const r = reservations.get(data.reservaId);
          if (r) {
            if (queue === QUEUE_APPROVED) {
              r.status = 'PAID';
            } else if (queue === QUEUE_REJECTED) {
              r.status = 'CANCELLED';
            } else if (queue === QUEUE_TICKET) {
              r.status = 'APPROVED';
              r.ticketId = data.ticketId;
            }
            console.log(`[<] Reserva ${r.id} atualizada: ${r.status}`);
          }

          ch.ack(msg);
        },
        { noAck: false }
      );
    });
  });
});

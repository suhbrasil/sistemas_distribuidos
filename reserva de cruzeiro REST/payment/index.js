const express = require('express');
const cors = require('cors');
const amqp = require('amqplib/callback_api');
const {
    RABBITMQ_URL, QUEUE_IN, QUEUE_APPROVED, QUEUE_REJECTED, EXCHANGE_NAME
} = require('./config');
const fetch = require('node-fetch');
const { signPayload } = require('./sign');

const app = express();
// app.use(cors({ origin: '*' })); // Libera para outros MSs
app.use(express.json());


let channelAmqp;



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

        channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

        // Garante existência das filas
        channel.assertQueue(QUEUE_IN, { durable: true });
        // Bind com routing key 'reserva-criada'
        channel.bindQueue(QUEUE_IN, EXCHANGE_NAME, 'reserva-criada');

        // Processa 1 mensagem por vez
        channel.prefetch(1);

        console.log(`[*] MS Pagamento aguardando em ${QUEUE_IN} (exchange=${EXCHANGE_NAME})...`);

        // Consome mensagens
        channel.consume(
            QUEUE_IN,
            msg => {
                if (!msg) return;

                try {
                    const reserva = JSON.parse(msg.content.toString());
                    // Aqui só loga/valida se quiser, NÃO publica na fila!
                    console.log('[>] MS Pagamento recebeu reserva:', reserva.id);
                    // Você pode registrar em memória/DB se quiser.
                } catch (err) {
                    console.error('Erro ao processar reserva:', err);
                }
                channel.ack(msg);
            },
            { noAck: false }
        );

        channelAmqp = channel;
    });
});


// Endpoint para o MS Reserva solicitar o link de pagamento
app.post('/pagamento', async (req, res) => {
    const { reservaId, valor, moeda, comprador } = req.body;

    if (!reservaId || !valor || !moeda || !comprador || !comprador.nome || !comprador.email) {
        return res.status(400).json({ error: 'Campos faltando ou inválidos.' });
    }

    try {
        // Chama o sistema externo de pagamento
        const resp = await fetch('http://localhost:4002/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservaId, valor, moeda, comprador }),
        });
        const { paymentLink, transactionId } = await resp.json();

        // Retorna o link ao cliente (MS Reserva)
        return res.status(201).json({ paymentLink, transactionId });
    } catch (err) {
        console.error('Erro ao consultar sistema de pagamento externo:', err);
        return res.status(500).json({ error: 'Erro ao solicitar pagamento externo' });
    }
});

//  Endpoint para receber webhook do sistema externo
app.post('/webhook', (req, res) => {
    const { transactionId, reservaId, status, valor, moeda, comprador } = req.body;
    console.log("[+] MS Pagamento recebeu resposta do sistema externo:", req.body);

    const response = {
        reservaId,
        transactionId,
        status: status === 'autorizado' ? 'APROVADO' : 'RECUSADO',
        valor,
        moeda,
        comprador,
        timestamp: new Date().toISOString(),
    };

    const queue = (status === 'autorizado') ? QUEUE_APPROVED : QUEUE_REJECTED;


    channelAmqp.publish(
        EXCHANGE_NAME,
        queue,
        Buffer.from(JSON.stringify(response)),
        { persistent: true }
    );


    console.log(`[+] Pagamento ${ response.status } para reserva ${ reservaId }`);


    res.json({ ok: true });
});

// Sobe a API REST
const PORT = 4001;
app.listen(PORT, () => {
    console.log('MS Pagamento REST na porta', PORT);
});

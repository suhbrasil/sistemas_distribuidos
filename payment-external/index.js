const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());


// Endpoint para criar pagamento
app.post('/pay', (req, res) => {
  // Recebe dados da requisição (ex: valor, cliente, etc)
  const { reservaId, value, currency, buyer } = req.body;
  const transactionId = Math.random().toString(36).substr(2, 9);

  // Responde ao MS Pagamento com um link fake
  const paymentLink = `http://localhost:4002/pagamento/${transactionId}`;
  res.json({ paymentLink, transactionId });

  // Simula processamento do pagamento (1-2 segundos) e faz webhook
  setTimeout(() => {
    const status = (value > 0 && currency === 'BRL') ? 'autorizado' : 'recusado';

    const payload = {
      transactionId,
      reservaId,
      status,
      value,
      currency,
      buyer,
    };

    // Envia POST para o webhook do MS Pagamento
    fetch('http://localhost:4001/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .catch(err => console.error('Erro ao enviar webhook:', err));
  }, 2000); // 2s de delay para simular processamento
});

app.listen(4002, () => {
  console.log('Sistema de Pagamento Externo na porta 4002');
});

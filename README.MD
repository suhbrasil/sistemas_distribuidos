# Payment
- rodar node keygen.js para gerar as chaves publica e privada 
- rodar node index.js
- Deverá aparecer "[*] MS Pagamento aguardando em reserva-criada (exchange=cruise-direct)..."
- Deve ser iniciado primeiro

# Ticket
- rodar index.js
- Deverá aparecer "[*] MS Bilhete aguardando em pagamento-aprovado (exchange=cruise-direct)..."
- Deve ser iniciado depois do payment

# Reservation
- rodar npm install express amqplib uuid js-crypto-rsa e npm init -y
- rodar node index.js
- Deve ser iniciado apenas depois de já ter iniciado o payment e o ticket
- Abrir postman ou outra consulta de endpoint:
    - Método POST na url "http://localhost:3000/reservas" para criar uma reserva, exemplo de body:
    {
        "cruiseId":    "cruzeiro-123",
        "embarkDate":  "2025-06-01",
        "passengers":  2,
        "cabins":      1
    }
    - Método GET na url http://localhost:3000/reservas/{reservaId} para consultar o andamento da reserva e as informacoes dela

# Subscriber
- rodar node subscriber.js promo_destinationX promo_destinationY ...
    - para se inscrever nas promoçoes de destinos desejados

# Marketing
- rodar node promogen.js
- rodar index.js
- Deverá aparecer a lista de promos publicadas "Promo published to 'promo_destinationX': promo"

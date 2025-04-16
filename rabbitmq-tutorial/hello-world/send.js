// Requisitando a biblioteca
var amqp = require('amqplib/callback_api');

// Conectando com o RabbitMQ server
amqp.connect('amqp://localhost', function(error0, connection) {});

// Criar um canal onde a maior parte da API que faz as coisas funcionarem fica
amqp.connect('amqp://localhost', function(error0, connection) {
    if (error0) {
      throw error0;
    }
    connection.createChannel(function(error1, channel) {});
  });

//   Para enviar, nós temos que declarar uma fila para nós para enviar para ela, depois podemos publicar uma mensagem para a fila
//  A fila só vai ser criada se já não existir. O conteúdo da mensagem é uma array de bytes, então podemos fazer o encode de qualquer coisa lá
amqp.connect('amqp://localhost', function(error0, connection) {
    if (error0) {
        throw error0;
    }
    connection.createChannel(function(error1, channel) {
        if (error1) {
        throw error1;
        }
        var queue = 'hello';
        var msg = 'Hello world';

        channel.assertQueue(queue, {
        durable: false
        });

        channel.sendToQueue(queue, Buffer.from(msg));
        console.log(" [x] Sent %s", msg);

        // Fechar a conexão e sair
        setTimeout(function() {
            connection.close();
            process.exit(0)
        }, 500);
    });
});

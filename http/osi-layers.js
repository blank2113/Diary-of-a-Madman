const net = require('node:net');   // Модуль для работы напрямую с 4-м уровнем (TCP)
const http = require('node:http'); // Модуль для работы на 7-м прикладном уровне (HTTP)

// 1. Мы можем опуститься на уровень TCP. 
// Здесь нет понятий req.body или req.url, здесь есть только сырой поток байт (Socket)
const tcpServer = net.createServer((socket) => {
  socket.on('data', (rawBytes) => {
    console.log('Прилетели сырые байты по TCP:', rawBytes);
  });
});
tcpServer.listen(4000); // Слушаем порт (Абстракция 4-го уровня)

// 2. А можем работать на уровне HTTP. 
// Node.js под капотом сам заберет байты из TCP-сокета, распарсит их через llhttp 
// и выдаст нам удобные текстовые абстракции:
const httpServer = http.createServer((req, res) => {
  console.log(req.method);  // GET (Прикладной уровень)
  console.log(req.headers); // Заголовки (Прикладной уровень)

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
});
httpServer.listen(3000);
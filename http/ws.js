
const http = require('node:http');
const crypto = require('node:crypto');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Для связи используйте WebSocket клиент (ws://localhost:8080)');
});

// Перехватываем низкоуровневое событие апгрейда протокола в Node.js
server.on('upgrade', (req, socket, head) => {
  // Проверяем, что клиент запрашивает именно WebSocket
  if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request');
    return;
  }

  // 1. Извлекаем ключ клиента из заголовков
  const clientKey = req.headers['sec-websocket-key'];

  // 2. Спецификация RFC 6455: конкатенируем ключ с магической константой-GUID
  const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

  // 3. Вычисляем криптографический SHA-1 хэш и кодируем в Base64
  const acceptKey = crypto
    .createHash('sha1')
    .update(clientKey + MAGIC_STRING)
    .digest('base64');

  // 4. Формируем сырой текстовый HTTP-ответ для переключения протоколов
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n' // Пустая строка-разделитель, завершающая секцию заголовков
  ];

  // Пишем ответ напрямую в открытый TCP сокет
  socket.write(responseHeaders.join('\r\n'));
  console.log('🎉 Полнодуплексный WebSocket канал успешно установлен напрямую через TCP сокет!');

  // Теперь сокет работает в режиме чтения бинарных WebSocket фреймов
  socket.on('data', (buffer) => {
    console.log('Получены сырые бинарные фреймы из WS-канала:', buffer);
    // Для чтения сообщения здесь необходим побайтовый разбор маски фрейма (Payload Masking)
  });

  socket.on('end', () => console.log('Клиент закрыл WebSocket соединение'));
});

server.listen(8080, () => {
  console.log('🚀 WebSocket Upgrade сервер запущен на порту 8080');
});
const http = require('node:http');

// Кастомный агент для пулинга HTTP/1.1 соединений
const customAgent = new http.Agent({
  keepAlive: true,        // Не закрывать TCP-сокет после завершения ответа
  maxSockets: 10,         // Максимальное количество параллельных сокетов на один домен
  keepAliveMsecs: 1000    // Каждые 1 сек слать TCP Keep-Alive пакеты для проверки сокета
});

// Запрос с использованием пула сокетов
http.get({
  hostname: 'google.com',
  port: 80,
  path: '/',
  agent: customAgent // Передаем наш пул
}, (res) => {
  console.log(res);
});
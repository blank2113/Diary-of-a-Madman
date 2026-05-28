const http = require('node:http');

const server = http.createServer((req, res) => {
  const allowedOrigin = '[https://my-trusted-frontend.com](https://my-trusted-frontend.com)';

  // 1. Динамическая конфигурация CORS
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // Разрешаем передачу кук/сессий через CORS

  // 2. Перехват и обработка Preflight запроса браузера (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' }); // Кэшируем Preflight на 24 часа
    return res.end();
  }

  // 3. Внедрение фундаментальных заголовков безопасности (OWASP Top 10)

  // Принудительный HTTPS на 1 год (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Ограничение источников контента (CSP). Разрешаем скрипты только с текущего домена
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';");

  // Запрет встраивания сайта в iframe сторонних ресурсов (Защита от Clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // Запрет браузеру угадывать MIME-тип файла (Защита от Sniffing атак, когда картинка маскируется под JS)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Управление заголовком Referer ради конфиденциальности пользователей
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Имитация роутинга бизнес-логики
  if (req.url === '/api/secure-data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: "success", data: "Данные под надежной защитой заголовков" }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(3000, () => {
  console.log('🚀 Безопасный сетевой сервер запущен на порту 3000');
});
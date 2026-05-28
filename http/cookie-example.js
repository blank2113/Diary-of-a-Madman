const http = require('node:http');
const crypto = require('node:crypto');

// Имитируем базу данных сессий в памяти бэкенда
const sessionStore = new Map();

const server = http.createServer((req, res) => {
  // 1. Парсинг входящей строки заголовка Cookie
  const rawCookies = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    rawCookies.split('; ').map(cookie => {
      const parts = cookie.split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );

  const sessionId = cookies['SESSION_ID'];
  let session = sessionStore.get(sessionId);

  // 2. Аутентификация: если сессии нет — создаем новую
  if (!session) {
    const newSessionId = crypto.randomUUID();
    session = { userId: 101, role: 'admin', username: 'blank2113' };
    sessionStore.set(newSessionId, session);

    // 3. Формируем заголовок Set-Cookie с флагами защиты уровня Enterprise
    res.setHeader('Set-Cookie', [
      `SESSION_ID=${newSessionId}`,
      'HttpOnly',         // Иммунитет к XSS
      'Secure',           // Передача только по HTTPS
      'SameSite=Strict',  // Иммунитет к CSRF
      'Path=/',           // Доступность на всем домене
      'Max-Age=3600'      // Время жизни — 1 час
    ].join('; '));
  }

  // Возвращаем данные сессии клиенту
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    message: "Сессия успешно валидирована",
    isNewSession: !sessionId,
    session
  }));
});

server.listen(3000, () => {
  console.log('🚀 Высокоточный HTTP сервер запущен на порту 3000');
});
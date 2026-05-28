# 🛜 Протоколы соединения (Connection Protocols)

В этом разделе представлен глубокий технический разбор сетевых протоколов, архитектурных компромиссов при их выборе, а также практические аспекты обеспечения безопасности, отказоустойчивости и производительности Node.js бэкенда.

---

## 1. HTTP/HTTPS: Жизненный цикл, кастомные заголовки и сессии

### 🔄 Анатомия запроса и ответа (Connection Lifecycle)
Когда бэкенд на Node.js обрабатывает запрос, под капотом происходит сложная цепочка событий на уровне ядра ОС и библиотеки `libuv`:

1.  **Выделение сокета**: Операционная система регистрирует входящее соединение и выделяет файловый дескриптор (сокет).
2.  **Парсинг потока (Stream Parsing)**: Node.js получает сетевые данные не целиком, а чанками (кусками байт) через `Readable Stream`. Встроенный в Node.js парсер (`llhttp`), написанный на C, считывает байты из буфера, парсит заголовки и конструирует объекты `req` (`IncomingMessage`) и `res` (`ServerResponse`).
3.  **Конвейер Middleware**: Объекты передаются в приложение (Express, Fastify, NestJS), где последовательно обрабатываются бизнес-логикой.

### 📝 Практический пример: Собственная сессионная система на Node.js (без библиотек)

Пример HTTP-сервера, который вручную парсит заголовки кук, управляет сессиями в памяти и защищает сессионные данные с помощью флагов безопасности OWASP:

```javascript
const http = require('node:http');
const crypto = require('node:crypto');

// Сессионное хранилище в RAM (В продакшене здесь должен быть Redis)
const sessionStore = new Map();

const server = http.createServer((req, res) => {
  // 1. Ручной парсинг заголовка Cookie
  const rawCookies = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    rawCookies.split('; ').map(cookie => {
      const parts = cookie.split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );

  const sessionId = cookies['SESSION_ID'];
  let session = sessionStore.get(sessionId);

  // 2. Если сессии нет — создаем новую (Имитация авторизации)
  if (!session) {
    const newSessionId = crypto.randomUUID();
    session = { userId: 42, username: 'blank2113', createdAt: Date.now() };
    sessionStore.set(newSessionId, session);

    // 3. Установка Куки с флагами защиты
    res.setHeader('Set-Cookie', [
      `SESSION_ID=${newSessionId}`,
      'HttpOnly',          // Защита от XSS (JS на фронтенде не сможет прочитать куку)
      'Secure',            // Кука передается только по зашифрованному HTTPS
      'SameSite=Strict',   // Защита от CSRF атак
      'Max-Age=3600'       // Время жизни куки — 1 час
    ].join('; '));
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: "Welcome back!", session }));
});

server.listen(3000, () => console.log('Auth server running on port 3000'));
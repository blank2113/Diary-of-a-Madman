const http2 = require('node:http2');
const fs = require('node:fs');

// Для HTTP/2 браузеры требуют обязательного SSL шифрования
const server = http2.createSecureServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
});

server.on('stream', (stream, headers) => {
  const method = headers[':method'];
  const path = headers[':path'];

  if (method === 'GET' && path === '/api/performance') {
    // Вместо res.writeHead используется stream.respond
    stream.respond({
      'content-type': 'application/json; charset=utf-8',
      ':status': 200
    });

    stream.end(JSON.stringify({
      protocol: "HTTP/2",
      multiplexed: true,
      note: "Все ресурсы летят параллельно по одному TCP сокету"
    }));
  } else {
    stream.respond({ ':status': 404 });
    stream.end('Not Found');
  }
});

server.listen(8443, () => console.log('🚀 HTTP/2 Server on https://localhost:8443'));
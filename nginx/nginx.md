[Назад к Сети](../networks/networks.md)  

[Назад к главному файлу 🗂️](../README.md)


# 🤖 **Nginx: Архитектура, Проксирование и Оптимизация**

**Nginx (Engine X)** — это высокопроизводительный HTTP-сервер, обратный прокси-сервер (Reverse Proxy), балансировщик нагрузки и почтовый прокси. Созданный в 2004 году Игорем Сысоевым, Nginx разрабатывался как решение **«проблемы C10k»** — задачи одновременного обслуживания 10 000 и более параллельных соединений при минимальном потреблении ресурсов.

Сегодня Nginx является стандартом индустрии для раздачи статического контента (HTML, CSS, JS, изображения), терминации SSL/TLS и маршрутизации трафика к бэкенд-приложениям (например, Node.js/NestJS).

---

## 1. Архитектура Nginx: Почему он такой быстрый?

Главный секрет производительности Nginx кроется в его **событийно-ориентированной (Event-driven) асинхронной архитектуре**.

В отличие от классических веб-серверов (например, Apache), которые на каждое новое подключение пользователя создают отдельный поток ОС (Thread-per-connection) и быстро упираются в лимиты памяти и контекстные переключения процессора, Nginx работает иначе:



* **Master-процесс (Управляющий):** Запускается под правами `root`. Он считывает и валидирует конфигурационные файлы, открывает сетевые порты и управляет рабочими процессами.
* **Worker-процессы (Рабочие):** Запускаются под низкопривилегированным пользователем (обычно `nginx` или `www-data`). Их количество в конфиге настраивается равным числу ядер процессора (`worker_processes auto;`).
* **Асинхронный Event Loop (Цикл событий):** Каждый Worker-процесс работает в один поток и обрабатывает тысячи соединений одновременно. Когда клиент делает запрос, Worker не ждет, пока диск прочитает файл или бэкенд вернет ответ — он вешает системное событие (через `epoll` в Linux или `kqueue` в macOS) и мгновенно переключается на обслуживание следующего клиента. Как только данные готовы, система уведомляет Worker, и он отправляет их пользователю.

---

## 2. Основные концепции конфигурации

Конфигурация Nginx хранится в файле `nginx.conf` и имеет иерархическую структуру блоков (директив):

```nginx
user www-data;
worker_processes auto; # Автоматически по числу ядер CPU

events {
    worker_connections 1024; # Сколько соединений может держать один Worker
}

http {
    # Блок для настройки L7 веб-трафика
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Подключаем конфигурации отдельных сайтов
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

## 3. Практические сценарии использования (Готовые конфиги)

### Сценарий А: Раздача SPA (React / Vue) с поддержкой HTML5 History API

Для Single Page Applications критически важно, чтобы при обновлении страницы по адресу вроде mysite.com/profile Nginx не выдавал ошибку 404, а перенаправлял запрос на index.html, отдавая роутинг на откуп JavaScript.

```nginx
server {
    listen 80;
    server_name mysite.com [www.mysite.com](https://www.mysite.com);

    # Путь к собранному фронтенду (dist/build)
    root /var/www/my-spa-app;
    index index.html;

    location / {
        # try_files проверяет существование файла и папки на диске.
        # Если их нет ($uri не найден), он принудительно отдает index.html
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статических ассетов для ускорения загрузки
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### Сценарий Б: Reverse Proxy для Node.js (NestJS) с веб-сокетами и SSL
В продакшене Node.js прячут за Nginx. Nginx берет на себя расшифровку SSL-трафика, сжатие gzip и проброс реальных IP-адресов клиентов внутрь приложения.

```nginx
# Описываем пул наших Node.js серверов (в данном случае один инстанс)
upstream nestjs_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name api.mysite.com;
    # Редирект с HTTP на HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2; # Слушаем HTTPS и включаем поддержку HTTP/2
    server_name api.mysite.com;

    # Настройка SSL сертификатов (например, Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/[api.mysite.com/fullchain.pem](https://api.mysite.com/fullchain.pem);
    ssl_certificate_key /etc/letsencrypt/live/[api.mysite.com/privkey.pem](https://api.mysite.com/privkey.pem);
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Включаем сжатие ответов для экономии трафика
    gzip on;
    gzip_types application/json text/plain;

    location / {
        # Перенаправляем трафик на наш upstream
        proxy_pass http://nestjs_backend;

        # Пробрасываем оригинальные заголовки клиента, чтобы NestJS их видел
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Настройки для поддержки WebSockets (если используются в NestJS)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Тайм-ауты для долгих соединений (например, SSE или WS)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```


## 4. Оптимизация и безопасность в Nginx

Для защиты Node.js приложения от перегрузок и злоумышленников, в Nginx стоит настроить базовые лимиты:

Ограничение частоты запросов (Rate Limiting)
Помогает защитить эндпоинты авторизации или API от brute-force атак и парсеров.

```nginx
http {
    # Создаем зону памяти 'api_limit' размером 10МБ, лимит — 5 запросов в секунду с одного IP
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=5r/s;

    server {
        listen 80;
        
        location /api/v1/auth/ {
            # Применяем лимит. burst=10 позволяет временно накопить до 10 запросов в очереди
            limit_req zone=api_limit burst=10 nodelay;
            proxy_pass http://nestjs_backend;
        }
    }
}
```

## Скрытие версии Nginx

По умолчанию Nginx пишет свою версию в заголовках ответов (например, Server: nginx/1.18.0) и на страницах стандартных ошибок. Это упрощает хакерам поиск известных уязвимостей. Скрыть версию можно одной директивой в блоке http

```nginx
http {
    server_tokens off; # Убирает цифры версии из заголовков и ошибок
}
```


## Сводная шпаргалка: Команды управления Nginx
* nginx -t — Самая важная команда. Проверяет конфигурационные файлы на наличие синтаксических ошибок. Всегда запускайте её перед перезапуском!

* sudo systemctl reload nginx (или nginx -s reload) — Перезагружает конфигурацию на лету. Master-процесс перечитывает конфиг и плавно завершает старые Worker-процессы только после того, как они дообслужат текущих клиентов. Ноль дропнутых пакетов.

* sudo systemctl restart nginx — Полная жесткая перезагрузка процесса с разрывом текущих сетевых соединений (использовать с осторожностью).
---
<br>
<br>

> Когда нужно на одном домене совместить и раздачу фронтенд-сайта (например, собранного на React/Vue), и проксирование запросов к бэкенд-API (например, на NestJS), используется разделение по путям (маршрутам) через блоки location.

### Вот готовый, чистый пример конфигурации для Nginx. Обычно все запросы к API помечают префиксом /api, а всё остальное отдают под фронтенд.


```nginx
# 1. Описываем пул бэкенд-серверов (наш NestJS API)
upstream nestjs_api {
    server 127.0.0.1:3000; # Node.js приложение слушает этот порт локально
}

server {
    listen 80;
    server_name mysite.com www.mysite.com;

    # Общий корень на диске, где лежит собранный фронтенд (index.html, js, css)
    root /var/www/my-frontend-site/dist;
    index index.html;

    # -----------------------------------------------------------------
    # СЦЕНАРИЙ 1: Раздача сайта (Фронтенд)
    # -----------------------------------------------------------------
    # Этот блок ловит все стандартные запросы (/, /about, /profile и т.д.)
    location / {
        # try_files критически важен для SPA (React/Vue/Angular Router).
        # Если пользователь обновит страницу по адресу /profile, Nginx сначала 
        # поищет файл "profile" на диске. Не найдет его и принудительно отдаст index.html,
        # а JS-код внутри браузера уже сам поймет, какой роут отрисовать.
        try_files $uri $uri/ /index.html;
    }

    # Кэшируем статические файлы сайта, чтобы они загружались мгновенно
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # -----------------------------------------------------------------
    # СЦЕНАРИЙ 2: Проксирование API (Бэкенд)
    # -----------------------------------------------------------------
    # Этот блок перехватывает любые запросы, которые начинаются с /api/
    location /api/ {
        # Перенаправляем запрос на наш upstream (NestJS)
        proxy_pass http://nestjs_api;

        # Сбрасываем HTTP-версию для поддержки веб-сокетов или стабильного keep-alive
        proxy_http_version 1.1;

        # Пробрасываем заголовки, чтобы бэкенд знал реальный адрес клиента, а не думал,
        # что все запросы делает сам Nginx с адреса 127.0.0.1
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Если в NestJS используются веб-сокеты (например, Socket.io / Gateway)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### Как это работает для конечного пользователя:
* Пользователь вводит в браузере mysite.com/dashboard.

  * Nginx попадает в блок location /. На диске такого файла нет, срабатывает try_files, отдается index.html. Загружается интерфейс сайта.

* Интерфейс сайта (код React) делает асинхронный запрос fetch('/api/v1/users').

  * Браузер отправляет запрос на mysite.com/api/v1/users.

  * Nginx видит префикс /api/ и перенаправляет этот запрос "внутрь" сервера на порт 3000 в NestJS.

  * NestJS обрабатывает запрос, возвращает JSON, Nginx берет этот JSON и отдает обратно вашему React-приложению.


## [Продвинутый Nginx](./advance-ngnix.md)

[Назад к Сети](../networks/networks.md)  

[Назад к главному файлу 🗂️](../README.md)

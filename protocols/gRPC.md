[Назад к OSI 🌎](../osi/OSI.md)

[Назад к главному файлу 🗂️](../README.md)
# 🚀 **gRPC (Google Remote Procedure Call)**

**gRPC** — это современный высокопроизводительный фреймворк с открытым исходным кодом, разработанный компанией Google в 2015 году. Он предназначен для организации удаленного вызова процедур (RPC), позволяя клиентскому приложению напрямую вызывать методы на удаленном сервере так, как будто это локальный объект.

В отличие от классического REST API, который обменивается текстовыми JSON-данными поверх HTTP/1.1, gRPC спроектирован строго поверх протокола **HTTP/2** и использует бинарный формат сериализации данных **Protocol Buffers (Protobuf)**. Это делает его основным выбором для построения высоконагруженных микросервисных архитектур и организации межсервисного взаимодействия (East-West traffic).

---

## 1. Ключевые столпы gRPC

Высокая скорость и эффективность gRPC базируются на двух технологиях:

### 1. Protocol Buffers (Protobuf)
Вместо отправки текстового JSON с кучей повторяющихся ключей-строк, Protobuf преобразует данные в компактный бинарный поток. Контракт данных строго описывается в специальных `.proto` файлах.



### 2. Эксклюзивное использование HTTP/2
gRPC на полную мощность использует все преимущества протокола HTTP/2:
* **Мультиплексирование:** Открытие всего одного TCP-соединения, внутри которого одновременно и асинхронно летят сотни запросов и ответов (нет проблемы Head-of-Line Blocking на уровне HTTP).
* **Сжатие заголовков (HPACK):** Экономит сетевой трафик на метаданных.
* **Двунаправленный стриминг:** Возможность передавать данные потоками в обе стороны в рамках одного запроса.

---

## 2. Четыре типа взаимодействия в gRPC

gRPC предлагает гораздо более гибкие сценарии обмена данными, чем классическая схема REST «один запрос — один ответ»:



1. **Унарный (Unary RPC):** Классический вариант. Клиент отправляет один запрос и ждет от сервера один ответ (аналог стандартного REST-вызова).
2. **Серверный стриминг (Server Streaming RPC):** Клиент отправляет один запрос, а сервер в ответ открывает поток и присылает последовательность сообщений (например, стриминг логов или ленты уведомлений).
3. **Клиентский стриминг (Client Streaming RPC):** Клиент открывает поток и отправляет на сервер множество сообщений подряд, а сервер после обработки всего потока возвращает один финальный ответ (например, загрузка тяжелого файла чанками).
4. **Двунаправленный стриминг (Bidirectional Streaming RPC):** Обе стороны открывают потоки и могут асинхронно слать сообщения друг другу в любой последовательности без жесткого ожидания «запрос-ответ» (идеально для реалтайм-систем и чатов).

---

## 3. Сравнение: gRPC против REST (JSON)

| Критерий | REST API | gRPC |
| :--- | :--- | :--- |
| **Протокол** | HTTP/1.1 (реже HTTP/2) | **Строго HTTP/2** |
| **Формат данных** | JSON / XML (текст) | **Protocol Buffers (бинарный)** |
| **Связанность контракта** | Слабая (нужна Swagger/OpenAPI документация) | **Строгая (IDL на базе `.proto` файлов)** |
| **Генерация кода** | Через сторонние плагины | **Встроена из коробки** для большинства языков |
| **Стриминг** | Ограниченный (только от сервера через SSE) | **Полноценный во все стороны** (4 типа RPC) |
| **Браузерная поддержка** | Идеальная «из коробки» | Ограниченная (нужен прокси-слой `grpc-web`) |
| **Производительность** | Средняя | **Сверхвысокая** (минимальный CPU overhead и размер пакетов) |

---

## 4. Описание контракта: Пример `.proto` файла

В gRPC всё начинается с дизайна. Вы описываете схему данных, а специальный компилятор `protoc` автоматически генерирует нативные интерфейсы и классы для любого языка (TypeScript, Go, Python, Java).

```protobuf
syntax = "proto3";

package users;

// Описываем микросервис пользователей и его методы
service UserService {
  // Унарный метод: Получить пользователя по ID
  rpc GetUser (UserRequest) returns (UserResponse);
  
  // Серверный стриминг: Получить поток активных пользователей
  rpc StreamActiveUsers (Empty) returns (stream UserResponse);
}

// Структура входящего запроса
message UserRequest {
  int32 id = 1; // Цифра — это уникальный тег (номер поля) в бинарном пакете
}

// Структура ответа
message UserResponse {
  int32 id = 1;
  string name = 2;
  string email = 3;
  repeated string roles = 4; // Repeated означает массив строк
}

message Empty {}
```
---
<br>

## 5. Реализация на Node.js / TypeScript (Использование @grpc/grpc-js)
gRPC отлично поддерживается в Node.js и нативно интегрирован в фреймворк NestJS (модуль @nestjs/microservices).

Пример простейшего gRPC-клиента на TypeScript:

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@proto-loader';
import { join } from 'path';

// Загружаем наш .proto файл динамически
const PROTO_PATH = join(__dirname, './users.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const usersProto = grpc.loadPackageDefinition(packageDefinition).users as any;

// Создаем клиент для подключения к gRPC серверу
const client = new usersProto.UserService(
  'localhost:50051', // Адрес удаленного микросервиса
  grpc.credentials.createInsecure() // В локальной сети отключаем SSL для тестов
);

// Вызываем унарный метод
client.GetUser({ id: 42 }, (error: Error | null, response: any) => {
  if (error) {
    console.error('Ошибка вызова gRPC метода:', error);
    return;
  }
  console.log('Ответ от микросервиса пользователей:', response.name);
});
```

--- 
<br>

## 6. Проблема gRPC в браузере и настройка Envoy
Браузеры на сегодняшний день не имеют прямого низкоуровневого доступа к HTTP/2 фреймам. Браузерный JavaScript не может управлять внутренними механизмами gRPC-соединения. Из-за этого фронтенд-приложения (React/Vue) не могут напрямую отправить запрос к gRPC серверу.

Решение: Прокси-слой grpc-web и Envoy
Чтобы подружить фронтенд с gRPC, между ними ставят Envoy Proxy. Фронтенд шлет стандартный HTTP/1.1 JSON-запрос (или специальный grpc-web формат), а Envoy на лету транслирует его в чистокровный бинарный gRPC HTTP/2 и отправляет в сеть микросервисов.

Конфигурация фильтра Envoy для трансляции gRPC-Web:

```yml
static_resources:
  listeners:
  - name: grpc_web_listener
    address:
      socket_address: { address: 0.0.0.0, port_value: 8080 }
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": [type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager](https://type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager)
          stat_prefix: grpc_web_router
          route_config:
            name: local_route
            virtual_hosts:
            - name: local_service
              domains: ["*"]
              routes:
              - match: { prefix: "/" }
                route: { cluster: internal_grpc_backend, timeout: 0s }
          http_filters:
          # Этот встроенный фильтр Envoy автоматически превращает grpc-web запросы в стандартный gRPC
          - name: envoy.filters.http.grpc_web
            typed_config:
              "@type": [type.googleapis.com/envoy.extensions.filters.http.grpc_web.v3.GrpcWeb](https://type.googleapis.com/envoy.extensions.filters.http.grpc_web.v3.GrpcWeb)
          - name: envoy.filters.http.router
            typed_config:
              "@type": [type.googleapis.com/envoy.extensions.filters.http.router.v3.Router](https://type.googleapis.com/envoy.extensions.filters.http.router.v3.Router)

  clusters:
  - name: internal_grpc_backend
    connect_timeout: 0.25s
    type: LOGICAL_DNS
    # Говорим Envoy общаться с бэкендом строго по HTTP/2
    typed_extension_protocol_options:
      envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
        "@type": [type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions](https://type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions)
        explicit_http_config:
          http2_protocol_options: {}
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: internal_grpc_backend
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address: { address: user-service.local, port_value: 50051 }
```              

---
<br>

## Когда выбирать gRPC?
  * Вам необходимо связать множество внутренних микросервисов, написанных на разных языках (например, бэкенд на NestJS, сервис машинного обучения на Python и тяжелый процессинг на Go).

  * Сетевой трафик между серверами зашкаливает, и JSON начинает создавать бутылочное горлышко на этапе сериализации/десериализации.

  * Вам необходима строгая гарантия соблюдения контрактов API на уровне компиляции кода.

[Назад к OSI 🌎](../osi/OSI.md)

[Назад к главному файлу 🗂️](../README.md)
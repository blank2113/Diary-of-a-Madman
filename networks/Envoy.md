[Назад в Сети](./networks.md)
## **Envoy Proxy: Современный сервис-прокси для Cloud-Native и Mesh-архитектур**

**Envoy** — это высокопроизводительный распределенный прокси-сервер с открытым исходным кодом, написанный на C++. Он был разработан компанией Lyft в 2016 году, а сейчас является ключевым проектом фонда CNCF (Cloud Native Computing Foundation).

В отличие от классических Nginx и HAProxy, Envoy создавался специально для **облачных сред (Cloud-Native)**, крупных микросервисных архитектур и концепции **Service Mesh** (где он чаще всего выступает в роли Sidecar-прокси, например, в Istio).

---

### Архитектурные особенности Envoy

Envoy обладает рядом уникальных фич, которые отличают его от старых технологических стеков:

1. **Платформа для построения сетей, а не просто прокси:** Envoy спроектирован как расширяемая платформа. У него модульная система фильтров (L3/L4 и L7), а логику обработки трафика можно кастомизировать с помощью **WebAssembly (Wasm)** или скриптов Lua.
2. **Полностью динамическая конфигурация (xDS API):** Это главная фича Envoy. В Nginx или HAProxy при изменении списка серверов (upstream) нужно перезагружать конфигурацию (`nginx -s reload`). Envoy умеет обновлять настройки (роуты, бэкенды, SSL-сертификаты) **на лету без перезапуска процесса и потери соединений** через централизованное gRPC-API (сервисы Discovery: EDS, CDS, RDS, LDS).
3. **Первоклассная поддержка HTTP/3 и gRPC:** Envoy изначально проектировался с глубоким пониманием HTTP/2 и gRPC (двунаправленный стриминг), а также является одним из лидеров по стабильной реализации HTTP/3 (QUIC). Он умеет бесшовно транслировать gRPC в JSON HTTP/1.1 и обратно.
4. **Обсерваемость (Observability):** Envoy собирает невероятно детальную статистику (промах кэша, задержки, распределение пакетов) и имеет встроенную интеграцию с системами распределенного трассирования (Jaeger, Zipkin) и сбора метрик (Prometheus).

---

### Основные понятия конфигурации Envoy

Конфигурация Envoy (обычно пишется на YAML) базируется на следующих сущностях:

* **Listener (Слушатель):** Точка входа. Именованный сетевой адрес (например, IP и порт), который Envoy слушает для приема входящего трафика.
* **Filter Chains (Цепочки фильтров):** Набор правил обработки внутри Listener. Фильтры могут проверять заголовки, выполнять маршрутизацию, терминировать TLS или собирать метрики.
* **Route Configuration:** Правила, которые соотносят входящий HTTP-запрос (по путям, хостам или заголовкам) с конкретным кластером.
* **Cluster (Кластер):** Логическая группа бэкенд-серверов (endpoints), которые обрабатывают однотипный трафик (аналог `upstream` в Nginx или `backend` в HAProxy).
* **Endpoint:** Конкретный IP-адрес и порт инстанса вашего приложения в кластере.

---

### Практический пример: Envoy как L7 Edge-прокси (Reverse Proxy)

Ниже представлен базовый рабочий конфигурационный файл `envoy.yaml`. В этом сценарии Envoy слушает порт `10000`, принимает HTTPS-трафик, терминирует SSL и перенаправляет запросы к микросервису NestJS на основе путей.



```yaml
static_resources:
  listeners:
  - name: ingress_edge_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10000 # Порт, который слушает Envoy
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": [type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager](https://type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager)
          stat_prefix: ingress_http
          access_log:
          - name: envoy.access_loggers.stdout
            typed_config:
              "@type": [type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog](https://type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog)
          route_config:
            name: local_route
            virtual_hosts:
            - name: backend_services
              domains: ["*"]
              routes:
              # Правило 1: Отправляем запросы /api на кластер с NestJS
              - match:
                  prefix: "/api"
                route:
                  cluster: nestjs_api_cluster
                  timeout: 15s
              # Правило 2: Все остальные запросы шлем на фронтенд-статику
              - match:
                  prefix: "/"
                route:
                  cluster: static_frontend_cluster
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": [type.googleapis.com/envoy.extensions.filters.http.router.v3.Router](https://type.googleapis.com/envoy.extensions.filters.http.router.v3.Router)

  clusters:
  # Настройка кластера для NestJS
  - name: nestjs_api_cluster
    connect_timeout: 0.25s
    type: STRICT_DNS # Способ обнаружения эндпоинтов (резолв через DNS)
    lb_policy: ROUND_ROBIN # Алгоритм балансировки
    load_assignment:
      cluster_name: nestjs_api_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: api-node-1.local
                port_value: 3000
        - endpoint:
            address:
              socket_address:
                address: api-node-2.local
                port_value: 3000

  # Настройка кластера для Статики
  - name: static_frontend_cluster
    connect_timeout: 0.5s
    type: LOGICAL_DNS
    lb_policy: LEAST_REQUEST
    load_assignment:
      cluster_name: static_frontend_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: static-server.local
                port_value: 8080
```                


### Сравнение: Сводная таблица трех титанов проксирования

Чтобы окончательно закрыть тему прокси-серверов в вашей сетевой базе знаний, сравним **Nginx**, **HAProxy** и **Envoy**:

| Критерий | Nginx | HAProxy | Envoy |
| :--- | :--- | :--- | :--- |
| **Язык разработки** | C | C | C++11 |
| **Смена конфига** | Требует `reload` процесса | Требует `reload` процесса | **Полный рантайм на лету** через gRPC (xDS API) |
| **Раздача статики** | Отличная (лучшая на рынке) | Не умеет вообще | Не умеет (или через сложные хаки) |
| **Поддержка gRPC** | Базовая L7-маршрутизация | Отличная | **Максимальная интеграция** (проксирование, трансляция) |
| **Поддержка HTTP/3** | Доступна в свежих версиях | Доступна (в процессе стабилизации) | **Встроенная «из коробки»**, проверенная в бою |
| **Основной Use Case** | Веб-сервер, раздача SPA, Edge API-Gateway. | Тяжелая балансировка БД и классических монолитных HTTP-апстримов. | Cloud-Native архитектуры, Service Mesh, Kubernetes Ingress, gRPC API Gateway. |

### Когда выбирать Envoy?

* Ваша инфраструктура живет в **Kubernetes** и постоянно масштабируется (ноды динамически появляются и исчезают). Envoy автоматически подхватит изменения без дропов сетевых пакетов.

* Вы строите архитектуру на **gRPC-микросервисах** и вам нужна продвинутая трассировка запросов.

* Вам нужен умный **Service Mesh** (внутренняя сеть общения между микросервисами), где каждый сервис имеет свой "секретарь-прокси" (Sidecar pattern).

[Назад в Сети](./networks.md)
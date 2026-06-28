## Как пользоваться

1. Скопируй блок **«БЛОК 0 — Контекст проекта»** в новый чат с ИИ (Cursor / Claude / GPT).
2. Для каждого спринта добавляй **один** блок Sprint из конца файла.
3. После каждого спринта проси: «покажи как проверить руками» + «список созданных файлов».
4. Не проси «сделай всё сразу» — только один модуль за раз.

---

## БЛОК 0 — Контекст проекта (вставь первым)

```text
Ты senior full-stack разработчик. Нужно создать с нуля multivendor food delivery платформу «Dastbadast» для рынка Таджикистана (TJS, Душанбе). Это аналог Uber Eats / Glovo: много ресторанов, клиент заказывает, кухня принимает, курьер доставляет, супер-админ управляет.

## Архитектура (monorepo)

6 частей, один GraphQL API:

1. dastbadast-multivendor-api — Node.js, Apollo GraphQL, MongoDB, WebSocket subscriptions, JWT auth. Порт 8001. Это единственный источник бизнес-логики.

2. dastbadast-multivendor-admin — Next.js 14 App Router, React 18, Apollo Client, PrimeReact, Tailwind, next-intl. Супер-админ: зоны, рестораны, меню, dispatch, configuration.

3. dastbadast-multivendor-web — Next.js 14, Apollo, PrimeReact, Tailwind, next-intl. Клиент: рестораны, корзина, checkout, трекинг заказа.

4. dastbadast-multivendor-store — Expo (React Native), Expo Router, Apollo, NativeWind. Ресторан: новые заказы, accept/cancel.

5. dastbadast-multivendor-rider — Expo, Expo Router, Apollo. Курьер: заказы, GPS, статусы доставки.

6. docker-compose.yml — MongoDB 7.

Клиентское mobile app (customer) — НЕ в MVP, только web.

## MVP-ограничения (строго)

- Валюта: только TJS (сомони).
- Оплата MVP: только COD (наличные при получении). Stripe и PayPal НЕ использовать.
- Платежи фаза 2: Alif Mobi и Dushanbe City Bank (DS) — заложить paymentMethod enum и webhook routes, но не реализовывать в MVP.
- Языки UI: русский (en.json как fallback). Не делать 30 языков.
- Один город / одна зона доставки на старте.
- Меню редактируется только в Admin, не в Store app.
- Без: купоны, чат, отзывы, support tickets, wallet/withdraw, audit logs, multi-vendor portal, customer mobile app, Amplitude, Sentry (опционально позже).

## Связь клиентов с API

- HTTP: POST {BASE}/graphql (queries + mutations)
- WebSocket: ws://{BASE}/graphql (subscriptions)
- Auth: Authorization: Bearer <JWT>
- Web также: userId header, nonce, X-Client-Type: web

Env:
- Web/Admin: NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_WS_SERVER_URL
- Expo: EXPO_PUBLIC_API_URL=http://host:8001 (без /graphql в env, добавляется в коде)

## Статусы заказа (enum, API валидирует переходы)

PENDING → ACCEPTED → ASSIGNED → PICKED → DELIVERED
Любой до PICKED может → CANCELLED

Кто меняет:
- placeOrder (COD) → PENDING — Customer
- acceptOrder / cancelOrder — Store
- assignRider — Admin
- updateOrderStatusRider — Rider (PICKED, DELIVERED)
- orderPickedUp — Store (опционально)

## MongoDB коллекции (минимум)

- User (customer): email, phone, passwordHash, name, addresses[], notificationToken
- Restaurant: name, slug, zoneId, location, address, username/password для store, menu via Category/Food, tax, minimumOrder, isAvailable
- Category, Food (variations, addons, options)
- Order: orderId, userId, restaurantId, riderId?, items[], orderStatus, paymentMethod, deliveryAddress, amounts, timestamps
- Rider: username, passwordHash, zoneId, available, location
- Zone: name, polygon coordinates
- Configuration: singleton (currency TJS, googleApiKey, deliveryRate, skipEmailVerification: true, skipMobileVerification: true, testOtp: "123456")

## GraphQL операции MVP (реализовать на API)

Queries:
- configuration
- restaurants (by lat/lng / zone)
- restaurant(id) with categories and foods
- orders (by user / by restaurant / all for admin)
- order(id)
- riders (admin)
- addresses (user)

Mutations:
- login, createUser (customer)
- ownerLogin (admin roles: SUPER_ADMIN)
- restaurantLogin
- riderLogin
- createAddress, editAddress, deleteAddress
- placeOrder (paymentMethod: COD only for MVP)
- acceptOrder, cancelOrder, orderPickedUp
- assignRider, updateStatus (admin)
- updateOrderStatusRider, updateRiderLocation, toggleRider
- createZone, createRestaurant, createCategory, createFood (admin)
- createRider (admin)
- metricsGeneral (public token для web — можно упростить)

Subscriptions:
- subscribePlaceOrder(restaurantId) — store
- orderStatusChanged(userId) — customer web
- subscriptionOrder(orderId) — tracking
- subscriptionAssignedRider / zone orders — rider

## Структура папок API

dastbadast-multivendor-api/
  src/
    index.js          # Express + Apollo + WS
    schema.js         # typeDefs
    resolvers/        # по доменам
    models/           # Mongoose
    middleware/auth.js
    utils/
  .env.example
  package.json (type: module, node 20)

## Структура фронтов (как в Enatega)

Next.js apps:
  app/ — routes
  lib/api/graphql/{queries,mutations,subscription}
  lib/context/
  lib/hooks/useSetApollo.tsx
  lib/ui/screen-components/

Expo store/rider:
  app/ — expo-router
  lib/api/graphql/ или lib/apollo/
  lib/config/api.ts — EXPO_PUBLIC_API_URL

## Порядок разработки (не нарушать)

Sprint 1: API seed + configuration + restaurants + restaurant(id). Web home + restaurant page (read-only menu).
Sprint 2: Auth customer + addresses + zone check. Web login + address.
Sprint 3: placeOrder COD + web cart/checkout/tracking (text statuses).
Sprint 4: restaurantLogin + subscriptions + store app accept/cancel.
Sprint 5: admin dispatch assignRider + rider app + GPS + DELIVERED.
Sprint 6: Google Maps, Firebase push (optional).
Sprint 7: Alif/DS payments + webhooks.

## Код-стайл

- TypeScript для Next.js apps, JS или TS для API (на выбор, но последовательно).
- Apollo Client 3 везде.
- Не over-engineer. Нет лишних абстракций.
- SSR-safe: не вызывать localStorage/document на сервере без typeof window check.
- next-intl: ключи без символа "." в имени (нельзя "your@email.com" как key).
- Passwords: bcrypt на API.

## Deliverables каждого спринта

- Рабочий код
- README шаги запуска
- curl или GraphQL примеры для проверки
- Seed script если нужен

Начни только когда я скажу номер Sprint. Пока подтверди, что понял архитектуру.
```

---

## БЛОК Sprint 1 — API + Web витрина

```text
Sprint 1 для Dastbadast.

Сделай:
1. docker-compose.yml с MongoDB
2. dastbadast-multivendor-api с нуля:
   - Apollo Server 4 + Express + graphql-ws
   - Mongoose models: Configuration, Zone, Restaurant, Category, Food
   - Resolvers: configuration, restaurants, restaurant(id)
   - scripts/seed.js: super admin (ownerLogin), 1 zone, 1 restaurant, 5 foods
3. dastbadast-multivendor-web минимально:
   - Next.js 14 app router
   - Apollo provider, .env.local localhost:8001
   - Страница списка ресторанов и страница ресторана с меню (без корзины)

Не делай: auth, cart, orders, mobile apps, admin UI.

В конце: команды запуска и 3 GraphQL запроса для проверки.
```

---

## БЛОК Sprint 2 — Auth + адреса

```text
Sprint 2 для Dastbadast. API и Web уже есть из Sprint 1.

Сделай:
1. API: User model, bcrypt, JWT middleware
   - mutation login, createUser
   - mutations createAddress, editAddress, deleteAddress, selectAddress
   - query addresses / profile
   - проверка: точка адреса внутри polygon Zone
2. Web: модалка login/register, сохранение token в localStorage
   - страница/flow выбора адреса на карте (Google Maps key из configuration)
   - security.ts: SSR-safe localStorage

Configuration: skipEmailVerification true, skipMobileVerification true.

Не делай: placeOrder, store, rider, admin.
```

---

## БЛОК Sprint 3 — Заказ COD

```text
Sprint 3 для Dastbadast.

Сделай:
1. API: Order model, mutation placeOrder (paymentMethod COD only → status PENDING)
   - query orders (for user), query order(id)
   - subscription orderStatusChanged(userId) — базовая реализация
2. Web:
   - cart context (local state)
   - checkout: subtotal, delivery fee, tax из restaurant config
   - placeOrder → redirect /order/[id]/tracking
   - tracking page показывает orderStatus текстом

Проверка: полный flow без store — заказ в MongoDB status PENDING.

Не делай: store app, rider, payments online.
```

---

## БЛОК Sprint 4 — Store app

```text
Sprint 4 для Dastbadast.

Сделай:
1. API:
   - restaurantLogin → JWT restaurant
   - acceptOrder, cancelOrder
   - subscription subscribePlaceOrder(restaurantId)
2. dastbadast-multivendor-store (Expo):
   - login screen
   - tabs: new orders / processing (упрощённо)
   - accept с preparation time, cancel с reason
   - listen subscription, play sound on new order

Проверка: заказ с web → появляется в store → accept → web tracking показывает ACCEPTED.

Не делай: rider, admin dispatch.
```

---

## БЛОК Sprint 5 — Admin dispatch + Rider

```text
Sprint 5 для Dastbadast.

Сделай:
1. API:
   - ownerLogin, createRider, riders query
   - assignRider, updateOrderStatusRider
   - updateRiderLocation, toggleRider
   - subscriptions for rider (assigned orders)
2. dastbadast-multivendor-admin:
   - login super admin
   - страницы: restaurants list (можно минимальный CRUD), dispatch page (orders ACCEPTED без rider → assign)
3. dastbadast-multivendor-rider:
   - login, list assigned orders
   - buttons: picked up, delivered
   - background GPS send every 10s

Проверка E2E: PENDING → ACCEPTED → ASSIGNED → PICKED → DELIVERED.

Не делай: coupons, wallet, customer app.
```

---

## БЛОК Sprint 6 — Maps + polish

```text
Sprint 6 для Dastbadast.

Сделай:
1. Web tracking: Google Maps marker restaurant + delivery address (react-google-maps-api)
2. Rider location on map via subscription (если API отдаёт)
3. Admin: форма configuration (googleApiKey, deliveryRate, currency)
4. Seed/README обновить

Опционально: Firebase FCM stub для store new order.

Не делай: Alif/DS payments yet.
```

---

## БЛОК Sprint 7 — Платежи TJ (фаза 2)

```text
Sprint 7 для Dastbadast (только если есть API docs от банка).

Сделай:
1. API payment provider abstraction:
   - PaymentProvider interface: createPayment, handleWebhook
   - Implementations: CodProvider, AlifProvider (stub), DcProvider (stub)
2. Flow: placeOrder → AWAITING_PAYMENT → createPayment → paymentUrl
   - webhook → confirm → PENDING (kitchen)
3. Web: payment method ALIF | DC | COD в checkout

Если нет docs банка — только интерфейсы + COD работает.

Удали из web/admin все упоминания Stripe и PayPal.
```

---

## БЛОК — Рефакторинг существующего Enatega-клона

Если работаешь в уже существующем репозитории (не с нуля):

```text
У меня уже есть форк Enatega переименованный в dastbadast-multivendor-*.

Задача: привести к MVP TJ без переписывания с нуля.

1. Все URL API → localhost:8001 / env
2. Удалить Stripe, PayPal, Hyp из UI и configuration
3. PAYMENT_METHOD_LIST только COD (пока)
4. Упростить locales до ru (+ en fallback)
5. Доработать dastbadast-multivendor-api (stub) под Sprint 1-5 resolvers
6. Не ломать структуру папок lib/api/graphql — расширять API под существующие operation names

Читай docs/USER-FLOWS-DEVELOPER.md в репозитории.

Работай по одному Sprint. Сначала Sprint 3 placeOrder если auth уже есть.
```

---

## Дополнительные мини-промпты (когда застрял)

### «Напиши только Mongoose схему Order»

```text
По контексту Dastbadast MVP напиши Mongoose schema Order со всеми полями для placeOrder, статусами, timestamps. Без resolver — только schema + indexes.
```

### «Напиши placeOrder resolver»

```text
Реализуй GraphQL mutation placeOrder для Dastbadast: валидация restaurant available, address in zone, items exist, paymentMethod COD → PENDING. Верни полный order object как в Enatega front contract. Mongoose.
```

### «Проверь совместимость с web»

```text
Открой dastbadast-multivendor-web/lib/api/graphql/mutations/orders и queries — перечисли все поля которые ждёт фронт от placeOrder и order query. Сгенерируй GraphQL schema и resolver types чтобы совпали.
```

### «E2E чеклист»

```text
Дай пошаговый manual QA чеклист для Dastbadast MVP: 20 шагов от seed до DELIVERED с указанием какое приложение открыть и какой статус ожидать.
```

---

## Что писать ИИ в начале каждой сессии

```text
Проект: Dastbadast multivendor delivery (TJ, TJS, COD MVP).
Стек: Node GraphQL API + MongoDB + Next.js web/admin + Expo store/rider.
Сейчас Sprint N: [номер].
Уже сделано: [список].
Не трогать: [модули].
Репозиторий структура: monorepo dastbadast-multivendor-*.
```

---

## Ожидаемый результат после всех Sprint

- `docker compose up` + `api npm run dev` + `web npm run dev`
- Admin создаёт ресторан
- Клиент на web заказывает COD
- Store принимает
- Admin назначает курьера
- Rider доставляет
- Web показывает статусы

Время для одного разработчика с ИИ: ~4–8 недель при дисциплине «один sprint за раз».

---

*Файл создан для репозитория food-delivery-multivendor / Dastbadast.*

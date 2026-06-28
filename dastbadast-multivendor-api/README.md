# dastbadast-multivendor-api

## Запуск
1. `cp .env.example .env`
2. `npm install`
3. `docker compose up -d mongo` (из корня)
4. `npm run seed`  — создаёт:
   - super admin: `admin@dastbadast.tj / admin123`
   - 1 зона (Душанбе, полигон)
   - 1 ресторан: `chayhana1 / store123`
   - 5 блюд в 2 категориях
   - 1 курьер: `courier1 / rider123`
5. `npm run dev` → http://localhost:8001/graphql

## Карты
Получите ключ в Google Cloud Console (Maps JavaScript API) и
вставьте в Admin → Configuration → Google Maps API Key
(он попадёт в Configuration.googleApiKey и раздаётся всем клиентам).

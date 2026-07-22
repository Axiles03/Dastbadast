# ФАЗА 1, пункт 4: real-time "заморозка" позиции

## 1. Новый топик — добавить в `src/pubsub-legacy.js` в объект `TOPICS`

```js
// ⭐ ФАЗА 1: закрывает разрыв между "сервер уже знает, что товара нет"
// (валидация в cart.js::placeOrder) и "клиент это видит" — сейчас клиент
// узнаёт о 86'е товара только когда сам перезапросит меню.
MENU_AVAILABILITY_CHANGED: (restaurantId) =>
  `MENU_AVAILABILITY_CHANGED_${restaurantId}`,
```

## 2. Публикация события — `src/resolvers/restaurant-menu.js`

```js
import { pubsub, TOPICS } from "../pubsub.js"; // добавить в импорты наверху файла

export const updateFood = async (_p, { id, input }, ctx) => {
  const r = requireRestaurant(ctx);
  const food = await assertFoodOwned(id, r._id);
  const wasAvailable = food.isAvailable;
  // ...весь существующий код изменения полей без изменений...

  if (typeof input.isAvailable === "boolean")
    food.isAvailable = input.isAvailable;
  // ...остальные if(input.xxx) как есть...

  await food.save();

  // ⭐ ФАЗА 1: публикуем ТОЛЬКО когда реально изменилась доступность —
  // не на каждое редактирование названия/цены, чтобы не спамить клиентов,
  // которые сейчас смотрят на меню, лишними рефетчами.
  if (wasAvailable !== food.isAvailable) {
    pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
      subscriptionMenuAvailability: {
        foodId: food._id.toString(),
        restaurantId: r._id.toString(),
        isAvailable: food.isAvailable,
      },
    });
  }

  return food;
};

export const deleteFood = async (_p, { id }, ctx) => {
  const r = requireRestaurant(ctx);
  const food = await assertFoodOwned(id, r._id);
  food.isActive = false;
  food.isAvailable = false;
  await food.save();

  // ⭐ ФАЗА 1: удаление = гарантированный переход available → unavailable.
  pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
    subscriptionMenuAvailability: {
      foodId: food._id.toString(),
      restaurantId: r._id.toString(),
      isAvailable: false,
    },
  });

  return food; // как и раньше — не менять остальную часть функции
};

export const updateMyRestaurant = async (_p, { input }, ctx) => {
  const r = requireRestaurant(ctx);
  const wasAvailable = r.isAvailable;
  // ...весь существующий код без изменений...

  if (typeof input.isAvailable === "boolean") r.isAvailable = input.isAvailable;
  // ...workingHours как есть...

  await r.save();

  // ⭐ ФАЗА 1: "ресторан закрылся целиком" — тоже нужно долетать до клиента.
  if (wasAvailable !== r.isAvailable) {
    pubsub.publish(TOPICS.MENU_AVAILABILITY_CHANGED(r._id.toString()), {
      subscriptionMenuAvailability: {
        foodId: null,
        restaurantId: r._id.toString(),
        isAvailable: r.isAvailable,
      },
    });
  }

  return r;
};
```

## 3. Схема — добавить в `src/schema.js`

```graphql
type MenuAvailabilityEvent {
  foodId: ID        # null = изменился ресторан целиком, а не одно блюдо
  restaurantId: ID!
  isAvailable: Boolean!
}

extend type Subscription {
  subscriptionMenuAvailability(restaurantId: ID!): MenuAvailabilityEvent!
}
```

## 4. Резолвер подписки — добавить в `src/resolvers/subscriptions.js`

```js
export const subscriptionMenuAvailability = {
  subscribe: (_p, { restaurantId }) =>
    pubsub.asyncIterator(TOPICS.MENU_AVAILABILITY_CHANGED(restaurantId)),
};
```
и зарегистрировать в объекте `Subscription` в `resolvers/index.js` рядом с уже существующими `subscriptionOrder`, `subscribePlaceOrder` и т.д.

## 5. Клиент (`dastbadast-multivendor-web`, `dastbadast-multivendor-client`)

В компоненте меню ресторана (`components/RestaurantMenu.tsx`) добавить
`useSubscription(SUB_MENU_AVAILABILITY, { variables: { restaurantId } })`
и по приходу события — либо точечно выключать карточку блюда
(`foodId` совпал → `isAvailable: false`, показать бейдж "Нет в наличии"
и заблокировать "В корзину"), либо, если `foodId: null` — показать баннер
"Ресторан временно не принимает заказы" поверх всего меню.
Отдельная GraphQL-подписка `SUB_MENU_AVAILABILITY` добавляется в
`lib/graphql/fragments.ts`/`lib/queries.ts` по тому же паттерну, что уже
использован для `SUB_PLACE_ORDER` в сторе.

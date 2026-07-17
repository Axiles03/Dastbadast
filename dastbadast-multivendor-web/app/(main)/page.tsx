
// dastbadast-multivendor-web/app/(main)/page.tsx
import { getClient } from "@/lib/apollo-server";
import { GET_RESTAURANTS, GET_CONFIGURATION } from "@/lib/queries";
import { HomeClient } from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const client = getClient();

  // ⭐ FIX: Configuration is not defined (ReferenceError) на сервере
  // раньше пробрасывалось клиенту как "errors[].extensions.code=INTERNAL_SERVER_ERROR"
  // с сообщением без контекста, и любые useQuery(GET_CONFIGURATION) падали.
  // Теперь оборачиваем в try/catch — если один из запросов падает (например,
  // сервер ещё не перезапущен после правок), главная страница всё равно
  // отрисуется с дефолтами, а ошибка уйдёт в server-логи для дебага.
  let cfgData: any = null;
  let data: any = null;
  try {
    const [cfgRes, restRes] = await Promise.all([
      client.query({ query: GET_CONFIGURATION }),
      client.query({ query: GET_RESTAURANTS }),
    ]);
    cfgData = cfgRes.data;
    data = restRes.data;
  } catch (e) {
    // ⭐ FIX: НЕ проглатываем молча — логируем в stderr, чтобы диагностика
    // оставалась доступной через `pm2 logs` / Vercel logs.
    console.error("[home] GraphQL bootstrap failed:", e);
    // data останется null — useQuery на клиенте сможет догрузить,
    // либо покажется пустое состояние с CTA.
  }

  // ⭐ FIX (Заведение дня / рейтинг / "Новый" вместо рейтинга):
  // раньше сюда прокидывались только id/name/slug/address/image/minimumOrder,
  // хотя GET_RESTAURANTS уже запрашивал averageRating/totalRatings/
  // estimatedPrepMinutes. Из-за этого на клиенте decorated[i].rating всегда
  // был null → ProductOfTheDay всегда возвращал null, а RestaurantCard всегда
  // показывал бейдж "Новый" вместо реального рейтинга. Пробрасываем все поля.
  const restaurants = (data?.restaurants ?? []).map((r: any) => ({
    id: String(r.id),
    name: r.name,
    slug: r.slug ?? null,
    address: r.address ?? null,
    image: r.image ?? null,
    minimumOrder: Number(r.minimumOrder ?? 0),
    averageRating: typeof r.averageRating === "number" ? r.averageRating : null,
    totalRatings: Number(r.totalRatings ?? 0),
    estimatedPrepMinutes:
      typeof r.estimatedPrepMinutes === "number" ? r.estimatedPrepMinutes : null,
  }));

  const sym = cfgData?.configuration?.currencySymbol ?? "сом.";

  // ⭐ FIX: если оба запроса упали — рендерим минимальный fallback,
  // чтобы Next.js не падал целиком из-за 500 на root странице.
  if (!data) {
    return (
      <HomeClient
        restaurants={[]}
        currencySymbol="сом."
        popularFoods={[]}
        saladFoods={[]}
        pizzaFoods={[]}
        pastaFoods={[]}
      />
    );
  }

  // Подтягиваем блюда первого ресторана (MVP-решение)
  let popularFoods: any[] = [];
  let saladFoods: any[] = [];
  let pizzaFoods: any[] = [];
  let pastaFoods: any[] = [];
  let featuredRestaurantId: string | undefined;

  if (restaurants.length > 0) {
    const featured = restaurants[0];
    featuredRestaurantId = featured.id;
    const { GET_RESTAURANT } = await import("@/lib/queries");
    const { data: rData } = await client.query({
      query: GET_RESTAURANT,
      variables: { id: featured.slug || featured.id },
    });
    const cats = rData?.restaurant?.categories ?? [];

    const mapFoods = (cat: any) =>
      (cat.foods ?? []).map((f: any) => ({
        id: String(f.id),
        title: f.title,
        price: Number(f.price ?? 0),
        image: f.image ?? null,
        description: f.description ?? null,
        restaurantId: featured.id,
        restaurantName: featured.name,
      }));

    const all = cats.flatMap(mapFoods);
    popularFoods = all.slice(0, 10);

    const findCat = (predicate: (t: string) => boolean) =>
      cats.find((c: any) => predicate((c.title || "").toLowerCase()));
    const saladCat = findCat((t) => t.includes("салат") || t.includes("salad"));

    if (saladCat) saladFoods = mapFoods(saladCat);
    if (all.length) {
      pizzaFoods = all.slice(0, 6);
      pastaFoods = all.slice(2, 8);
    }
  }

  return (
    <HomeClient
      restaurants={restaurants}
      currencySymbol={sym}
      popularFoods={popularFoods}
      saladFoods={saladFoods}
      pizzaFoods={pizzaFoods}
      pastaFoods={pastaFoods}
      featuredRestaurantId={featuredRestaurantId}
    />
  );
}

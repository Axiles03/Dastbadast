import { getClient } from "@/lib/apollo-server";
import { GET_RESTAURANTS, GET_CONFIGURATION } from "@/lib/queries";
import { HomeClient } from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const client = getClient();

  const [{ data: cfgData }, { data }] = await Promise.all([
    client.query({ query: GET_CONFIGURATION }),
    client.query({ query: GET_RESTAURANTS }),
  ]);

  const restaurants = (data?.restaurants ?? []).map((r: any) => ({
    id: String(r.id),
    name: r.name,
    slug: r.slug ?? null,
    address: r.address ?? null,
    image: r.image ?? null,
    minimumOrder: Number(r.minimumOrder ?? 0),
  }));

  const sym = cfgData?.configuration?.currencySymbol ?? "сом.";

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

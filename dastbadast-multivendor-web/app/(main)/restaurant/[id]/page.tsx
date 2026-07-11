import { getClient } from "@/lib/apollo-server";
import {
  GET_RESTAURANT,
  GET_CONFIGURATION,
  GET_RESTAURANTS,
} from "@/lib/queries";
import Link from "next/link";
import { RestaurantMenu } from "@/components/RestaurantMenu";
import { ChevronLeft, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({
  params,
}: {
  params: { id: string };
}) {
  const client = getClient();
  const slugOrId = decodeURIComponent(params.id);

  const [{ data: cfg }, { data }, { data: listData }] = await Promise.all([
    client.query({ query: GET_CONFIGURATION }),
    client.query({ query: GET_RESTAURANT, variables: { id: slugOrId } }),
    client.query({ query: GET_RESTAURANTS }),
  ]);

  if (!data?.restaurant) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-soft-text-soft hover:text-soft-accent"
        >
          <ChevronLeft className="w-4 h-4" /> На главную
        </Link>
        <h1 className="text-2xl font-extrabold text-soft-text mt-4 mb-2">
          Ресторан не найден
        </h1>
        <ul className="space-y-2 mt-4">
          {(listData?.restaurants || []).map((r: any) => (
            <li key={r.id}>
              <Link
                href={`/restaurant/${r.slug || r.id}`}
                className="block bg-soft-surface border border-soft-border rounded-2xl p-4 hover:border-soft-accent"
              >
                <div className="font-bold text-soft-text">{r.name}</div>
                <div className="text-xs text-soft-text-soft">{r.address}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const r = data.restaurant;
  const sym = cfg?.configuration?.currencySymbol ?? "сом.";
  const today = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const closed = r.isOpenNow === false || r.isAvailable === false;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> Рестораны
      </Link>

      <header className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <p className="text-soft-text-muted text-sm capitalize">{today}</p>
        <h1 className="text-2xl md:text-3xl font-extrabold mt-1 text-soft-text">
          {r.name}
        </h1>
        {r.address && (
          <p className="text-soft-text-soft text-sm mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {r.address}
          </p>
        )}

        {!r.isOpenNow && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-soft-accent-soft text-soft-accent">
            Закрыто · откроется в {r.workingHours?.open}
          </span>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-soft-surface-2 border border-soft-border text-soft-text-soft">
            Мин. заказ · {r.minimumOrder} {sym}
          </span>
          {r.workingHours && !r.workingHours.isAlwaysOpen && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-soft-surface-2 border border-soft-border text-soft-text-soft">
              🕐 {r.workingHours.open}–{r.workingHours.close}
            </span>
          )}
          {closed && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-soft border border-red/30 text-red">
              {r.isAvailable === false
                ? "Временно не принимает заказы"
                : `Закрыто · откроется в ${r.workingHours?.open ?? ""}`}
            </span>
          )}
        </div>
      </header>

      <RestaurantMenu
        restaurantId={r.id}
        restaurantName={r.name}
        categories={r.categories || []}
        currencySymbol={sym}
        disabled={closed}
      />
    </div>
  );
}

// dastbadast-multivendor-web/app/(main)/restaurant/[id]/page.tsx
import { getClient } from "@/lib/apollo-server";
import {
  GET_RESTAURANT,
  GET_CONFIGURATION,
  GET_RESTAURANTS,
  RESTAURANT_REVIEWS,
} from "@/lib/queries";
import Link from "next/link";
import { RestaurantMenu } from "@/components/RestaurantMenu";
import { RestaurantReviewForm } from "@/components/RestaurantReviewForm";
import { ChevronLeft, MapPin, Star } from "lucide-react";

export const dynamic = "force-dynamic";

const REVIEWS_PREVIEW_COUNT = 3;

export default async function RestaurantPage({
  params,
}: {
  params: { id: string };
}) {
  const client = getClient();
  const slugOrId = decodeURIComponent(params.id);

  // ⭐ ШАГ 1: подтягиваем restaurantReviews отдельным запросом,
  // чтобы не возвращать их через Restaurant (это упростит кеш GraphQL).
  const [{ data: cfg }, { data }, { data: listData }, { data: reviewsData }] =
    await Promise.all([
      client.query({ query: GET_CONFIGURATION }),
      client.query({ query: GET_RESTAURANT, variables: { id: slugOrId } }),
      client.query({ query: GET_RESTAURANTS }),
      client
        .query({
          query: RESTAURANT_REVIEWS,
          // ⭐ FIX: страница ресторана — это превью, поэтому запрашиваем
          // с запасом (10), но реально показываем только 3 (см. ниже),
          // остальное — на отдельной странице /reviews.
          variables: { restaurantId: slugOrId, limit: 10 },
        })
        .catch(() => ({ data: null })), // ⭐ на случай, если резолвера ещё нет в API
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

  // ⭐ ШАГ 1: отзывы ресторана из отдельного query (с защитой от undefined,
  // если query ещё не подключён на бэке).
  const allReviews: any[] = reviewsData?.restaurantReviews ?? [];
  // ⭐ FIX: на странице ресторана показываем только 3 последних отзыва,
  // а не весь список — полный список теперь на /restaurant/[id]/reviews.
  const previewReviews = allReviews.slice(0, REVIEWS_PREVIEW_COUNT);
  // totalRatings из шапки ресторана — это точное общее число отзывов
  // (r.totalRatings из aggregate в БД), используем его для счётчика
  // и для решения, показывать ли кнопку "Показать все".
  const totalReviewsCount = r.totalRatings ?? allReviews.length;

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

        {/* ⭐ ШАГ 1: реальный рейтинг ресторана (aggregate из RestaurantReview) */}
        {r.averageRating != null && r.totalRatings > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1 bg-soft-rating-soft border border-soft-rating/30 px-2.5 py-1 rounded-full">
              <Star className="w-3.5 h-3.5 text-soft-rating fill-current" />
              <span className="font-extrabold text-soft-rating-dark">
                {r.averageRating.toFixed(1)}
              </span>
              <span className="text-soft-rating-dark/70 text-xs">
                · {r.totalRatings} отзывов
              </span>
            </div>
          </div>
        )}
      </header>

      {/* ⭐ ШАГ 1: блок отзывов (вынесен из header — иначе ломается структура,
          и блок с workingHours/workingHours.open даёт потенциальный null-доступ
          при рендере вне header'а). Теперь отдельной секцией — и логичнее
          семантически, и не зависит от null safety в header'е. */}
      {previewReviews.length > 0 && (
        <section className="bg-soft-surface border border-soft-border rounded-2xl p-5 shadow-soft-sm">
          <h3 className="font-extrabold text-base text-soft-text mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-soft-rating fill-current" />
            Отзывы о ресторане ({totalReviewsCount})
          </h3>
          <ul className="space-y-2.5">
            {previewReviews.map((rv: any) => (
              <li
                key={rv.id}
                className="bg-soft-surface-2 border border-soft-border rounded-xl p-3.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-soft-text">
                    {rv.userName || "Гость"}
                  </span>
                  <span className="text-soft-rating text-sm">
                    {"★".repeat(rv.rating)}
                    <span className="text-soft-border">
                      {"☆".repeat(5 - rv.rating)}
                    </span>
                  </span>
                </div>
                <p className="text-sm text-soft-text-soft leading-relaxed">
                  {rv.comment}
                </p>
              </li>
            ))}
          </ul>

          {/* ⭐ NEW: кнопка "Показать все отзывы" — только если отзывов
              больше, чем показано в превью. Ведёт на отдельную страницу. */}
          {totalReviewsCount > previewReviews.length && (
            <Link
              href={`/restaurant/${slugOrId}/reviews`}
              className="mt-3 block text-center py-2.5 rounded-xl border border-soft-border font-bold text-sm text-soft-accent hover:bg-soft-surface-2 transition-colors"
            >
              Показать все отзывы ({totalReviewsCount})
            </Link>
          )}
        </section>
      )}

      {/* ⭐ NEW: форма отправки отзыва — раньше нигде не была подключена */}
      <RestaurantReviewForm restaurantId={r.id} />

      {/* ⭐ FIX: раньше сюда передавался disabled={closed}, и вся кнопка
          "В корзину" на меню блокировалась, как только ресторан закрывался
          по расписанию. По требованию — добавлять в корзину можно всегда;
          реальная блокировка происходит на чекауте (см. cart/page.tsx —
          там уже есть предупреждение "Ресторан закрыт · откроется в …" и
          кнопка оформления заказа недоступна), плюс это же дополнительно
          проверяется на сервере в placeOrder. */}
      <RestaurantMenu
        restaurantId={r.id}
        restaurantName={r.name}
        categories={r.categories || []}
        currencySymbol={sym}
      />
    </div>
  );
}

// dastbadast-multivendor-web/app/(main)/restaurant/[id]/reviews/page.tsx

import { getClient } from "@/lib/apollo-server";
import { GET_RESTAURANT, RESTAURANT_REVIEWS } from "@/lib/queries";
import Link from "next/link";
import { ChevronLeft, Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RestaurantReviewsPage({
  params,
}: {
  params: { id: string };
}) {
  const client = getClient();
  const slugOrId = decodeURIComponent(params.id);

  const [{ data }, { data: reviewsData }] = await Promise.all([
    client.query({ query: GET_RESTAURANT, variables: { id: slugOrId } }),
    client
      .query({
        query: RESTAURANT_REVIEWS,
        // ⭐ на странице "все отзывы" запрашиваем с большим лимитом —
        // сервер сам ограничит потолком (см. restaurant-reviews.js, cap 200)
        variables: { restaurantId: slugOrId, limit: 200 },
      })
      .catch(() => ({ data: null })),
  ]);

  const restaurant = data?.restaurant;
  const reviews: any[] = reviewsData?.restaurantReviews ?? [];

  if (!restaurant) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-soft-text-soft hover:text-soft-accent"
        >
          <ChevronLeft className="w-4 h-4" /> На главную
        </Link>
        <h1 className="text-2xl font-extrabold text-soft-text mt-4">
          Ресторан не найден
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href={`/restaurant/${slugOrId}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> {restaurant.name}
      </Link>

      <header className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm">
        <h1 className="text-xl md:text-2xl font-extrabold text-soft-text">
          Отзывы о ресторане {restaurant.name}
        </h1>
        {restaurant.averageRating != null && restaurant.totalRatings > 0 && (
          <div className="flex items-center gap-1 mt-2 bg-soft-rating-soft border border-soft-rating/30 px-2.5 py-1 rounded-full w-fit">
            <Star className="w-3.5 h-3.5 text-soft-rating fill-current" />
            <span className="font-extrabold text-soft-rating-dark">
              {restaurant.averageRating.toFixed(1)}
            </span>
            <span className="text-soft-rating-dark/70 text-xs">
              · {restaurant.totalRatings} отзывов
            </span>
          </div>
        )}
      </header>

      {reviews.length === 0 ? (
        <div className="bg-soft-surface border border-soft-border rounded-2xl p-10 text-center">
          <p className="text-sm text-soft-text-soft">
            Пока нет ни одного отзыва.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {reviews.map((rv: any) => (
            <li
              key={rv.id}
              className="bg-soft-surface border border-soft-border rounded-2xl p-4"
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
      )}
    </div>
  );
}

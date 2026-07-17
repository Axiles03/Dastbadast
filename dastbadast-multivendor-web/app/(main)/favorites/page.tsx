// dastbadast-multivendor-web/app/(main)/favorites/page.tsx
"use client";

import Link from "next/link";
import { useQuery } from "@apollo/client";
import { ArrowLeft, Heart } from "lucide-react";

import { GET_MY_FAVORITES, GET_CONFIGURATION } from "@/lib/queries";
import { RequireAuth } from "@/components/RequireAuth";
import { RestaurantCard } from "@/components/RestaurantCard";
import { FoodCard } from "@/components/FoodCard";

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesInner />
    </RequireAuth>
  );
}

function FavoritesInner() {
  // ⭐ network-only: если зайти сюда сразу после снятия сердечка на другой
  // странице, cache-first мог бы отдать устаревший список из кэша запроса
  // (сам toggle обновляет карточки по id, но не переписывает массив
  // myFavoriteRestaurants/myFavoriteFoods — это отдельный кэш-ключ).
  const { data, loading } = useQuery(GET_MY_FAVORITES, {
    fetchPolicy: "cache-and-network",
  });
  const { data: cfg } = useQuery(GET_CONFIGURATION);
  const sym = cfg?.configuration?.currencySymbol ?? "сом.";

  const restaurants = data?.myFavoriteRestaurants ?? [];
  const foods = data?.myFavoriteFoods ?? [];
  const isEmpty = !loading && restaurants.length === 0 && foods.length === 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ArrowLeft className="w-4 h-4" /> На главную
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
          Избранное
        </h1>
        <p className="text-sm text-soft-text-soft mt-1">
          Рестораны и блюда, которые вам понравились
        </p>
      </div>

      {loading && !data ? (
        <div className="flex gap-4 flex-wrap">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="w-[260px] h-[220px] bg-soft-surface border border-soft-border rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center space-y-3 shadow-soft-sm">
          <div className="w-14 h-14 rounded-full bg-soft-accent-soft flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6 text-soft-accent" />
          </div>
          <h3 className="font-extrabold text-soft-text">Пока пусто</h3>
          <p className="text-sm text-soft-text-soft">
            Нажмите на сердечко у ресторана или блюда — они появятся здесь.
          </p>
          <Link
            href="/"
            className="inline-block bg-soft-accent text-white px-5 py-2.5 rounded-2xl text-sm font-extrabold hover:bg-soft-accent-dark transition-colors"
          >
            Выбрать ресторан
          </Link>
        </div>
      ) : (
        <>
          {restaurants.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-extrabold text-lg text-soft-text">
                Рестораны
                <span className="ml-2 text-soft-text-muted font-medium text-base">
                  {restaurants.length}
                </span>
              </h2>
              <div className="flex gap-4 flex-wrap">
                {restaurants.map((r: any) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    currencySymbol={sym}
                  />
                ))}
              </div>
            </section>
          )}

          {foods.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-extrabold text-lg text-soft-text">
                Блюда
                <span className="ml-2 text-soft-text-muted font-medium text-base">
                  {foods.length}
                </span>
              </h2>
              <div className="flex gap-4 flex-wrap">
                {foods.map((f: any) => (
                  <FoodCard key={f.id} food={f} currencySymbol={sym} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
    
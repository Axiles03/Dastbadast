"use client";

import { useRef } from "react";
import {
  Sparkles,
  Star,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RestaurantCard } from "./RestaurantCard";

export function ProductOfTheDay({
  restaurants,
  currencySymbol,
}: {
  restaurants: any[];
  currencySymbol: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (restaurants.length === 0) return null;

  // В центре — самый рейтинговый, по бокам — peek'и
  const sorted = [...restaurants].sort((a, b) => {
    const av = a.averageRating ?? -1;
    const bv = b.averageRating ?? -1;
    if (av === bv) return (b.totalRatings ?? 0) - (a.totalRatings ?? 0);
    return bv - av;
  });
  // ⭐ Если у ВСЕХ ресторанов averageRating=null (нет ни одного отзыва),
  // sorted[0] будет равен первому ресторану в списке — не показываем
  // "Заведение дня" в этом случае, лучше пусто, чем выдумка.
  if (!sorted[0] || sorted[0].averageRating == null) {
    return null;
  }
  const center = sorted[0];
  const sides = sorted.slice(1, 3);

  const scrollBy = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: 320 * dir, behavior: "smooth" });
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-soft-accent" />
          <h2 className="font-extrabold text-lg text-soft-text">
            Заведение дня
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="w-8 h-8 rounded-full bg-soft-surface border border-soft-border text-soft-text-soft hover:text-soft-accent hover:border-soft-accent flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="w-8 h-8 rounded-full bg-soft-surface border border-soft-border text-soft-text-soft hover:text-soft-accent hover:border-soft-accent flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Контейнер с overflow, внутри — горизонтальная лента */}
      <div className="relative">
        <div
          ref={ref}
          className="flex items-stretch gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        >
          {/* Левый peek */}
          {sides[0] && (
            <div className="snap-start shrink-0 hidden sm:block">
              <RestaurantCard
                restaurant={sides[0]}
                currencySymbol={currencySymbol}
                variant="peek"
              />
            </div>
          )}

          {/* Центральная крупная карточка */}
          <div className="snap-center shrink-0 w-full sm:w-[640px]">
            <div className="group relative h-[280px] sm:h-[300px] rounded-3xl overflow-hidden bg-gradient-to-br from-soft-dark-2 to-soft-dark border border-soft-dark-border">
              <img
                src={center.image || center.coverImage}
                alt={center.name}
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = `https://placehold.co/1200x500/2A2640/FFFFFF?text=${encodeURIComponent(center.name)}`;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-soft-dark-2/90 via-soft-dark-2/30 to-transparent" />
              <div className="absolute inset-0 p-7 sm:p-10 flex flex-col justify-end">
                <div className="text-soft-text-muted text-xs font-semibold tracking-widest uppercase">
                  Заведение дня
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mt-1">
                  {center.name}
                </h3>
                <p className="text-white/80 text-sm mt-1">
                  {center.address || "Душанбе"}
                </p>
                <div className="mt-3 flex items-center gap-4 text-sm text-white/80">
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-4 h-4 text-soft-rating fill-current" />{" "}
                    {center.rating}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-4 h-4 text-soft-rating fill-current" />{" "}
                    {typeof center.deliveryTime === "number"
                      ? `${center.deliveryTime} мин`
                      : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-4 h-4" />{" "}
                    {typeof center.distanceKm === "number"
                      ? `${center.distanceKm} км`
                      : "—"}
                  </span>
                </div>
                <div className="mt-4 text-soft-rating font-extrabold text-lg">
                  от {center.minimumOrder} {currencySymbol}
                </div>
              </div>
            </div>
          </div>

          {/* Правый peek */}
          {sides[1] && (
            <div className="snap-end shrink-0 hidden sm:block">
              <RestaurantCard
                restaurant={sides[1]}
                currencySymbol={currencySymbol}
                variant="peek"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

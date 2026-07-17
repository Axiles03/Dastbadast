// dastbadast-multivendor-web/components/HomeClient.tsx
"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useShell } from "@/lib/shell-context";
import { CategoryChips, ChipId } from "./CategoryChips";
import { HorizontalCarousel } from "./HorizontalCarousel";
import { ProductOfTheDay } from "./ProductOfTheDay";
import { FoodCard } from "./FoodCard";
import { RestaurantCard } from "./RestaurantCard";
import {
  GET_RESTAURANTS,
  GET_ADDRESSES,
  GET_CONFIGURATION,
} from "@/lib/queries";
import { useQuery } from "@apollo/client";

type Restaurant = {
  id: string;
  name: string;
  slug?: string | null;
  address?: string | null;
  image?: string | null;
  minimumOrder: number;
};

export function HomeClient({
  restaurants,
  currencySymbol,
  popularFoods = [],
  saladFoods = [],
  pizzaFoods = [],
  pastaFoods = [],
  featuredRestaurantId,
}: {
  restaurants: Restaurant[];
  currencySymbol: string;
  popularFoods?: any[];
  saladFoods?: any[];
  pizzaFoods?: any[];
  pastaFoods?: any[];
  featuredRestaurantId?: string;
}) {
  const { setFiltersOpen, restaurantFilters } = useShell();
  const { items } = useCart();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipId>("all");

  const { data: addrData } = useQuery(GET_ADDRESSES);
  const userCoords = (addrData?.selectedAddress?.location?.coordinates ??
    null) as number[] | null;

  const { data: cfg } = useQuery(GET_CONFIGURATION);

  // ⭐ FIX (км/время не показывались на карточках): раньше этот запрос
  // выполнялся ТОЛЬКО когда включён фильтр "ближайшие ко мне" (skip
  // зависел от restaurantFilters.nearest), а его результат `data` вообще
  // не использовался ниже — decorated строился из пропса `restaurants`,
  // в котором нет distanceKm/deliveryTime. Теперь запрос уходит, как
  // только у пользователя есть выбранный адрес (координаты), а его
  // результат мёржится в decorated по id — km/время появляются на всех
  // карточках сразу, а не только после клика по "ближайшие".
  const { data: geoData } = useQuery(GET_RESTAURANTS, {
    variables: userCoords
      ? { latitude: userCoords[1], longitude: userCoords[0] }
      : { latitude: null, longitude: null },
    fetchPolicy: "cache-and-network",
    skip: !userCoords || userCoords.length < 2,
  });

  const geoById = useMemo(() => {
    const m = new Map<string, any>();
    (geoData?.restaurants ?? []).forEach((r: any) => m.set(String(r.id), r));
    return m;
  }, [geoData]);

  // Декорируем рестораны реальными данными (рейтинг из БД + geo-данные,
  // когда у пользователя выбран адрес)
  const decorated = useMemo(
    () =>
      restaurants.map((r: any) => {
        const geo = geoById.get(String(r.id));
        return {
          ...r,
          // ⭐ Реальные данные из БД (aggregate в модели Restaurant).
          // Если 0 отзывов — averageRating=null, totalRatings=0.
          // UI должен это учитывать (см. RestaurantCard.tsx — fallback "Новый").
          averageRating:
            typeof r.averageRating === "number" ? r.averageRating : null,
          totalRatings: typeof r.totalRatings === "number" ? r.totalRatings : 0,
          // ⭐ FIX: раньше здесь всегда были null (поле называлось `distance`,
          // а карточка читает `distanceKm`/`deliveryTime` — плюс сами эти
          // значения нигде не считались). Теперь берём их из geo-запроса,
          // когда он доступен, иначе честно показываем "—" в карточке.
          distanceKm:
            typeof geo?.distanceKm === "number" ? geo.distanceKm : null,
          deliveryTime:
            typeof geo?.deliveryTime === "number"
              ? geo.deliveryTime
              : typeof r.estimatedPrepMinutes === "number"
                ? r.estimatedPrepMinutes
                : null,
          isNew: (r.totalRatings ?? 0) === 0, // реальное определение "нового"
          isPopular: (r.totalRatings ?? 0) >= 3, // и "популярного"
        };
      }),
    [restaurants, geoById],
  );

  // Что показываем в «Заведении дня»
  const featuredList = useMemo(() => {
    if (decorated.length === 0) return [];
    if (featuredRestaurantId) {
      const f = decorated.find((r) => r.id === featuredRestaurantId);
      if (f)
        return [f, ...decorated.filter((r) => r.id !== featuredRestaurantId)];
    }
    return decorated;
  }, [decorated, featuredRestaurantId]);

  // Фильтрация для сетки ресторанов
  const filtered = useMemo(() => {
    let list = [...decorated];
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.address || "").toLowerCase().includes(q),
      );
    if (chip === "popular") list = list.filter((r) => r.isPopular);

    if (restaurantFilters.maxMinimumOrder != null) {
      list = list.filter(
        (r) => r.minimumOrder <= restaurantFilters.maxMinimumOrder!,
      );
    }
    if (restaurantFilters.maxDeliveryTime != null) {
      list = list.filter(
        (r) =>
          r.deliveryTime != null &&
          r.deliveryTime <= restaurantFilters.maxDeliveryTime!,
      );
    }

    list.sort((a, b) => {
      // ⭐ FIX: тумблер "ближайшие ко мне" теперь реально сортирует по
      // расстоянию, а не просто дожидается клика, чтобы что-то показать.
      // Рестораны без известного расстояния (адрес ещё грузится) уходят вниз.
      if (restaurantFilters.nearest) {
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      }
      if (restaurantFilters.sortBy === "rating") {
        // null внизу
        const av = a.averageRating ?? 0;
        const bv = b.averageRating ?? 0;
        if (av === bv) return (b.totalRatings ?? 0) - (a.totalRatings ?? 0);
        return bv - av;
      }
      if (restaurantFilters.sortBy === "deliveryTime") {
        // ⭐ FIX: раньше сравнивалось несуществующее a.estimatedPrepMinutes
        const at = a.deliveryTime ?? 999;
        const bt = b.deliveryTime ?? 999;
        return at - bt;
      }
      return a.minimumOrder - b.minimumOrder;
    });
    return list;
  }, [decorated, search, chip, restaurantFilters]);

  // Набор блюд по выбранному чипу
  const visibleFoods = useMemo(() => {
    if (chip === "popular") return popularFoods;
    if (chip === "salad") return saladFoods;
    if (chip === "pizza") return pizzaFoods;
    if (chip === "pasta") return pastaFoods;
    return popularFoods; // для «Все» — показываем популярные
  }, [chip, popularFoods, saladFoods, pizzaFoods, pastaFoods]);

  return (
    <>
      {/* ====== SEARCH + FILTERS ====== */}
      <div className="flex items-center gap-3 mb-6 max-w-3xl">
        <div className="flex-1 flex items-center gap-2 bg-soft-surface rounded-2xl border border-soft-border shadow-soft-sm pl-4 pr-1.5 py-1.5">
          <Search className="w-5 h-5 text-soft-text-muted shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти ресторан или блюдо..."
            className="flex-1 min-w-0 bg-transparent outline-none text-soft-text placeholder:text-soft-text-muted py-2.5 text-base"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex items-center gap-2 px-5 py-3.5 bg-soft-purple hover:bg-soft-purple-dark text-white font-bold rounded-2xl shadow-soft-sm transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Фильтры</span>
        </button>
      </div>

      {/* ====== CATEGORY CHIPS ====== */}
      <CategoryChips active={chip} onChange={setChip} />

      {/* ====== PRODUCT OF THE DAY ====== */}
      {featuredList.length > 1 && !search && chip === "all" && (
        <ProductOfTheDay
          restaurants={featuredList}
          currencySymbol={currencySymbol}
        />
      )}

      {/* ====== HORIZONTAL CAROUSEL: Most Popular Dishes ====== */}
      {visibleFoods.length > 0 && (
        <HorizontalCarousel
          title={
            chip === "popular"
              ? "Популярные блюда"
              : chip === "salad"
                ? "Салаты"
                : chip === "pizza"
                  ? "Пицца"
                  : chip === "pasta"
                    ? "Паста и супы"
                    : "Популярные блюда"
          }
        >
          {visibleFoods.map((f) => (
            <FoodCard key={f.id} food={f} currencySymbol={currencySymbol} />
          ))}
        </HorizontalCarousel>
      )}

      {/* ====== HORIZONTAL CAROUSEL: Все рестораны ====== */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-lg text-soft-text">
            {search || chip !== "all" ? "Результаты" : "Все рестораны"}
            <span className="ml-2 text-soft-text-muted font-medium text-base">
              {filtered.length}
            </span>
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-soft-surface border border-soft-border rounded-2xl p-10 text-center">
            <div className="text-5xl mb-2">🔍</div>
            <h3 className="font-extrabold text-soft-text">Ничего не нашли</h3>
            <p className="text-sm text-soft-text-soft mt-1">
              Попробуйте другое название или сбросьте фильтры.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-5 px-5 sm:mx-0 sm:px-0">
            {filtered.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                currencySymbol={currencySymbol}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

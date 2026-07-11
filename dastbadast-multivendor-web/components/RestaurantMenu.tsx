"use client";

import { useMemo, useState } from "react";
import { Search, Star, Plus } from "lucide-react";
import { categoryIcon, foodImageUrl } from "@/lib/category-icons";
import { FoodDetailModal } from "./FoodDetailModal";
import { AddToCartButton } from "./AddToCartButton";
import { useCart } from "@/lib/cart-context";

type Review = {
  id: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type Food = {
  id: string;
  title: string;
  description?: string;
  price: number;
  image?: string;
  averageRating?: number;
  reviewCount?: number;
  reviews?: Review[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  spiceLevel?: number;
  allergens?: string[];
};

type Category = {
  id: string;
  title: string;
  foods: Food[];
};

export function RestaurantMenu({
  restaurantId,
  restaurantName,
  categories,
  currencySymbol,
  disabled,
}: {
  restaurantId: string;
  restaurantName: string;
  categories: Category[];
  currencySymbol: string;
  disabled?: boolean;
}) {
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [detailFood, setDetailFood] = useState<Food | null>(null);
  const [onlyVeg, setOnlyVeg] = useState(false);
  const [maxSpice, setMaxSpice] = useState<number | null>(null);
  const [excludeAllergens, setExcludeAllergens] = useState<string[]>([]);

  const { add, items } = useCart();

  const activeCategory =
    categories.find((c) => c.id === activeId) ?? categories[0];

  const foods = useMemo(() => {
    const list = activeCategory?.foods ?? [];
    const q = search.trim().toLowerCase();
    let result = q
      ? list.filter(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            (f.description || "").toLowerCase().includes(q),
        )
      : list;
    if (onlyVeg) result = result.filter((f) => f.isVegetarian);
    if (maxSpice != null)
      result = result.filter((f) => (f.spiceLevel ?? 0) <= maxSpice);
    if (excludeAllergens.length > 0)
      result = result.filter(
        (f) => !(f.allergens || []).some((a) => excludeAllergens.includes(a)),
      );
    return result;
  }, [activeCategory, search, onlyVeg, maxSpice, excludeAllergens]);

  if (!categories.length) {
    return (
      <p className="text-soft-text-soft text-center py-16">
        Меню пока пустое. Владелец добавит блюда в приложении Store.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 bg-soft-surface border border-soft-border rounded-full px-4 py-2.5 shadow-soft-sm max-w-md">
        <Search className="w-4 h-4 text-soft-text-muted shrink-0" />
        <input
          type="search"
          placeholder="Поиск блюда..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-soft-text placeholder-soft-text-muted text-sm"
        />
      </div>

      {/* Категории — чипы */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`shrink-0 flex flex-col items-center gap-2 min-w-[88px] px-4 py-3 rounded-2xl border transition-colors ${
                active
                  ? "border-soft-accent bg-soft-accent-soft"
                  : "border-soft-border bg-soft-surface hover:border-soft-accent"
              }`}
            >
              <span className="text-2xl">{categoryIcon(c.title)}</span>
              <span
                className={`text-xs font-extrabold text-center ${
                  active ? "text-soft-accent" : "text-soft-text"
                }`}
              >
                {c.title}
              </span>
              <span className="text-[10px] text-soft-text-muted">
                {c.foods?.length ?? 0} шт.
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOnlyVeg((v) => !v)}
          className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
            onlyVeg
              ? "bg-soft-accent text-white border-soft-accent"
              : "bg-soft-surface-2 border-soft-border text-soft-text-soft"
          }`}
        >
          🥦 Вегетарианское
        </button>
        {[1, 2, 3].map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setMaxSpice(maxSpice === lvl ? null : lvl)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
              maxSpice === lvl
                ? "bg-soft-accent text-white border-soft-accent"
                : "bg-soft-surface-2 border-soft-border text-soft-text-soft"
            }`}
          >
            {"🌶️".repeat(lvl)} не острее
          </button>
        ))}
      </div>

      <h2 className="text-lg font-extrabold text-soft-text">
        {activeCategory?.title}
      </h2>

      {foods.length === 0 ? (
        <p className="text-soft-text-soft">Ничего не найдено</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {foods.map((f) => (
            <article
              key={f.id}
              className="bg-soft-surface border border-soft-border rounded-2xl p-3 flex gap-3 hover:border-soft-accent transition-colors cursor-pointer items-center min-h-[120px]"
              onClick={() => setDetailFood(f)}
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-soft-surface-2 shrink-0 border border-soft-border">
                <img
                  src={foodImageUrl(f.title, f.image)}
                  alt={f.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 flex flex-col justify-between h-full min-w-0 py-0.5">
                <div>
                  <h3 className="font-extrabold text-sm leading-snug line-clamp-1 text-soft-text">
                    {f.title}
                  </h3>
                  {f.description && (
                    <p className="text-xs text-soft-text-soft mt-0.5 line-clamp-2 leading-normal">
                      {f.description}
                    </p>
                  )}
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-soft-accent font-extrabold text-sm sm:text-base whitespace-nowrap">
                      {f.price} {currencySymbol}
                    </p>
                    {(f.spiceLevel ?? 0) > 0 && (
                      <span title={`Острота ${f.spiceLevel}/3`}>
                        {"🌶️".repeat(f.spiceLevel ?? 0)}
                      </span>
                    )}
                    <p className="text-[10px] text-soft-text-muted mt-0.5 whitespace-nowrap flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-current text-soft-rating" />{" "}
                      {f.averageRating ? f.averageRating.toFixed(1) : "—"} ·{" "}
                      {f.reviewCount ?? 0} отз.
                    </p>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    <AddToCartButton
                      food={f}
                      restaurantId={restaurantId}
                      restaurantName={restaurantName}
                      compact={true}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {detailFood && (
        <FoodDetailModal
          food={detailFood}
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          currencySymbol={currencySymbol}
          onClose={() => setDetailFood(null)}
        />
      )}
    </>
  );
}

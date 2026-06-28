// dastbadast-multivendor-web/components/FoodCard.tsx
"use client";

import { Star, Plus } from "lucide-react";
import { useCart } from "@/lib/cart-context";

type Food = {
  id: string;
  title: string;
  price: number;
  image?: string | null;
  description?: string | null;
  averageRating?: number;
  reviewCount?: number;
  restaurantId: string;
  restaurantName: string;
};

const FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=400&q=80",
  "https://images.unsplash.com/photo-1432139509613-5c4255815697?w=400&q=80",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function coverFor(name: string, image?: string | null) {
  if (image && image.trim()) return image;
  return FOOD_IMAGES[hash(name) % FOOD_IMAGES.length];
}

export function FoodCard({
  food,
  currencySymbol,
}: {
  food: Food;
  currencySymbol: string;
}) {
  const { add, items } = useCart();
  const inCart = items.find((i) => i.foodId === food.id);

  return (
    <article className="snap-start shrink-0 w-[200px] sm:w-[220px] bg-soft-surface border border-soft-border rounded-2xl p-3 hover:border-soft-accent hover:shadow-soft transition-all group flex flex-col">
      {/* 1) ФОТО СВЕРХУ — прямоугольное (rounded-2xl), НЕ круглое */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-soft-surface-2">
        <img
          src={coverFor(food.title, food.image)}
          alt={food.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = `https://placehold.co/300x225/F4EFE7/6B6358?text=${encodeURIComponent(food.title)}`;
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Бейдж "в корзине" — теперь НА фото, а не вместе с кнопкой */}
        {inCart && (
          <span className="absolute top-2 left-2 bg-soft-accent text-white text-[10px] font-extrabold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 shadow-soft-sm">
            {inCart.quantity}
          </span>
        )}
      </div>

      {/* 2) НАЗВАНИЕ И ОТЗЫВЫ — НИЖЕ фото, ВНЕ аватара */}
      <div className="mt-3 flex-1 min-w-0">
        <h3 className="font-bold text-sm text-soft-text truncate">
          {food.title}
        </h3>
        {typeof food.averageRating === "number" && food.averageRating > 0 ? (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 text-soft-rating fill-current shrink-0" />
            <span className="text-xs font-bold text-soft-text-soft">
              {food.averageRating.toFixed(1)}
            </span>
            <span className="text-xs text-soft-text-muted">
              · {food.reviewCount ?? 0} отз.
            </span>
          </div>
        ) : (
          <p className="text-xs text-soft-text-muted mt-1">
            Новый · без отзывов
          </p>
        )}
      </div>

      {/* 3) ЦЕНА + КНОПКА ДОБАВЛЕНИЯ — ВНИЗУ карточки, ВНЕ аватара */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-soft-accent font-extrabold text-base whitespace-nowrap">
          {food.price} {currencySymbol}
        </p>
        <button
          type="button"
          aria-label="Добавить в корзину"
          onClick={(e) => {
            e.stopPropagation();
            add({
              foodId: food.id,
              title: food.title,
              price: food.price,
              image: coverFor(food.title, food.image),
              description: food.description ?? undefined,
              quantity: 1,
              restaurantId: food.restaurantId,
              restaurantName: food.restaurantName,
            });
          }}
          className="w-9 h-9 rounded-full bg-soft-accent hover:bg-soft-accent-dark text-white flex items-center justify-center shadow-soft-sm active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}

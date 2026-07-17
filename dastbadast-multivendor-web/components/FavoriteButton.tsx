// dastbadast-multivendor-web/components/FavoriteButton.tsx
// ⭐ NEW: кнопка "добавить в избранное" — переиспользуется в RestaurantCard
// и FoodCard. Не залогинен → открываем AuthModal вместо мутации.
"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { Heart } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  TOGGLE_FAVORITE_RESTAURANT,
  TOGGLE_FAVORITE_FOOD,
} from "@/lib/queries";
import { AuthModal } from "./AuthModal";

export function FavoriteButton({
  type,
  id,
  isFavorite,
  className = "",
}: {
  type: "restaurant" | "food";
  id: string;
  isFavorite: boolean;
  className?: string;
}) {
  const { user, mounted } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const mutationDoc =
    type === "restaurant" ? TOGGLE_FAVORITE_RESTAURANT : TOGGLE_FAVORITE_FOOD;
  const variables =
    type === "restaurant" ? { restaurantId: id } : { foodId: id };
  const typename = type === "restaurant" ? "Restaurant" : "Food";
  const mutationName =
    type === "restaurant" ? "toggleFavoriteRestaurant" : "toggleFavoriteFood";

  const [toggle, { loading }] = useMutation(mutationDoc, {
    variables,
    // ⭐ Оптимистичный ответ — сердечко переключается мгновенно, не дожидаясь
    // ответа сети. Apollo сам применит настоящий ответ поверх, когда придёт,
    // а по нормализованному ключу "<Typename>:<id>" обновит ЛЮБУЮ карточку
    // этого же ресторана/блюда, показанную где-либо ещё на странице.
    optimisticResponse: {
      [mutationName]: {
        __typename: typename,
        id,
        isFavorite: !isFavorite,
      },
    },
  });

  // ⭐ mounted-гейт как и у остального auth-UI в проекте (LeftSidebar,
  // AuthButtons) — до гидратации не знаем, залогинен ли пользователь,
  // поэтому не рискуем мигнуть неправильным состоянием.
  const active = mounted && user ? isFavorite : false;

  return (
    <>
      <button
        type="button"
        aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
        aria-pressed={active}
        disabled={loading}
        onClick={(e) => {
          // карточки — это <Link>, кнопка лежит поверх картинки
          e.preventDefault();
          e.stopPropagation();
          if (!mounted) return;
          if (!user) {
            setAuthOpen(true);
            return;
          }
          toggle().catch(() => {
            /* ошибка сети — Apollo откатит optimisticResponse сам */
          });
        }}
        className={`w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-soft-sm active:scale-90 transition-all disabled:opacity-60 ${className}`}
      >
        <Heart
          className={`w-4 h-4 transition-colors ${
            active ? "text-soft-accent fill-current" : "text-soft-text-soft"
          }`}
        />
      </button>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

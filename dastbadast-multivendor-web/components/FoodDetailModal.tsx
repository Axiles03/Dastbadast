// dastbadast-multivendor-web/components/FoodDetailModal.tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useAuth } from "@/lib/auth-context";
import { ADD_FOOD_REVIEW, GET_FOOD_REVIEWS } from "@/lib/queries";
import { foodImageUrl } from "@/lib/category-icons";
import { AddToCartButton } from "./AddToCartButton";
import { Star, X } from "lucide-react";

type Review = {
  id: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export function FoodDetailModal({
  food,
  restaurantId,
  restaurantName,
  currencySymbol,
  onClose,
}: {
  food: {
    id: string;
    title: string;
    description?: string;
    price: number;
    image?: string;
    averageRating?: number;
    reviewCount?: number;
    reviews?: Review[];
  };
  restaurantId: string;
  restaurantName: string;
  currencySymbol: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"error" | "success">("error");

  const { data, refetch } = useQuery(GET_FOOD_REVIEWS, {
    variables: { foodId: food.id },
  });
  const [addReview, { loading }] = useMutation(ADD_FOOD_REVIEW);

  const reviews: Review[] = data?.foodReviews ?? food.reviews ?? [];

  const submitReview = async () => {
    setMsg(null);
    if (!user) {
      setMsg("Войдите, чтобы оставить отзыв");
      setMsgType("error");
      return;
    }
    const trimmed = comment.trim();
    if (!trimmed) {
      setMsg("Напишите комментарий к отзыву");
      setMsgType("error");
      return;
    }
    try {
      await addReview({
        variables: {
          input: { foodId: food.id, rating, comment: trimmed },
        },
      });
      setComment("");
      setMsg("Спасибо за отзыв!");
      setMsgType("success");
      refetch();
    } catch (e: any) {
      setMsg(e?.message ?? "Не удалось отправить отзыв");
      setMsgType("error");
    }
  };

  const fallback = `https://placehold.co/600x400/F4EFE7/6B6358?text=${encodeURIComponent(food.title)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Затемнение */}
      <button
        type="button"
        className="absolute inset-0 bg-soft-dark-2/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Закрыть"
      />

      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-soft-surface border border-soft-border rounded-t-3xl sm:rounded-3xl shadow-soft-xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Шапка с фото */}
        <div className="relative w-full h-52 sm:h-60 shrink-0">
          <img
            src={foodImageUrl(food.title, food.image) || fallback}
            alt={food.title}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = fallback;
            }}
            className="w-full h-full object-cover rounded-t-3xl"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm text-soft-text-soft hover:text-soft-text flex items-center justify-center shadow-soft-sm active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-3 bg-soft-surface/95 backdrop-blur-sm border border-soft-border rounded-full px-3 py-1 text-xs font-extrabold text-soft-text-soft">
            {restaurantName}
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Заголовок + описание */}
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-soft-text tracking-tight">
              {food.title}
            </h2>
            {food.description && (
              <p className="text-sm text-soft-text-soft mt-1.5 leading-relaxed">
                {food.description}
              </p>
            )}
          </div>

          {/* Цена + рейтинг + кнопка добавления в корзину */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-soft-surface-2 border border-soft-border rounded-2xl">
            <div className="min-w-0">
              <div className="text-2xl font-extrabold text-soft-accent">
                {food.price} {currencySymbol}
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-soft-text-soft">
                <Star className="w-3.5 h-3.5 text-soft-rating fill-current" />
                <span className="font-bold text-soft-text">
                  {food.averageRating?.toFixed(1) ?? "—"}
                </span>
                <span>·</span>
                <span>
                  {food.reviewCount ?? reviews.length}{" "}
                  {food.reviewCount === 1 ? "отзыв" : "отзывов"}
                </span>
              </div>
            </div>
            <AddToCartButton
              food={food}
              restaurantId={restaurantId}
              restaurantName={restaurantName}
            />
          </div>

          {/* Отзывы */}
          <div>
            <h3 className="font-extrabold text-soft-text mb-3 text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-soft-rating fill-current" />
              Отзывы покупателей
            </h3>
            {reviews.length === 0 ? (
              <p className="text-sm text-soft-text-soft bg-soft-surface-2 border border-soft-border rounded-2xl px-4 py-3">
                Пока нет отзывов. Будьте первым!
              </p>
            ) : (
              <ul className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className="bg-soft-surface-2 border border-soft-border rounded-2xl p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-soft-text">
                        {r.userName || "Гость"}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-soft-rating text-sm">
                        {"★".repeat(r.rating)}
                        <span className="text-soft-border">
                          {"☆".repeat(5 - r.rating)}
                        </span>
                      </span>
                    </div>
                    <p className="text-sm text-soft-text-soft mt-1.5 leading-relaxed">
                      {r.comment}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Форма нового отзыва */}
          <div className="bg-soft-surface-2 border border-soft-border rounded-2xl p-4 space-y-3">
            <p className="text-sm font-extrabold text-soft-text">
              Оставить свой отзыв
            </p>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-2xl transition-transform active:scale-110 leading-none ${
                    n <= rating ? "text-soft-rating" : "text-soft-border"
                  }`}
                  aria-label={`Поставить ${n} ${n === 1 ? "звезду" : "звёзд"}`}
                >
                  ★
                </button>
              ))}
              <span className="text-xs text-soft-text-muted ml-1.5">
                {rating} из 5
              </span>
            </div>

            <textarea
              className="w-full bg-soft-surface border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl p-3 text-sm min-h-[88px] focus:outline-none focus:border-soft-accent transition-colors resize-none"
              placeholder="Поделитесь впечатлениями о блюде…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
            />

            {msg && (
              <p
                className={`text-sm font-semibold ${
                  msgType === "success"
                    ? "text-soft-success"
                    : "text-soft-accent"
                }`}
              >
                {msg}
              </p>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={submitReview}
              className="w-full h-12 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center shadow-soft-sm"
            >
              {loading ? "Отправка..." : "Опубликовать отзыв"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

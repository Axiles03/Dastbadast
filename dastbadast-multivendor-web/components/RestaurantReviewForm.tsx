// dastbadast-multivendor-web/components/RestaurantReviewForm.tsx
// ⭐ NEW: раньше ADD_RESTAURANT_REVIEW был объявлен в lib/queries.ts, но
// никогда не использовался ни одним компонентом — оставить отзыв о
// ресторане было просто негде. Форма ниже — по образцу уже работающего
// FoodReviewForm (components/FoodDetailModal.tsx).
"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ADD_RESTAURANT_REVIEW } from "@/lib/queries";

export function RestaurantReviewForm({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [addReview] = useMutation(ADD_RESTAURANT_REVIEW);

  if (!user) {
    return (
      <div className="bg-soft-surface-2 border border-soft-border rounded-2xl px-4 py-3 text-sm text-soft-text-soft text-center">
        🔐{" "}
        <Link
          href="/address"
          className="text-soft-accent font-bold hover:underline"
        >
          Войдите
        </Link>
        , чтобы оставить отзыв о ресторане
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    if (rating < 1 || rating > 5) {
      setError("Поставьте оценку от 1 до 5");
      return;
    }
    const trimmed = comment.trim();
    if (!trimmed) {
      setError("Напишите комментарий");
      return;
    }
    setSubmitting(true);
    try {
      await addReview({
        variables: { input: { restaurantId, rating, comment: trimmed } },
      });
      setComment("");
      setRating(5);
      setSuccess(true);
      // ⭐ Страница ресторана — server component (force-dynamic), поэтому
      // после успешной отправки просто просим Next.js перезапросить её
      // данные — новый отзыв и пересчитанный рейтинг подтянутся сами.
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Не удалось отправить отзыв");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm">
      <h3 className="font-extrabold text-soft-text mb-3 text-base">
        ✍️ Оставить отзыв о ресторане
      </h3>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setRating(n);
              setSuccess(false);
            }}
            className="p-0.5 active:scale-90 transition-transform"
            aria-label={`Поставить ${n}`}
          >
            <Star
              className={`w-7 h-7 ${
                n <= rating
                  ? "text-soft-rating fill-current"
                  : "text-soft-border"
              }`}
            />
          </button>
        ))}
        <span className="text-sm text-soft-text-soft ml-1.5 font-bold">
          {rating} / 5
        </span>
      </div>
      <textarea
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setSuccess(false);
        }}
        placeholder="Расскажите о вашем опыте с этим рестораном..."
        className="w-full bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] focus:outline-none focus:border-soft-accent resize-none mb-2"
        maxLength={500}
      />
      {error && <p className="text-sm text-soft-accent mb-2">⚠ {error}</p>}
      {success && !error && (
        <p className="text-sm text-soft-success mb-2">Спасибо за отзыв!</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full h-11 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl disabled:opacity-50 active:scale-[0.99] transition-all"
      >
        {submitting ? "Отправляем..." : "Опубликовать отзыв"}
      </button>
    </div>
  );
}

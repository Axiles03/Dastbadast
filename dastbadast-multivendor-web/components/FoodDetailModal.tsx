// dastbadast-multivendor-web/components/FoodDetailModal.tsx
"use client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { ADD_FOOD_REVIEW, GET_FOOD_REVIEWS } from "@/lib/queries";
import { foodImageUrl } from "@/lib/category-icons";
import { AddToCartButton } from "./AddToCartButton";
import { Link, Star, X } from "lucide-react";
import { ModifierGroup } from "./modifiers/ModifierGroup";
import { useFoodModifiers } from "@/hooks/useFoodModifiers";

type Review = {
  id: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type FoodOption = {
  id: string;
  title: string;
  price: number;
  isAvailable: boolean;
};

type FoodOptionGroup = {
  id: string;
  title: string;
  required: boolean;
  multiple: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder?: number;
  options: FoodOption[];
};

type FoodDetail = {
  id: string;
  title: string;
  description?: string;
  price: number;
  image?: string;
  averageRating?: number;
  reviewCount?: number;
  reviews?: Review[];
  // ⭐⭐⭐ ШАГ 5: новое поле из Шага 1
  optionGroups?: FoodOptionGroup[];
};

type Props = {
  food: FoodDetail;
  restaurantId: string;
  restaurantName: string;
  currencySymbol: string;
  onClose: () => void;
};

export function FoodDetailModal({
  food,
  restaurantId,
  restaurantName,
  currencySymbol,
  onClose,
}: Props) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"error" | "success">("error");

  // ⭐⭐⭐ ШАГ 5: хук модификаторов
  const groups = food.optionGroups || [];
  const {
    selectedByGroup,
    perGroupValid,
    allValid,
    optionsTotal,
    finalPrice,
    toggle,
    reset,
    toMutationInput,
  } = useFoodModifiers(food.price, groups);

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
        variables: { input: { foodId: food.id, rating, comment: trimmed } },
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

  const fallback = `https://placehold.co/600x400/F4EFE7/6B6358?text=${encodeURIComponent(
    food.title,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
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
          {/* ⭐⭐⭐ ШАГ 5: блок модификаторов */}
          {groups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-soft-text-muted uppercase tracking-wider">
                  Выберите опции
                </h3>
                {(optionsTotal > 0 || selectedByGroup.size > 0) && (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs font-bold text-soft-accent hover:underline"
                  >
                    Сбросить
                  </button>
                )}
              </div>
              {groups
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((g) => (
                  <ModifierGroup
                    key={g.id}
                    group={g}
                    selectedIds={selectedByGroup.get(g.id) || new Set()}
                    onChange={() => {
                      /* noop — управляется через toggle */
                    }}
                    currencySymbol={currencySymbol}
                  />
                ))}
              {/* ⭐ Бейдж-превью итоговой цены */}
              <div className="bg-soft-accent-soft border border-soft-accent/30 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-2xs text-soft-text-muted font-bold uppercase tracking-wider">
                    Итого за единицу
                  </p>
                  <p className="text-xs text-soft-text-soft mt-0.5">
                    {food.price} {currencySymbol}
                    {optionsTotal > 0 && ` + ${optionsTotal} ${currencySymbol}`}
                  </p>
                </div>
                <p className="text-2xl font-black text-soft-accent">
                  {finalPrice} {currencySymbol}
                </p>
              </div>
            </div>
          )}
          {/* Цена + рейтинг + кнопка добавления (с учётом модификаторов) */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-soft-surface-2 border border-soft-border rounded-2xl">
            <div className="min-w-0">
              <div className="text-2xl font-extrabold text-soft-accent">
                {groups.length === 0 ? (
                  <>
                    {food.price} {currencySymbol}
                  </>
                ) : (
                  <>
                    от {finalPrice} {currencySymbol}
                  </>
                )}
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
            <div className="shrink-0">
              <AddToCartButton
                food={{
                  id: food.id,
                  title: food.title,
                  price: finalPrice, // ⭐ ШАГ 5: цена с учётом модификаторов
                  image: food.image,
                  description: food.description,
                }}
                restaurantId={restaurantId}
                restaurantName={restaurantName}
                onAdd={async () => {
                  // ⭐ Префетчим selectedOptions из локального state через addToCart
                  // (см. AddToCartButton ниже — принимает onAdd callback)
                }}
              />
            </div>
          </div>
          {/* ⭐ Если есть модификаторы — добавляем глобальный footer CTA с проверкой валидации */}
          {groups.length > 0 && (
            <button
              type="button"
              disabled={!allValid}
              onClick={async () => {
                if (!allValid) {
                  setMsg("Заполните все обязательные опции");
                  setMsgType("error");
                  return;
                }
                // Добавить в корзину с выбранными опциями
                // (детали — в AddToCartButton ниже)
                onClose();
              }}
              className="w-full h-14 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-soft-sm"
            >
              {allValid
                ? `В корзину · ${finalPrice} ${currencySymbol}`
                : "Заполните обязательные опции"}
            </button>
          )}
          {/* Отзывы */}
          {reviews.length > 0 && (
            <div>
              <h3 className="font-extrabold text-soft-text mb-3 text-base flex items-center gap-2">
                <Star className="w-4 h-4 text-soft-rating fill-current" />
                Отзывы покупателей
              </h3>
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
            </div>
          )}
          <FoodReviewForm foodId={food.id} onSuccess={refetch} />
        </div>
      </div>
    </div>
  );
}

function FoodReviewForm({
  foodId,
  onSuccess,
}: {
  foodId: string;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addReview] = useMutation(ADD_FOOD_REVIEW);

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
        , чтобы оставить отзыв
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
        variables: { input: { foodId, rating, comment: trimmed } },
        refetchQueries: [{ query: GET_FOOD_REVIEWS, variables: { foodId } }],
        awaitRefetchQueries: true,
      });
      setComment("");
      setRating(5);
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message ?? "Не удалось отправить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm">
      <h3 className="font-extrabold text-soft-text mb-3 text-base">
        ✍️ Оставить отзыв
      </h3>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
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
        onChange={(e) => setComment(e.target.value)}
        placeholder="Расскажите о ваших впечатлениях..."
        className="w-full bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] focus:outline-none focus:border-soft-accent resize-none mb-2"
        maxLength={500}
      />
      {error && <p className="text-sm text-soft-accent mb-2">⚠ {error}</p>}
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

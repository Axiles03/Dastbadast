// dastbadast-multivendor-web/components/AddToCartButton.tsx
"use client";
import { useCart } from "@/lib/cart-context";
import { useState } from "react";
import { coverFor } from "./FoodCard"; // ⭐ берём готовую реализацию, без заглушек

export function AddToCartButton({
  food,
  restaurantId,
  restaurantName,
  compact,
  onAdd,
  disabled,
}: {
  food: {
    id: string;
    title: string;
    price: number;
    image?: string;
    description?: string;
  };
  restaurantId: string;
  restaurantName: string;
  compact?: boolean;
  onAdd?: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const { add, items } = useCart();
  const [flash, setFlash] = useState(false);
  const inCart = items.find((i) => i.foodId === food.id);
  const [replacedNotice, setReplacedNotice] = useState(false);
  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!food.id || !restaurantId) return;
    const result = add({
      foodId: food.id,
      title: food.title,
      price: food.price,
      image: coverFor(food.title, food.image),
      description: food.description,
      quantity: 1,
      restaurantId,
      restaurantName,
    });
    if (result !== "invalid") {
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
      onAdd?.();
      if (result === "replaced") {
        setReplacedNotice(true);
        setTimeout(() => setReplacedNotice(false), 2500);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleAdd}
        disabled={!food.id || !restaurantId}
        className={`bg-dbd-accent hover:brightness-110 text-white font-semibold rounded-xl disabled:opacity-40 ${
          compact ? "text-xs px-2.5 py-1.5" : "text-sm px-3 py-2 min-w-[88px]"
        }`}
      >
        {inCart ? `+ ${inCart.quantity}` : "+"}
      </button>
      {flash && <span className="text-[10px] text-dbd-accent">✓</span>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Star, Clock, MapPin } from "lucide-react";

const COVERS = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=900&q=80",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=900&q=80",
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=900&q=80",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function RestaurantCard({
  restaurant,
  currencySymbol,
  variant = "grid",
}: {
  restaurant: any;
  currencySymbol: string;
  variant?: "grid" | "peek";
}) {
  const cover = COVERS[hash(restaurant.id) % COVERS.length];
  const isPeek = variant === "peek";

  return (
    <Link
      href={`/restaurant/${restaurant.slug || restaurant.id}`}
      className={`group block bg-soft-surface border border-soft-border rounded-2xl overflow-hidden hover:border-soft-accent hover:shadow-soft transition-all ${
        isPeek
          ? "snap-center shrink-0 w-[280px] sm:w-[340px] opacity-60 hover:opacity-100"
          : "snap-start shrink-0 w-[260px] sm:w-[280px]"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-soft-surface-2">
        <img
          src={restaurant.image || cover}
          alt={restaurant.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = `https://placehold.co/600x400/F4EFE7/6B6358?text=${encodeURIComponent(restaurant.name)}`;
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-extrabold text-soft-text shadow-soft-sm">
          <Star className="w-3 h-3 text-soft-rating fill-current" />{" "}
          {restaurant.rating}
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-bold text-sm text-soft-text group-hover:text-soft-accent transition-colors truncate">
          {restaurant.name}
        </h3>
        <div className="mt-2 flex items-center justify-between text-xs text-soft-text-soft">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-0.5">
              <Clock className="w-3.5 h-3.5" /> {restaurant.deliveryTime} мин
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="w-3.5 h-3.5" /> {restaurant.distance} км
            </span>
          </div>
          <span className="font-bold text-soft-accent">
            от {restaurant.minimumOrder} {currencySymbol}
          </span>
        </div>
      </div>
    </Link>
  );
}

"use client";

import { ReactNode, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function HorizontalCarousel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: "l" | "r") => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7 * (dir === "r" ? 1 : -1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className={`mb-8 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-lg text-soft-text">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scroll("l")}
              aria-label="Назад"
              className="w-8 h-8 rounded-full bg-soft-surface border border-soft-border text-soft-text-soft hover:text-soft-accent hover:border-soft-accent flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("r")}
              aria-label="Вперёд"
              className="w-8 h-8 rounded-full bg-soft-surface border border-soft-border text-soft-text-soft hover:text-soft-accent hover:border-soft-accent flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-5 px-5 sm:mx-0 sm:px-0"
      >
        {children}
      </div>
    </section>
  );
}

"use client";

import {
  Clock,
  Sparkles,
  ChefHat,
  Bike,
  PackageCheck,
  PartyPopper,
  MapPin,
} from "lucide-react";
import { STATUS_LABELS } from "@/lib/order-status";

type RiderPos = { lat: number; lng: number } | null;

type Stage = {
  icon: any;
  image: string;
  headline: string;
  minutes: number;
  subline: string;
  ringColor: string;
};

const STAGES: Record<string, Stage> = {
  PENDING: {
    icon: Clock,
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
    headline: "Заказ отправлен на кухню",
    minutes: 3,
    subline: "Ресторан подтвердит приём в течение пары минут",
    ringColor: "#F5A623",
  },
  ACCEPTED: {
    icon: ChefHat,
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
    headline: "Заказ принят в работу",
    minutes: 12,
    subline: "Шеф-повар готовит ваш заказ",
    ringColor: "#F26A4A",
  },
  ASSIGNED: {
    icon: Bike,
    image:
      "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&q=80",
    headline: "Курьер выехал к ресторану",
    minutes: 8,
    subline: "Курьер скоро заберёт ваш заказ",
    ringColor: "#6E5BFF",
  },
  PICKED: {
    icon: Bike,
    image:
      "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&q=80",
    headline: "Курьер уже в пути к вам",
    minutes: 6,
    subline: "Следите за курьером на карте",
    ringColor: "#6E5BFF",
  },
  AWAITING_CONFIRMATION: {
    icon: PackageCheck,
    image:
      "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&q=80",
    headline: "Подтвердите получение",
    minutes: 0,
    subline: "Курьер доставил заказ — нажмите «Получил»",
    ringColor: "#16A34A",
  },
  DELIVERED: {
    icon: PartyPopper,
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
    headline: "Приятного аппетита!",
    minutes: 0,
    subline: "Спасибо за заказ. Будем рады видеть снова ☺",
    ringColor: "#16A34A",
  },
  CANCELLED: {
    icon: Clock,
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
    headline: "Заказ отменён",
    minutes: 0,
    subline: "Если это ошибка — свяжитесь с поддержкой",
    ringColor: "#DC2626",
  },
};

export function OrderStatusStage({
  status,
  onAsk,
}: {
  status: keyof typeof STATUS_LABELS;
  onAsk?: () => void;
}) {
  const s = STAGES[status] ?? STAGES.PENDING;
  const Icon = s.icon;
  return (
    <div className="bg-soft-surface border border-soft-border rounded-3xl p-6 sm:p-10 text-center shadow-soft-sm">
      <div className="text-sm text-soft-text-soft">
        Ваш заказ будет готов через
      </div>
      <div className="text-3xl sm:text-4xl font-extrabold text-soft-accent mt-1">
        {s.minutes} {minutesWord(s.minutes)}
      </div>

      {/* Концентрические кольца как на скриншоте 2 */}
      <div className="relative mt-6 mx-auto w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]">
        {/* Внешнее кольцо */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin-slow"
          viewBox="0 0 400 400"
        >
          <circle
            cx="200"
            cy="200"
            r="190"
            fill="none"
            stroke={s.ringColor}
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
          <circle cx="200" cy="10" r="4" fill={s.ringColor} />
          <circle
            cx="390"
            cy="200"
            r="3"
            fill={s.ringColor}
            fillOpacity="0.5"
          />
          <circle
            cx="200"
            cy="390"
            r="3"
            fill={s.ringColor}
            fillOpacity="0.5"
          />
          <circle cx="10" cy="200" r="3" fill={s.ringColor} fillOpacity="0.5" />
        </svg>
        {/* Внутреннее кольцо */}
        <svg
          className="absolute inset-[40px] w-[calc(100%-80px)] h-[calc(100%-80px)] animate-spin-reverse"
          viewBox="0 0 320 320"
        >
          <circle
            cx="160"
            cy="160"
            r="150"
            fill="none"
            stroke={s.ringColor}
            strokeOpacity="0.2"
            strokeWidth="1.5"
            strokeDasharray="6 8"
          />
          <circle cx="160" cy="14" r="3" fill={s.ringColor} />
        </svg>

        {/* Центральный круг с эмодзи/иконкой */}
        <div className="absolute inset-[70px] sm:inset-[90px] rounded-full overflow-hidden bg-soft-accent-soft border-2 border-white shadow-soft-lg flex items-center justify-center">
          <img
            src={s.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon
              className="w-16 h-16 text-soft-accent drop-shadow"
              strokeWidth={1.5}
            />
          </div>
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl font-extrabold text-soft-text mt-8">
        {s.headline}
      </h2>
      <p className="text-soft-text-soft text-sm mt-1">{s.subline}</p>
    </div>
  );
}

function minutesWord(n: number) {
  if (n === 0) return "";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "минута";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "минуты";
  return "минут";
}

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
import {
  useNow,
  formatCountdown,
  getPrepRemainingSeconds,
  getPrepTotalSeconds,
} from "@/lib/order-timers";

type RiderPos = { lat: number; lng: number } | null;

type Stage = {
  icon: any;
  image: string;
  headline: string;
  /** Статический fallback (мин), если нет динамических данных */
  minutes: number;
  subline: string;
  ringColor: string;
  /** Использовать живой динамический таймер для этого статуса */
  liveTimer?: boolean;
};

const STAGES: Record<string, Stage> = {
  PENDING: {
    icon: Clock,
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
    headline: "Заказ отправлен на кухню",
    minutes: 3,
    subline: "Ресторан подтвердит приём в течение пары минуты",
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
    liveTimer: true,
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
  acceptedAt,
  prepTime,
  onAsk,
}: {
  status: keyof typeof STATUS_LABELS;
  acceptedAt?: string | null;
  prepTime?: number | null;
  onAsk?: () => void;
}) {
  const s = STAGES[status] ?? STAGES.PENDING;
  const Icon = s.icon;

  // ⭐ Тикаем раз в секунду — используется только если нужен живой таймер
  const now = useNow(1000);

  // ⭐⭐⭐ УСИЛЕННАЯ ПРОВЕРКА: живой режим только если ВСЁ есть
  const useLive =
    s.liveTimer === true &&
    status === "ACCEPTED" &&
    !!acceptedAt &&
    !!prepTime &&
    Number(prepTime) > 0; // защита от 0/NaN

  const liveRemainingSec = useLive
    ? getPrepRemainingSeconds(acceptedAt!, prepTime!, now)
    : -1;
  const liveTotalSec = useLive ? getPrepTotalSeconds(prepTime!) : -1;

  // Что показывать в блоке «X минут»
  const minutesToShow = useLive
    ? Math.max(0, Math.ceil(liveRemainingSec / 60))
    : s.minutes;

  const sublineText = useLive
    ? `Шеф-повар готовит. Срок: ${prepTime} мин. с момента принятия.`
    : s.subline;

  // Прогресс готовки (0–100%), если есть динамика
  const progressPct =
    useLive && liveTotalSec > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((liveTotalSec - liveRemainingSec) / liveTotalSec) * 100,
          ),
        )
      : null;

  return (
    <div className="bg-soft-surface border border-soft-border rounded-3xl p-6 sm:p-10 text-center shadow-soft-sm">
      <div className="text-sm text-soft-text-soft">
        {useLive ? "Заказ будет готов через" : "Ваш заказ будет готов через"}
      </div>
      <div className="text-3xl sm:text-4xl font-extrabold text-soft-accent mt-1">
        {minutesToShow} {minutesWord(minutesToShow)}
      </div>

      {/* ⭐ Если живой режим — показываем точный таймер MM:SS + прогресс-бар */}
      {useLive && liveRemainingSec > 0 && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="text-3xl font-extrabold font-mono text-soft-text tabular-nums tracking-widest">
            ⏱ {formatCountdown(liveRemainingSec * 1000)}
          </div>
          {progressPct !== null && (
            <div className="w-full max-w-xs h-2 bg-soft-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-soft-accent rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Концентрические кольца */}
      <div className="relative mt-6 mx-auto w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]">
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
      <p className="text-soft-text-soft text-sm mt-1">{sublineText}</p>
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

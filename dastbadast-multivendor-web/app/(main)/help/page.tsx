"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  CreditCard,
} from "lucide-react";

const FAQ = [
  {
    q: "Как сделать заказ?",
    a: "Выберите ресторан в каталоге, добавьте блюда в корзину, укажите адрес доставки (внутри зоны) и подтвердите заказ. Курьер свяжется с вами в ближайшее время.",
  },
  {
    q: "Сколько стоит доставка?",
    a: "Стоимость рассчитывается автоматически по расстоянию: 10 сом. за первый километр + 3 сом. за каждый последующий километр. Точную стоимость увидите перед подтверждением заказа.",
  },
  {
    q: "Какие способы оплаты доступны?",
    a: "Сейчас доступна оплата наличными при получении (COD). В ближайшее время подключим Alif Mobi и Dushanbe City Bank.",
  },
  {
    q: "Как отменить заказ?",
    a: "Отменить заказ можно в истории заказов до того, как ресторан его примет. После принятия — только через звонок в поддержку.",
  },
  {
    q: "Что делать, если курьер не приехал?",
    a: "Свяжитесь с поддержкой через чат с курьером или по телефону. Среднее время доставки — 30-40 минут, в часы пик возможно до 60 минут.",
  },
  {
    q: "Можно ли изменить адрес доставки?",
    a: "Да, до момента, когда курьер заберет заказ. Перейдите в раздел «Мои адреса» и выберите новый.",
  },
  {
    q: "Мой адрес вне зоны доставки. Что делать?",
    a: "Сервис работает только в пределах активной зоны (сейчас — центр Душанбе). Если ваш адрес вне зоны, мы пока не сможем доставить заказ. Следите за расширением географии.",
  },
  {
    q: "Как стать курьером или рестораном?",
    a: "Отправьте заявку на support@dastbadast.tj с пометкой «Курьер» или «Ресторан», и мы свяжемся с вами в течение 24 часов.",
  },
  {
    q: "Безопасна ли оплата наличными?",
    a: "Да. Деньги передаются курьеру только после получения заказа и проверки содержимого. Все онлайн-платежи (когда подключим) будут защищены банковским шифрованием 3D-Secure.",
  },
];

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> На главную
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-soft-info-soft text-soft-info flex items-center justify-center">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Помощь
          </h1>
          <p className="text-sm text-soft-text-soft">
            Ответы на частые вопросы и поддержка
          </p>
        </div>
      </div>

      {/* Контакты поддержки */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href="tel:+992446000000"
          className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm flex items-center gap-3 hover:border-soft-success transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-soft-success-soft text-soft-success flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-soft-text-muted">Горячая линия</div>
            <div className="text-sm font-bold text-soft-text truncate">
              +992 44 600 00 00
            </div>
          </div>
        </a>
        <a
          href="mailto:support@dastbadast.tj"
          className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm flex items-center gap-3 hover:border-soft-accent transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-soft-accent-soft text-soft-accent flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-soft-text-muted">Email</div>
            <div className="text-sm font-bold text-soft-text truncate">
              support@dastbadast.tj
            </div>
          </div>
        </a>
        <a
          href="https://t.me/dastbadast_support"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-soft-surface border border-soft-border rounded-2xl p-4 shadow-soft-sm flex items-center gap-3 hover:border-soft-info transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-soft-info-soft text-soft-info flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-soft-text-muted">Telegram</div>
            <div className="text-sm font-bold text-soft-text truncate">
              @dastbadast_support
            </div>
          </div>
        </a>
      </div>

      {/* FAQ */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-soft-border">
          <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-soft-accent" />
            Частые вопросы
          </h2>
        </div>
        <ul>
          {FAQ.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={idx}
                className="border-b border-soft-border last:border-0"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-soft-surface-2 transition-colors"
                  aria-expanded={open}
                >
                  <span className="text-sm font-bold text-soft-text">
                    {item.q}
                  </span>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-soft-text-soft shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-soft-text-soft shrink-0" />
                  )}
                </button>
                {open && (
                  <div className="px-5 pb-4 text-sm text-soft-text-soft leading-relaxed">
                    {item.a}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* How to */}
      <section className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm space-y-5">
        <h2 className="font-extrabold text-lg text-soft-text flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-soft-accent" />
          Как сделать заказ
        </h2>

        <Step
          n={1}
          title="Найдите ресторан"
          text="Откройте главную страницу или воспользуйтесь поиском — выберите заведение, в котором хотите сделать заказ."
        />
        <Step
          n={2}
          title="Добавьте блюда в корзину"
          text="В меню ресторана нажмите «+» на понравившемся блюде — оно появится в корзине."
        />
        <Step
          n={3}
          title="Укажите адрес"
          text="В разделе «Мои адреса» добавьте точку на карте (должна быть внутри оранжевой зоны доставки)."
        />
        <Step
          n={4}
          title="Оформите заказ"
          text="На странице корзины подтвердите заказ и оплатите наличными при получении. Курьер свяжется с вами!"
        />

        <div className="bg-soft-accent-soft border border-soft-accent/20 rounded-2xl p-3 text-xs text-soft-text-soft leading-relaxed">
          💡 <strong className="text-soft-text">Совет:</strong> Следите за
          статусом заказа в реальном времени. Все обновления приходят
          автоматически через WebSocket — без обновления страницы.
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-soft-accent text-white flex items-center justify-center font-extrabold text-sm shrink-0">
        {n}
      </div>
      <div>
        <h3 className="font-extrabold text-sm text-soft-text">{title}</h3>
        <p className="text-sm text-soft-text-soft mt-0.5 leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

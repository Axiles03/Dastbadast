"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Shield, ChevronLeft } from "lucide-react";

export default function PrivacyPage() {
  useEffect(() => {
    document.title = "Политика конфиденциальности — Dastbadast";
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-bold text-soft-text-soft hover:text-soft-accent"
      >
        <ChevronLeft className="w-4 h-4" /> На главную
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-soft-accent-soft text-soft-accent flex items-center justify-center">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Политика конфиденциальности
          </h1>
          <p className="text-sm text-soft-text-soft">
            Последнее обновление: 1 января 2025
          </p>
        </div>
      </div>

      <div className="bg-soft-surface border border-soft-border rounded-3xl p-6 shadow-soft-sm space-y-5">
        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            1. Общие положения
          </h2>
          <p className="text-sm text-soft-text-soft leading-relaxed">
            <strong className="text-soft-text">Dastbadast</strong> (далее —
            «Платформа») уважает конфиденциальность пользователей и обязуется
            обеспечивать защиту персональных данных в соответствии с
            законодательством Республики Таджикистан. Настоящая Политика
            описывает, какие данные мы собираем, как используем и защищаем.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            2. Какие данные мы собираем
          </h2>
          <ul className="text-sm text-soft-text-soft space-y-1.5 list-disc pl-5 leading-relaxed">
            <li>Имя и контактные данные (email, номер телефона)</li>
            <li>Адреса доставки с географическими координатами</li>
            <li>История заказов и платежей</li>
            <li>Данные для аутентификации (хеш пароля)</li>
            <li>Push-токен для отправки уведомлений о статусе заказа</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            3. Цели использования данных
          </h2>
          <ul className="text-sm text-soft-text-soft space-y-1.5 list-disc pl-5 leading-relaxed">
            <li>Обработка и доставка заказов</li>
            <li>Связь с курьерами и ресторанами</li>
            <li>Улучшение качества обслуживания</li>
            <li>Уведомления о статусе заказа</li>
            <li>Предотвращение мошенничества</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            4. Защита данных
          </h2>
          <p className="text-sm text-soft-text-soft leading-relaxed">
            Мы применяем современные технические и организационные меры для
            защиты ваших данных от несанкционированного доступа, изменения или
            уничтожения. Все пароли хранятся в виде криптографических хешей
            (bcrypt). Передача данных между клиентом и сервером осуществляется
            по защищённому протоколу.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            5. Права пользователя
          </h2>
          <p className="text-sm text-soft-text-soft leading-relaxed">
            Вы имеете право:
          </p>
          <ul className="text-sm text-soft-text-soft space-y-1.5 list-disc pl-5 mt-1 leading-relaxed">
            <li>Запросить информацию о хранимых данных</li>
            <li>Изменить или обновить персональные данные</li>
            <li>Удалить аккаунт и все связанные с ним данные</li>
            <li>Отозвать согласие на обработку данных</li>
          </ul>
          <p className="text-sm text-soft-text-soft leading-relaxed mt-2">
            Для реализации прав обратитесь по адресу:{" "}
            <a
              href="mailto:support@dastbadast.tj"
              className="text-soft-accent font-bold hover:underline"
            >
              support@dastbadast.tj
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            6. Передача данных третьим лицам
          </h2>
          <p className="text-sm text-soft-text-soft leading-relaxed">
            Мы <strong className="text-soft-text">не передаём</strong> ваши
            персональные данные третьим лицам в коммерческих целях. Исключения:
          </p>
          <ul className="text-sm text-soft-text-soft space-y-1.5 list-disc pl-5 mt-1 leading-relaxed">
            <li>Передача адреса и контактов курьеру для исполнения заказа</li>
            <li>Передача заказа в выбранный ресторан</li>
            <li>Случаи, предусмотренные законодательством РТ</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            7. Cookies и аналитика
          </h2>
          <p className="text-sm text-soft-text-soft leading-relaxed">
            Платформа использует локальное хранилище (localStorage /
            AsyncStorage) для сохранения корзины и настроек. Мы можем
            использовать анонимную аналитику для улучшения сервиса. Вы можете
            отключить cookies в настройках браузера, однако это может ограничить
            функциональность.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            8. Изменения в политике
          </h2>
          <p className="text-sm text-soft-text-soft leading-relaxed">
            Мы можем обновлять настоящую Политику. О существенных изменениях
            пользователи будут уведомлены по email не менее чем за 14 дней до
            вступления изменений в силу.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-soft-text mb-2">
            9. Контактные данные
          </h2>
          <p className="text-sm text-soft-text-soft leading-relaxed">
            По всем вопросам, связанным с конфиденциальностью:
          </p>
          <ul className="text-sm text-soft-text-soft space-y-1.5 list-none mt-1 leading-relaxed">
            <li>
              📧 Email:{" "}
              <strong className="text-soft-text">support@dastbadast.tj</strong>
            </li>
            <li>
              📞 Телефон:{" "}
              <strong className="text-soft-text">+992 (44) 600-00-00</strong>
            </li>
            <li>
              📍 Адрес:{" "}
              <strong className="text-soft-text">
                г. Душанбе, ул. Рудаки, 1
              </strong>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

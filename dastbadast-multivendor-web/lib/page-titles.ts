export type PageMeta = { title: string; subtitle: string };

export function getPageMeta(pathname: string): PageMeta {
  if (pathname === "/") {
    return { title: "Все наши заведения", subtitle: "Полный каталог" };
  }
  if (pathname === "/orders") {
    return { title: "История заказов", subtitle: "Все ваши заказы" };
  }
  if (pathname === "/address") {
    return { title: "Адреса доставки", subtitle: "Управление адресами" };
  }
  if (pathname === "/profile") {
    return { title: "Профиль", subtitle: "Настройки аккаунта" };
  }
  if (pathname === "/edit-profile") {
    return {
      title: "Редактировать профиль",
      subtitle: "Имя, email, телефон, аватар",
    };
  }
  if (pathname === "/security") {
    return { title: "Безопасность", subtitle: "Пароль и вход" };
  }
  if (pathname === "/cart") {
    return { title: "Корзина", subtitle: "Проверьте заказ" };
  }
  if (pathname.startsWith("/order/")) {
    return { title: "Order Status", subtitle: "Мой заказ" };
  }
  if (pathname.startsWith("/restaurant/")) {
    return { title: "Меню ресторана", subtitle: "Выберите блюда" };
  }
  if (pathname === "/notifications") {
    return { title: "Уведомления", subtitle: "Push в браузере" };
  }
  return { title: "Dastbadast", subtitle: "" };
}

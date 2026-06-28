'use client';

type Props = {
  hydrated: boolean;
  itemsCount: number;
  restaurantId: string | null;
  restLoading: boolean;
  restError?: string;
  restaurant: { id: string; name: string; isAvailable?: boolean } | null | undefined;
  apiUrl: string;
};

export function CartDebugPanel({
  hydrated,
  itemsCount,
  restaurantId,
  restLoading,
  restError,
  restaurant,
  apiUrl,
}: Props) {
  if (process.env.NODE_ENV === 'production') {
    const force =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1';
    if (!force) return null;
  }

  return (
    <details className="mt-8 border border-dashed border-gray-300 rounded p-3 text-xs font-mono bg-gray-50">
      <summary className="cursor-pointer text-gray-600 font-sans font-medium">
        🔍 Отладка корзины (F12 → Console для логов [Dastbadast])
      </summary>
      <ul className="mt-2 space-y-1 text-gray-700">
        <li>API: {apiUrl}</li>
        <li>hydrated: {String(hydrated)}</li>
        <li>items: {itemsCount}</li>
        <li>restaurantId (корзина): {restaurantId ?? '—'}</li>
        <li>restaurant query loading: {String(restLoading)}</li>
        <li>restaurant query error: {restError ?? '—'}</li>
        <li>restaurant from API: {restaurant ? `${restaurant.name} (${restaurant.id}) avail=${restaurant.isAvailable}` : 'null'}</li>
        <li>localStorage raw: {typeof window !== 'undefined' ? (localStorage.getItem('db_cart_v4')?.slice(0, 80) ?? '—') + '…' : '—'}</li>
      </ul>
    </details>
  );
}

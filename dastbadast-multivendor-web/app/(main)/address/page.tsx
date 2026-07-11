"use client";

import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  GET_ADDRESSES,
  GET_DELIVERY_ZONE,
  CREATE_ADDRESS,
  SELECT_ADDRESS,
  DELETE_ADDRESS,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { reverseGeocode } from "@/lib/geocode";
import dynamic from "next/dynamic";
import {
  MapPin,
  Loader2,
  Trash2,
  Plus,
  Home,
  Briefcase,
  Check,
} from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";

const AddressPicker = dynamic(
  () => import("@/components/AddressPicker").then((m) => m.AddressPicker),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="w-full h-[300px] rounded-2xl border border-soft-border bg-soft-surface-2 flex items-center justify-center text-soft-text-muted text-sm">
      Загрузка карты…
    </div>
  );
}

export default function AddressPage() {
  return (
    <RequireAuth>
      <AddressInner />
    </RequireAuth>
  );
}

function AddressInner() {
  const { user } = useAuth();
  const [notice, setNotice] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const [selectAddress] = useMutation(SELECT_ADDRESS, {
    refetchQueries: [{ query: GET_ADDRESSES }],
    awaitRefetchQueries: true,
    onError: (e) => setNotice({ text: e.message, type: "error" }),
  });

  const [deleteAddress] = useMutation(DELETE_ADDRESS, {
    refetchQueries: [{ query: GET_ADDRESSES }],
    awaitRefetchQueries: true,
    onCompleted: () => setNotice({ text: "Адрес удалён", type: "success" }),
    onError: (e) => setNotice({ text: e.message, type: "error" }),
  });
  const [form, setForm] = useState({
    label: "Дом",
    address: "",
    city: "Душанбе",
    lng: 68.783,
    lat: 38.574,
  });

  const [geoLoading, setGeoLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: zoneData } = useQuery(GET_DELIVERY_ZONE);
  const zonePolygon = zoneData?.deliveryZone?.polygon ?? null;

  const { data, refetch } = useQuery(GET_ADDRESSES, { skip: !user });
  const [createAddress, { loading: creating, error: cErr }] =
    useMutation(CREATE_ADDRESS);

  const [pointInZone, setPointInZone] = useState(true);

  const applyCoords = useCallback(
    async (lat: number, lng: number, inZone = true) => {
      setMapLoading(true);
      setPointInZone(inZone);
      try {
        const geo = await reverseGeocode(lat, lng);
        setForm((f) => ({
          ...f,
          lat,
          lng,
          address: geo.address || f.address,
          city: geo.city || f.city,
        }));
      } catch {
        setForm((f) => ({ ...f, lat, lng }));
      } finally {
        setMapLoading(false);
      }
    },
    [],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Геолокация недоступна в браузере");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const inZone = !zonePolygon?.length
          ? true
          : isInZone(lng, lat, zonePolygon);
        await applyCoords(lat, lng, inZone);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        alert("Не удалось получить местоположение");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointInZone) {
      alert(
        "Точка вне зоны доставки. Переместите маркер внутрь оранжевой области.",
      );
      return;
    }
    try {
      await createAddress({
        variables: {
          input: {
            label: form.label,
            address: form.address,
            city: form.city,
            location: { type: "Point", coordinates: [form.lng, form.lat] },
          },
        },
      });
      setForm({ ...form, address: "" });
      setShowForm(false);
      refetch();
    } catch (err) {
      // shown below
    }
  };

  const addresses: any[] = data?.addresses ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight">
            Мои адреса
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Управление адресами доставки
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold px-4 py-2.5 rounded-2xl text-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Скрыть" : "Добавить"}
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-semibold border ${
            notice.type === "success"
              ? "bg-soft-success-soft text-soft-success border-soft-success/30"
              : "bg-soft-accent-soft text-soft-accent border-soft-accent/20"
          }`}
        >
          {notice.text}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="bg-soft-surface border border-soft-border rounded-3xl p-6 space-y-4 shadow-soft-sm"
        >
          <h2 className="font-extrabold text-soft-text text-lg">Новый адрес</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-soft-text-soft px-1">
                Метка
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, label: "Дом" })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    form.label === "Дом"
                      ? "bg-soft-accent text-white border-soft-accent"
                      : "bg-soft-surface-2 border-soft-border text-soft-text-soft hover:border-soft-accent hover:text-soft-accent"
                  }`}
                >
                  <Home className="w-4 h-4" /> Дом
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, label: "Работа" })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    form.label === "Работа"
                      ? "bg-soft-accent text-white border-soft-accent"
                      : "bg-soft-surface-2 border-soft-border text-soft-text-soft hover:border-soft-accent hover:text-soft-accent"
                  }`}
                >
                  <Briefcase className="w-4 h-4" /> Работа
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-soft-text-soft px-1">
                Город
              </label>
              <input
                className="bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted w-full p-3 rounded-xl text-sm focus:outline-none focus:border-soft-accent transition-colors"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Душанбе"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-soft-text-soft px-1">
              Адрес
            </label>
            <input
              className="bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted w-full p-3 rounded-xl text-sm focus:outline-none focus:border-soft-accent transition-colors"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Кликните на карту или введите: пр. Рудаки, 14"
              required
            />
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoLoading}
            className="text-sm bg-soft-surface-2 hover:bg-soft-accent-soft border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {geoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
            {geoLoading ? "Определяем…" : "Моё местоположение"}
          </button>

          <div className="rounded-2xl overflow-hidden border border-soft-border h-[300px] relative">
            <AddressPicker
              center={{ lat: form.lat, lng: form.lng }}
              zonePolygon={zonePolygon}
              onPick={(lat, lng, inZone) => applyCoords(lat, lng, inZone)}
            />
            {mapLoading && (
              <div className="absolute inset-0 bg-soft-surface/60 flex items-center justify-center pointer-events-none">
                <Loader2 className="w-6 h-6 text-soft-accent animate-spin" />
              </div>
            )}
          </div>

          {!pointInZone && (
            <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl px-4 py-3 text-sm font-semibold">
              ⚠️ Точка вне зоны доставки. Поставьте маркер внутрь оранжевой
              области.
            </div>
          )}

          {cErr && (
            <div className="bg-soft-accent-soft text-soft-accent border border-soft-accent/20 rounded-2xl px-4 py-3 text-sm font-semibold">
              🛑 {cErr.message}
            </div>
          )}

          <button
            disabled={creating || mapLoading || !pointInZone}
            className="bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold w-full h-12 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center"
          >
            {creating ? "Сохранение..." : "Подтвердить и добавить"}
          </button>
        </form>
      )}

      <section className="bg-soft-surface border border-soft-border rounded-3xl shadow-soft-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-soft-border flex items-center justify-between">
          <h2 className="font-extrabold text-soft-text">
            Сохранённые{" "}
            <span className="text-soft-text-muted font-medium">
              {addresses.length}
            </span>
          </h2>
        </div>
        {addresses.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-2">📍</div>
            <h3 className="font-extrabold text-soft-text">Адресов пока нет</h3>
            <p className="text-sm text-soft-text-soft mt-1">
              Добавьте первый адрес, чтобы оформлять заказы
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-soft-border">
            {addresses.map((a: any) => {
              const isHome = a.label?.toLowerCase().includes("дом");
              return (
                <li
                  key={a.id}
                  className="p-4 flex items-center gap-3 hover:bg-soft-surface-2 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      a.isSelected
                        ? "bg-soft-accent-soft text-soft-accent"
                        : "bg-soft-surface-2 text-soft-text-soft"
                    }`}
                  >
                    {isHome ? (
                      <Home className="w-5 h-5" />
                    ) : (
                      <Briefcase className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-soft-text truncate">
                      {a.label}
                      {a.isSelected && (
                        <span className="ml-2 inline-flex items-center gap-1 bg-soft-success-soft text-soft-success border border-soft-success/30 text-[10px] px-2 py-0.5 rounded-full font-bold align-middle">
                          <Check className="w-2.5 h-2.5" /> Выбран
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-soft-text-soft truncate">
                      {a.city}, {a.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!a.isSelected && (
                      <button
                        type="button"
                        onClick={() =>
                          selectAddress({ variables: { id: a.id } })
                        }
                        className="text-xs px-3 py-1.5 rounded-xl bg-soft-accent-soft text-soft-accent border border-soft-accent/20 font-bold"
                      >
                        Выбрать
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteAddress({ variables: { id: a.id } })}
                      className="w-8 h-8 flex items-center justify-center text-soft-text-muted hover:text-soft-accent hover:bg-soft-accent-soft rounded-xl transition-colors"
                      aria-label="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function isInZone(lng: number, lat: number, polygon: number[][]): boolean {
  if (!polygon?.length) return true;
  const [x, y] = [lng, lat];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

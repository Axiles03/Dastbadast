"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation } from "@apollo/client";
import { ZONES, CREATE_ZONE, UPDATE_ZONE, DELETE_ZONE } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/lib/hooks/useRequireAuth";
import { NAV_ACCESS, ACTION_ACCESS } from "@/lib/page-access";
import {
  Map as MapIcon,
  Plus,
  Edit3,
  Trash2,
  Power,
  PowerOff,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Save,
  RefreshCw,
} from "lucide-react";

// Динамический импорт карты (только в браузере)
const ZoneEditorMap = dynamic(
  () => import("../../components/ZoneEditorMap").then((m) => m.ZoneEditorMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-soft-surface-2 rounded-2xl">
      <Loader2 className="w-8 h-8 text-soft-accent animate-spin" />
    </div>
  );
}

export default function ZonesPage() {
  return (
    <RoleGate allowedRoles={NAV_ACCESS.zones}>
      <ZonesInner />
    </RoleGate>
  );
}

function ZonesInner() {
  const { hasRole } = useAuth();
  const canCreate = hasRole(ACTION_ACCESS.editRestaurant); // создание зон = OPERATIONS
  const canDelete = hasRole("SUPER_ADMIN");

  const { data, loading, refetch } = useQuery(ZONES, {
    fetchPolicy: "cache-and-network",
  });
  const [createZone, { loading: creating }] = useMutation(CREATE_ZONE, {
    refetchQueries: [{ query: ZONES }],
  });
  const [updateZone, { loading: updating }] = useMutation(UPDATE_ZONE, {
    refetchQueries: [{ query: ZONES }],
  });
  const [deleteZone] = useMutation(DELETE_ZONE, {
    refetchQueries: [{ query: ZONES }],
  });

  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    description: string;
    polygon: number[][];
    isActive: boolean;
  } | null>(null);
  const [creatingMode, setCreatingMode] = useState(false);
  const [draftPolygon, setDraftPolygon] = useState<number[][]>([]);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const zones = data?.zones || [];
  const activeZones = zones.filter((z: any) => z.isActive);

  const startCreate = () => {
    setEditing({
      id: "",
      name: "",
      description: "",
      polygon: [],
      isActive: true,
    });
    setCreatingMode(true);
    setDraftPolygon([]);
  };

  const startEdit = (z: any) => {
    const poly =
      Array.isArray(z.polygon) && z.polygon.length > 0
        ? z.polygon[0]
        : z.polygon;
    setEditing({
      id: z.id,
      name: z.name,
      description: z.description || "",
      polygon: poly || [],
      isActive: z.isActive,
    });
    setCreatingMode(false);
    setDraftPolygon(poly || []);
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreatingMode(false);
    setDraftPolygon([]);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      showToast("error", "Название зоны обязательно");
      return;
    }
    if (draftPolygon.length < 3) {
      showToast(
        "error",
        "Полигон должен содержать минимум 3 точки. Кликните по карте, чтобы добавить точки",
      );
      return;
    }

    // Закрываем кольцо: первая точка == последняя
    const closedPolygon =
      draftPolygon[0][0] === draftPolygon[draftPolygon.length - 1][0] &&
      draftPolygon[0][1] === draftPolygon[draftPolygon.length - 1][1]
        ? draftPolygon
        : [...draftPolygon, draftPolygon[0]];

    try {
      if (creatingMode) {
        await createZone({
          variables: {
            input: {
              name: editing.name,
              description: editing.description,
              polygon: closedPolygon,
              isActive: editing.isActive,
            },
          },
        });
        showToast("success", "Зона создана");
      } else {
        await updateZone({
          variables: {
            id: editing.id,
            input: {
              name: editing.name,
              description: editing.description,
              polygon: closedPolygon,
              isActive: editing.isActive,
            },
          },
        });
        showToast("success", "Зона обновлена");
      }
      cancelEdit();
    } catch (e: any) {
      showToast("error", e?.message ?? "Ошибка сохранения");
    }
  };

  const handleToggle = async (z: any) => {
    try {
      await updateZone({
        variables: { id: z.id, input: { isActive: !z.isActive } },
      });
      showToast(
        "success",
        z.isActive ? "Зона деактивирована" : "Зона активирована",
      );
    } catch (e: any) {
      showToast("error", e?.message ?? "Ошибка");
    }
  };

  const handleDelete = async (z: any) => {
    if (!confirm(`Удалить зону «${z.name}»? Это нельзя отменить.`)) return;
    try {
      await deleteZone({ variables: { id: z.id } });
      showToast("success", "Зона удалена");
    } catch (e: any) {
      showToast("error", e?.message ?? "Невозможно удалить");
    }
  };

  // Что показывать на карте
  const mapZones = useMemo(() => {
    return zones
      .filter((z: any) => Array.isArray(z.polygon) && z.polygon.length > 0)
      .map((z: any) => ({
        id: z.id,
        name: z.name,
        isActive: z.isActive,
        // API возвращает [ [ [lng,lat], ... ] ] — берём первое кольцо
        ring: z.polygon[0] || z.polygon,
      }));
  }, [zones]);

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl shadow-soft-lg flex items-center gap-2 text-sm font-bold animate-fade-in ${
            toast.type === "success"
              ? "bg-soft-success text-white"
              : "bg-soft-accent text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-soft-text tracking-tight flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-soft-accent" />
            Зоны доставки
          </h1>
          <p className="text-sm text-soft-text-soft mt-1">
            Полигоны зон, в которых разрешено создавать заказы
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 bg-soft-surface border border-soft-border hover:border-soft-accent text-soft-text-soft hover:text-soft-accent font-bold text-sm px-3.5 py-2 rounded-full transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {canCreate && !editing && (
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold text-sm px-4 py-2 rounded-full transition-colors shadow-soft-sm"
            >
              <Plus className="w-4 h-4" />
              Новая зона
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Карта */}
        <div className="bg-soft-surface border border-soft-border rounded-3xl overflow-hidden shadow-soft-sm h-[500px] lg:h-auto lg:sticky lg:top-20">
          <ZoneEditorMap
            zones={mapZones}
            draftPolygon={draftPolygon}
            isDrawing={!!editing}
            onPolygonChange={setDraftPolygon}
          />
        </div>

        {/* Список / редактор */}
        <div className="space-y-3">
          {editing ? (
            <div className="bg-soft-surface border border-soft-accent/40 rounded-3xl p-5 space-y-4 shadow-soft-sm animate-fade-in">
              <div className="flex items-center justify-between border-b border-soft-border pb-3">
                <h3 className="font-extrabold text-soft-text flex items-center gap-2">
                  {creatingMode ? (
                    <Plus className="w-4 h-4 text-soft-accent" />
                  ) : (
                    <Edit3 className="w-4 h-4 text-soft-accent" />
                  )}
                  {creatingMode ? "Новая зона" : "Редактирование зоны"}
                </h3>
                <button
                  onClick={cancelEdit}
                  className="text-soft-text-muted hover:text-soft-text"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-soft-text-soft px-1">
                  Название *
                </label>
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="Душанбе Центр, Худжанд..."
                  className="w-full px-3.5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-soft-text-soft px-1">
                  Описание
                </label>
                <input
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  placeholder="Центральная зона Душанбе"
                  className="w-full px-3.5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text placeholder-soft-text-muted rounded-xl text-sm focus:outline-none focus:border-soft-accent focus:bg-soft-surface transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-soft-text-soft px-1">
                  Точки полигона ({draftPolygon.length}) *
                </label>
                <div className="bg-soft-info-soft border border-soft-info/20 rounded-xl px-3 py-2.5 text-xs text-soft-info flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Кликните по карте слева, чтобы добавить точки. Минимум 3
                    точки. Кольцо закроется автоматически.
                  </span>
                </div>
                {draftPolygon.length > 0 && (
                  <button
                    onClick={() => setDraftPolygon([])}
                    className="text-xs text-soft-accent hover:underline"
                  >
                    Очистить точки
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) =>
                    setEditing({ ...editing, isActive: e.target.checked })
                  }
                  className="w-4 h-4 accent-soft-accent"
                />
                <span className="text-sm font-semibold text-soft-text">
                  Зона активна
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="px-5 py-2.5 bg-soft-surface-2 border border-soft-border text-soft-text-soft font-bold rounded-2xl text-sm hover:bg-soft-border transition-colors"
                >
                  Отмена
                </button>
                <button
                  disabled={creating || updating}
                  onClick={save}
                  className="flex-1 h-11 bg-soft-accent hover:bg-soft-accent-dark text-white font-extrabold rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
                >
                  {creating || updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Сохраняем...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Сохранить зону
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : loading && !data ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="bg-soft-surface border border-soft-border h-20 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : zones.length === 0 ? (
            <div className="bg-soft-surface border border-soft-border rounded-3xl p-10 text-center shadow-soft-sm">
              <div className="text-4xl mb-2">🗺️</div>
              <p className="text-base font-extrabold text-soft-text">
                Зон пока нет
              </p>
              <p className="text-sm text-soft-text-soft mt-1">
                {canCreate
                  ? "Нажмите «Новая зона»"
                  : "Создание доступно только OPERATIONS / SUPER_ADMIN"}
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-extrabold text-lg text-soft-text px-1">
                Все зоны{" "}
                <span className="text-soft-text-muted font-medium">
                  {zones.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {zones.map((z: any) => {
                  const points = Array.isArray(z.polygon)
                    ? z.polygon[0]?.length || 0
                    : 0;
                  return (
                    <li
                      key={z.id}
                      className="bg-soft-surface border border-soft-border rounded-2xl p-4 flex justify-between items-center shadow-soft-sm hover:border-soft-accent hover:shadow-soft transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            z.isActive
                              ? "bg-soft-success-soft text-soft-success"
                              : "bg-soft-surface-2 text-soft-text-muted"
                          }`}
                        >
                          <MapIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-soft-text truncate">
                            {z.name}
                          </div>
                          <div className="text-xs text-soft-text-soft truncate">
                            {z.description || "Без описания"} · {points} точек
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canCreate && (
                          <button
                            onClick={() => handleToggle(z)}
                            className={`w-8 h-8 flex items-center justify-center border rounded-xl transition-colors ${
                              z.isActive
                                ? "bg-soft-surface-2 border-soft-border text-soft-text-muted hover:text-soft-accent hover:border-soft-accent"
                                : "bg-soft-success-soft border-soft-success/30 text-soft-success hover:bg-soft-success hover:text-white"
                            }`}
                            title={
                              z.isActive ? "Деактивировать" : "Активировать"
                            }
                          >
                            {z.isActive ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {canCreate && (
                          <button
                            onClick={() => startEdit(z)}
                            className="w-8 h-8 flex items-center justify-center bg-soft-surface-2 border border-soft-border rounded-xl text-soft-text-soft hover:text-soft-accent hover:border-soft-accent transition-colors"
                            title="Редактировать"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(z)}
                            className="w-8 h-8 flex items-center justify-center bg-soft-surface-2 border border-soft-border rounded-xl text-soft-text-muted hover:text-soft-accent hover:border-soft-accent transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

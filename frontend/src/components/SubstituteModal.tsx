import { useEffect, useState } from "react";
import { equipmentApi, ApiError } from "../api/client";
import type { EquipmentItem, EquipmentType } from "../types";
import { EQUIPMENT_TYPE_LABELS, PLATOON_SERGEANT_POSITION, SQUAD_LEADER_POSITION } from "../types";
import ConditionBadge from "./ConditionBadge";

export default function SubstituteModal({
  type,
  cadetId,
  cadetPosition,
  currentItemId,
  onClose,
  onAssigned,
}: {
  type: EquipmentType;
  cadetId: number;
  cadetPosition: string;
  currentItemId: number | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | "unassign" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    equipmentApi
      .list(type)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [type]);

  const isPs = cadetPosition === PLATOON_SERGEANT_POSITION;
  const isSl = cadetPosition === SQUAD_LEADER_POSITION;
  const visibleItems =
    type === "infantry_rifle"
      ? items.filter((i) => i.is_ps_rifle === isPs)
      : type === "bayonet"
        ? items.filter((i) => i.is_black_sl_bayonet === isSl)
        : items;

  async function assign(itemId: number) {
    setError(null);
    setBusyId(itemId);
    try {
      await equipmentApi.assign(itemId, cadetId);
      onAssigned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign item.");
    } finally {
      setBusyId(null);
    }
  }

  async function unassign() {
    if (currentItemId === null) return;
    setError(null);
    setBusyId("unassign");
    try {
      await equipmentApi.assign(currentItemId, null);
      onAssigned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to unassign item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            Assign {EQUIPMENT_TYPE_LABELS[type]}
            {type === "infantry_rifle" && isPs ? " (PS Rifle)" : ""}
            {type === "bayonet" && isSl ? " (Black SL Bayonet)" : ""}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {!loading && visibleItems.length === 0 && (
            <p className="text-sm text-slate-400">
              {type === "infantry_rifle" && isPs
                ? "No PS Rifle in the catalogue yet. Add one from the Equipment tab and mark it as a PS Rifle."
                : type === "bayonet" && isSl
                  ? "No Black SL Bayonet in the catalogue yet. Add one from the Equipment tab and mark it as a Black SL Bayonet."
                  : `No ${EQUIPMENT_TYPE_LABELS[type].toLowerCase()} in the catalogue yet. Add one from the Equipment tab first.`}
            </p>
          )}
          {visibleItems.map((item) => {
            const isCurrent = item.id === currentItemId;
            return (
              <button
                key={item.id}
                disabled={isCurrent || busyId !== null}
                onClick={() => assign(item.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  isCurrent ? "border-slate-300 bg-slate-100" : "border-slate-200 hover:bg-slate-50"
                } disabled:cursor-default`}
              >
                <span>
                  <span className="font-medium text-slate-800">{item.tag}</span>
                  {item.owner_name && !isCurrent && (
                    <span className="ml-2 text-xs text-slate-500">
                      currently: {item.owner_name} (Co. {item.owner_company})
                    </span>
                  )}
                  {isCurrent && <span className="ml-2 text-xs text-slate-500">currently assigned here</span>}
                </span>
                <ConditionBadge condition={item.condition} />
              </button>
            );
          })}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-between">
          {currentItemId !== null ? (
            <button
              onClick={unassign}
              disabled={busyId !== null}
              className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Unassign current item
            </button>
          ) : (
            <span />
          )}
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

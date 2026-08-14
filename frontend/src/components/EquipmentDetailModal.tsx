import { useEffect, useState } from "react";
import { cadetsApi, equipmentApi, ApiError } from "../api/client";
import type { Cadet, Condition, EquipmentItem, RifleCompany } from "../types";
import {
  EQUIPMENT_TYPE_LABELS,
  PLATOON_SERGEANT_POSITION,
  SQUAD_LEADER_POSITION,
  formatPosition,
  infantryRifleTag,
  isCadetEligibleForEquipmentType,
  parseInfantryRifleTag,
  tagNumberPart,
  tagPrefixFor,
} from "../types";
import ConditionBadge from "./ConditionBadge";
import TagInput from "./TagInput";
import HistorySection from "./HistorySection";

const CONDITIONS: Condition[] = ["green", "yellow", "red"];

// Infantry Rifle tags parse their number back out of the "01A" scheme; every
// other type strips its shared prefix as before.
function initialTagNumber(item: EquipmentItem): string {
  if (item.type === "infantry_rifle") return parseInfantryRifleTag(item.tag).number;
  return tagNumberPart(item.type, item.tag);
}

export default function EquipmentDetailModal({
  item,
  onClose,
  onChanged,
}: {
  item: EquipmentItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [number, setNumber] = useState(initialTagNumber(item));
  const [condition, setCondition] = useState<Condition>(item.manual_condition);
  const [hasSheath, setHasSheath] = useState(item.has_sheath ?? true);
  const [hasPompom, setHasPompom] = useState(item.has_pompom ?? true);
  const [size, setSize] = useState(item.size ?? "");
  const [isPsRifle, setIsPsRifle] = useState(item.is_ps_rifle);
  const [isBlackSl, setIsBlackSl] = useState(item.is_black_sl_bayonet);
  const [company, setCompany] = useState<RifleCompany | "">(item.company ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showReassign, setShowReassign] = useState(false);
  const [cadets, setCadets] = useState<Cadet[]>([]);
  const [search, setSearch] = useState("");

  const autoRed = (item.type === "bayonet" && !hasSheath) || (item.type === "dress_cover" && !hasPompom);

  useEffect(() => {
    if (showReassign && cadets.length === 0) {
      cadetsApi.list().then(setCadets);
    }
  }, [showReassign, cadets.length]);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await equipmentApi.update(item.id, {
        tag: item.type === "infantry_rifle" ? infantryRifleTag(number, company as RifleCompany) : `${tagPrefixFor(item.type, isBlackSl)}${number.trim()}`,
        manual_condition: condition,
        has_sheath: item.type === "bayonet" ? hasSheath : undefined,
        has_pompom: item.type === "dress_cover" ? hasPompom : undefined,
        size: item.type === "dress_jacket" ? size : undefined,
        is_ps_rifle: item.type === "infantry_rifle" ? isPsRifle : undefined,
        is_black_sl_bayonet: item.type === "bayonet" ? isBlackSl : undefined,
        company: item.type === "infantry_rifle" ? (company as RifleCompany) : undefined,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function reassign(cadetId: number | null) {
    setError(null);
    setSaving(true);
    try {
      await equipmentApi.assign(item.id, cadetId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reassign item.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${item.tag} from the catalogue? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await equipmentApi.remove(item.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove item.");
      setSaving(false);
    }
  }

  const eligibleCadets = cadets
    .filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => isCadetEligibleForEquipmentType(c, item.type))
    .filter((c) => {
      if (item.type === "infantry_rifle") {
        const cadetIsPs = c.position === PLATOON_SERGEANT_POSITION;
        if (isPsRifle ? !cadetIsPs : cadetIsPs) return false;
        return !company || c.company === company;
      }
      if (item.type === "bayonet") {
        const cadetIsSl = c.position === SQUAD_LEADER_POSITION;
        return isBlackSl ? cadetIsSl : !cadetIsSl;
      }
      return true;
    });

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{EQUIPMENT_TYPE_LABELS[item.type]} · {item.tag}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <form onSubmit={saveDetails} className="mt-4 space-y-3">
          <TagInput
            type={item.type}
            number={number}
            onNumberChange={setNumber}
            isBlackSlBayonet={isBlackSl}
            onIsBlackSlBayonetChange={setIsBlackSl}
            company={company}
            onCompanyChange={setCompany}
            disabled={saving}
          />

          <div>
            <label className="block text-xs font-medium text-slate-600">Condition</label>
            {autoRed ? (
              <div className="mt-1">
                <ConditionBadge condition="red" />
                <span className="ml-2 text-xs text-slate-500">auto-set to Red while the accessory below is missing</span>
              </div>
            ) : (
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as Condition)}
                className="mt-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {item.type === "bayonet" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={hasSheath} onChange={(e) => setHasSheath(e.target.checked)} />
              Has sheath
            </label>
          )}

          {item.type === "dress_cover" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={hasPompom} onChange={(e) => setHasPompom(e.target.checked)} />
              Has pompom
            </label>
          )}

          {item.type === "dress_jacket" && (
            <div>
              <label className="block text-xs font-medium text-slate-600">Size</label>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="mt-1 w-24 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </div>
          )}

          {item.type === "infantry_rifle" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isPsRifle} onChange={(e) => setIsPsRifle(e.target.checked)} />
              PS Rifle (blank-firing, Platoon Sergeant only)
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assignment</p>
          <p className="mt-1 text-sm text-slate-700">
            {item.owner_name ? (
              <>
                {item.owner_name} <span className="text-slate-400">(Company {item.owner_company})</span>
              </>
            ) : (
              <span className="text-slate-400">Unassigned</span>
            )}
          </p>

          <div className="mt-2 flex gap-3">
            {item.owner_cadet_id !== null && (
              <button onClick={() => reassign(null)} disabled={saving} className="text-sm font-medium text-red-600 hover:text-red-800">
                Unassign
              </button>
            )}
            <button onClick={() => setShowReassign((v) => !v)} className="text-sm font-medium text-slate-700 hover:text-slate-900">
              {showReassign ? "Cancel reassign" : item.owner_cadet_id ? "Reassign to…" : "Assign to…"}
            </button>
          </div>

          {showReassign && (
            <div className="mt-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cadets by name…"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {eligibleCadets.length === 0 && <p className="text-xs text-slate-400">No matching cadets.</p>}
                {eligibleCadets.map((c) => (
                  <button
                    key={c.id}
                    disabled={saving}
                    onClick={() => reassign(c.id)}
                    className="flex w-full items-center justify-between rounded-md border border-slate-200 px-2.5 py-1.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span>
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      Co. {c.company} · {formatPosition(c.position)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <HistorySection variant="equipment" fetchHistory={() => equipmentApi.history(item.id)} />

        <div className="mt-5 flex justify-between border-t border-slate-200 pt-4">
          <button onClick={remove} disabled={saving} className="text-sm font-medium text-red-600 hover:text-red-800">
            Remove from catalogue
          </button>
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

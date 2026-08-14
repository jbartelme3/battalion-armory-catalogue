import { useState } from "react";
import { equipmentApi, ApiError } from "../api/client";
import type { Condition, EquipmentItem, EquipmentType, RifleCompany } from "../types";
import { infantryRifleTag, tagPrefixFor } from "../types";
import ConditionBadge from "./ConditionBadge";
import EquipmentDetailModal from "./EquipmentDetailModal";
import TagInput from "./TagInput";

const CONDITIONS: Condition[] = ["green", "yellow", "red"];

export default function EquipmentTable({
  type,
  items,
  onChanged,
}: {
  type: EquipmentType;
  items: EquipmentItem[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [detailItem, setDetailItem] = useState<EquipmentItem | null>(null);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Tag</th>
              <th className="py-2 pr-3">Condition</th>
              <th className="py-2 pr-3">Owner</th>
              <th className="py-2 pr-3">Unit</th>
              {type === "bayonet" && <th className="py-2 pr-3">Sheath</th>}
              {type === "dress_cover" && <th className="py-2 pr-3">Pompom</th>}
              {type === "dress_jacket" && <th className="py-2 pr-3">Size</th>}
              {type === "infantry_rifle" && <th className="py-2 pr-3">PS Rifle</th>}
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-sm text-slate-400">
                  No items yet.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <Row key={item.id} item={item} onChanged={onChanged} onOpenDetail={() => setDetailItem(item)} />
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={() => setShowAdd((v) => !v)} className="mt-3 text-sm font-semibold text-slate-700 hover:text-slate-900">
        {showAdd ? "Cancel" : "+ Add item"}
      </button>

      {showAdd && (
        <AddItemForm
          type={type}
          onCreated={() => {
            setShowAdd(false);
            onChanged();
          }}
        />
      )}

      {detailItem && (
        <EquipmentDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onChanged={() => {
            setDetailItem(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function Row({ item, onChanged, onOpenDetail }: { item: EquipmentItem; onChanged: () => void; onOpenDetail: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateCondition(condition: Condition) {
    setSaving(true);
    setError(null);
    try {
      await equipmentApi.update(item.id, { manual_condition: condition });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccessory(field: "has_sheath" | "has_pompom" | "is_ps_rifle" | "is_black_sl_bayonet", value: boolean) {
    setSaving(true);
    setError(null);
    try {
      await equipmentApi.update(item.id, { [field]: value });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSize(size: string) {
    setSaving(true);
    setError(null);
    try {
      await equipmentApi.update(item.id, { size });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${item.tag} from the catalogue?`)) return;
    setSaving(true);
    setError(null);
    try {
      await equipmentApi.remove(item.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove.");
      setSaving(false);
    }
  }

  const autoRed =
    (item.type === "bayonet" && item.has_sheath === false) || (item.type === "dress_cover" && item.has_pompom === false);

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3">
        <button onClick={onOpenDetail} className="font-medium text-slate-800 hover:underline">
          {item.tag}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
      <td className="py-2 pr-3">
        {autoRed ? (
          <ConditionBadge condition="red" />
        ) : (
          <select
            value={item.manual_condition}
            disabled={saving}
            onChange={(e) => updateCondition(e.target.value as Condition)}
            className="rounded-md border border-slate-300 px-1.5 py-1 text-xs"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-2 pr-3 text-slate-600">{item.owner_name ?? <span className="text-slate-400">Unassigned</span>}</td>
      <td className="py-2 pr-3 text-slate-500">{item.owner_company ?? "–"}</td>
      {item.type === "bayonet" && (
        <td className="py-2 pr-3">
          <input
            type="checkbox"
            checked={item.has_sheath ?? false}
            disabled={saving}
            onChange={(e) => toggleAccessory("has_sheath", e.target.checked)}
          />
        </td>
      )}
      {item.type === "dress_cover" && (
        <td className="py-2 pr-3">
          <input
            type="checkbox"
            checked={item.has_pompom ?? false}
            disabled={saving}
            onChange={(e) => toggleAccessory("has_pompom", e.target.checked)}
          />
        </td>
      )}
      {item.type === "dress_jacket" && (
        <td className="py-2 pr-3">
          <input
            defaultValue={item.size ?? ""}
            disabled={saving}
            onBlur={(e) => e.target.value !== (item.size ?? "") && updateSize(e.target.value)}
            className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-xs"
          />
        </td>
      )}
      {item.type === "infantry_rifle" && (
        <td className="py-2 pr-3">
          <input
            type="checkbox"
            checked={item.is_ps_rifle}
            disabled={saving}
            onChange={(e) => toggleAccessory("is_ps_rifle", e.target.checked)}
          />
        </td>
      )}
      <td className="py-2 pr-3 text-right">
        <button onClick={remove} disabled={saving} className="text-xs font-medium text-slate-400 hover:text-red-600">
          Remove
        </button>
      </td>
    </tr>
  );
}

function AddItemForm({ type, onCreated }: { type: EquipmentType; onCreated: () => void }) {
  const [number, setNumber] = useState("");
  const [size, setSize] = useState("");
  const [isPsRifle, setIsPsRifle] = useState(false);
  const [isBlackSl, setIsBlackSl] = useState(false);
  const [company, setCompany] = useState<RifleCompany | "">("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await equipmentApi.create({
        type,
        tag: type === "infantry_rifle" ? infantryRifleTag(number, company as RifleCompany) : `${tagPrefixFor(type, isBlackSl)}${number.trim()}`,
        manual_condition: "green",
        has_sheath: type === "bayonet" ? true : undefined,
        has_pompom: type === "dress_cover" ? true : undefined,
        size: type === "dress_jacket" ? size : undefined,
        is_ps_rifle: type === "infantry_rifle" ? isPsRifle : undefined,
        is_black_sl_bayonet: type === "bayonet" ? isBlackSl : undefined,
        company: type === "infantry_rifle" ? (company as RifleCompany) : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <TagInput
        type={type}
        number={number}
        onNumberChange={setNumber}
        isBlackSlBayonet={isBlackSl}
        onIsBlackSlBayonetChange={setIsBlackSl}
        company={company}
        onCompanyChange={setCompany}
        disabled={submitting}
      />
      {type === "dress_jacket" && (
        <div>
          <label className="block text-xs font-medium text-slate-600">Size</label>
          <input value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 w-20 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      )}
      {type === "infantry_rifle" && (
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={isPsRifle} onChange={(e) => setIsPsRifle(e.target.checked)} />
          PS Rifle
        </label>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

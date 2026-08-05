import type { EquipmentItem } from "../types";
import { EQUIPMENT_TYPE_LABELS } from "../types";
import ConditionBadge from "./ConditionBadge";

export default function EquipmentResultsTable({ items, onOpenDetail }: { items: EquipmentItem[]; onOpenDetail: (item: EquipmentItem) => void }) {
  if (items.length === 0) {
    return <p className="px-1 py-3 text-sm text-slate-400">No items match.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-3">Type</th>
          <th className="py-2 pr-3">Tag</th>
          <th className="py-2 pr-3">Condition</th>
          <th className="py-2 pr-3">Owner</th>
          <th className="py-2 pr-3">Unit</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-slate-100">
            <td className="py-2 pr-3 text-slate-600">{EQUIPMENT_TYPE_LABELS[item.type]}</td>
            <td className="py-2 pr-3">
              <button onClick={() => onOpenDetail(item)} className="font-medium text-slate-800 hover:underline">
                {item.tag}
              </button>
            </td>
            <td className="py-2 pr-3">
              <ConditionBadge condition={item.condition} />
            </td>
            <td className="py-2 pr-3 text-slate-600">{item.owner_name ?? <span className="text-slate-400">Unassigned</span>}</td>
            <td className="py-2 pr-3 text-slate-500">{item.owner_company ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

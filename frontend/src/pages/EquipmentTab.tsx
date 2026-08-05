import { useEffect, useState } from "react";
import { equipmentApi } from "../api/client";
import type { Condition, EquipmentItem, EquipmentType } from "../types";
import { EQUIPMENT_TYPE_LABELS, EQUIPMENT_TYPE_ORDER } from "../types";
import EquipmentTable from "../components/EquipmentTable";
import EquipmentDetailModal from "../components/EquipmentDetailModal";
import EquipmentResultsTable from "../components/EquipmentResultsTable";

type SectionKey = EquipmentType | "needs_repair";

const SECTIONS: { key: SectionKey; label: string }[] = [
  ...EQUIPMENT_TYPE_ORDER.map((type) => ({ key: type, label: EQUIPMENT_TYPE_LABELS[type] })),
  { key: "needs_repair", label: "Needs Repair" },
];

const CONDITIONS: Condition[] = ["green", "yellow", "red"];

export default function EquipmentTab() {
  const [open, setOpen] = useState<SectionKey | null>(null);
  const [items, setItems] = useState<Partial<Record<SectionKey, EquipmentItem[]>>>({});
  const [loading, setLoading] = useState<SectionKey | null>(null);

  const [allItems, setAllItems] = useState<EquipmentItem[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<EquipmentType | "">("");
  const [filterCondition, setFilterCondition] = useState<Condition | "">("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [detailItem, setDetailItem] = useState<EquipmentItem | null>(null);

  async function load(key: SectionKey) {
    setLoading(key);
    try {
      const data = key === "needs_repair" ? await equipmentApi.needsRepair() : await equipmentApi.list(key);
      setItems((prev) => ({ ...prev, [key]: data }));
    } finally {
      setLoading(null);
    }
  }

  async function loadAllItems() {
    setAllItems(await equipmentApi.list());
  }

  useEffect(() => {
    loadAllItems();
  }, []);

  function toggle(key: SectionKey) {
    const next = open === key ? null : key;
    setOpen(next);
    if (next) load(next);
  }

  function refreshAll() {
    if (open) load(open);
    loadAllItems();
  }

  const isFiltering = search.trim() !== "" || filterType !== "" || filterCondition !== "" || filterOwner !== "" || filterUnit !== "";

  const ownerOptions = Array.from(new Set(allItems.map((i) => i.owner_name).filter((n): n is string => !!n))).sort();

  const filteredItems = allItems.filter((item) => {
    if (search.trim() && !item.tag.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filterType && item.type !== filterType) return false;
    if (filterCondition && item.condition !== filterCondition) return false;
    if (filterOwner === "__unassigned__" && item.owner_name) return false;
    if (filterOwner && filterOwner !== "__unassigned__" && item.owner_name !== filterOwner) return false;
    if (filterUnit && item.owner_company !== filterUnit) return false;
    return true;
  });

  function clearFilters() {
    setSearch("");
    setFilterType("");
    setFilterCondition("");
    setFilterOwner("");
    setFilterUnit("");
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-slate-900">Equipment</h2>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tag number…"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Filters{filterType || filterCondition || filterOwner || filterUnit ? " •" : ""}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EquipmentType | "")}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">All types</option>
              {EQUIPMENT_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {EQUIPMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value as Condition | "")}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">All conditions</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">All owners</option>
              <option value="__unassigned__">Unassigned</option>
              {ownerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">All units</option>
              <option value="A">Company A</option>
              <option value="B">Company B</option>
              <option value="C">Company C</option>
            </select>
          </div>
        )}

        {isFiltering && (
          <button onClick={clearFilters} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800">
            Clear search &amp; filters
          </button>
        )}
      </div>

      {isFiltering ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <EquipmentResultsTable items={filteredItems} onOpenDetail={setDetailItem} />
        </div>
      ) : (
        <div className="space-y-3">
          {SECTIONS.map(({ key, label }) => {
            const isOpen = open === key;
            return (
              <div key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  onClick={() => toggle(key)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-slate-900 hover:bg-slate-50"
                >
                  <span>{label}</span>
                  <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 p-4">
                    {loading === key && <p className="text-sm text-slate-400">Loading…</p>}
                    {loading !== key && key !== "needs_repair" && (
                      <EquipmentTable type={key as EquipmentType} items={items[key] ?? []} onChanged={() => load(key)} />
                    )}
                    {loading !== key && key === "needs_repair" && (
                      <EquipmentResultsTable items={items.needs_repair ?? []} onOpenDetail={setDetailItem} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detailItem && (
        <EquipmentDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onChanged={() => {
            setDetailItem(null);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

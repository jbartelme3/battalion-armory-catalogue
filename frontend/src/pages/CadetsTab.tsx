import { useEffect, useState } from "react";
import { cadetsApi } from "../api/client";
import type { Cadet } from "../types";
import { ALL_POSITIONS, CLASSMEN, CLASSMAN_LABELS, RANKS } from "../types";
import CadetProfile from "./CadetProfile";
import CadetRow from "../components/CadetRow";
import AddCadetForm from "../components/AddCadetForm";

const COMPANIES: Cadet["company"][] = ["A", "B", "C"];

export default function CadetsTab() {
  const [openCompany, setOpenCompany] = useState<Cadet["company"] | null>(null);
  const [rosters, setRosters] = useState<Partial<Record<Cadet["company"], Cadet[]>>>({});
  const [loading, setLoading] = useState<Cadet["company"] | null>(null);
  const [selectedCadetId, setSelectedCadetId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [allCadets, setAllCadets] = useState<Cadet[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterUnit, setFilterUnit] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterClassman, setFilterClassman] = useState("");
  const [filterHg, setFilterHg] = useState("");

  async function loadCompany(company: Cadet["company"]) {
    setLoading(company);
    try {
      const list = await cadetsApi.list(company);
      setRosters((prev) => ({ ...prev, [company]: list }));
    } finally {
      setLoading(null);
    }
  }

  async function loadAllCadets() {
    setAllCadets(await cadetsApi.list());
  }

  useEffect(() => {
    loadAllCadets();
  }, []);

  function toggleCompany(company: Cadet["company"]) {
    const next = openCompany === company ? null : company;
    setOpenCompany(next);
    if (next && !rosters[next]) loadCompany(next);
  }

  function refreshAll() {
    if (openCompany) loadCompany(openCompany);
    loadAllCadets();
  }

  if (selectedCadetId !== null) {
    return (
      <CadetProfile
        cadetId={selectedCadetId}
        onBack={() => {
          setSelectedCadetId(null);
          refreshAll();
        }}
      />
    );
  }

  const isFiltering =
    search.trim() !== "" || filterUnit !== "" || filterPosition !== "" || filterRank !== "" || filterClassman !== "" || filterHg !== "";

  const filteredCadets = allCadets.filter((c) => {
    if (search.trim() && !`${c.first_name} ${c.last_name}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filterUnit && c.company !== filterUnit) return false;
    if (filterPosition && c.position !== filterPosition) return false;
    if (filterRank && c.rank !== filterRank) return false;
    if (filterClassman && c.classman !== filterClassman) return false;
    if (filterHg === "yes" && !c.is_honor_guard) return false;
    if (filterHg === "no" && c.is_honor_guard) return false;
    return true;
  });

  function clearFilters() {
    setSearch("");
    setFilterUnit("");
    setFilterPosition("");
    setFilterRank("");
    setFilterClassman("");
    setFilterHg("");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Cadets</h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {showAddForm ? "Cancel" : "+ Add Cadet"}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6">
          <AddCadetForm
            onCreated={() => {
              setShowAddForm(false);
              refreshAll();
            }}
          />
        </div>
      )}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cadets by name…"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Filters{filterUnit || filterPosition || filterRank || filterClassman || filterHg ? " •" : ""}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">All units</option>
              <option value="A">Company A</option>
              <option value="B">Company B</option>
              <option value="C">Company C</option>
            </select>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">All positions</option>
              {ALL_POSITIONS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label} ({p.abbrev})
                </option>
              ))}
            </select>
            <select value={filterRank} onChange={(e) => setFilterRank(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">All ranks</option>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={filterClassman}
              onChange={(e) => setFilterClassman(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">All classmen</option>
              {CLASSMEN.map((c) => (
                <option key={c} value={c}>
                  {CLASSMAN_LABELS[c]}
                </option>
              ))}
            </select>
            <select value={filterHg} onChange={(e) => setFilterHg(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Honor Guard: any</option>
              <option value="yes">Honor Guard only</option>
              <option value="no">Non-Honor Guard only</option>
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {filteredCadets.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No cadets match.</p>}
          {filteredCadets.map((cadet) => (
            <CadetRow key={cadet.id} cadet={cadet} onSelect={() => setSelectedCadetId(cadet.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {COMPANIES.map((company) => {
            const isOpen = openCompany === company;
            const roster = rosters[company];
            return (
              <div key={company} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  onClick={() => toggleCompany(company)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-slate-900 hover:bg-slate-50"
                >
                  <span>Company {company}</span>
                  <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200">
                    {loading === company && <p className="px-4 py-3 text-sm text-slate-400">Loading…</p>}
                    {roster && roster.length === 0 && (
                      <p className="px-4 py-3 text-sm text-slate-400">No cadets in Company {company} yet.</p>
                    )}
                    {roster?.map((cadet) => (
                      <CadetRow key={cadet.id} cadet={cadet} onSelect={() => setSelectedCadetId(cadet.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

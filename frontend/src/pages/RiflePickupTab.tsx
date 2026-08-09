import { useEffect, useRef, useState } from "react";
import { ApiError, cadetsApi, equipmentApi, riflePickupApi, type PickupResult } from "../api/client";
import type { Cadet, EquipmentItem, HistoryEntry } from "../types";
import { formatPosition, parseSqliteUtc } from "../types";

type Banner = { kind: "success" | "error" | "warning"; message: string };

const BANNER_STYLES: Record<Banner["kind"], string> = {
  success: "border-green-300 bg-green-50 text-green-800",
  error: "border-red-300 bg-red-50 text-red-800",
  warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
};

function formatTime(sqliteUtc: string): string {
  return parseSqliteUtc(sqliteUtc).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function RiflePickupTab() {
  const [scanValue, setScanValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [unmatchedScanId, setUnmatchedScanId] = useState<string | null>(null);
  const [resolveSearch, setResolveSearch] = useState("");

  const [cadets, setCadets] = useState<Cadet[]>([]);
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [activity, setActivity] = useState<HistoryEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const [showManual, setShowManual] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [busyCadetId, setBusyCadetId] = useState<number | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  async function loadCadets() {
    setCadets(await cadetsApi.list());
  }

  async function loadActivity() {
    setLoadingActivity(true);
    try {
      setActivity(await riflePickupApi.activity());
    } finally {
      setLoadingActivity(false);
    }
  }

  async function loadAvailableCount() {
    const items: EquipmentItem[] = await equipmentApi.list("infantry_rifle");
    setAvailableCount(items.filter((i) => !i.owner_cadet_id && i.condition !== "red").length);
  }

  function refreshAll() {
    loadCadets();
    loadActivity();
    loadAvailableCount();
  }

  useEffect(() => {
    refreshAll();
    scanInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function focusScan() {
    scanInputRef.current?.focus();
  }

  function handleResult(result: PickupResult) {
    switch (result.status) {
      case "checked_out":
        setBanner({ kind: "success", message: `Issued ${result.item.tag} to ${result.cadet.first_name} ${result.cadet.last_name}.` });
        setUnmatchedScanId(null);
        break;
      case "checked_in":
        setBanner({ kind: "success", message: `Returned ${result.item.tag} from ${result.cadet.first_name} ${result.cadet.last_name}.` });
        setUnmatchedScanId(null);
        break;
      case "ineligible":
        setBanner({ kind: "error", message: result.reason });
        setUnmatchedScanId(null);
        break;
      case "none_available":
        setBanner({
          kind: "warning",
          message: `No Green/Yellow Infantry Rifles left to issue ${result.cadet.first_name} ${result.cadet.last_name}.`,
        });
        setUnmatchedScanId(null);
        break;
      case "not_found":
        setBanner({ kind: "error", message: "Cadet not found." });
        setUnmatchedScanId(null);
        break;
      case "unmatched":
        setBanner({ kind: "warning", message: `No cadet is linked to scan “${result.scanned_id}” yet — look them up below.` });
        setUnmatchedScanId(result.scanned_id);
        break;
    }
    refreshAll();
  }

  async function submitScan(e: React.FormEvent) {
    e.preventDefault();
    const value = scanValue.trim();
    setScanValue("");
    if (!value) return;
    setScanning(true);
    try {
      const result = await riflePickupApi.scan(value);
      handleResult(result);
    } catch (err) {
      setBanner({ kind: "error", message: err instanceof ApiError ? err.message : "Scan failed." });
    } finally {
      setScanning(false);
      focusScan();
    }
  }

  async function resolveUnmatched(cadetId: number) {
    if (!unmatchedScanId) return;
    setBusyCadetId(cadetId);
    try {
      const result = await riflePickupApi.link(cadetId, unmatchedScanId);
      handleResult(result);
    } catch (err) {
      setBanner({ kind: "error", message: err instanceof ApiError ? err.message : "Failed to link scan." });
    } finally {
      setBusyCadetId(null);
      focusScan();
    }
  }

  async function manualToggle(cadetId: number) {
    setBusyCadetId(cadetId);
    try {
      const result = await riflePickupApi.manual(cadetId);
      handleResult(result);
    } catch (err) {
      setBanner({ kind: "error", message: err instanceof ApiError ? err.message : "Failed to check in/out." });
    } finally {
      setBusyCadetId(null);
    }
  }

  const resolveMatches = cadets.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(resolveSearch.trim().toLowerCase()),
  );

  const manualMatches = cadets.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(manualSearch.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Rifle Pickup</h2>
        {availableCount !== null && (
          <span className="text-sm text-slate-500">
            {availableCount} Infantry Rifle{availableCount === 1 ? "" : "s"} available to issue
          </span>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <form onSubmit={submitScan}>
          <label className="block text-xs font-medium text-slate-600">Scan ID (or type it and press Enter)</label>
          <input
            ref={scanInputRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              // Belt-and-suspenders alongside the form's own onSubmit: most HID
              // barcode scanners send a real Enter keystroke after the payload,
              // which should trigger implicit form submission on its own, but
              // browsers/scanner configs vary enough that we submit explicitly too.
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            onBlur={focusScan}
            disabled={scanning}
            autoFocus
            placeholder="Waiting for scan…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-lg tracking-wide"
          />
        </form>

        {banner && (
          <div className={`mt-3 rounded-md border px-3 py-2 text-sm font-medium ${BANNER_STYLES[banner.kind]}`}>{banner.message}</div>
        )}

        {unmatchedScanId && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Link scan “{unmatchedScanId}” to a cadet</p>
            <input
              value={resolveSearch}
              onChange={(e) => setResolveSearch(e.target.value)}
              placeholder="Search cadets by name…"
              className="mt-2 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {resolveMatches.length === 0 && <p className="text-xs text-slate-400">No matching cadets.</p>}
              {resolveMatches.map((c) => (
                <button
                  key={c.id}
                  disabled={busyCadetId !== null}
                  onClick={() => resolveUnmatched(c.id)}
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
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
            <button onClick={() => setUnmatchedScanId(null)} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-slate-900 hover:bg-slate-50"
        >
          <span>Lost or forgot their ID? Look up by name</span>
          <span className="text-slate-400">{showManual ? "▲" : "▼"}</span>
        </button>
        {showManual && (
          <div className="border-t border-slate-200 p-4">
            <input
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              placeholder="Search cadets by name…"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {manualMatches.map((c) => {
                const hasInfantryRifle = c.rifle?.type === "infantry_rifle";
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                  >
                    <span>
                      {c.first_name} {c.last_name}
                      <span className="ml-2 text-xs text-slate-500">
                        Co. {c.company} · {formatPosition(c.position)}
                      </span>
                      {hasInfantryRifle && <span className="ml-2 text-xs font-semibold text-slate-700">{c.rifle!.tag}</span>}
                    </span>
                    <button
                      disabled={busyCadetId !== null}
                      onClick={() => manualToggle(c.id)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {hasInfantryRifle ? "Check In" : "Check Out"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Activity</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {loadingActivity && <p className="px-4 py-3 text-sm text-slate-400">Loading…</p>}
          {!loadingActivity && activity.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No activity yet today.</p>}
          {!loadingActivity && activity.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Cadet</th>
                  <th className="px-4 py-2">Rifle</th>
                  <th className="px-4 py-2">Checked out</th>
                  <th className="px-4 py-2">Checked in</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-2 text-slate-800">
                      {row.cadet_name} <span className="text-xs text-slate-400">(Co. {row.cadet_company})</span>
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-700">{row.equipment_tag}</td>
                    <td className="px-4 py-2 text-slate-500">{formatTime(row.checked_out_at)}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {row.checked_in_at ? formatTime(row.checked_in_at) : <span className="text-slate-400">still out</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

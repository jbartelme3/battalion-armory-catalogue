import { useEffect, useState } from "react";
import { staffApi } from "../../api/client";
import type { StaffAuditEntry, StaffData, StaffField, StaffKind, StaffRecord } from "../../types";
import ActorBar, { useActorName } from "../ActorBar";
import { TONE_CLASSES, emptyData, formatValue, isActive, loadKinds, quickAction, recordBadges } from "./staffUtils";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

// A list of one staff record type (orders, work orders, training...): filter,
// add, edit, delete, and view each record's change history. Everything is
// driven by the record type's field definitions from the worker.
export default function StaffRecordsBoard({ kindKey }: { kindKey: string }) {
  const [actor, setActor] = useActorName();
  const [kind, setKind] = useState<StaffKind | null>(null);
  const [records, setRecords] = useState<StaffRecord[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [company, setCompany] = useState<"all" | "A" | "B" | "C">("all");
  const [editing, setEditing] = useState<StaffRecord | "new" | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setRecords(await staffApi.list(kindKey));
  }

  useEffect(() => {
    setKind(null);
    setRecords(null);
    setEditing(null);
    loadKinds()
      .then((kinds) => setKind(kinds.find((k) => k.key === kindKey) ?? null))
      .then(reload)
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindKey]);

  if (error && !records) return <p className="text-sm text-red-600">{error}</p>;
  if (!kind || !records) return <p className="text-sm text-slate-400">Loading…</p>;

  // Morale reports and police areas are running logs; the rest have a
  // natural "done" state worth hiding by default.
  const hasActiveFilter = kind.key !== "police_areas" && kind.key !== "morale";
  const filtered = records.filter(
    (r) =>
      (!hasActiveFilter || showAll || isActive(kind, r.data)) &&
      (company === "all" || !kind.companyField || r.data[kind.companyField] === company || r.data[kind.companyField] === null),
  );
  // Upcoming training reads best soonest-first; everything else newest-first.
  const visible =
    kind.key === "training" && !showAll
      ? [...filtered].sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)))
      : filtered;
  const canWrite = actor.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{kind.label}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{kind.description}</p>
        </div>
        {editing === null && (
          <button
            onClick={() => setEditing("new")}
            disabled={!canWrite}
            className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            + Add
          </button>
        )}
      </div>

      <ActorBar actor={actor} onChange={setActor} />
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing !== null && (
        <RecordForm
          kind={kind}
          initial={editing === "new" ? emptyData(kind) : editing.data}
          title={editing === "new" ? `Add to ${kind.label}` : "Edit"}
          onCancel={() => setEditing(null)}
          onSubmit={async (data) => {
            if (editing === "new") await staffApi.create(kind.key, data, actor);
            else await staffApi.update(editing.id, data, actor);
            setEditing(null);
            await reload();
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {kind.companyField && (
          <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs">
            {(["all", "A", "B", "C"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCompany(c)}
                className={`px-3 py-1.5 font-semibold ${company === c ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
              >
                {c === "all" ? "All" : `C${c}`}
              </button>
            ))}
          </div>
        )}
        {hasActiveFilter && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show {kind.key === "orders" ? "expired" : "closed"} too
          </label>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {visible.length} of {records.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          {records.length === 0 ? "Nothing recorded yet." : "Nothing matches these filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <RecordCard
              key={r.id}
              kind={kind}
              record={r}
              open={expanded === r.id}
              canEdit={canWrite && editing === null}
              onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              onEdit={() => {
                setEditing(r);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onQuickUpdate={async (data) => {
                try {
                  setError(null);
                  await staffApi.update(r.id, data, actor);
                  await reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not save.");
                }
              }}
              onDelete={async () => {
                if (!window.confirm("Delete this record? It stays in the change history.")) return;
                try {
                  await staffApi.remove(r.id, actor);
                  await reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not delete.");
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RecordCard({
  kind,
  record,
  open,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
  onQuickUpdate,
}: {
  kind: StaffKind;
  record: StaffRecord;
  open: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onQuickUpdate: (data: StaffData) => void;
}) {
  const { data } = record;
  const dateField = kind.fields.find((f) => f.key === kind.dateField);
  const company = kind.companyField ? data[kind.companyField] : null;
  const badges = recordBadges(kind, data);
  const quick = quickAction(kind, data);
  const title =
    kind.key === "laundry"
      ? `${data.items} garment${data.items === 1 ? "" : "s"}`
      : kind.key === "first_sgt_reports"
        ? `${data.formation} report`
        : String(data[kind.titleField] ?? "");

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <button onClick={onToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          <span className="shrink-0 text-xs text-slate-500">
            {company ? `C${company}` : kind.companyField === "audience" ? "Battalion" : ""}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {dateField && data[dateField.key] && (
            <span className="text-xs text-slate-500">{formatValue(dateField.type, data[dateField.key])}</span>
          )}
          {badges.map((b) => (
            <span key={b.label} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONE_CLASSES[b.tone]}`}>
              {b.label}
            </span>
          ))}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 text-sm">
            {kind.fields
              .filter((f) => data[f.key] !== null && data[f.key] !== "")
              .map((f) => (
                <div key={f.key} className="contents">
                  <dt className="text-slate-500">{f.label}</dt>
                  <dd className="whitespace-pre-wrap text-slate-800">{formatValue(f.type, data[f.key])}</dd>
                </div>
              ))}
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">
            Added by {record.created_by}
            {record.updated_by !== record.created_by || record.updated_at !== record.created_at ? ` · last changed by ${record.updated_by}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {canEdit && quick && (
              <button
                onClick={() => onQuickUpdate(quick.data)}
                className="rounded-md bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700"
              >
                {quick.label}
              </button>
            )}
            {canEdit && (
              <>
                <button onClick={onEdit} className="font-semibold text-slate-700 underline">
                  Edit
                </button>
                <button onClick={onDelete} className="text-red-600 underline">
                  Delete
                </button>
              </>
            )}
          </div>
          <RecordHistory kind={kind} recordId={record.id} />
        </div>
      )}
    </li>
  );
}

function RecordHistory({ kind, recordId }: { kind: StaffKind; recordId: number }) {
  const [entries, setEntries] = useState<StaffAuditEntry[] | null>(null);
  const [open, setOpen] = useState(false);

  async function toggle() {
    if (!open && entries === null) setEntries(await staffApi.history(recordId));
    setOpen(!open);
  }

  function changes(e: StaffAuditEntry): string {
    if (e.action === "create") return "Created";
    if (e.action === "delete") return "Deleted";
    const diffs = kind.fields
      .filter((f) => (e.before?.[f.key] ?? null) !== (e.after?.[f.key] ?? null))
      .map((f) => `${f.label}: ${formatValue(f.type, e.before?.[f.key] ?? null)} → ${formatValue(f.type, e.after?.[f.key] ?? null)}`);
    return diffs.length ? diffs.join("; ") : "Saved with no changes";
  }

  return (
    <div className="mt-2">
      <button onClick={toggle} className="text-xs text-slate-500 underline">
        {open ? "Hide history" : "History"}
      </button>
      {open && entries && (
        <ul className="mt-1 space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="text-xs text-slate-600">
              <span className="text-slate-800">{changes(e)}</span>
              <span className="text-slate-400">
                {" "}
                · {e.actor} · {new Date(`${e.created_at.replace(" ", "T")}Z`).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: StaffField; value: string; onChange: (v: string) => void }) {
  const common = { id: `f-${field.key}`, value, onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
  switch (field.type) {
    case "textarea":
      return <textarea {...common} rows={3} placeholder={field.placeholder} className={inputClass} />;
    case "date":
      return <input {...common} type="date" className={inputClass} />;
    case "datetime":
      return <input {...common} type="datetime-local" className={inputClass} />;
    case "number":
      return <input {...common} type="number" inputMode="numeric" min="0" className={inputClass} />;
    case "company":
      return (
        <select {...common} className={inputClass}>
          {!field.required && <option value="">{field.key === "audience" ? "Whole battalion" : "—"}</option>}
          {field.required && !value && <option value="">Choose…</option>}
          {["A", "B", "C"].map((c) => (
            <option key={c} value={c}>
              Company {c}
            </option>
          ))}
        </select>
      );
    case "select":
      return (
        <select {...common} className={inputClass}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    default:
      return <input {...common} placeholder={field.placeholder} className={inputClass} />;
  }
}

function RecordForm({
  kind,
  initial,
  title,
  onSubmit,
  onCancel,
}: {
  kind: StaffKind;
  initial: StaffData;
  title: string;
  onSubmit: (data: StaffData) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(kind.fields.map((f) => [f.key, initial[f.key] === null || initial[f.key] === undefined ? "" : String(initial[f.key])])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const missing = kind.fields.find((f) => f.required && !values[f.key]?.trim());
        if (missing) return setError(`${missing.label} is required.`);
        setSaving(true);
        try {
          await onSubmit(values);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save.");
          setSaving(false);
        }
      }}
      className="space-y-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {kind.fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <label htmlFor={`f-${f.key}`} className="block text-sm font-medium text-slate-700">
              {f.label}
              {!f.required && <span className="font-normal text-slate-400"> (optional)</span>}
            </label>
            <FieldInput field={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
            {f.hint && <p className="mt-0.5 text-xs text-slate-500">{f.hint}</p>}
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

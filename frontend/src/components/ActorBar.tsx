import { useState } from "react";

// Name recorded against every change in the banner and staff sections.
// Remembered per browser so each person only types it once.
const ACTOR_KEY = "banner.actorName";

export function useActorName(): [string, (name: string) => void] {
  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTOR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  function save(next: string) {
    setName(next);
    try {
      localStorage.setItem(ACTOR_KEY, next);
    } catch {
      // Storage unavailable (private mode); the name still lasts this visit.
    }
  }
  return [name, save];
}

// Shows who changes will be recorded as, with a way to set or change it.
export default function ActorBar({ actor, onChange }: { actor: string; onChange: (name: string) => void }) {
  const [editing, setEditing] = useState(!actor);
  const [draft, setDraft] = useState(actor);

  if (!editing) {
    return (
      <p className="text-xs text-slate-500 print:hidden">
        Recording as <span className="font-semibold text-slate-700">{actor}</span> ·{" "}
        <button onClick={() => setEditing(true)} className="underline hover:text-slate-800">
          change
        </button>
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        onChange(draft.trim());
        setEditing(false);
      }}
      className="rounded-lg border border-slate-300 bg-white p-3 print:hidden"
    >
      <label className="block text-sm font-medium text-slate-700" htmlFor="banner-actor">
        Your name
      </label>
      <p className="text-xs text-slate-500">Saved with every score you enter or change, so the history shows who did what.</p>
      <div className="mt-2 flex gap-2">
        <input
          id="banner-actor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. BSM Bartelme"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Save
        </button>
      </div>
    </form>
  );
}

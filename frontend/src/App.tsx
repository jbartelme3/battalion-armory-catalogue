import { useEffect, useState } from "react";
import { auth } from "./api/client";
import Login from "./pages/Login";
import CadetsTab from "./pages/CadetsTab";
import EquipmentTab from "./pages/EquipmentTab";
import RiflePickupTab from "./pages/RiflePickupTab";

type SubTab = { id: string; label: string; render: () => JSX.Element };

type Section = { id: string; label: string; subtabs: SubTab[] };

// Home screen widgets, top to bottom. Sections with no subtabs yet show a
// placeholder when opened.
const SECTIONS: Section[] = [
  { id: "commander", label: "Commander", subtabs: [] },
  { id: "adjutant", label: "Adjutant", subtabs: [] },
  { id: "operations", label: "Operations Officer", subtabs: [] },
  { id: "sergeant-major", label: "Sergeant Major", subtabs: [] },
  { id: "supply", label: "Supply", subtabs: [] },
  {
    id: "armorer",
    label: "Armorer",
    subtabs: [
      { id: "cadets", label: "Cadets", render: () => <CadetsTab /> },
      { id: "equipment", label: "Equipment", render: () => <EquipmentTab /> },
      { id: "rifle-pickup", label: "Rifle Pickup", render: () => <RiflePickupTab /> },
    ],
  },
];

// Routes live in the URL hash (#/armorer/equipment) so the browser/phone back
// button returns to the home screen.
function parseHash(): { section: Section | null; subtab: SubTab | null } {
  const [sectionId, subtabId] = window.location.hash.replace(/^#\/?/, "").split("/");
  const section = SECTIONS.find((s) => s.id === sectionId) ?? null;
  const subtab = section ? section.subtabs.find((t) => t.id === subtabId) ?? section.subtabs[0] ?? null : null;
  return { section, subtab };
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export default function App() {
  const [authState, setAuthState] = useState<"checking" | "authed" | "unauthed">("checking");
  const { section, subtab } = useHashRoute();

  useEffect(() => {
    auth
      .me()
      .then(() => setAuthState("authed"))
      .catch(() => setAuthState("unauthed"));
  }, []);

  if (authState === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  if (authState === "unauthed") {
    return <Login onSuccess={() => setAuthState("authed")} />;
  }

  async function handleLogout() {
    await auth.logout();
    setAuthState("unauthed");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href="#/" className="text-base font-bold text-slate-900">
            Infantry Battalion Catalogue
          </a>
          <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800">
            Log out
          </button>
        </div>
        {section && (
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex items-center gap-2 pb-2 text-sm">
              <a href="#/" className="text-slate-500 hover:text-slate-800">
                ← Home
              </a>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-900">{section.label}</span>
            </div>
            {section.subtabs.length > 0 && (
              <nav className="flex gap-1 overflow-x-auto">
                {section.subtabs.map((t) => (
                  <a
                    key={t.id}
                    href={`#/${section.id}/${t.id}`}
                    className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${
                      subtab?.id === t.id
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {t.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!section && (
          <div className="flex flex-col gap-3">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm hover:border-slate-400 active:bg-slate-50"
              >
                <div>
                  <div className="text-base font-bold text-slate-900">{s.label}</div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {s.subtabs.length > 0 ? s.subtabs.map((t) => t.label).join(" · ") : "Coming soon"}
                  </div>
                </div>
                <span className="text-xl text-slate-400">›</span>
              </a>
            ))}
          </div>
        )}
        {section && subtab && subtab.render()}
        {section && !subtab && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Nothing here yet for {section.label}.
          </div>
        )}
      </main>
    </div>
  );
}

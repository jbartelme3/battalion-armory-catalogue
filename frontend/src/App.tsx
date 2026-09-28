import { Suspense, lazy, useEffect, useState } from "react";
import { auth } from "./api/client";
import Login from "./pages/Login";
import PageErrorBoundary from "./components/PageErrorBoundary";
import HomeNotices from "./components/HomeNotices";

// Each page loads on first visit, so the home screen doesn't download every
// section's code up front.
const CadetsTab = lazy(() => import("./pages/CadetsTab"));
const EquipmentTab = lazy(() => import("./pages/EquipmentTab"));
const RiflePickupTab = lazy(() => import("./pages/RiflePickupTab"));
const BannerWeekTab = lazy(() => import("./pages/BannerWeekTab"));
const BannerSeasonTab = lazy(() => import("./pages/BannerSeasonTab"));
const BannerTrendsTab = lazy(() => import("./pages/BannerTrendsTab"));
const CommanderTab = lazy(() => import("./pages/CommanderTab"));
const NcsTab = lazy(() => import("./pages/NcsTab"));
const StaffRecordsBoard = lazy(() => import("./components/staff/StaffRecordsBoard"));

type SubTab = { id: string; label: string; render: () => JSX.Element };

type Section = { id: string; label: string; blurb: string; subtabs: SubTab[] };

const records = (kind: string) => () => <StaffRecordsBoard kindKey={kind} />;

// Home screen widgets, top to bottom. Duties behind each section come from
// CMA 3-1 (Billet Descriptions) and Eagles & Wings.
const SECTIONS: Section[] = [
  {
    id: "commander",
    label: "Commander",
    blurb: "Battalion overview · P.I./G.I. inspections",
    subtabs: [
      { id: "overview", label: "Overview", render: () => <CommanderTab /> },
      { id: "inspections", label: "Inspections", render: records("inspections") },
    ],
  },
  {
    id: "adjutant",
    label: "Adjutant",
    blurb: "Orders & notices · Morale reports · New Cadet System",
    subtabs: [
      { id: "orders", label: "Orders & Notices", render: records("orders") },
      { id: "morale", label: "Morale", render: records("morale") },
      { id: "ncs", label: "New Cadets", render: () => <NcsTab /> },
    ],
  },
  {
    id: "operations",
    label: "Operations Officer",
    blurb: "Training schedule and evaluations",
    subtabs: [{ id: "training", label: "Training", render: records("training") }],
  },
  {
    id: "sergeant-major",
    label: "Sergeant Major",
    blurb: "Battalion Banner · Season · Trends · 1SG reports",
    subtabs: [
      { id: "banner", label: "Banner", render: () => <BannerWeekTab /> },
      { id: "season", label: "Season", render: () => <BannerSeasonTab /> },
      { id: "trends", label: "Trends", render: () => <BannerTrendsTab /> },
      { id: "1sg-reports", label: "1SG Reports", render: records("first_sgt_reports") },
    ],
  },
  {
    id: "supply",
    label: "Supply",
    blurb: "Laundry pickup · Work orders · Police areas",
    subtabs: [
      { id: "laundry", label: "Laundry", render: records("laundry") },
      { id: "work-orders", label: "Work Orders", render: records("work_orders") },
      { id: "police-areas", label: "Police Areas", render: records("police_areas") },
    ],
  },
  {
    id: "armorer",
    label: "Armorer",
    blurb: "Cadets · Equipment · Rifle Pickup",
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
                    className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
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
            <HomeNotices />
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm hover:border-slate-400 active:bg-slate-50"
              >
                <div>
                  <div className="text-base font-bold text-slate-900">{s.label}</div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {s.blurb}
                  </div>
                </div>
                <span className="text-xl text-slate-400">›</span>
              </a>
            ))}
          </div>
        )}
        {section && subtab && (
          // key remounts the page (and resets any error) when switching subtabs
          <PageErrorBoundary key={`${section.id}/${subtab.id}`}>
            <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>{subtab.render()}</Suspense>
          </PageErrorBoundary>
        )}
        {section && !subtab && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Nothing here yet for {section.label}.
          </div>
        )}
      </main>
    </div>
  );
}

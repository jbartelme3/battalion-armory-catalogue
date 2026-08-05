import { useEffect, useState } from "react";
import { auth } from "./api/client";
import Login from "./pages/Login";
import CadetsTab from "./pages/CadetsTab";
import EquipmentTab from "./pages/EquipmentTab";

type Tab = "cadets" | "equipment";

export default function App() {
  const [authState, setAuthState] = useState<"checking" | "authed" | "unauthed">("checking");
  const [tab, setTab] = useState<Tab>("cadets");

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
          <h1 className="text-base font-bold text-slate-900">Infantry Battalion Armory Catalogue</h1>
          <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800">
            Log out
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {(["cadets", "equipment"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-4 py-2 text-sm font-semibold capitalize ${
                tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "cadets" ? <CadetsTab /> : <EquipmentTab />}
      </main>
    </div>
  );
}

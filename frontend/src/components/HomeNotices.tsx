import { useEffect, useState } from "react";
import { staffApi } from "../api/client";
import type { StaffRecord } from "../types";

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

// Orders and notices in effect, shown on the home screen so every leader
// who opens the site sees them (CMA 3-1: the Battalion Commander makes sure
// unit commanders know every special schedule, notice and event).
export default function HomeNotices() {
  const [orders, setOrders] = useState<StaffRecord[]>([]);

  useEffect(() => {
    const today = todayLocal();
    staffApi
      .list("orders")
      .then((all) =>
        setOrders(all.filter((r) => String(r.data.effective) <= today && (!r.data.expires || String(r.data.expires) >= today))),
      )
      .catch(() => setOrders([]));
  }, []);

  if (orders.length === 0) return null;
  return (
    <a
      href="#/adjutant/orders"
      className="block rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 hover:border-blue-300"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">
        {orders.length} {orders.length === 1 ? "order or notice" : "orders & notices"} in effect
      </div>
      <ul className="mt-1 space-y-0.5">
        {orders.slice(0, 3).map((r) => (
          <li key={r.id} className="truncate text-sm text-slate-800">
            <span className="font-semibold">{String(r.data.title)}</span>
            <span className="text-xs text-slate-500"> · {r.data.audience ? `Company ${r.data.audience}` : "Battalion"}</span>
          </li>
        ))}
      </ul>
      {orders.length > 3 && <div className="mt-0.5 text-xs text-blue-800">+{orders.length - 3} more</div>}
    </a>
  );
}

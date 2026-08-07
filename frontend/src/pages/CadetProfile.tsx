import { useEffect, useState } from "react";
import { cadetsApi, ApiError } from "../api/client";
import type { CadetProfile as CadetProfileType, EquipmentItem, EquipmentType } from "../types";
import { EQUIPMENT_TYPE_LABELS, EQUIPMENT_TYPE_ORDER, formatClassman, formatHgRank, formatPosition, formatRank } from "../types";
import ConditionBadge from "../components/ConditionBadge";
import SubstituteModal from "../components/SubstituteModal";
import CadetForm from "../components/CadetForm";
import EquipmentDetailModal from "../components/EquipmentDetailModal";

export default function CadetProfile({ cadetId, onBack }: { cadetId: number; onBack: () => void }) {
  const [profile, setProfile] = useState<CadetProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [substituteType, setSubstituteType] = useState<EquipmentType | null>(null);
  const [editing, setEditing] = useState(false);
  const [detailItem, setDetailItem] = useState<EquipmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await cadetsApi.get(cadetId);
      setProfile(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadetId]);

  if (loading || !profile) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  const eligibleTypes = EQUIPMENT_TYPE_ORDER.filter((type) => profile.eligible_slots[type]);

  async function handleDelete() {
    if (!profile) return;
    if (!confirm(`Delete ${profile.first_name} ${profile.last_name} from the roster? Any assigned equipment will become unassigned, not deleted. This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      await cadetsApi.remove(cadetId);
      onBack();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete cadet.");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <h2 className="mt-4 mb-3 text-lg font-bold text-slate-900">Edit Cadet</h2>
        <CadetForm
          submitLabel="Save Changes"
          initial={{
            first_name: profile.first_name,
            last_name: profile.last_name,
            company: profile.company,
            position: profile.position,
            rank: profile.rank,
            classman: profile.classman,
            is_honor_guard: profile.is_honor_guard,
            hg_rank: profile.hg_rank,
          }}
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await cadetsApi.update(cadetId, values);
            setEditing(false);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <BackButton onBack={onBack} />

      <div className={`mt-4 rounded-lg border p-5 ${profile.is_honor_guard ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className={`text-xl font-bold ${profile.is_honor_guard ? "text-blue-900" : "text-slate-900"}`}>
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Unit: Company {profile.company} · {formatPosition(profile.position)}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">Rank: {formatRank(profile.rank)}</p>
            <p className="mt-0.5 text-sm text-slate-600">Classman: {formatClassman(profile.classman)}</p>
            {profile.is_honor_guard && (
              <p className="mt-1 text-sm font-medium text-blue-800">
                Honor Guard{profile.hg_rank ? ` — ${formatHgRank(profile.hg_rank)}` : " — rank not set"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
        {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
      </div>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Assigned Equipment</h3>

        {eligibleTypes.length === 0 && (
          <p className="text-sm text-slate-400">This position does not carry any catalogued equipment.</p>
        )}

        {eligibleTypes.map((type) => {
          const item = profile.equipment.find((e) => e.type === type);
          return (
            <div key={type} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{EQUIPMENT_TYPE_LABELS[type]}</p>
                {item ? (
                  <button onClick={() => setDetailItem(item)} className="mt-1 flex items-center gap-2 text-left hover:underline">
                    <span className="text-sm text-slate-600">{item.tag}</span>
                    <ConditionBadge condition={item.condition} />
                    {item.is_ps_rifle && (
                      <span className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        PS Rifle
                      </span>
                    )}
                    {item.is_black_sl_bayonet && (
                      <span className="rounded-full border border-slate-500 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">
                        Black SL Bayonet
                      </span>
                    )}
                    {item.type === "bayonet" && item.has_sheath === false && (
                      <span className="text-xs text-red-600">missing sheath</span>
                    )}
                    {item.type === "dress_cover" && item.has_pompom === false && (
                      <span className="text-xs text-red-600">missing pompom</span>
                    )}
                    {item.type === "dress_jacket" && item.size && <span className="text-xs text-slate-500">size {item.size}</span>}
                  </button>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">Unassigned</p>
                )}
              </div>
              <button
                onClick={() => setSubstituteType(type)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {item ? "Substitute" : "Assign"}
              </button>
            </div>
          );
        })}
      </div>

      {substituteType && (
        <SubstituteModal
          type={substituteType}
          cadetId={cadetId}
          cadetPosition={profile.position}
          currentItemId={profile.equipment.find((e) => e.type === substituteType)?.id ?? null}
          onClose={() => setSubstituteType(null)}
          onAssigned={() => {
            setSubstituteType(null);
            load();
          }}
        />
      )}

      {detailItem && (
        <EquipmentDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onChanged={() => {
            setDetailItem(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-800">
      ← Back to roster
    </button>
  );
}

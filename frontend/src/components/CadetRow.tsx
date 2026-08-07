import type { Cadet } from "../types";
import { CONDITION_TEXT_COLOR, formatClassmanShort, formatHgRank, formatPosition } from "../types";

export default function CadetRow({ cadet, onSelect }: { cadet: Cadet; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left text-sm first:border-t-0 hover:bg-slate-50 ${
        cadet.is_honor_guard ? "bg-blue-50" : ""
      }`}
    >
      <span className={cadet.is_honor_guard ? "font-medium text-blue-900" : "text-slate-800"}>
        {cadet.last_name}, {cadet.first_name}
      </span>
      <span className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-xs text-slate-500">
          Co. {cadet.company}
          {formatClassmanShort(cadet.classman) ? ` · ${formatClassmanShort(cadet.classman)}` : ""} · {formatPosition(cadet.position)}
          {cadet.is_honor_guard && cadet.hg_rank
            ? ` · HG ${formatHgRank(cadet.hg_rank)}`
            : cadet.is_honor_guard
              ? " · Honor Guard"
              : ""}
        </span>
        {cadet.rifle && (
          <span className={`text-xs font-semibold ${CONDITION_TEXT_COLOR[cadet.rifle.condition]}`}>{cadet.rifle.tag}</span>
        )}
      </span>
    </button>
  );
}

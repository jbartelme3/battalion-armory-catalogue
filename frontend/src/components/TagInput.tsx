import { BAYONET_TAG_PREFIX_BLACK_SL, TAG_PREFIXES, tagPrefixFor } from "../types";
import type { EquipmentType } from "../types";

// Fixed prefix + number entry for equipment tags. For bayonets, a dropdown
// picks between the standard (BAY-) and Black SL (BSL-) prefix, which also
// drives the is_black_sl_bayonet flag so the tag and the flag can't drift
// apart.
export default function TagInput({
  type,
  number,
  onNumberChange,
  isBlackSlBayonet,
  onIsBlackSlBayonetChange,
  disabled,
}: {
  type: EquipmentType;
  number: string;
  onNumberChange: (value: string) => void;
  isBlackSlBayonet?: boolean;
  onIsBlackSlBayonetChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const prefix = tagPrefixFor(type, isBlackSlBayonet);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">Tag</label>
      <div className="mt-1 flex items-center gap-1.5">
        {type === "bayonet" ? (
          <select
            value={isBlackSlBayonet ? "black_sl" : "standard"}
            disabled={disabled}
            onChange={(e) => onIsBlackSlBayonetChange?.(e.target.value === "black_sl")}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="standard">Standard ({TAG_PREFIXES.bayonet})</option>
            <option value="black_sl">Black SL ({BAYONET_TAG_PREFIX_BLACK_SL})</option>
          </select>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-500">{prefix}</span>
        )}
        <input
          required
          value={number}
          disabled={disabled}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="001"
          className="w-20 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}

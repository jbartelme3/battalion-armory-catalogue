import type { Condition } from "../types";

const STYLES: Record<Condition, string> = {
  green: "bg-green-100 text-green-800 border-green-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
  red: "bg-red-100 text-red-800 border-red-300",
};

const LABELS: Record<Condition, string> = {
  green: "Green",
  yellow: "Yellow",
  red: "Red",
};

export default function ConditionBadge({ condition }: { condition: Condition }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[condition]}`}>
      <span
        className={`h-2 w-2 rounded-full ${
          condition === "green" ? "bg-green-600" : condition === "yellow" ? "bg-yellow-600" : "bg-red-600"
        }`}
      />
      {LABELS[condition]}
    </span>
  );
}

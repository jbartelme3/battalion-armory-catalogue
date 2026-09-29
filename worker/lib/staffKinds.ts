// Record types kept by the battalion staff sections (Adjutant, Operations
// Officer, Supply). Each is a list of simple records defined by its fields;
// the worker validates against these definitions and the frontend renders
// its forms from them, so adding a field is a one-line change here.
// Duties come from CMA 3-1 (3-1.2 Billet Descriptions) and Eagles & Wings.

export type FieldType = "text" | "textarea" | "date" | "datetime" | "number" | "select" | "company";

export interface StaffField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  // Shown under the field in the form.
  hint?: string;
}

export interface StaffKind {
  key: string;
  section: "commander" | "adjutant" | "operations" | "supply" | "sergeant-major";
  label: string;
  // One line on what the record is for and where the duty comes from.
  description: string;
  fields: StaffField[];
  // Which fields feed the indexed columns (sorting, filtering, dashboard).
  titleField: string;
  dateField?: string;
  companyField?: string;
  statusField?: string;
  // Statuses that count as "still needs action" on the Commander dashboard.
  openStatuses?: string[];
}

export const STAFF_KINDS: StaffKind[] = [
  {
    key: "inspections",
    section: "commander",
    label: "Inspections",
    description:
      "The Battalion Commander's inspections of each company at P.I. and G.I., with anything that needs correcting (CMA 3-1: Battalion Commanders make inspections of organizations at P.I. and G.I.).",
    titleField: "findings",
    dateField: "date",
    companyField: "company",
    statusField: "corrected",
    openStatuses: ["Correction needed"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "type", label: "Type", type: "select", required: true, options: ["P.I.", "G.I.", "Formation", "Other"] },
      { key: "company", label: "Company", type: "company", required: true },
      { key: "rating", label: "Result", type: "select", required: true, options: ["Outstanding", "Satisfactory", "Unsatisfactory"] },
      { key: "findings", label: "Findings", type: "text", required: true, placeholder: "One line summary" },
      { key: "details", label: "Details", type: "textarea" },
      { key: "corrected", label: "Follow-up", type: "select", required: true, options: ["None needed", "Correction needed", "Corrected"] },
    ],
  },
  {
    key: "orders",
    section: "adjutant",
    label: "Orders & Notices",
    description:
      "Orders, notices and events published to the battalion or a company, so unit commanders see every special schedule (CMA 3-1: Battalion Adjutant publishes orders; Battalion Commander keeps unit commanders informed).",
    titleField: "title",
    dateField: "effective",
    companyField: "audience",
    fields: [
      { key: "type", label: "Type", type: "select", required: true, options: ["Order", "Notice", "Event"] },
      { key: "title", label: "Title", type: "text", required: true, placeholder: "e.g. Uniform of the day change" },
      { key: "body", label: "Details", type: "textarea", required: true },
      { key: "audience", label: "Audience", type: "company", hint: "Leave blank for the whole battalion." },
      { key: "effective", label: "Effective", type: "date", required: true },
      { key: "expires", label: "Expires", type: "date", hint: "After this date it drops off the dashboard." },
    ],
  },
  {
    key: "morale",
    section: "adjutant",
    label: "Morale Reports",
    description:
      "Periodic reports on the state of morale in each company (CMA 3-1: the Battalion Adjutant keeps abreast of cadet problems and reports on morale).",
    titleField: "summary",
    dateField: "date",
    companyField: "company",
    statusField: "follow_up",
    openStatuses: ["Follow-up needed"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "company", label: "Company", type: "company", required: true },
      { key: "rating", label: "Morale", type: "select", required: true, options: ["5 – High", "4 – Good", "3 – Fair", "2 – Low", "1 – Critical"] },
      { key: "summary", label: "Summary", type: "text", required: true, placeholder: "One line on how the company is doing" },
      { key: "concerns", label: "Problems / concerns", type: "textarea" },
      { key: "follow_up", label: "Follow-up", type: "select", required: true, options: ["None needed", "Follow-up needed", "Resolved"] },
    ],
  },
  {
    key: "first_sgt_reports",
    section: "sergeant-major",
    label: "First Sergeant's Reports",
    description:
      "Each company's daily personnel report from its First Sergeant, checked for accuracy before it goes to the RSM and Military Mentor (CMA 3-1: Battalion Sergeant Major).",
    titleField: "formation",
    dateField: "date",
    companyField: "company",
    statusField: "submitted",
    openStatuses: ["Not yet submitted"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "company", label: "Company", type: "company", required: true },
      { key: "formation", label: "Formation", type: "select", required: true, options: ["Breakfast", "Lunch", "Dinner", "Retreat", "Taps", "Other"] },
      { key: "assigned", label: "Assigned", type: "number", required: true },
      { key: "present", label: "Present", type: "number", required: true },
      { key: "excused", label: "Excused", type: "number", required: true, hint: "Sick call, sports, approved absences." },
      { key: "unexcused", label: "Unexcused absent", type: "number", required: true },
      { key: "names", label: "Absent cadets", type: "textarea", placeholder: "Names and reasons" },
      { key: "submitted", label: "Submitted to RSM / Mentor", type: "select", required: true, options: ["Not yet submitted", "Submitted"] },
    ],
  },
  {
    key: "training",
    section: "operations",
    label: "Training Schedule",
    description:
      "Wednesday drill, parade preparation and battalion inspections, with an evaluation of whether each met the standard (CMA 3-1: Infantry Battalion Operations Officer).",
    titleField: "title",
    dateField: "date",
    statusField: "status",
    openStatuses: ["Planned"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "time", label: "Time", type: "text", placeholder: "e.g. 1600–1730" },
      {
        key: "event",
        label: "Event",
        type: "select",
        required: true,
        options: ["Wednesday Drill", "Parade Practice", "Sunday Parade", "Battalion Inspection", "CAR Preparation", "New Cadet Training", "Other"],
      },
      { key: "title", label: "Title", type: "text", required: true, placeholder: "e.g. Company drill: manual of arms" },
      { key: "location", label: "Location", type: "text" },
      { key: "uniform", label: "Uniform", type: "text" },
      { key: "lead", label: "Lead", type: "text", placeholder: "Who runs it" },
      { key: "status", label: "Status", type: "select", required: true, options: ["Planned", "Completed", "Cancelled"] },
      {
        key: "evaluation",
        label: "Evaluation",
        type: "select",
        options: ["Met standard", "Partially met", "Did not meet – retrain"],
        hint: "Fill in once completed.",
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "laundry",
    section: "supply",
    label: "Laundry Pickup",
    description:
      "Garments waiting at the uniform department must be picked up within 24 hours of notification (CMA 3-1: Supply Officers, through the unit supply NCOs).",
    titleField: "items",
    dateField: "notified",
    companyField: "company",
    statusField: "status",
    openStatuses: ["Waiting"],
    fields: [
      { key: "notified", label: "Notified", type: "datetime", required: true },
      { key: "company", label: "Company", type: "company", required: true },
      { key: "items", label: "Garments waiting", type: "number", required: true },
      { key: "status", label: "Status", type: "select", required: true, options: ["Waiting", "Picked up"] },
      { key: "picked_up", label: "Picked up", type: "datetime", hint: "Required once picked up." },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Names of garments/cadets if reported" },
    ],
  },
  {
    key: "work_orders",
    section: "supply",
    label: "Work Orders",
    description:
      "Barracks and equipment repair requests, tracked through the Military Mentor until complete (CMA 3-1: Supply Officers monitor work order requests).",
    titleField: "description",
    dateField: "submitted",
    companyField: "company",
    statusField: "status",
    openStatuses: ["Open", "Submitted to Mentor", "In progress"],
    fields: [
      { key: "submitted", label: "Reported", type: "date", required: true },
      { key: "company", label: "Company", type: "company" },
      { key: "location", label: "Location", type: "text", required: true, placeholder: "e.g. Room 214, 2nd floor latrine" },
      { key: "category", label: "Category", type: "select", required: true, options: ["Barracks", "Furniture", "Plumbing", "Electrical", "Equipment", "Other"] },
      { key: "description", label: "Problem", type: "text", required: true },
      { key: "work_order_no", label: "Work order #", type: "text" },
      { key: "status", label: "Status", type: "select", required: true, options: ["Open", "Submitted to Mentor", "In progress", "Completed"] },
      { key: "completed", label: "Completed", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "police_areas",
    section: "supply",
    label: "Police Areas",
    description: "Which company polices which grounds, and when each was last checked (CMA 3-1: ensure proper police of assigned Battalion Police Areas).",
    titleField: "area",
    dateField: "last_checked",
    companyField: "company",
    statusField: "condition",
    openStatuses: ["Needs attention"],
    fields: [
      { key: "area", label: "Area", type: "text", required: true, placeholder: "e.g. North side of barracks" },
      { key: "company", label: "Company", type: "company", required: true },
      { key: "last_checked", label: "Last checked", type: "date" },
      { key: "condition", label: "Condition", type: "select", required: true, options: ["Good", "Needs attention"] },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type StaffData = Record<string, string | number | null>;

// Validate and normalize submitted data against the kind's fields. Unknown
// keys are dropped; blank optional fields become null.
export function validateStaffData(kind: StaffKind, raw: unknown): { ok: true; data: StaffData } | { ok: false; error: string } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const data: StaffData = {};
  for (const f of kind.fields) {
    const v = input[f.key];
    const blank = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (blank) {
      if (f.required) return { ok: false, error: `${f.label} is required` };
      data[f.key] = null;
      continue;
    }
    const s = String(v).trim();
    switch (f.type) {
      case "number": {
        const n = Number(s);
        if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${f.label} must be a number (0 or more)` };
        data[f.key] = n;
        break;
      }
      case "date":
        if (!DATE_RE.test(s)) return { ok: false, error: `${f.label} must be a date` };
        data[f.key] = s;
        break;
      case "datetime":
        if (!DATETIME_RE.test(s)) return { ok: false, error: `${f.label} must be a date and time` };
        data[f.key] = s;
        break;
      case "company":
        if (!["A", "B", "C"].includes(s)) return { ok: false, error: `${f.label} must be Company A, B or C` };
        data[f.key] = s;
        break;
      case "select":
        if (!f.options?.includes(s)) return { ok: false, error: `Pick a valid ${f.label.toLowerCase()}` };
        data[f.key] = s;
        break;
      default:
        data[f.key] = s.slice(0, f.type === "textarea" ? 2000 : 200);
    }
  }

  // Cross-field rules that keep records honest.
  if (kind.key === "laundry" && data.status === "Picked up" && !data.picked_up) {
    return { ok: false, error: "Enter when the garments were picked up" };
  }
  if (kind.key === "laundry" && data.picked_up && data.notified && String(data.picked_up) < String(data.notified)) {
    return { ok: false, error: "Pickup can't be before notification" };
  }
  if (kind.key === "work_orders" && data.status === "Completed" && !data.completed) {
    return { ok: false, error: "Enter the date the work was completed" };
  }
  // A report only balances if everyone assigned is accounted for.
  if (kind.key === "first_sgt_reports") {
    const [assigned, present, excused, unexcused] = ["assigned", "present", "excused", "unexcused"].map((k) => Number(data[k]));
    if (present + excused + unexcused !== assigned) {
      return { ok: false, error: `Doesn't add up: ${present} present + ${excused} excused + ${unexcused} unexcused = ${present + excused + unexcused}, but ${assigned} assigned` };
    }
  }
  if (kind.key === "orders" && data.expires && data.effective && String(data.expires) < String(data.effective)) {
    return { ok: false, error: "Expiry can't be before the effective date" };
  }
  return { ok: true, data };
}

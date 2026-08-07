export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SITE_PASSWORD: string;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
  ALERT_EMAIL: string;
}

export interface CadetRow {
  id: number;
  first_name: string;
  last_name: string;
  company: "A" | "B" | "C";
  position: string;
  rank: string | null;
  classman: string | null;
  is_honor_guard: 0 | 1;
  hg_rank: string | null;
  student_id: string | null;
}

export interface EquipmentHistoryRow {
  id: number;
  equipment_id: number | null;
  equipment_type: string;
  equipment_tag: string;
  cadet_id: number | null;
  cadet_first_name: string;
  cadet_last_name: string;
  cadet_company: string;
  checked_out_at: string;
  checked_in_at: string | null;
}

export interface EquipmentRow {
  id: number;
  type: string;
  tag: string;
  manual_condition: "green" | "yellow" | "red";
  owner_cadet_id: number | null;
  has_sheath: 0 | 1 | null;
  has_pompom: 0 | 1 | null;
  size: string | null;
  is_ps_rifle: 0 | 1;
  is_black_sl_bayonet: 0 | 1;
}

import type {
  BannerAuditEntry,
  BannerCategory,
  BannerEvent,
  BannerEventInput,
  BannerWeek,
  BannerWeekInput,
  Cadet,
  CadetProfile,
  EquipmentItem,
  EquipmentType,
  HistoryEntry,
} from "../types";

class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string })?.error ?? res.statusText, data);
  }

  return data as T;
}

export { ApiError };

export interface LoginError {
  error: string;
  locked?: boolean;
  remainingAttempts?: number;
}

export const auth = {
  login: (password: string) => request<{ ok: true }>("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>("/api/logout", { method: "POST" }),
  me: () => request<{ authenticated: boolean }>("/api/me"),
  verifyCode: (code: string) => request<{ ok: true }>("/api/login/verify", { method: "POST", body: JSON.stringify({ code }) }),
  resendCode: () => request<{ ok: true }>("/api/login/resend-code", { method: "POST" }),
};

export const cadetsApi = {
  list: (company?: string) => request<Cadet[]>(`/api/cadets${company ? `?company=${company}` : ""}`),
  get: (id: number) => request<CadetProfile>(`/api/cadets/${id}`),
  create: (data: Partial<Cadet>) => request<Cadet>("/api/cadets", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Cadet>) =>
    request<Cadet>(`/api/cadets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/api/cadets/${id}`, { method: "DELETE" }),
  history: (id: number) => request<HistoryEntry[]>(`/api/cadets/${id}/history`),
};

export const equipmentApi = {
  list: (type?: EquipmentType) => request<EquipmentItem[]>(`/api/equipment${type ? `?type=${type}` : ""}`),
  needsRepair: () => request<EquipmentItem[]>("/api/equipment/needs-repair"),
  get: (id: number) => request<EquipmentItem>(`/api/equipment/${id}`),
  create: (data: Partial<EquipmentItem>) =>
    request<EquipmentItem>("/api/equipment", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<EquipmentItem>) =>
    request<EquipmentItem>(`/api/equipment/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  assign: (id: number, cadetId: number | null) =>
    request<EquipmentItem>(`/api/equipment/${id}/assign`, { method: "POST", body: JSON.stringify({ cadet_id: cadetId }) }),
  remove: (id: number) => request<void>(`/api/equipment/${id}`, { method: "DELETE" }),
  history: (id: number) => request<HistoryEntry[]>(`/api/equipment/${id}/history`),
};

// Discriminated result shape returned by every Rifle Pickup action route.
export interface PickupCadetSummary {
  id: number;
  first_name: string;
  last_name: string;
  company: "A" | "B" | "C";
  position: string;
}

export type PickupResult =
  | { status: "unmatched"; scanned_id: string }
  | { status: "not_found" }
  | { status: "ineligible"; cadet: PickupCadetSummary; reason: string }
  | { status: "none_available"; cadet: PickupCadetSummary }
  | { status: "checked_in" | "checked_out"; cadet: PickupCadetSummary; item: { id: number; tag: string } };

export const riflePickupApi = {
  scan: (scannedId: string) =>
    request<PickupResult>("/api/rifle-pickup/scan", { method: "POST", body: JSON.stringify({ scanned_id: scannedId }) }),
  manual: (cadetId: number) =>
    request<PickupResult>("/api/rifle-pickup/manual", { method: "POST", body: JSON.stringify({ cadet_id: cadetId }) }),
  link: (cadetId: number, scannedId: string) =>
    request<PickupResult>("/api/rifle-pickup/link", {
      method: "POST",
      body: JSON.stringify({ cadet_id: cadetId, scanned_id: scannedId }),
    }),
  activity: (limit = 50) => request<HistoryEntry[]>(`/api/rifle-pickup/activity?limit=${limit}`),
};

// Every banner write carries the name of whoever is entering it; the worker
// records it in the week's change history.
export const bannerApi = {
  weeks: () => request<{ categories: BannerCategory[]; weeks: BannerWeek[] }>("/api/banner/weeks"),
  week: (id: number) =>
    request<{ categories: BannerCategory[]; week: BannerWeek; events: BannerEvent[]; audit: BannerAuditEntry[] }>(
      `/api/banner/weeks/${id}`,
    ),
  createWeek: (data: BannerWeekInput, actor: string) =>
    request<BannerWeek>("/api/banner/weeks", { method: "POST", body: JSON.stringify({ ...data, actor }) }),
  updateWeek: (id: number, data: BannerWeekInput, actor: string) =>
    request<BannerWeek>(`/api/banner/weeks/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, actor }) }),
  addEvent: (weekId: number, data: BannerEventInput, actor: string) =>
    request<BannerEvent>(`/api/banner/weeks/${weekId}/events`, { method: "POST", body: JSON.stringify({ ...data, actor }) }),
  updateEvent: (id: number, data: BannerEventInput, actor: string) =>
    request<BannerEvent>(`/api/banner/events/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, actor }) }),
  deleteEvent: (id: number, actor: string) =>
    request<void>(`/api/banner/events/${id}`, { method: "DELETE", body: JSON.stringify({ actor }) }),
  finalize: (id: number, actor: string) =>
    request<BannerWeek>(`/api/banner/weeks/${id}/finalize`, { method: "POST", body: JSON.stringify({ actor }) }),
  reopen: (id: number, actor: string, reason: string) =>
    request<BannerWeek>(`/api/banner/weeks/${id}/reopen`, { method: "POST", body: JSON.stringify({ actor, reason }) }),
};

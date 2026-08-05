import type { Cadet, CadetProfile, EquipmentItem, EquipmentType } from "../types";

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
};

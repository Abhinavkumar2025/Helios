import { Incident, IncidentSeverity, IncidentStatus } from "../types";
import { apiRequest, getApiBaseUrl } from "./api";

export interface IncidentFilters {
  event_type?: string;
  severity?: IncidentSeverity | string;
  status?: IncidentStatus | string;
  bus_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchIncidents(filters: IncidentFilters = {}): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (filters.event_type && filters.event_type !== "all") params.append("event_type", filters.event_type);
  if (filters.severity && filters.severity !== "all") params.append("severity", filters.severity);
  if (filters.status && filters.status !== "all") params.append("status", filters.status);
  if (filters.bus_id) params.append("bus_id", filters.bus_id);
  if (filters.search) params.append("search", filters.search);
  if (filters.limit) params.append("limit", filters.limit.toString());
  if (filters.offset) params.append("offset", filters.offset.toString());

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<Incident[]>(`/incidents${query}`);
}

export async function fetchIncidentById(incidentId: string): Promise<Incident> {
  return apiRequest<Incident>(`/incidents/${incidentId}`);
}

export async function updateIncident(
  incidentId: string,
  data: { status?: IncidentStatus | string; severity?: IncidentSeverity | string; notes?: string }
): Promise<Incident> {
  return apiRequest<Incident>(`/incidents/${incidentId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteIncident(incidentId: string): Promise<{ status: string; message: string; id: string }> {
  return apiRequest<{ status: string; message: string; id: string }>(`/incidents/${incidentId}`, {
    method: "DELETE",
  });
}


export interface DetectBox {
  class_id: number;
  class_name: string;
  is_crash: boolean;
  confidence: number;
  bbox: number[];
}

export interface DetectUploadResponse {
  success: boolean;
  detected: boolean;
  confidence: number;
  raw_confidence: number;
  severity: string;
  latency_ms: number;
  boxes: DetectBox[];
  image_url: string;
  bus_id: string;
  incident?: Incident;
  message: string;
}

export async function uploadAndDetectImage(
  file: File,
  busId?: string,
  confidenceBoost: number = 0.15,
  forceAlert: boolean = false
): Promise<DetectUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (busId) formData.append("bus_id", busId);
  formData.append("confidence_boost", confidenceBoost.toString());
  formData.append("force_alert", forceAlert.toString());

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/detect/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Upload detection failed");
  }

  return response.json();
}


// ─── Pothole AI Upload ───────────────────────────────────

export async function uploadAndDetectPothole(
  file: File,
  busId?: string
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  if (busId) formData.append("bus_id", busId);

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/detect/pothole/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Pothole detection failed");
  }

  return response.json();
}


// ─── Waterlogging AI Upload ──────────────────────────────

export async function uploadAndDetectWaterlogging(
  file: File,
  busId?: string
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  if (busId) formData.append("bus_id", busId);

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/detect/waterlogging/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Waterlogging detection failed");
  }

  return response.json();
}


// ─── Traffic / Vehicle AI Upload ─────────────────────────

export async function uploadAndDetectTraffic(
  file: File,
  busId?: string
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  if (busId) formData.append("bus_id", busId);

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/detect/traffic/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || "Traffic detection failed");
  }

  return response.json();
}

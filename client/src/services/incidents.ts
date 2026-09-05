import { Incident, IncidentSeverity, IncidentStatus } from "../types";
import { apiRequest } from "./api";

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

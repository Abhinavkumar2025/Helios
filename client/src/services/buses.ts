import { Bus } from "../types";
import { apiRequest } from "./api";

export async function fetchBuses(status?: string, search?: string): Promise<Bus[]> {
  const params = new URLSearchParams();
  if (status && status !== "all") params.append("status", status);
  if (search) params.append("search", search);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<Bus[]>(`/buses${query}`);
}

export async function fetchBusById(busId: string): Promise<Bus> {
  return apiRequest<Bus>(`/buses/${busId}`);
}

export async function updateBusStatus(busId: string, updates: Partial<Bus>): Promise<Bus> {
  return apiRequest<Bus>(`/buses/${busId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

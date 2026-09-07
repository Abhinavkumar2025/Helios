import { SOSEvent, SOSStatus } from "../types";
import { apiRequest } from "./api";

export async function fetchSOSHistory(): Promise<SOSEvent[]> {
  return apiRequest<SOSEvent[]>("/sos/history");
}

export async function updateSOSEvent(
  sosId: string,
  data: { status?: SOSStatus | string; dispatched_ambulance?: boolean; notified_police?: boolean }
): Promise<SOSEvent> {
  return apiRequest<SOSEvent>(`/sos/${sosId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSOSEvent(sosId: string): Promise<{ status: string; message: string; id: string }> {
  return apiRequest<{ status: string; message: string; id: string }>(`/sos/${sosId}`, {
    method: "DELETE",
  });
}


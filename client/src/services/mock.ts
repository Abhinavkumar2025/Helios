import { apiRequest } from "./api";

export async function simulateAccident(busId: string = "BUS-1042"): Promise<any> {
  return apiRequest(`/mock/accident?bus_id=${busId}`, { method: "POST" });
}

export async function simulatePothole(): Promise<any> {
  return apiRequest("/mock/pothole", { method: "POST" });
}

export async function simulateWaterlogging(): Promise<any> {
  return apiRequest("/mock/waterlogging", { method: "POST" });
}

export async function simulateBusOffline(): Promise<any> {
  return apiRequest("/mock/bus-offline", { method: "POST" });
}

export async function toggleSimulator(): Promise<{ status: string; running: boolean; message: string }> {
  return apiRequest("/mock/toggle-simulator", { method: "POST" });
}

export async function getSimulatorStatus(): Promise<{ mock_mode: boolean; simulator_running: boolean }> {
  return apiRequest("/mock/status");
}

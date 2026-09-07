import { AnalyticsSummary, TrafficAnalytics } from "../types";
import { apiRequest } from "./api";

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiRequest<AnalyticsSummary>("/analytics/summary");
}

export async function fetchTrafficAnalytics(): Promise<TrafficAnalytics> {
  return apiRequest<TrafficAnalytics>("/analytics/traffic");
}

const DEFAULT_API_BASE = "http://localhost:8000/api/v1";

export function getApiBaseUrl(): string {
  return localStorage.getItem("helios_api_url") || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
}

export function getWsUrl(): string {
  const customWs = localStorage.getItem("helios_ws_url");
  if (customWs) return customWs;
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const apiBase = getApiBaseUrl();
  return apiBase.replace(/^http/, "ws") + "/ws/events";
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

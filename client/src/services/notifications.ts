import { Notification } from "../types";
import { apiRequest } from "./api";

export async function fetchNotifications(category?: string, unreadOnly?: boolean): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (category && category !== "all") params.append("category", category);
  if (unreadOnly) params.append("unread_only", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<Notification[]>(`/notifications${query}`);
}

export async function markNotificationRead(notifId: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${notifId}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/notifications/read-all", {
    method: "POST",
  });
}

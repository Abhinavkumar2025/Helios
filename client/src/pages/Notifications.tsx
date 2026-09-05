import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications";
import { Notification } from "../types";

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useHeliosWebSocket();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchNotifications(categoryFilter, false);
      setNotifications(data);
    } catch (err) {
      console.error("Error loading notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubNotif = subscribe("notification_created", (newN: Notification) => {
      setNotifications((prev) => [newN, ...prev]);
    });

    return () => {
      unsubNotif();
    };
  }, [categoryFilter, subscribe]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all read", err);
    }
  };

  const handleItemClick = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "critical":
        return <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-solar-400" />
            System Notifications & Alerts ({notifications.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry event alerts, device connectivity notices, and priority warnings
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-1.5 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Mark All Read
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 font-mono text-xs">
        {["all", "critical", "warning", "info"].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3.5 py-1.5 rounded-xl capitalize font-semibold transition-all cursor-pointer ${
              categoryFilter === cat
                ? "bg-solar-500 text-helios-950 shadow-glow-solar"
                : "bg-helios-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {cat} Alerts
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading && notifications.length === 0 ? (
          <LoadingSkeleton count={4} className="h-20 rounded-xl" />
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-800 bg-helios-900 font-mono text-slate-400">
            No notifications in this category.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`p-4 rounded-xl border backdrop-blur-md transition-all duration-150 cursor-pointer flex items-start justify-between gap-4 group ${
                !n.read
                  ? "border-slate-700 bg-helios-850/90 shadow-md"
                  : "border-slate-800/80 bg-helios-900/60 opacity-75 hover:opacity-100"
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {getCategoryIcon(n.category)}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 font-mono">
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-solar-400 transition-colors">
                      {n.title}
                    </h4>
                    <Badge
                      variant={
                        n.category === "critical"
                          ? "danger"
                          : n.category === "warning"
                          ? "warning"
                          : "info"
                      }
                      size="sm"
                    >
                      {n.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 font-sans">{n.message}</p>
                </div>
              </div>

              <div className="text-right shrink-0 font-mono text-xs text-slate-500 space-y-1">
                <div>{new Date(n.created_at).toLocaleTimeString()}</div>
                {n.link && (
                  <span className="text-solar-400 text-[11px] group-hover:underline flex items-center justify-end gap-1">
                    Open <ExternalLink className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

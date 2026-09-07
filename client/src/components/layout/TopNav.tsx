import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Wifi,
  WifiOff,
  User,
  LogOut,
  ChevronDown,
  Shield,
  Clock,
} from "lucide-react";
import { useHeliosWebSocket } from "../../context/WebSocketContext";
import { useAuth } from "../../context/AuthContext";
import { fetchNotifications, markNotificationRead } from "../../services/notifications";
import { Notification } from "../../types";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Command Overview", subtitle: "Real-time City Transit & Hazard Monitoring" },
  "/overview": { title: "Command Overview", subtitle: "Real-time City Transit & Hazard Monitoring" },
  "/map": { title: "Live City GIS Map", subtitle: "Interactive Geospatial Telemetry & Road Incidents" },
  "/buses": { title: "Electric Bus Fleet", subtitle: "Jetson Nano Edge AI Telemetry & Route Operations" },
  "/incidents": { title: "Incident Center", subtitle: "Unified Road Condition Hazard Log & Verification" },
  "/accidents": { title: "Emergency SOS Command", subtitle: "High-Priority Collision Triage & First-Responder Dispatch" },
  "/cameras": { title: "Multi-Camera Surveillance Wall", subtitle: "Live Dashcam Feeds with AI Bounding Box Overlays" },
  "/potholes": { title: "Pothole & Surface Health", subtitle: "Road Pavement Degradation & Repair Prioritization" },
  "/waterlogging": { title: "Waterlogging & Flood Alerts", subtitle: "Monsoon Hazard Inundation Depth Monitoring" },
  "/road-signs": { title: "Road Assets & Lane Violations", subtitle: "Zebra Crossings, Speed Signs & Lane Dividers" },
  "/traffic": { title: "Vehicle Traffic Analytics", subtitle: "AI Flow Counting & Corridor Congestion Density" },
  "/ai-models": { title: "Edge AI Model Health", subtitle: "Jetson Nano Inference Latency & Model Versions" },
  "/analytics": { title: "City Intelligence Analytics", subtitle: "Historical Trends, Hotspots & Fleet Performance" },
  "/notifications": { title: "System Notifications", subtitle: "Alert Logs, Incident Triggers & Diagnostics" },
  "/settings": { title: "Platform Settings", subtitle: "API Endpoints, Simulation Engine & Dispatch Config" },
};

export const TopNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected, subscribe } = useHeliosWebSocket();
  const { user, logout } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notifications & subscribe to live notifications
  useEffect(() => {
    const loadNotifs = async () => {
      try {
        const list = await fetchNotifications("all", false);
        setNotifications(list.slice(0, 6));
      } catch {
        // ignore
      }
    };
    loadNotifs();

    const unsub = subscribe("notification_created", (newNotif: Notification) => {
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)].slice(0, 6));
    });

    return () => {
      unsub();
    };
  }, [subscribe]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const currentInfo = PAGE_TITLES[location.pathname] || {
    title: "Command Center",
    subtitle: "Helios Smart City Intelligence Platform",
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    if (searchTerm.toUpperCase().startsWith("BUS-")) {
      navigate(`/buses/${searchTerm.toUpperCase()}`);
    } else {
      navigate(`/incidents?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <header className="h-16 px-6 border-b border-slate-800/80 bg-helios-950/80 backdrop-blur-xl flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Title & Subtitle */}
      <div className="flex flex-col">
        <h1 className="text-base font-bold font-mono tracking-tight text-white flex items-center gap-2">
          {currentInfo.title}
        </h1>
        <p className="text-xs text-slate-400 font-sans hidden sm:block">
          {currentInfo.subtitle}
        </p>
      </div>

      {/* Center Search */}
      <form onSubmit={handleSearchSubmit} className="relative hidden md:block max-w-xs w-full">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search bus (BUS-101) or incident"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-9 pr-3 py-1.5 rounded-xl bg-helios-700 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-solar-500/50 font-mono"
        />
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Live Digital Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-helios-900/60 border border-slate-800 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-solar-400" />
          <span>{currentTime} IST</span>
        </div>

        {/* Backend & WS Connection Status */}
        {/* <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}
        >
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">LIVE SYNC</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>OFFLINE</span>
            </>
          )}
        </div> */}

        {/* Notification Bell with Dropdown */}
        {/* <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-helios-900 border border-slate-700 shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  Live Notifications ({unreadCount})
                </span>
                <button
                  onClick={() => navigate("/notifications")}
                  className="text-[11px] text-solar-400 hover:underline font-mono"
                >
                  View All
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.link) navigate(n.link);
                        setShowNotifications(false);
                      }}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-800/50 transition-colors ${
                        !n.read ? "bg-helios-850/70" : ""
                      }`}
                    >
                      <div className="font-semibold text-slate-200">{n.title}</div>
                      <div className="text-slate-400 mt-0.5 line-clamp-2">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div> */}

        {/* Admin Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-helios-900/60 hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-solar-500 to-solar-600 flex items-center justify-center font-bold text-helios-950 text-xs">
              M
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {user?.name || "Commander"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {user?.badgeNumber || "HYD-01"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl bg-helios-900 border border-slate-700 shadow-2xl p-1.5 z-50">
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <div className="text-xs font-bold text-slate-200">{user?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/settings");
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4 text-solar-400" />
                Command Settings
              </button>

              <button
                onClick={() => {
                  logout();
                  setShowProfileMenu(false);
                  navigate("/login");
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 mt-1"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

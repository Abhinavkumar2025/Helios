import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MapPin,
  Bus,
  AlertTriangle,
  Siren,
  Camera,
  Activity,
  Droplets,
  Milestone,
  BarChart3,
  Cpu,
  LineChart,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  SunMedium,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const mainNavItems: NavItem[] = [
  { label: "Overview", path: "/overview", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Live City Map", path: "/map", icon: <MapPin className="w-5 h-5" /> },
  { label: "Bus Fleet", path: "/buses", icon: <Bus className="w-5 h-5" /> },
  { label: "Incident Center", path: "/incidents", icon: <AlertTriangle className="w-5 h-5" /> },
  { label: "Accidents / SOS", path: "/accidents", icon: <Siren className="w-5 h-5" />, badge: "SOS", badgeColor: "bg-red-500 text-white" },
  { label: "Camera Center", path: "/cameras", icon: <Camera className="w-5 h-5" /> },
  { label: "Pothole Monitor", path: "/potholes", icon: <Activity className="w-5 h-5" /> },
  { label: "Waterlogging", path: "/waterlogging", icon: <Droplets className="w-5 h-5" /> },
  { label: "Road & Signs", path: "/road-signs", icon: <Milestone className="w-5 h-5" /> },
  { label: "Traffic Flow", path: "/traffic", icon: <BarChart3 className="w-5 h-5" /> },
  { label: "AI Models", path: "/ai-models", icon: <Cpu className="w-5 h-5" /> },
  { label: "City Analytics", path: "/analytics", icon: <LineChart className="w-5 h-5" /> },
];

const secondaryNavItems: NavItem[] = [
  { label: "Notifications", path: "/notifications", icon: <Bell className="w-5 h-5" /> },
  { label: "Settings", path: "/settings", icon: <Settings className="w-5 h-5" /> },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const location = useLocation();
  const summary = { active_buses: 24, total_buses: 32 };

  return (
    <aside
      className={clsx(
        "sticky top-0 h-screen flex flex-col justify-between border-r border-slate-800/80 bg-helios-950/95 backdrop-blur-xl z-30 transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-800/70">
          <div className="flex items-center gap-3 overflow-hidden">
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold tracking-wider text-lg font-mono text-white leading-tight">
                  HELIO<span className="text-solar-400">S</span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                  Smart City Ops
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Live System Badge */}
        {!collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-mono font-medium text-emerald-400 uppercase tracking-wider">
                Command Panel
              </span>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-230px)]">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/overview" && location.pathname === "/");
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group relative",
                  isActive
                    ? "bg-solar-500/15 text-solar-400 border border-solar-500/30 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-850/80"
                )}
                title={collapsed ? item.label : undefined}
              >
                <div className={clsx("shrink-0", isActive ? "text-solar-400" : "text-slate-400 group-hover:text-slate-200")}>
                  {item.icon}
                </div>
                {!collapsed && (
                  <span className="truncate flex-1 font-sans">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase tracking-wider",
                      item.badgeColor || "bg-solar-500 text-helios-950"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Secondary Links */}
      <div className="p-3 border-t border-slate-800/80 space-y-1">
        {secondaryNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-solar-500/15 text-solar-400 border border-solar-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-850/80"
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className="shrink-0">{item.icon}</div>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}

        {/* Officer Status Footer */}
        {!collapsed && (
          <div className="mt-2 pt-2 border-t border-slate-800/50 px-2 flex items-center gap-2.5 text-xs text-slate-500 font-mono">
            <ShieldCheck className="w-4 h-4 text-solar-400 shrink-0" />
            <span className="truncate">HYD-CENTRAL-COMMAND</span>
          </div>
        )}
      </div>
    </aside>
  );
};

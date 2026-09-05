import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bus,
  Search,
  Filter,
  Camera,
  Cpu,
  MapPin,
  BatteryCharging,
  ArrowRight,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { fetchBuses } from "../services/buses";
import { Bus as BusType } from "../types";

export const BusFleet: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useHeliosWebSocket();

  const [buses, setBuses] = useState<BusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadBuses = async () => {
    try {
      setLoading(true);
      const data = await fetchBuses(statusFilter, search);
      setBuses(data);
    } catch (err) {
      console.error("Error loading bus fleet", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuses();

    const unsubBus = subscribe("bus_updated", (updatedBus: any) => {
      setBuses((prev) =>
        prev.map((b) => (b.id === updatedBus.id ? { ...b, ...updatedBus } : b))
      );
    });

    const unsubGPS = subscribe("gps_updated", (positions: any[]) => {
      setBuses((prev) =>
        prev.map((b) => {
          const p = positions.find((item) => item.id === b.id);
          return p ? { ...b, lat: p.lat, lng: p.lng, speed: p.speed } : b;
        })
      );
    });

    return () => {
      unsubBus();
      unsubGPS();
    };
  }, [statusFilter, subscribe]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadBuses();
  };

  const onlineCount = buses.filter((b) => b.status === "online").length;
  const offlineCount = buses.filter((b) => b.status === "offline").length;
  const warningCount = buses.filter((b) => b.status === "warning").length;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <Bus className="w-5 h-5 text-solar-400" />
            Electric City Bus Fleet ({buses.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Mobile monitoring units equipped with NVIDIA Jetson Nano edge AI and dashcam video analytics
          </p>
        </div>

        {/* Status Tab Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-solar-500 text-helios-950 font-bold shadow-glow-solar"
                : "bg-helios-850 text-slate-300 hover:text-white border border-slate-800"
            }`}
          >
            All Buses ({buses.length})
          </button>
          <button
            onClick={() => setStatusFilter("online")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
              statusFilter === "online"
                ? "bg-emerald-500 text-helios-950 font-bold"
                : "bg-helios-850 text-emerald-400 hover:text-white border border-slate-800"
            }`}
          >
            Online ({onlineCount})
          </button>
          <button
            onClick={() => setStatusFilter("warning")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
              statusFilter === "warning"
                ? "bg-red-500 text-white font-bold shadow-glow-emergency"
                : "bg-helios-850 text-red-400 hover:text-white border border-slate-800"
            }`}
          >
            Warning / Alert ({warningCount})
          </button>
          <button
            onClick={() => setStatusFilter("offline")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
              statusFilter === "offline"
                ? "bg-slate-700 text-white font-bold"
                : "bg-helios-850 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            Offline ({offlineCount})
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by Bus ID (e.g. BUS-101) or Route description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-helios-900 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-solar-500/50 font-mono"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-200 text-xs font-mono font-semibold border border-slate-700 cursor-pointer"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            loadBuses();
          }}
          className="px-3 py-2.5 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
          title="Reset"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </form>

      {/* Bus Grid */}
      {loading && buses.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <LoadingSkeleton count={6} className="h-56" />
        </div>
      ) : buses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-helios-900/60 font-mono text-slate-400">
          No buses match the current filter or search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {buses.map((bus) => (
            <div
              key={bus.id}
              onClick={() => navigate(`/buses/${bus.id}`)}
              className="p-5 rounded-2xl border border-slate-800/80 bg-helios-900/80 hover:border-slate-700 hover:bg-helios-850/80 backdrop-blur-md transition-all duration-200 cursor-pointer group shadow-card-subtle flex flex-col justify-between"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-mono font-bold text-slate-200 text-xs group-hover:bg-solar-500 group-hover:text-helios-950 transition-colors">
                      <Bus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-sm text-white group-hover:text-solar-400 transition-colors">
                        {bus.id}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Driver: {bus.driver_name}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={
                      bus.status === "online"
                        ? "success"
                        : bus.status === "warning"
                        ? "danger"
                        : "neutral"
                    }
                    dot
                  >
                    {bus.status}
                  </Badge>
                </div>

                {/* Route Information */}
                <div className="py-3">
                  <div className="text-xs font-semibold text-slate-200 line-clamp-2">
                    {bus.route}
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-2 gap-2.5 py-3 border-y border-slate-800/80 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-solar-400 shrink-0" />
                    <span className="truncate">{bus.lat.toFixed(4)}, {bus.lng.toFixed(4)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Jetson: <b className="text-slate-100">{bus.jetson_temp}°C</b></span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Battery: <b className="text-emerald-400">{bus.battery}%</b></span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300">
                    <Camera className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Speed: <b className="text-white">{bus.speed} km/h</b></span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 mt-2 flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {new Date(bus.last_seen).toLocaleTimeString()}
                </span>

                <span className="text-solar-400 flex items-center gap-1 font-semibold group-hover:translate-x-1 transition-transform">
                  View Telemetry <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

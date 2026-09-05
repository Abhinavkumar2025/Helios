import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bus,
  Siren,
  Activity,
  Droplets,
  BarChart3,
  AlertTriangle,
  Cpu,
  ArrowUpRight,
  RefreshCw,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { StatCard } from "../components/ui/StatCard";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { fetchAnalyticsSummary } from "../services/analytics";
import { fetchIncidents } from "../services/incidents";
import { fetchAIModels } from "../services/models";
import { fetchBuses } from "../services/buses";
import { AIModelStatus, AnalyticsSummary, Bus as BusType, Incident } from "../types";

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useHeliosWebSocket();

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [aiModels, setAiModels] = useState<AIModelStatus[]>([]);
  const [buses, setBuses] = useState<BusType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, incRes, modelsRes, busRes] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchIncidents({ limit: 8 }),
        fetchAIModels(),
        fetchBuses(),
      ]);
      setAnalytics(summaryRes);
      setRecentIncidents(incRes);
      setAiModels(modelsRes);
      setBuses(busRes);
    } catch (err) {
      console.error("Failed to load overview data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to live incident creations
    const unsubIncident = subscribe("incident_created", (newInc: Incident) => {
      setRecentIncidents((prev) => [newInc, ...prev.slice(0, 7)]);
      // Update local stat counts reactively
      setAnalytics((prev) => {
        if (!prev) return prev;
        const s = { ...prev.summary };
        if (newInc.event_type === "accident") s.accidents_today += 1;
        if (newInc.event_type === "pothole") s.potholes_detected += 1;
        if (newInc.event_type === "waterlogging") s.waterlogging_alerts += 1;
        if (newInc.event_type === "traffic") s.traffic_events += 1;
        return { ...prev, summary: s };
      });
    });

    const unsubBus = subscribe("bus_updated", (updatedBus: any) => {
      setBuses((prev) =>
        prev.map((b) => (b.id === updatedBus.id ? { ...b, ...updatedBus } : b))
      );
    });

    return () => {
      unsubIncident();
      unsubBus();
    };
  }, [subscribe]);

  const summary = analytics?.summary || {
    active_buses: 18,
    total_buses: 20,
    accidents_today: 12,
    potholes_detected: 153,
    waterlogging_alerts: 27,
    traffic_events: 68,
    sos_alerts: 4,
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "critical":
        return <Badge variant="danger" dot>{sev}</Badge>;
      case "high":
        return <Badge variant="warning">{sev}</Badge>;
      case "medium":
        return <Badge variant="solar">{sev}</Badge>;
      default:
        return <Badge variant="neutral">{sev}</Badge>;
    }
  };

  const getEventTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "accident":
        return <Badge variant="danger">ACCIDENT</Badge>;
      case "pothole":
        return <Badge variant="solar">POTHOLE</Badge>;
      case "waterlogging":
        return <Badge variant="info">WATERLOGGING</Badge>;
      case "traffic":
        return <Badge variant="purple">TRAFFIC</Badge>;
      default:
        return <Badge variant="neutral">{type.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            Central Command Operations
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry stream from electric bus edge nodes across Hyderabad
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-helios-900 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-mono transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Stream
        </button>
      </div>

      {/* Top 6 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Active Buses"
          value={`${summary.active_buses} / ${summary.total_buses}`}
          icon={<Bus className="w-5 h-5" />}
          trend="90% fleet uptime"
          trendUp={true}
          color="emerald"
          activePulse={true}
        />
        <StatCard
          label="Accidents Today"
          value={summary.accidents_today}
          icon={<Siren className="w-5 h-5" />}
          trend="+2 in last hour"
          trendUp={false}
          color="red"
          activePulse={summary.accidents_today > 0}
        />
        <StatCard
          label="Potholes Detected"
          value={summary.potholes_detected}
          icon={<Activity className="w-5 h-5" />}
          trend="+14% this week"
          trendUp={true}
          color="amber"
        />
        <StatCard
          label="Waterlogging Alerts"
          value={summary.waterlogging_alerts}
          icon={<Droplets className="w-5 h-5" />}
          trend="Monsoon monitoring"
          trendUp={true}
          color="cyan"
        />
        <StatCard
          label="Traffic Events"
          value={summary.traffic_events}
          icon={<BarChart3 className="w-5 h-5" />}
          trend="Corridor flow active"
          trendUp={true}
          color="purple"
        />
        <StatCard
          label="SOS Alerts"
          value={summary.sos_alerts}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend="Emergency priority"
          trendUp={false}
          color="red"
          activePulse={true}
        />
      </div>

      {/* Live City Map Preview & Fleet Quick Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Telemetry Callout */}
        <div className="lg:col-span-2">
          <Card
            title="Live City Activity & Geospatial GIS"
            subtitle="Mobile bus cameras mapping road surface hazards in real time"
            action={
              <button
                onClick={() => navigate("/map")}
                className="text-xs font-mono text-solar-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Expand Full GIS Map <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-helios-950 h-72 flex flex-col items-center justify-center p-6 text-center">
              {/* Radar Grid Animation Effect */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
              <div className="relative z-10 space-y-3 max-w-md">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-solar-500/10 border border-solar-500/30 text-solar-400 animate-pulse">
                  <Bus className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold font-mono text-white">
                  18 Active Electric Buses Monitoring Hyderabad Corridors
                </h4>
                <p className="text-xs text-slate-400">
                  Real-time GPS updates, road cracks, waterlogging spots, and traffic bottlenecks mapped across Hitec City, Gachibowli, Jubilee Hills, and Airport Express.
                </p>
                <button
                  onClick={() => navigate("/map")}
                  className="px-4 py-2 rounded-lg bg-solar-500 hover:bg-solar-600 text-helios-950 font-mono font-bold text-xs uppercase tracking-wider shadow-glow-solar transition-all cursor-pointer"
                >
                  Open Interactive GIS Map
                </button>
              </div>

              {/* Floating Live Telemetry Counter */}
              <div className="absolute bottom-3 left-3 bg-helios-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-[11px] font-mono text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live GPS Simulator: Active</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Live Bus Fleet Status Card */}
        <div className="lg:col-span-1">
          <Card
            title="Fleet Telemetry Status"
            subtitle={`${buses.filter((b) => b.status === "online").length} Online / ${buses.length} Registered`}
            action={
              <button
                onClick={() => navigate("/buses")}
                className="text-xs font-mono text-solar-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                All Buses <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {loading && buses.length === 0 ? (
                <LoadingSkeleton count={5} className="h-10 mb-2" />
              ) : (
                buses.slice(0, 6).map((bus) => (
                  <div
                    key={bus.id}
                    onClick={() => navigate(`/buses/${bus.id}`)}
                    className="p-2.5 rounded-lg border border-slate-800/80 bg-helios-850/60 hover:bg-helios-800/80 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          bus.status === "online"
                            ? "bg-emerald-400"
                            : bus.status === "warning"
                            ? "bg-red-400 animate-ping"
                            : "bg-slate-500"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold font-mono text-slate-200 truncate">
                          {bus.id}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {bus.route}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono text-xs">
                      <div className="text-slate-200">{bus.speed} km/h</div>
                      <div className="text-[10px] text-slate-400">{bus.battery}% Bat</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <Card
        title="Recent Incident Feed"
        subtitle="Standardized event telemetry streaming directly from Jetson edge inference"
        action={
          <button
            onClick={() => navigate("/incidents")}
            className="text-xs font-mono text-solar-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            View Full Incident Center <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-3 font-semibold">Time</th>
                <th className="pb-3 font-semibold">Bus ID</th>
                <th className="pb-3 font-semibold">Event Type</th>
                <th className="pb-3 font-semibold">Location</th>
                <th className="pb-3 font-semibold">Confidence</th>
                <th className="pb-3 font-semibold">Severity</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading && recentIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4">
                    <LoadingSkeleton count={4} className="h-8 mb-2" />
                  </td>
                </tr>
              ) : recentIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                    No active incidents detected.
                  </td>
                </tr>
              ) : (
                recentIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-slate-850/40 transition-colors group"
                  >
                    <td className="py-3 text-slate-400">
                      {new Date(inc.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 font-bold text-slate-200">
                      {inc.bus_id}
                    </td>
                    <td className="py-3">{getEventTypeBadge(inc.event_type)}</td>
                    <td className="py-3 text-slate-400">
                      {inc.gps.lat.toFixed(4)}, {inc.gps.lng.toFixed(4)}
                    </td>
                    <td className="py-3 text-solar-400 font-bold">
                      {Math.round(inc.confidence * 100)}%
                    </td>
                    <td className="py-3">{getSeverityBadge(inc.severity)}</td>
                    <td className="py-3">
                      <span className="capitalize text-slate-300">
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => navigate(`/incidents?search=${inc.id}`)}
                        className="p-1 rounded text-slate-400 hover:text-solar-400 hover:bg-slate-800/60 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI System Health Section */}
      <Card
        title="Edge AI Model Health & Device Telemetry"
        subtitle="NVIDIA Jetson Nano edge inference status and model benchmarks"
        action={
          <button
            onClick={() => navigate("/ai-models")}
            className="text-xs font-mono text-solar-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            Inspect Models <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {aiModels.map((model) => (
            <div
              key={model.id}
              className="p-4 rounded-xl border border-slate-800 bg-helios-850/60 hover:border-slate-700 transition-all font-mono"
            >
              <div className="flex items-center justify-between">
                <Cpu className="w-5 h-5 text-solar-400" />
                <Badge variant={model.status === "ONLINE" ? "success" : "warning"} size="sm" dot>
                  {model.status}
                </Badge>
              </div>

              <div className="mt-3">
                <h4 className="text-xs font-bold text-slate-200 truncate">
                  {model.name}
                </h4>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {model.version}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] uppercase text-slate-500">Latency</div>
                  <div className="text-slate-200 font-bold">{model.latency_ms} ms</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-500">Confidence</div>
                  <div className="text-solar-400 font-bold">
                    {Math.round(model.avg_confidence * 100)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

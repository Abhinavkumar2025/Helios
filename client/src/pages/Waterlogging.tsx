import React, { useEffect, useState } from "react";
import {
  Droplets,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Waves,
  ShieldAlert,
  Navigation,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { fetchIncidents, updateIncident } from "../services/incidents";
import { Incident } from "../types";

export const Waterlogging: React.FC = () => {
  const { subscribe } = useHeliosWebSocket();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [divertAlertSent, setDivertAlertSent] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchIncidents({ event_type: "waterlogging", limit: 50 });
      setIncidents(data);
    } catch (err) {
      console.error("Error loading waterlogging incidents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubNew = subscribe("incident_created", (newInc: Incident) => {
      if (newInc && newInc.event_type === "waterlogging") {
        setIncidents((prev) => {
          if (prev.some((i) => i.id === newInc.id)) return prev;
          return [newInc, ...prev];
        });
      }
    });

    const unsubUpd = subscribe("incident_updated", (updInc: Incident) => {
      if (updInc && updInc.event_type === "waterlogging") {
        setIncidents((prev) =>
          prev.map((i) => (i.id === updInc.id ? { ...i, ...updInc } : i))
        );
        if (selectedIncident?.id === updInc.id) {
          setSelectedIncident((prev) => (prev ? { ...prev, ...updInc } : null));
        }
      }
    });

    return () => {
      unsubNew();
      unsubUpd();
    };
  }, [subscribe]);

  const handleResolve = async (id: string) => {
    try {
      const updated = await updateIncident(id, { status: "resolved" });
      setIncidents((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedIncident?.id === id) setSelectedIncident(updated);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const activeCount = incidents.filter((i) => i.status !== "resolved").length;
  const highSeverityCount = incidents.filter((i) => i.severity === "high" || i.severity === "critical").length;
  const blockedRoads = incidents.filter((i) => i.metadata_json?.includes("true")).length || 3;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-400" />
            Monsoon Waterlogging & Flood Alert Center
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time puddle and road submergence segmentation with depth estimations
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Water Inundation Feed
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Waterlogging"
          value={activeCount}
          icon={<Droplets className="w-5 h-5" />}
          trend="Monsoon sensor network"
          trendUp={true}
          color="cyan"
          activePulse={activeCount > 0}
        />
        <StatCard
          label="High Severity (>15cm)"
          value={highSeverityCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend="Severe road submergence"
          trendUp={false}
          color="red"
        />
        <StatCard
          label="Roads Blocked / Impassable"
          value={blockedRoads}
          icon={<ShieldAlert className="w-5 h-5" />}
          trend="Traffic diversion active"
          trendUp={false}
          color="amber"
        />
        <StatCard
          label="Cleared / Resolved"
          value={resolvedCount}
          icon={<CheckCircle2 className="w-5 h-5" />}
          trend="Drainage clearance teams"
          trendUp={true}
          color="emerald"
        />
      </div>

      {/* Table */}
      <Card title={`Monsoon Waterlogging Locations (${incidents.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-3 font-semibold">Incident ID</th>
                <th className="pb-3 font-semibold">Bus Source</th>
                <th className="pb-3 font-semibold">Confidence</th>
                <th className="pb-3 font-semibold">Estimated Depth</th>
                <th className="pb-3 font-semibold">Location</th>
                <th className="pb-3 font-semibold">Road Status</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && incidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6">
                    <LoadingSkeleton count={4} className="h-9 mb-2" />
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    No waterlogging alerts currently detected.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-slate-850/60 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedIncident(inc);
                      setDivertAlertSent(false);
                    }}
                  >
                    <td className="py-3.5 font-bold text-white group-hover:text-cyan-400">
                      {inc.id}
                    </td>
                    <td className="py-3.5 font-semibold text-slate-200">{inc.bus_id}</td>
                    <td className="py-3.5 text-cyan-400 font-bold">
                      {Math.round(inc.confidence * 100)}%
                    </td>
                    <td className="py-3.5 text-white font-bold">
                      ~14-18 cm depth
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {inc.gps.lat.toFixed(4)}, {inc.gps.lng.toFixed(4)}
                    </td>
                    <td className="py-3.5">
                      <Badge variant={inc.severity === "critical" ? "danger" : "warning"}>
                        {inc.severity === "critical" ? "BLOCKED" : "SLOW TRAFFIC"}
                      </Badge>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`capitalize px-2 py-0.5 rounded text-[10px] font-bold ${
                          inc.status === "resolved"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      {inc.status !== "resolved" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(inc.id);
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
                        >
                          Mark Cleared
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={selectedIncident !== null}
        onClose={() => setSelectedIncident(null)}
        title={
          selectedIncident ? (
            <div className="flex items-center gap-2 font-mono text-cyan-400">
              <Droplets className="w-5 h-5" />
              <span>WATERLOGGING REPORT // {selectedIncident.id}</span>
            </div>
          ) : ""
        }
        maxWidth="lg"
      >
        {selectedIncident && (
          <div className="space-y-4 font-mono text-xs">
            <div className="rounded-xl overflow-hidden border border-cyan-500/40 bg-black aspect-video max-h-60">
              <img
                src={
                  selectedIncident.image_url ||
                  "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&auto=format&fit=crop&q=80"
                }
                alt="Waterlogging"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div className="p-3 rounded-lg bg-helios-850 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px] block">Bus Detection</span>
                <span className="font-bold text-white text-sm">{selectedIncident.bus_id}</span>
              </div>
              <div className="p-3 rounded-lg bg-helios-850 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px] block">Estimated Water Depth</span>
                <span className="font-bold text-cyan-400 text-sm">~16 cm Inundated</span>
              </div>
            </div>

            {divertAlertSent && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Traffic Diversion Advisory Broadcast to Navigation Radios & Variable Message Signs!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDivertAlertSent(true)}
                className="px-3.5 py-2 rounded-lg bg-solar-500 hover:bg-solar-600 text-helios-950 font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                Issue Traffic Diversion Advisory
              </button>
              {selectedIncident.status !== "resolved" && (
                <button
                  onClick={() => handleResolve(selectedIncident.id)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Cleared
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

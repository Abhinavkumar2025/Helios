import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  RefreshCw,
  Clock,
  MapPin,
  Camera,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { fetchIncidents, updateIncident } from "../services/incidents";
import { Incident, IncidentSeverity, IncidentStatus } from "../types";

export const IncidentCenter: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscribe } = useHeliosWebSocket();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Filters state
  const [eventTypeFilter, setEventTypeFilter] = useState(searchParams.get("type") || "all");
  const [severityFilter, setSeverityFilter] = useState(searchParams.get("severity") || "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const data = await fetchIncidents({
        event_type: eventTypeFilter,
        severity: severityFilter,
        status: statusFilter,
        search: searchQuery,
        limit: 100,
      });
      setIncidents(data);
    } catch (err) {
      console.error("Error loading incidents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();

    const unsubNew = subscribe("incident_created", (newInc: Incident) => {
      setIncidents((prev) => [newInc, ...prev]);
    });

    const unsubUpd = subscribe("incident_updated", (updInc: Incident) => {
      setIncidents((prev) =>
        prev.map((i) => (i.id === updInc.id ? { ...i, ...updInc } : i))
      );
      if (selectedIncident?.id === updInc.id) {
        setSelectedIncident((prev) => (prev ? { ...prev, ...updInc } : null));
      }
    });

    const unsubDel = subscribe("incident_deleted", (data: any) => {
      if (data?.id) {
        setIncidents((prev) => prev.filter((i) => i.id !== data.id));
        setSelectedIncident((prev) => (prev?.id === data.id ? null : prev));
      }
    });

    return () => {
      unsubNew();
      unsubUpd();
      unsubDel();
    };
  }, [eventTypeFilter, severityFilter, statusFilter, subscribe]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadIncidents();
  };

  const handleUpdateStatus = async (newStatus: IncidentStatus) => {
    if (!selectedIncident) return;
    try {
      setIsUpdatingStatus(true);
      const updated = await updateIncident(selectedIncident.id, { status: newStatus });
      setSelectedIncident(updated);
      setIncidents((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getSeverityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case "critical":
        return <Badge variant="danger" dot>CRITICAL</Badge>;
      case "high":
        return <Badge variant="warning">HIGH</Badge>;
      case "medium":
        return <Badge variant="solar">MEDIUM</Badge>;
      case "low":
      default:
        return <Badge variant="neutral">LOW</Badge>;
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
      case "road_sign":
        return <Badge variant="warning">ROAD SIGN</Badge>;
      default:
        return <Badge variant="neutral">{type.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-solar-400" />
            Central Incident Management Center ({incidents.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Standardized road condition detection events captured by electric bus dashcams
          </p>
        </div>

        <button
          onClick={loadIncidents}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Incident Log
        </button>
      </div>

      {/* Multi-Filter Bar */}
      <div className="bg-helios-900/90 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, Bus (BUS-102), or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-helios-850 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 font-mono focus:outline-none focus:border-solar-500/50"
          />
        </form>

        {/* Type Filter */}
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-helios-850 border border-slate-700 text-xs text-slate-300 font-mono focus:outline-none cursor-pointer"
        >
          <option value="all">All Event Types</option>
          <option value="accident">Accident</option>
          <option value="pothole">Pothole</option>
          <option value="waterlogging">Waterlogging</option>
          <option value="traffic">Traffic</option>
          <option value="road_sign">Road Signs</option>
        </select>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-helios-850 border border-slate-700 text-xs text-slate-300 font-mono focus:outline-none cursor-pointer"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-helios-850 border border-slate-700 text-xs text-slate-300 font-mono focus:outline-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="detected">Detected</option>
          <option value="investigating">Investigating</option>
          <option value="dispatched">Dispatched</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Incident Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-3 font-semibold">Incident ID</th>
                <th className="pb-3 font-semibold">Time</th>
                <th className="pb-3 font-semibold">Bus Source</th>
                <th className="pb-3 font-semibold">Type</th>
                <th className="pb-3 font-semibold">Confidence</th>
                <th className="pb-3 font-semibold">Severity</th>
                <th className="pb-3 font-semibold">Coordinates</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && incidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6">
                    <LoadingSkeleton count={5} className="h-10 mb-2" />
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-mono">
                    No incidents match your filter parameters.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className="hover:bg-slate-850/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 font-bold text-white group-hover:text-solar-400 transition-colors">
                      {inc.id}
                    </td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(inc.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 font-semibold text-slate-200">
                      {inc.bus_id}
                    </td>
                    <td className="py-3.5">{getEventTypeBadge(inc.event_type)}</td>
                    <td className="py-3.5 text-solar-400 font-bold">
                      {Math.round(inc.confidence * 100)}%
                    </td>
                    <td className="py-3.5">{getSeverityBadge(inc.severity)}</td>
                    <td className="py-3.5 text-slate-400">
                      {inc.gps.lat.toFixed(4)}, {inc.gps.lng.toFixed(4)}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`capitalize px-2 py-0.5 rounded text-[10px] font-bold ${
                          inc.status === "resolved"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : inc.status === "dispatched"
                            ? "bg-blue-500/20 text-blue-400"
                            : inc.status === "investigating"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-solar-400 group-hover:bg-slate-800 transition-colors inline-block">
                        <Eye className="w-4 h-4" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Incident Detail Modal / Drawer */}
      <Modal
        isOpen={selectedIncident !== null}
        onClose={() => setSelectedIncident(null)}
        title={
          selectedIncident ? (
            <div className="flex items-center gap-2 font-mono">
              <ShieldAlert className="w-5 h-5 text-solar-400" />
              <span>INCIDENT DOSSIER // {selectedIncident.id}</span>
            </div>
          ) : ""
        }
        maxWidth="2xl"
      >
        {selectedIncident && (
          <div className="space-y-5">
            {/* Header badges */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {getEventTypeBadge(selectedIncident.event_type)}
                {getSeverityBadge(selectedIncident.severity)}
              </div>
              <div className="text-xs font-mono text-slate-400">
                Logged: {new Date(selectedIncident.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Evidence Image */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-64">
              <img
                src={
                  selectedIncident.image_url ||
                  "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80"
                }
                alt="Evidence"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-black/75 backdrop-blur-md text-[10px] font-mono text-slate-200">
                MODEL: {selectedIncident.model} // {selectedIncident.camera.toUpperCase()} CAM
              </div>
            </div>

            {/* Incident Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-center">
              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Bus ID</div>
                <div className="font-bold text-white mt-0.5">{selectedIncident.bus_id}</div>
              </div>
              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Confidence</div>
                <div className="font-bold text-solar-400 mt-0.5">
                  {Math.round(selectedIncident.confidence * 100)}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Status</div>
                <div className="font-bold text-slate-200 mt-0.5 capitalize">
                  {selectedIncident.status}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">GPS</div>
                <div className="font-bold text-slate-300 mt-0.5 truncate">
                  {selectedIncident.gps.lat.toFixed(3)}, {selectedIncident.gps.lng.toFixed(3)}
                </div>
              </div>
            </div>

            {/* Notes / Description */}
            {selectedIncident.notes && (
              <div className="p-3.5 rounded-xl bg-helios-850/70 border border-slate-800 text-xs text-slate-300">
                <span className="font-bold font-mono text-solar-400 block mb-1">
                  AI Edge Inference Diagnostics:
                </span>
                {selectedIncident.notes}
              </div>
            )}

            {/* Action Buttons to Change Status */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateStatus("investigating")}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold cursor-pointer"
                >
                  Mark Investigating
                </button>

                <button
                  onClick={() => handleUpdateStatus("dispatched")}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs font-mono font-semibold cursor-pointer"
                >
                  Dispatch Response Team
                </button>

                <button
                  onClick={() => handleUpdateStatus("resolved")}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Resolved
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedIncident(null);
                  navigate("/map");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-solar-400" />
                View on Map
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

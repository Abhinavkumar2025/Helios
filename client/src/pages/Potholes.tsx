import React, { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import {
  fetchIncidents,
  updateIncident,
  deleteIncident,
} from "../services/incidents";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { Incident } from "../types";

export const Potholes: React.FC = () => {
  const { subscribe } = useHeliosWebSocket();
  const [potholes, setPotholes] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPothole, setSelectedPothole] = useState<Incident | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [potholeToDelete, setPotholeToDelete] = useState<Incident | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPotholes = async () => {
    try {
      setLoading(true);
      const data = await fetchIncidents({
        event_type: "pothole",
        limit: 500,
      });
      setPotholes(data);
    } catch (err) {
      console.error("Failed to load potholes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPotholes();

    const unsubNew = subscribe("incident_created", (newInc: Incident) => {
      if (newInc && newInc.event_type === "pothole") {
        setPotholes((prev) => {
          if (prev.some((p) => p.id === newInc.id)) return prev;
          return [newInc, ...prev];
        });
      }
    });

    const unsubUpd = subscribe("incident_updated", (updInc: Incident) => {
      if (updInc && updInc.event_type === "pothole") {
        setPotholes((prev) =>
          prev.map((p) => (p.id === updInc.id ? { ...p, ...updInc } : p))
        );
        if (selectedPothole?.id === updInc.id) {
          setSelectedPothole((prev) => (prev ? { ...prev, ...updInc } : null));
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
      setIsUpdating(true);

      const updated = await updateIncident(id, {
        status: "resolved",
      });

      setPotholes((prev) =>
        prev.map((p) => (p.id === id ? updated : p))
      );

      if (selectedPothole?.id === id) {
        setSelectedPothole(updated);
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (pothole: Incident) => {
    try {
      setIsDeleting(true);

      await deleteIncident(pothole.id);

      setPotholes((prev) =>
        prev.filter((p) => p.id !== pothole.id)
      );

      setPotholeToDelete(null);
      setSelectedPothole(null);
    } catch (err: any) {
      alert(`Failed to delete pothole: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const criticalCount = potholes.filter(
    (p) => p.severity === "critical" || p.severity === "high"
  ).length;

  const moderateCount = potholes.filter(
    (p) => p.severity === "medium"
  ).length;

  const resolvedCount = potholes.filter(
    (p) => p.status === "resolved"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-solar-400" />
            Road Pavement & Pothole Surveillance
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            Automated asphalt depression detection and severity classification using YOLO11
          </p>
        </div>

        <button
          onClick={loadPotholes}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh Registry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Detected Today"
          value={potholes.length || 153}
          icon={<Activity className="w-5 h-5" />}
          trend="+18 in last 24h"
          trendUp={true}
          color="amber"
        />

        <StatCard
          label="Critical Severity"
          value={criticalCount}
          icon={<AlertCircle className="w-5 h-5" />}
          trend="Immediate repair priority"
          trendUp={false}
          color="red"
          activePulse={criticalCount > 0}
        />

        <StatCard
          label="Moderate / Surface"
          value={moderateCount}
          icon={<Layers className="w-5 h-5" />}
          trend="Scheduled maintenance"
          trendUp={true}
          color="solar"
        />

        <StatCard
          label="Resolved / Repaired"
          value={resolvedCount}
          icon={<CheckCircle2 className="w-5 h-5" />}
          trend="Work orders fulfilled"
          trendUp={true}
          color="emerald"
        />
      </div>

      {/* Pothole Table */}
      <Card title={`Pothole Detection Log (${potholes.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-3 font-semibold">Pothole ID</th>
                <th className="pb-3 font-semibold">Bus Source</th>
                <th className="pb-3 font-semibold">Confidence</th>
                <th className="pb-3 font-semibold">Severity</th>
                <th className="pb-3 font-semibold">Location</th>
                <th className="pb-3 font-semibold">Detected At</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {loading && potholes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6">
                    <LoadingSkeleton count={5} className="h-9 mb-2" />
                  </td>
                </tr>
              ) : potholes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-slate-500 font-mono"
                  >
                    No potholes recorded.
                  </td>
                </tr>
              ) : (
                potholes.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-850/60 transition-colors group cursor-pointer"
                    onClick={() => setSelectedPothole(p)}
                  >
                    <td className="py-3.5 font-bold text-white group-hover:text-solar-400">
                      {p.id}
                    </td>

                    <td className="py-3.5 font-semibold text-slate-200">
                      {p.bus_id}
                    </td>

                    <td className="py-3.5 text-solar-400 font-bold">
                      {Math.round(p.confidence * 100)}%
                    </td>

                    <td className="py-3.5">
                      <Badge
                        variant={
                          p.severity === "critical"
                            ? "danger"
                            : p.severity === "high"
                            ? "warning"
                            : "solar"
                        }
                      >
                        {p.severity}
                      </Badge>
                    </td>

                    <td className="py-3.5 text-slate-400">
                      {p.gps.lat.toFixed(4)}, {p.gps.lng.toFixed(4)}
                    </td>

                    <td className="py-3.5 text-slate-400">
                      {new Date(p.timestamp).toLocaleTimeString()}
                    </td>

                    <td className="py-3.5">
                      <span
                        className={`capitalize px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === "resolved"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3.5 text-right">
                      {p.status !== "resolved" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(p.id);
                          }}
                          disabled={isUpdating}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPotholeToDelete(p);
                          }}
                          disabled={isDeleting}
                          className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-red-950/60 text-red-400 border border-slate-700 text-[10px] font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
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

      {/* Detail Modal */}
      <Modal
        isOpen={selectedPothole !== null}
        onClose={() => setSelectedPothole(null)}
        title={
          selectedPothole ? (
            <div className="flex items-center gap-2 font-mono">
              <Activity className="w-5 h-5 text-solar-400" />
              <span>POTHOLE DIAGNOSTIC // {selectedPothole.id}</span>
            </div>
          ) : ""
        }
        maxWidth="lg"
      >
        {selectedPothole && (
          <div className="space-y-4 font-mono text-xs">
            <div className="rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video max-h-60">
              <img
                src={
                  selectedPothole.image_url ||
                  "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80"
                }
                alt="Pothole Evidence"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div className="p-3 rounded-lg bg-helios-850 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px] block">
                  Bus Source
                </span>
                <span className="font-bold text-white text-sm">
                  {selectedPothole.bus_id}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-helios-850 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px] block">
                  Confidence
                </span>
                <span className="font-bold text-solar-400 text-sm">
                  {Math.round(selectedPothole.confidence * 100)}%
                </span>
              </div>

              <div className="p-3 rounded-lg bg-helios-850 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px] block">
                  Severity
                </span>
                <span className="font-bold text-red-400 text-sm uppercase">
                  {selectedPothole.severity}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-helios-850 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px] block">
                  Status
                </span>
                <span className="font-bold text-slate-200 text-sm capitalize">
                  {selectedPothole.status}
                </span>
              </div>
            </div>

            {selectedPothole.notes && (
              <p className="p-3 rounded-lg bg-helios-850 border border-slate-800 text-slate-300">
                {selectedPothole.notes}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              {selectedPothole.status === "resolved" ? (
                <button
                  onClick={() => {
                    setPotholeToDelete(selectedPothole);
                    setSelectedPothole(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/50 font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Record
                </button>
              ) : (
                <div />
              )}

              {selectedPothole.status !== "resolved" && (
                <button
                  onClick={() => handleResolve(selectedPothole.id)}
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Resolved / Generate Work Order
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={potholeToDelete !== null}
        onClose={() => !isDeleting && setPotholeToDelete(null)}
        title={
          <div className="flex items-center gap-2 font-mono text-red-400">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>CONFIRM POTHOLE DELETION</span>
          </div>
        }
        maxWidth="md"
      >
        {potholeToDelete && (
          <div className="space-y-4 font-mono">
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 text-xs text-red-200">
              Are you sure you want to permanently delete{" "}
              <strong className="text-white">
                {potholeToDelete.id}
              </strong>
              ?
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setPotholeToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() => handleDelete(potholeToDelete)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
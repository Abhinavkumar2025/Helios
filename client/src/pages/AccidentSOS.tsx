import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Siren,
  Ambulance,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Camera,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  FileText,
  Trash2,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { fetchSOSHistory, updateSOSEvent, deleteSOSEvent } from "../services/sos";
import { updateIncident } from "../services/incidents";
import { Incident, SOSEvent, SOSStatus } from "../types";

export const AccidentSOS: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useHeliosWebSocket();

  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SOSEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<SOSEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSOS = async () => {
    try {
      setLoading(true);
      const data = await fetchSOSHistory();
      setSosEvents(data);
    } catch (err) {
      console.error("Failed to load SOS history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSOS();

    const unsubSOS = subscribe("sos_created", (newSOS: SOSEvent) => {
      setSosEvents((prev) => {
        const existingIdx = prev.findIndex(
          (e) => e.id === newSOS.id || (newSOS.incident_id && e.incident_id === newSOS.incident_id)
        );
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], ...newSOS };
          return updated;
        }
        return [newSOS, ...prev];
      });
    });

    const handleIncomingAccident = (data: any) => {
      if (!data) return;
      const inc: Incident = data.incident || data;
      if (inc && (inc.event_type === "accident" || data.event_type === "accident")) {
        const incId = inc.id || data.incident_id;
        if (!incId) return;

        setSosEvents((prev) => {
          const exists = prev.some(
            (e) => e.incident_id === incId || e.id === incId || e.incident?.id === incId
          );
          if (exists) {
            return prev.map((e) =>
              e.incident_id === incId || e.id === incId ? { ...e, incident: inc } : e
            );
          }

          const newSOS: SOSEvent = {
            id: incId.startsWith("SOS-")
              ? incId
              : `SOS-${incId.replace(/^INC-/, "")}`,
            incident_id: incId,
            bus_id: inc.bus_id || data.bus_id || "BUS-UNKNOWN",
            severity: inc.severity || data.severity || "high",
            status: "SENT",
            dispatched_ambulance: false,
            notified_police: false,
            created_at: inc.timestamp || new Date().toISOString(),
            updated_at: inc.timestamp || new Date().toISOString(),
            incident: inc,
          };
          return [newSOS, ...prev];
        });
      }
    };

    const unsubInc = subscribe("incident_created", handleIncomingAccident);
    const unsubAcc = subscribe("accident", handleIncomingAccident);
    const unsubDet = subscribe("detection", handleIncomingAccident);

    const unsubUpd = subscribe("sos_updated", (updSOS: any) => {
      setSosEvents((prev) =>
        prev.map((e) => (e.id === updSOS.id ? { ...e, ...updSOS } : e))
      );
      if (selectedEvent?.id === updSOS.id) {
        setSelectedEvent((prev) => (prev ? { ...prev, ...updSOS } : null));
      }
    });

    const unsubDel = subscribe("sos_deleted", (data: any) => {
      if (!data) return;
      const delId = data.id || data.sos_id;
      const incId = data.incident_id;
      setSosEvents((prev) => prev.filter((e) => e.id !== delId && (!incId || e.incident_id !== incId)));
      setSelectedEvent((prev) => (prev && (prev.id === delId || (incId && prev.incident_id === incId)) ? null : prev));
    });

    return () => {
      unsubSOS();
      unsubInc();
      unsubAcc();
      unsubDet();
      unsubUpd();
      unsubDel();
    };
  }, [subscribe]);

  const handleStatusChange = async (sosId: string, incidentId: string, newStatus: SOSStatus, extra: any = {}) => {
    try {
      setIsUpdating(true);
      const updated = await updateSOSEvent(sosId, { status: newStatus, ...extra });
      if (newStatus === "RESOLVED") {
        await updateIncident(incidentId, { status: "resolved" });
      } else if (newStatus === "AMBULANCE_DISPATCHED") {
        await updateIncident(incidentId, { status: "dispatched" });
      }
      setSelectedEvent(updated);
      setSosEvents((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e))
      );
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (event: SOSEvent) => {
    try {
      setIsDeleting(true);
      await deleteSOSEvent(event.id);
      setSosEvents((prev) => prev.filter((e) => e.id !== event.id && e.incident_id !== event.incident_id));
      if (selectedEvent?.id === event.id || selectedEvent?.incident_id === event.incident_id) {
        setSelectedEvent(null);
      }
      setEventToDelete(null);
    } catch (err: any) {
      alert(`Failed to delete SOS event: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeAlerts = sosEvents.filter(
    (e) => e.status !== "RESOLVED"
  );


  return (
    <div className="space-y-6">
      {/* Top Urgent Emergency Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-900/50 via-helios-900 to-red-900/40 border-2 border-red-500/60 shadow-glow-emergency flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-glow-emergency shrink-0 animate-pulse">
            <Siren className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-widest text-red-400 uppercase">
                EMERGENCY RESPONSE PROTOCOL
              </span>
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-mono font-bold uppercase">
                LIVE INTERCEPT
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white mt-0.5">
              Accident & SOS Emergency Center
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Autonomous collision detection pipeline triggered by bus front-dashcam video stream
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-helios-950/80 border border-red-500/40 px-4 py-2.5 rounded-xl text-center font-mono">
            <div className="text-[10px] uppercase text-red-400 font-bold">Active SOS Alarms</div>
            <div className="text-2xl font-black text-white">{activeAlerts.length}</div>
          </div>
        </div>
      </div>

      {/* SOS Events Grid */}
      <div className="grid grid-cols-1 gap-4">
        {loading && sosEvents.length === 0 ? (
          <LoadingSkeleton count={3} className="h-32 rounded-2xl" />
        ) : sosEvents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-800 bg-helios-900/60 font-mono text-slate-400">
            No emergency accidents registered. All city transit corridors nominal.
          </div>
        ) : (
          sosEvents.map((sos) => {
            const inc = sos.incident;
            const isPending = sos.status === "SENT" || sos.status === "PENDING";
            const isResolved = sos.status === "RESOLVED";

            return (
              <div
                key={sos.id}
                className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 shadow-card-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-5 ${
                  isPending
                    ? "border-red-500/60 bg-red-950/20 shadow-glow-emergency"
                    : isResolved
                    ? "border-slate-800 bg-helios-900/60 opacity-80"
                    : "border-amber-500/40 bg-helios-900/80"
                }`}
              >
                {/* Left Info */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Evidence Thumbnail */}
                  <div
                    onClick={() => setSelectedEvent(sos)}
                    className="relative w-20 h-20 rounded-xl overflow-hidden border border-red-500/40 bg-black shrink-0 cursor-pointer group shadow-sm"
                  >
                    <img
                      src={
                        inc?.image_url ||
                        "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=300&auto=format&fit=crop&q=80"
                      }
                      alt="Accident Evidence"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-1">
                      <span className="text-[9px] font-mono text-white font-bold">VIEW</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span className="text-base font-black text-white">{sos.id}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                        Bus: {sos.bus_id}
                      </span>
                      <Badge
                        variant={
                          (inc?.severity || sos.severity) === "critical" ||
                          (inc?.severity || sos.severity) === "high"
                            ? "danger"
                            : "warning"
                        }
                      >
                        SEVERITY: {(inc?.severity || sos.severity).toUpperCase()}
                      </Badge>
                      <Badge
                        variant={
                          isPending
                            ? "danger"
                            : isResolved
                            ? "success"
                            : "warning"
                        }
                        dot={isPending}
                      >
                        STATUS: {sos.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-solar-400" />
                        {new Date(sos.created_at).toLocaleString()}
                      </span>
                      {inc && (
                        <>
                          <span className="flex items-center gap-1 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-solar-400" />
                            GPS: {inc.gps.lat}, {inc.gps.lng}
                          </span>
                          <span className="text-solar-400 font-bold">
                            Confidence: {Math.round(inc.confidence * 100)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  <button
                    onClick={() => setSelectedEvent(sos)}
                    className="px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 text-solar-400" />
                    View Evidence
                  </button>

                  {!sos.dispatched_ambulance && (
                    <button
                      onClick={() =>
                        handleStatusChange(sos.id, sos.incident_id, "AMBULANCE_DISPATCHED", {
                          dispatched_ambulance: true,
                        })
                      }
                      disabled={isUpdating}
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-glow-emergency transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Ambulance className="w-4 h-4" />
                      Dispatch Ambulance
                    </button>
                  )}

                  {!sos.notified_police && (
                    <button
                      onClick={() =>
                        handleStatusChange(sos.id, sos.incident_id, "POLICE_NOTIFIED", {
                          notified_police: true,
                        })
                      }
                      disabled={isUpdating}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PhoneCall className="w-4 h-4" />
                      Notify Police
                    </button>
                  )}

                  {!isResolved && (
                    <button
                      onClick={() =>
                        handleStatusChange(sos.id, sos.incident_id, "RESOLVED")
                      }
                      disabled={isUpdating}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-mono font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Mark Resolved
                    </button>
                  )}

                  <button
                    onClick={() => setEventToDelete(sos)}
                    disabled={isDeleting}
                    className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-red-950/60 hover:text-red-400 hover:border-red-500/50 text-slate-400 border border-slate-700/80 font-mono font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 group"
                    title="Delete Emergency SOS"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" />
                    <span className="text-slate-300 group-hover:text-red-300 transition-colors">Delete</span>
                  </button>
                </div>
              </div>

            );
          })
        )}
      </div>

      {/* Emergency Evidence Dossier Modal */}
      <Modal
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={
          selectedEvent ? (
            <div className="flex items-center gap-2 font-mono text-red-400">
              <ShieldAlert className="w-5 h-5" />
              <span>EMERGENCY DOSSIER // {selectedEvent.id}</span>
            </div>
          ) : ""
        }
        maxWidth="2xl"
      >
        {selectedEvent && (
          <div className="space-y-5">
            {/* Status overview */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-helios-850 border border-slate-800">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase">Emergency Protocol</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  SOS STATUS: {selectedEvent.status}
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                {selectedEvent.dispatched_ambulance && (
                  <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/40 flex items-center gap-1">
                    <Ambulance className="w-3.5 h-3.5" /> Ambulance Dispatched
                  </span>
                )}
                {selectedEvent.notified_police && (
                  <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/40 flex items-center gap-1">
                    <PhoneCall className="w-3.5 h-3.5" /> Police Alerted
                  </span>
                )}
              </div>
            </div>

            {/* Evidence Image */}
            <div className="relative rounded-xl overflow-hidden border border-red-500/50 bg-black aspect-video max-h-72">
              <img
                src={
                  selectedEvent.incident?.image_url ||
                  "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1000&auto=format&fit=crop&q=80"
                }
                alt="Accident Evidence Frame"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-red-500 rounded bg-red-500/10 pointer-events-none">
                <span className="absolute -top-5 left-0 bg-red-600 text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                  Accident Confidence: {Math.round((selectedEvent.incident?.confidence || 0.97) * 100)}%
                </span>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/75 px-2.5 py-1 rounded text-[10px] font-mono text-slate-300">
                EDGE AI EVIDENCE STREAM // BUS {selectedEvent.bus_id}
              </div>
            </div>

            {/* Dispatch Timeline & Coordinates */}
            <div className="p-4 rounded-xl bg-helios-850/60 border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
              <div className="flex items-center justify-between">
                <span>Incident Ref:</span>
                <span className="text-white font-bold">{selectedEvent.incident_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Bus Identifier:</span>
                <span className="text-solar-400 font-bold">{selectedEvent.bus_id}</span>
              </div>
              {selectedEvent.incident && (
                <div className="flex items-center justify-between">
                  <span>GPS Telemetry:</span>
                  <span className="text-white">
                    {selectedEvent.incident.gps.lat}, {selectedEvent.incident.gps.lng}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Alarm Timestamp:</span>
                <span className="text-slate-400">
                  {new Date(selectedEvent.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  const toDel = selectedEvent;
                  setSelectedEvent(null);
                  setEventToDelete(toDel);
                }}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-red-950/60 hover:text-red-400 hover:border-red-500/50 text-slate-400 border border-slate-700/80 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-all group"
                title="Delete SOS Incident"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-400 transition-colors" />
                <span className="text-slate-300 group-hover:text-red-300 transition-colors">Delete Record</span>
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    setSelectedEvent(null);
                    navigate("/map");
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-solar-400" />
                  Track on GIS Map
                </button>

                {!selectedEvent.dispatched_ambulance && (
                  <button
                    onClick={() =>
                      handleStatusChange(selectedEvent.id, selectedEvent.incident_id, "AMBULANCE_DISPATCHED", {
                        dispatched_ambulance: true,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-bold uppercase tracking-wider shadow-glow-emergency cursor-pointer flex items-center gap-1.5"
                  >
                    <Ambulance className="w-4 h-4" />
                    Dispatch Ambulance
                  </button>
                )}

                {selectedEvent.status !== "RESOLVED" && (
                  <button
                    onClick={() =>
                      handleStatusChange(selectedEvent.id, selectedEvent.incident_id, "RESOLVED")
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Resolve Emergency
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal for Deletion */}
      <Modal
        isOpen={eventToDelete !== null}
        onClose={() => !isDeleting && setEventToDelete(null)}
        title={
          <div className="flex items-center gap-2 font-mono text-red-400">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span>CONFIRM EMERGENCY SOS DELETION</span>
          </div>
        }
        maxWidth="md"
      >
        {eventToDelete && (
          <div className="space-y-4 font-mono">
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 text-xs text-red-200 leading-relaxed">
              Are you sure you want to permanently delete emergency alarm{" "}
              <strong className="text-white font-bold">{eventToDelete.id}</strong> on{" "}
              <strong className="text-solar-400 font-bold">{eventToDelete.bus_id}</strong>?
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This action will purge this SOS event and its linked accident incident record from the active emergency queue and telemetry database.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEventToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(eventToDelete)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-bold uppercase tracking-wider shadow-glow-emergency transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};


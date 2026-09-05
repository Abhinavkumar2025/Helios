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
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { fetchSOSHistory, updateSOSEvent } from "../services/sos";
import { updateIncident } from "../services/incidents";
import { SOSEvent, SOSStatus } from "../types";

export const AccidentSOS: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useHeliosWebSocket();

  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SOSEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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
      setSosEvents((prev) => [newSOS, ...prev]);
    });

    const unsubUpd = subscribe("sos_updated", (updSOS: any) => {
      setSosEvents((prev) =>
        prev.map((e) => (e.id === updSOS.id ? { ...e, ...updSOS } : e))
      );
      if (selectedEvent?.id === updSOS.id) {
        setSelectedEvent((prev) => (prev ? { ...prev, ...updSOS } : null));
      }
    });

    return () => {
      unsubSOS();
      unsubUpd();
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
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isPending
                        ? "bg-red-600 text-white animate-bounce"
                        : isResolved
                        ? "bg-emerald-600/20 text-emerald-400"
                        : "bg-amber-600/20 text-amber-400"
                    }`}
                  >
                    <Siren className="w-6 h-6" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span className="text-base font-black text-white">{sos.id}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                        Bus: {sos.bus_id}
                      </span>
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
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
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
        )}
      </Modal>
    </div>
  );
};

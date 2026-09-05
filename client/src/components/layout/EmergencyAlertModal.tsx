import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Siren,
  MapPin,
  Clock,
  Camera,
  ShieldAlert,
  Ambulance,
  PhoneCall,
  CheckCircle2,
  ExternalLink,
  X,
  AlertTriangle,
} from "lucide-react";
import { useHeliosWebSocket } from "../../context/WebSocketContext";
import { updateSOSEvent } from "../../services/sos";
import { updateIncident } from "../../services/incidents";

export const EmergencyAlertModal: React.FC = () => {
  const { activeEmergency, dismissEmergency } = useHeliosWebSocket();
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!activeEmergency) return null;

  const { incident, sos } = activeEmergency;

  const handleDispatchAmbulance = async () => {
    try {
      setIsUpdating(true);
      await updateSOSEvent(sos.id, {
        status: "AMBULANCE_DISPATCHED",
        dispatched_ambulance: true,
      });
      await updateIncident(incident.id, { status: "dispatched" });
      setActionSuccess("Ambulance Unit 108 Dispatched to GPS Coordinates!");
      sos.status = "AMBULANCE_DISPATCHED";
      sos.dispatched_ambulance = true;
    } catch (err: any) {
      alert(`Dispatch error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotifyPolice = async () => {
    try {
      setIsUpdating(true);
      await updateSOSEvent(sos.id, {
        status: "POLICE_NOTIFIED",
        notified_police: true,
      });
      setActionSuccess("Traffic Police Control Room Alerted!");
      sos.notified_police = true;
    } catch (err: any) {
      alert(`Police alert error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkResolved = async () => {
    try {
      setIsUpdating(true);
      await updateSOSEvent(sos.id, { status: "RESOLVED" });
      await updateIncident(incident.id, { status: "resolved" });
      setActionSuccess("Incident Marked as Resolved!");
      setTimeout(() => {
        dismissEmergency();
      }, 1500);
    } catch (err: any) {
      alert(`Resolve error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-helios-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-red-500 bg-helios-900 shadow-glow-emergency overflow-hidden">
        {/* Urgent Emergency Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-red-600 via-red-700 to-red-600 text-white animate-pulse-slow">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <Siren className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-mono tracking-widest uppercase opacity-90">
                CRITICAL COLLISION ALERT
              </div>
              <h2 className="text-lg font-black font-mono tracking-tight">
                ACCIDENT DETECTED — {incident.bus_id}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-white/20 font-mono text-xs font-bold uppercase tracking-wider">
              SOS: {sos.status}
            </span>
            <button
              onClick={dismissEmergency}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Confidence</div>
              <div className="text-xl font-bold font-mono text-solar-400 mt-0.5">
                {Math.round(incident.confidence * 100)}%
              </div>
            </div>

            <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Severity</div>
              <div className="text-xl font-bold font-mono text-red-400 mt-0.5 uppercase">
                {incident.severity}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Camera View</div>
              <div className="text-xl font-bold font-mono text-slate-200 mt-0.5 capitalize">
                {incident.camera} Cam
              </div>
            </div>

            <div className="p-3 rounded-xl bg-helios-850 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase">AI Model</div>
              <div className="text-xs font-bold font-mono text-slate-300 mt-2 truncate">
                {incident.model}
              </div>
            </div>
          </div>

          {/* Details & Coordinates */}
          <div className="p-4 rounded-xl bg-helios-850/70 border border-slate-800 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-solar-400 shrink-0" />
              <span className="font-mono">Coordinates: {incident.gps.lat}, {incident.gps.lng}</span>
              <button
                onClick={() => {
                  dismissEmergency();
                  navigate("/map");
                }}
                className="ml-auto text-xs text-solar-400 hover:underline flex items-center gap-1 font-mono"
              >
                View on Map <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-mono">Detected At: {new Date(incident.timestamp).toLocaleString()}</span>
            </div>

            {incident.notes && (
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 italic">
                "{incident.notes}"
              </div>
            )}
          </div>

          {/* Simulated Dashcam Evidence */}
          <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video max-h-52">
            <img
              src={incident.image_url || "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80"}
              alt="Accident Evidence"
              className="w-full h-full object-cover"
            />
            {/* Edge AI simulated bounding box */}
            <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-red-500 rounded bg-red-500/10 pointer-events-none">
              <span className="absolute -top-6 left-0 bg-red-600 text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                Collision Object 97%
              </span>
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-slate-300">
              JETSON-NANO-01 // FRONT-CAM // 1080P
            </div>
          </div>

          {/* Action Success Toast */}
          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
            <button
              onClick={handleDispatchAmbulance}
              disabled={isUpdating || sos.dispatched_ambulance}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-glow-emergency disabled:opacity-50 transition-all cursor-pointer"
            >
              <Ambulance className="w-4 h-4" />
              {sos.dispatched_ambulance ? "Ambulance Dispatched" : "Dispatch Ambulance"}
            </button>

            <button
              onClick={handleNotifyPolice}
              disabled={isUpdating || sos.notified_police}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-all cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              {sos.notified_police ? "Police Notified" : "Notify Police"}
            </button>

            <button
              onClick={handleMarkResolved}
              disabled={isUpdating}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Mark Resolved
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

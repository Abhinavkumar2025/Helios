import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Siren,
  Activity,
  Droplets,
  WifiOff,
  Sparkles,
  CheckCircle2,
  UploadCloud,
} from "lucide-react";
import {
  simulateAccident,
  simulateBusOffline,
  simulatePothole,
  simulateWaterlogging,
} from "../../services/mock";

export const DemoControlBar: React.FC = () => {
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSimulate = async (
    type: "accident" | "pothole" | "waterlogging" | "bus_offline",
    fn: () => Promise<any>,
    label: string
  ) => {
    try {
      setLoadingAction(type);
      setSuccessMsg(null);
      await fn();
      setSuccessMsg(`Simulated: ${label}`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error(err);
      alert(`Simulation error: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-helios-900/90 border-b border-solar-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md sticky top-0 shadow-sm">
      {/* Label and Badge */}
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-solar-400 bg-solar-500/15 border border-solar-500/30 px-2.5 py-1 rounded-md">
          Controls Panel
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Simulate Accident (The Hero Action) */}
        <button
          onClick={() =>
            handleSimulate("accident", () => simulateAccident("BUS-1042"), "Critical Accident on BUS-1042")
          }
          disabled={loadingAction !== null}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-red-600/90 hover:bg-red-600 text-white shadow-glow-emergency border border-red-400/80 active:scale-95 transition-all cursor-pointer"
        >
          {loadingAction === "accident" ? (
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Siren className="w-3.5 h-3.5 animate-bounce" />
          )}
          Simulate Accident
        </button>

        {/* Upload & Test My Image */}
        <button
          onClick={() => {
            navigate("/overview");
            setTimeout(() => {
              window.scrollTo({ top: 350, behavior: "smooth" });
            }, 150);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-solar-500/20 hover:bg-solar-500/30 text-solar-300 border border-solar-500/50 active:scale-95 transition-all cursor-pointer shadow-sm"
        >
          <UploadCloud className="w-3.5 h-3.5 text-solar-400" />
          Test My Image
        </button>

        {/* Simulate Pothole */}
        <button
          onClick={() =>
            handleSimulate("pothole", simulatePothole, "Road Surface Pothole")
          }
          disabled={loadingAction !== null}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 active:scale-95 transition-all cursor-pointer"
        >
          {loadingAction === "pothole" ? (
            <span className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          Simulate Pothole
        </button>

        {/* Simulate Waterlogging */}
        <button
          onClick={() =>
            handleSimulate("waterlogging", simulateWaterlogging, "Waterlogging Alert (18cm)")
          }
          disabled={loadingAction !== null}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 active:scale-95 transition-all cursor-pointer"
        >
          {loadingAction === "waterlogging" ? (
            <span className="w-3 h-3 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Droplets className="w-3.5 h-3.5" />
          )}
          Simulate Waterlogging
        </button>

        {/* Simulate Bus Offline */}
        <button
          onClick={() =>
            handleSimulate("bus_offline", simulateBusOffline, "Jetson Telemetry Lost")
          }
          disabled={loadingAction !== null}
          className="display:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition-all cursor-pointer hidden md:flex"
        >
          {loadingAction === "bus_offline" ? (
            <span className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          Simulate Bus Offline
        </button>

        {/* Toast confirmation */}
        {successMsg && (
          <div className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};

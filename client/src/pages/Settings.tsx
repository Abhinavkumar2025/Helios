import React, { useState } from "react";
import {
  Settings as SettingsIcon,
  Server,
  Wifi,
  Shield,
  Save,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { getApiBaseUrl, getWsUrl } from "../services/api";
import { toggleSimulator, getSimulatorStatus } from "../services/mock";

export const Settings: React.FC = () => {
  const { isConnected, sendPing } = useHeliosWebSocket();

  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [wsUrl, setWsUrl] = useState(getWsUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [simulatorRunning, setSimulatorRunning] = useState(true);
  const [isTogglingSim, setIsTogglingSim] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("helios_api_url", apiUrl);
    localStorage.setItem("helios_ws_url", wsUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleToggleSimulator = async () => {
    try {
      setIsTogglingSim(true);
      const res = await toggleSimulator();
      setSimulatorRunning(res.running);
    } catch (err: any) {
      alert(`Failed to toggle simulator: ${err.message}`);
    } finally {
      setIsTogglingSim(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-solar-400" />
            Helios Platform Settings & Diagnostics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure central API connection points, WebSocket sync, and edge simulation parameters
          </p>
        </div>

        <Badge variant={isConnected ? "success" : "danger"} dot>
          {isConnected ? "WEBSOCKET SYNCED" : "SERVER DISCONNECTED"}
        </Badge>
      </div>

      {/* API Configuration Card */}
      <Card
        title="Network & API Endpoints"
        subtitle="Configure the FastAPI backend and WebSocket event stream URLs"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block uppercase text-slate-400 font-bold mb-1.5">
              Backend REST API Base URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000/api/v1"
              className="w-full px-3.5 py-2.5 rounded-xl bg-helios-850 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-solar-500/50"
            />
          </div>

          <div>
            <label className="block uppercase text-slate-400 font-bold mb-1.5">
              WebSocket Event Broadcast Endpoint
            </label>
            <input
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="ws://localhost:8000/api/v1/ws/events"
              className="w-full px-3.5 py-2.5 rounded-xl bg-helios-850 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-solar-500/50"
            />
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Endpoint settings saved successfully! Reload page if URLs were modified.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={sendPing}
              className="px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Wifi className="w-4 h-4 text-solar-400" />
              Test WebSocket Ping
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-solar-500 hover:bg-solar-600 text-helios-950 font-bold uppercase tracking-wider shadow-glow-solar cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      </Card>

      {/* Simulator Engine Controls */}
      <Card
        title="Mock Simulation Engine & Telemetry Generator"
        subtitle="Control periodic bus coordinate movements and road condition events"
      >
        <div className="p-4 rounded-xl bg-helios-850 border border-slate-800 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-200">Autonomous Bus Movement Loop</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Periodically increments GPS coordinates for 18 online buses along Hyderabad routes.
              </div>
            </div>

            <button
              onClick={handleToggleSimulator}
              disabled={isTogglingSim}
              className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-xs transition-all cursor-pointer ${
                simulatorRunning
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
              }`}
            >
              {simulatorRunning ? "Simulator Running" : "Simulator Paused"}
            </button>
          </div>
        </div>
      </Card>

      {/* Audio & Alert Preferences */}
      <Card
        title="Command Audio & Dispatch Settings"
        subtitle="Control siren audio alerts and emergency response dispatches"
      >
        <div className="space-y-3 font-mono text-xs text-slate-300">
          <div className="flex items-center justify-between p-3 rounded-xl bg-helios-850 border border-slate-800">
            <div className="flex items-center gap-3">
              {audioAlerts ? <Volume2 className="w-5 h-5 text-solar-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
              <div>
                <div className="font-bold text-white">Audible Siren Chime on High-Severity Accident</div>
                <div className="text-[11px] text-slate-400">Play subtle operational chime when SOS is broadcast</div>
              </div>
            </div>
            <button
              onClick={() => setAudioAlerts(!audioAlerts)}
              className={`px-3 py-1 rounded-lg border font-bold text-xs cursor-pointer ${
                audioAlerts ? "bg-solar-500 text-helios-950 border-solar-400" : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {audioAlerts ? "ENABLED" : "MUTED"}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-white">Emergency Services Integration Gateway</div>
              <div className="text-[11px] text-slate-400">Simulation sandbox mode active for Smart India Hackathon demo</div>
            </div>
            <Badge variant="solar">SANDBOX ACTIVE</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};

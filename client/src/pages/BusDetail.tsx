import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Bus,
  ArrowLeft,
  Camera,
  Cpu,
  MapPin,
  Activity,
  BatteryCharging,
  Wifi,
  Clock,
  Layers,
  AlertTriangle,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useHeliosWebSocket } from "../context/WebSocketContext";
import { fetchBusById } from "../services/buses";
import { fetchIncidents } from "../services/incidents";
import { Bus as BusType, Incident } from "../types";

export const BusDetail: React.FC = () => {
  const { busId } = useParams<{ busId: string }>();
  const navigate = useNavigate();
  const { subscribe } = useHeliosWebSocket();

  const [bus, setBus] = useState<BusType | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAiOverlay, setShowAiOverlay] = useState(true);
  const [cameraView, setCameraView] = useState<"front" | "rear">("front");

  useEffect(() => {
    if (!busId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [busData, incData] = await Promise.all([
          fetchBusById(busId),
          fetchIncidents({ bus_id: busId, limit: 10 }),
        ]);
        setBus(busData);
        setIncidents(incData);
      } catch (err) {
        console.error("Failed to load bus details", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to live updates for this specific bus
    const unsubGPS = subscribe("gps_updated", (positions: any[]) => {
      const target = positions.find((p) => p.id === busId);
      if (target) {
        setBus((prev) =>
          prev
            ? { ...prev, lat: target.lat, lng: target.lng, speed: target.speed, status: target.status, jetson_temp: target.jetson_temp || prev.jetson_temp, jetson_cpu: target.jetson_cpu || prev.jetson_cpu }
            : null
        );
      }
    });

    const unsubInc = subscribe("incident_created", (newInc: Incident) => {
      if (newInc.bus_id === busId) {
        setIncidents((prev) => [newInc, ...prev]);
      }
    });

    return () => {
      unsubGPS();
      unsubInc();
    };
  }, [busId, subscribe]);

  if (loading && !bus) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LoadingSkeleton className="h-96 lg:col-span-2" />
          <LoadingSkeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!bus) {
    return (
      <div className="p-12 text-center rounded-2xl border border-slate-800 bg-helios-900 font-mono text-slate-400">
        Bus not found: {busId}
        <button
          onClick={() => navigate("/buses")}
          className="mt-4 px-4 py-2 rounded-lg bg-solar-500 text-helios-950 font-bold block mx-auto text-xs"
        >
          Return to Fleet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/buses")}
            className="p-2 rounded-xl bg-helios-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Back to Bus Fleet"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black font-mono tracking-tight text-white">
                {bus.id}
              </h2>
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
            <p className="text-xs text-slate-400 mt-0.5">{bus.route}</p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-3 bg-helios-900/80 border border-slate-800 px-4 py-2 rounded-xl text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-solar-400" />
            Last Seen: {new Date(bus.last_seen).toLocaleTimeString()}
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Wifi className="w-3.5 h-3.5" />
            4G LTE 98ms
          </span>
        </div>
      </div>

      {/* Main Grid: Cameras & Hardware Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Camera Feed with AI Overlay */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title={`Dashcam Telemetry Feed — ${cameraView.toUpperCase()} CAMERA`}
            subtitle="1080p RTSP Stream processed by NVIDIA Jetson Nano"
            action={
              <div className="flex items-center gap-2">
                {/* AI Overlay Toggle */}
                <button
                  onClick={() => setShowAiOverlay(!showAiOverlay)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    showAiOverlay
                      ? "bg-solar-500/20 text-solar-300 border border-solar-500/40"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  AI Bounding Box {showAiOverlay ? "ON" : "OFF"}
                </button>

                {/* Cam Switcher */}
                <div className="flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700">
                  <button
                    onClick={() => setCameraView("front")}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md font-semibold transition-colors ${
                      cameraView === "front"
                        ? "bg-solar-500 text-helios-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Front Cam
                  </button>
                  <button
                    onClick={() => setCameraView("rear")}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md font-semibold transition-colors ${
                      cameraView === "rear"
                        ? "bg-solar-500 text-helios-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Rear Cam
                  </button>
                </div>
              </div>
            }
          >
            {/* Live Camera Viewport */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center shadow-2xl">
              {/* Simulated dashcam road image */}
              <img
                src={
                  cameraView === "front"
                    ? "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200&auto=format&fit=crop&q=80"
                    : "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&auto=format&fit=crop&q=80"
                }
                alt="Dashcam feed"
                className="w-full h-full object-cover"
              />

              {/* Simulated AI Overlays */}
              {showAiOverlay && (
                <div className="absolute inset-0 pointer-events-none p-6">
                  {/* Bounding Box 1: Preceding Vehicle */}
                  <div className="absolute top-[35%] left-[30%] w-[22%] h-[32%] border-2 border-emerald-400/90 rounded bg-emerald-500/10">
                    <span className="absolute -top-5 left-0 bg-emerald-500 text-helios-950 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded uppercase">
                      Car [96%]
                    </span>
                  </div>

                  {/* Bounding Box 2: Road Surface Hazard */}
                  <div className="absolute bottom-[20%] right-[32%] w-[18%] h-[16%] border-2 border-solar-400/90 rounded bg-solar-500/15 animate-pulse">
                    <span className="absolute -top-5 left-0 bg-solar-500 text-helios-950 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded uppercase">
                      Pothole [92%]
                    </span>
                  </div>

                  {/* Top Feed Telemetry HUD */}
                  <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 font-mono text-[11px] text-slate-200 flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE RTSP
                    </span>
                    <span>29.97 FPS</span>
                    <span>1080p H.265</span>
                    <span className="text-solar-400">YOLO11-EDGE ACTIVE</span>
                  </div>

                  {/* Bottom GPS Watermark */}
                  <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 font-mono text-[10px] text-slate-300">
                    GPS: {bus.lat.toFixed(5)}, {bus.lng.toFixed(5)} | SPD: {bus.speed} KM/H
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Detections Timeline on this Bus */}
          <Card
            title={`Recent AI Detections from ${bus.id}`}
            subtitle="Chronological log of road condition events submitted by edge inference"
          >
            {incidents.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-500">
                No recent incidents flagged along this route.
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3.5 rounded-xl border border-slate-800/80 bg-helios-850/60 hover:border-slate-700 transition-all flex items-center justify-between gap-4 font-mono text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        {inc.event_type === "accident" ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : inc.event_type === "pothole" ? (
                          <Activity className="w-4 h-4 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-200 uppercase truncate">
                          {inc.event_type} — {inc.id}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Confidence: {Math.round(inc.confidence * 100)}% | Severity: {inc.severity}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-slate-300">
                        {new Date(inc.timestamp).toLocaleTimeString()}
                      </div>
                      <span className="text-[10px] text-solar-400 capitalize">
                        {inc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Col: Jetson Nano Hardware Telemetry & GPS */}
        <div className="space-y-6">
          <Card
            title="Jetson Nano Hardware Health"
            subtitle="Edge compute telemetry on board electric bus"
          >
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Compute Hardware</span>
                <span className="text-white font-bold">NVIDIA Jetson Nano 4GB</span>
              </div>

              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Jetson Core Status</span>
                <Badge variant={bus.jetson_status === "online" ? "success" : "danger"} size="sm" dot>
                  {bus.jetson_status}
                </Badge>
              </div>

              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">SoC Core Temp</span>
                <span className="text-solar-400 font-bold">{bus.jetson_temp}°C</span>
              </div>

              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Edge CPU Load</span>
                <span className="text-white font-bold">{bus.jetson_cpu}%</span>
              </div>

              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Electric Battery</span>
                <span className="text-emerald-400 font-bold">{bus.battery}%</span>
              </div>

              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Speed Velocity</span>
                <span className="text-white font-bold">{bus.speed} km/h</span>
              </div>

              <div className="p-3 rounded-xl bg-helios-850 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">GPS Coordinates</span>
                <span className="text-slate-200">{bus.lat.toFixed(4)}, {bus.lng.toFixed(4)}</span>
              </div>
            </div>
          </Card>

          {/* Quick Action Box */}
          <Card title="Vehicle Operations">
            <div className="space-y-2.5">
              <button
                onClick={() => navigate("/map")}
                className="w-full py-2.5 rounded-xl bg-solar-500 hover:bg-solar-600 text-helios-950 font-mono font-bold text-xs uppercase tracking-wider shadow-glow-solar transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Track on Live City GIS Map
              </button>

              <button
                onClick={() => navigate("/cameras")}
                className="w-full py-2.5 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-200 border border-slate-700 font-mono font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-solar-400" />
                Open Multi-Camera Wall
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

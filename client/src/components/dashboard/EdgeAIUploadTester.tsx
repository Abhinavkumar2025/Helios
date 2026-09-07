import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Cpu,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  Layers,
  Zap,
  Droplets,
  Car,
  Gauge,
  Activity,
  Radio,
  ExternalLink,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import {
  uploadAndDetectImage,
  uploadAndDetectPothole,
  uploadAndDetectWaterlogging,
  uploadAndDetectTraffic,
  DetectUploadResponse,
  PotholeUploadResponse,
  WaterloggingUploadResponse,
  TrafficUploadResponse,
} from "../../services/incidents";
import { Incident } from "../../types";

type ModelMode = "accident" | "pothole" | "waterlogging" | "traffic";

interface ModelMeta {
  id: ModelMode;
  name: string;
  badge: string;
  tag: string;
  desc: string;
  icon: React.ElementType;
  activeColor: string;
}

const MODELS: ModelMeta[] = [
  {
    id: "accident",
    name: "Accidents / SOS",
    badge: "best.pt",
    tag: "Crash & Collision",
    desc: "YOLOv8n-Accident-EdgeNet real-time collision detection with telemetry deceleration fusion",
    icon: ShieldAlert,
    activeColor: "bg-red-500/20 text-red-300 border-red-500/50 shadow-glow-emergency",
  },
  {
    id: "pothole",
    name: "Pothole Monitor",
    badge: "yolov8n_pothole.pt",
    tag: "Road Surface",
    desc: "YOLOv8n road surface damage detection with bounding boxes & severity classification",
    icon: AlertTriangle,
    activeColor: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  },
  {
    id: "waterlogging",
    name: "Waterlogging / Flood",
    badge: "best.pt (Seg)",
    tag: "Flood Mask",
    desc: "YOLOv8 Instance Segmentation for road water coverage % & flood hazard scoring",
    icon: Droplets,
    activeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
  },
  {
    id: "traffic",
    name: "Traffic & Vehicles",
    badge: "yolo26n.pt",
    tag: "Vehicle Flow",
    desc: "Multi-class vehicle counting (Car, Bus, Truck, Bike) & PCU congestion density engine",
    icon: Car,
    activeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  },
];

function formatBoxName(name: string): string {
  if (!name || name === "-" || name.startsWith("class_")) return "Traffic Collision";
  return name;
}

interface EdgeAIUploadTesterProps {
  onOpenDossier?: (incident: Incident) => void;
}

export const EdgeAIUploadTester: React.FC<EdgeAIUploadTesterProps> = ({ onOpenDossier }) => {
  const [selectedModel, setSelectedModel] = useState<ModelMode>("accident");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Per-model result states
  const [accidentResult, setAccidentResult] = useState<DetectUploadResponse | null>(null);
  const [potholeResult, setPotholeResult] = useState<PotholeUploadResponse | null>(null);
  const [waterlogResult, setWaterlogResult] = useState<WaterloggingUploadResponse | null>(null);
  const [trafficResult, setTrafficResult] = useState<TrafficUploadResponse | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [boostDecel, setBoostDecel] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeModelMeta = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  const clearResults = () => {
    setAccidentResult(null);
    setPotholeResult(null);
    setWaterlogResult(null);
    setTrafficResult(null);
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    clearResults();

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processSelectedFile(file);
    }
  };

  const handleRunInference = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setErrorMsg(null);

      if (selectedModel === "accident") {
        const res = await uploadAndDetectImage(
          selectedFile,
          undefined,
          boostDecel ? 0.15 : 0.0,
          false
        );
        setAccidentResult(res);
      } else if (selectedModel === "pothole") {
        const res = await uploadAndDetectPothole(selectedFile);
        setPotholeResult(res);
      } else if (selectedModel === "waterlogging") {
        const res = await uploadAndDetectWaterlogging(selectedFile);
        setWaterlogResult(res);
      } else if (selectedModel === "traffic") {
        const res = await uploadAndDetectTraffic(selectedFile);
        setTrafficResult(res);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to analyze image with YOLO model");
    } finally {
      setIsUploading(false);
    }
  };

  // Get current active result
  const currentResult =
    selectedModel === "accident"
      ? accidentResult
      : selectedModel === "pothole"
      ? potholeResult
      : selectedModel === "waterlogging"
      ? waterlogResult
      : trafficResult;

  const currentImageUrl = currentResult?.image_url || previewUrl;

  return (
    <Card
      title="Edge AI Live Model Verification & Custom Image Lab"
      subtitle={activeModelMeta.desc}
      action={
        <div className="flex items-center gap-2">
          <Badge variant="solar" size="sm">
            <Cpu className="w-3 h-3 mr-1" />
            YOLO Weights: {activeModelMeta.badge}
          </Badge>
        </div>
      }
    >
      {/* Model Selection Tabs */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-1.5 rounded-2xl bg-helios-950/90 border border-slate-800">
        {MODELS.map((model) => {
          const Icon = model.icon;
          const isSelected = selectedModel === model.id;
          return (
            <button
              key={model.id}
              onClick={() => {
                setSelectedModel(model.id);
                setErrorMsg(null);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                isSelected
                  ? model.activeColor
                  : "bg-helios-850/60 text-slate-400 border-transparent hover:text-slate-200 hover:bg-helios-850"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{model.name}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone & Model-Specific Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
              previewUrl
                ? "border-solar-500/50 bg-helios-900/60"
                : "border-slate-700/80 hover:border-solar-500/60 bg-helios-850/60 hover:bg-helios-850"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {previewUrl ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700 bg-black/60 group">
                <img
                  src={previewUrl}
                  alt="Upload Preview"
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-mono text-xs text-white">
                  Click to choose different image
                </div>
              </div>
            ) : (
              <div className="py-6 space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-full bg-solar-500/10 border border-solar-500/20 text-solar-400 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold font-mono text-slate-200">
                    Upload Frame to Test {activeModelMeta.tag}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Supports JPG, PNG, WEBP, or BMP
                  </div>
                </div>
                <div className="inline-block px-3 py-1 rounded-lg bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                  Browse from Computer
                </div>
              </div>
            )}
          </div>

          {/* Model-Specific Context Controls */}
          {selectedModel === "accident" && (
            <div className="p-3 rounded-xl bg-helios-850/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
              <div>
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-solar-400" />
                  Telemetry Deceleration Signal
                </div>
                <div className="text-[10px] text-slate-400">
                  Fuse sudden brake G-force telemetry (+15% confidence boost)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBoostDecel(!boostDecel)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                  boostDecel
                    ? "bg-solar-500 text-helios-950"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {boostDecel ? "ACTIVE" : "OFF"}
              </button>
            </div>
          )}

          {selectedModel === "pothole" && (
            <div className="p-3 rounded-xl bg-helios-850/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
              <div>
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Road Surface Depth Profiling
                </div>
                <div className="text-[10px] text-slate-400">
                  YOLOv8 bounding box + severity threshold (Confidence &gt; 25%)
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ACTIVE
              </span>
            </div>
          )}

          {selectedModel === "waterlogging" && (
            <div className="p-3 rounded-xl bg-helios-850/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
              <div>
                <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  Instance Segmentation ROI
                </div>
                <div className="text-[10px] text-slate-400">
                  Road surface polygon mask + amber overlay + flood hazard score
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                ACTIVE
              </span>
            </div>
          )}

          {selectedModel === "traffic" && (
            <div className="p-3 rounded-xl bg-helios-850/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
              <div>
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-emerald-400" />
                  PCU Density Weighting
                </div>
                <div className="text-[10px] text-slate-400">
                  Passenger Car Unit calculations: Bus (3.5), Truck (3.0), Car (1.0), Moto (0.5)
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
          )}

          {/* Inference Trigger Button */}
          <button
            onClick={handleRunInference}
            disabled={!selectedFile || isUploading}
            className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !selectedFile
                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                : isUploading
                ? "bg-solar-500/50 text-helios-950 cursor-wait"
                : "bg-gradient-to-r from-solar-500 via-amber-400 to-solar-500 hover:from-solar-400 hover:to-solar-500 text-helios-950 shadow-glow-solar"
            }`}
          >
            {isUploading ? (
              <>
                <span className="w-4 h-4 border-2 border-helios-950 border-t-transparent rounded-full animate-spin" />
                Running {activeModelMeta.name} Inference...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run Edge AI Detection ({activeModelMeta.tag})
              </>
            )}
          </button>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right Column: Visual Result with Bounding Boxes & Diagnostics (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          {currentResult ? (
            <div className="space-y-3.5">
              {/* ─── ACCIDENT RESULT ─── */}
              {selectedModel === "accident" && accidentResult && (
                <>
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl font-mono border transition-all ${
                      accidentResult.detected
                        ? "bg-red-950/40 border-red-500/50 shadow-glow-emergency"
                        : "bg-helios-850 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          accidentResult.detected ? "bg-red-500 animate-ping" : "bg-emerald-400"
                        }`}
                      />
                      <span className={`text-xs font-bold ${accidentResult.detected ? "text-red-200" : "text-white"}`}>
                        {accidentResult.detected ? "ACCIDENT DETECTED!" : "NO ACCIDENT DETECTED"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={accidentResult.detected ? "danger" : "neutral"} size="sm">
                        {accidentResult.severity.toUpperCase()} SEVERITY
                      </Badge>
                      <span className="text-[11px] text-solar-400 font-bold">
                        Confidence: {Math.round(accidentResult.confidence * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({accidentResult.latency_ms} ms)
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black aspect-video max-h-72 flex items-center justify-center">
                    <img
                      src={currentImageUrl || accidentResult.image_url}
                      alt="Accident Detection Result"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 bg-helios-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-solar-400 border border-solar-500/30 flex items-center gap-1.5">
                      <Layers className="w-3 h-3" />
                      YOLOv8 Accident Overlay Active
                    </div>
                    {accidentResult.detected && (
                      <div className="absolute top-2 right-2 bg-red-600/90 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-white font-bold border border-red-400/40 flex items-center gap-1.5 animate-pulse">
                        <ShieldAlert className="w-3 h-3" />
                        EMERGENCY DETECTED
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-helios-850/60 border border-slate-800 space-y-2.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-[10px] uppercase text-slate-400 font-bold">
                      <span>Detected Classes ({accidentResult.boxes.length} found):</span>
                      {accidentResult.detected && (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
                          Live Incident Created
                        </span>
                      )}
                    </div>
                    {accidentResult.boxes.length === 0 ? (
                      <div className="text-slate-500 text-[11px]">No bounding boxes found.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {accidentResult.boxes.map((box, idx) => {
                          const cleanName = formatBoxName(box.class_name);
                          return (
                            <span
                              key={idx}
                              className={`px-2.5 py-1 rounded-lg text-[11px] border font-bold flex items-center gap-1.5 ${
                                box.is_crash || accidentResult.detected
                                  ? "bg-red-500/20 text-red-200 border-red-500/40"
                                  : "bg-slate-800 text-slate-300 border-slate-700"
                              }`}
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                              <span>{cleanName}:</span>
                              <span className="text-solar-400">{Math.round(box.confidence * 100)}%</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {accidentResult.incident && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-xs">
                      <span className="text-[11px] text-slate-400">
                        Incident ID: <strong className="text-white">{accidentResult.incident.id}</strong> (Bus: {accidentResult.bus_id})
                      </span>

                      <div className="flex items-center gap-2">
                        <a
                          href="/accidents"
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on Dashboard
                        </a>
                        {onOpenDossier && (
                          <button
                            onClick={() => onOpenDossier(accidentResult.incident!)}
                            className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-glow-emergency transition-all cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Open Emergency Dossier
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ─── POTHOLE RESULT ─── */}
              {selectedModel === "pothole" && potholeResult && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-helios-850 border border-slate-800 font-mono">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          potholeResult.detected ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {potholeResult.detected
                          ? `${potholeResult.boxes.length} POTHOLE(S) DETECTED!`
                          : "NO POTHOLES DETECTED"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={potholeResult.detected ? "warning" : "neutral"} size="sm">
                        {potholeResult.severity.toUpperCase()} SEVERITY
                      </Badge>
                      <span className="text-[11px] text-amber-400 font-bold">
                        Top Conf: {Math.round(potholeResult.confidence * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({potholeResult.latency_ms} ms)
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black aspect-video max-h-72 flex items-center justify-center">
                    <img
                      src={currentImageUrl || potholeResult.image_url}
                      alt="Pothole Detection Result"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 bg-helios-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                      <Layers className="w-3 h-3" />
                      YOLOv8 Pothole Bounding Boxes Active
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-helios-850/60 border border-slate-800 space-y-2 font-mono text-xs">
                    <div className="text-[10px] uppercase text-slate-400 font-bold">
                      Detected Pothole Instances ({potholeResult.boxes.length} found):
                    </div>
                    {potholeResult.boxes.length === 0 ? (
                      <div className="text-slate-500 text-[11px]">Road surface is clean. No potholes found.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {potholeResult.boxes.map((box, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg text-[11px] border font-bold flex items-center gap-1 bg-amber-500/20 text-amber-300 border-amber-500/40"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Pothole #{idx + 1}: {Math.round(box.confidence * 100)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {potholeResult.incident && (
                    <div className="flex items-center justify-between pt-1 font-mono text-xs text-slate-400">
                      <span>
                        Incident ID: <strong className="text-white">{potholeResult.incident.id}</strong> (Bus: {potholeResult.bus_id})
                      </span>
                      <span className="text-amber-400 font-bold">Road Hazard Logged to Database</span>
                    </div>
                  )}
                </>
              )}

              {/* ─── WATERLOGGING RESULT ─── */}
              {selectedModel === "waterlogging" && waterlogResult && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-helios-850 border border-slate-800 font-mono">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          waterlogResult.detected ? "bg-cyan-400 animate-pulse" : "bg-emerald-400"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {waterlogResult.detected
                          ? `WATERLOGGING: ${waterlogResult.severity_title.toUpperCase()}`
                          : "NO SIGNIFICANT WATERLOGGING"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={waterlogResult.detected ? "info" : "neutral"} size="sm">
                        {waterlogResult.severity.toUpperCase()}
                      </Badge>
                      <span className="text-[11px] text-cyan-400 font-bold">
                        Coverage: {waterlogResult.road_coverage_pct}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({waterlogResult.latency_ms} ms)
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black aspect-video max-h-72 flex items-center justify-center">
                    <img
                      src={currentImageUrl || waterlogResult.image_url}
                      alt="Waterlogging Segmentation Result"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 bg-helios-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
                      <Droplets className="w-3 h-3" />
                      YOLOv8-Seg Waterlogging Mask Active
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-helios-850/60 border border-slate-800 space-y-3 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">
                          Road Water Coverage
                        </div>
                        <div className="text-base font-bold text-cyan-400">
                          {waterlogResult.road_coverage_pct}%
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                          <div
                            className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, waterlogResult.road_coverage_pct * 2)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">
                          Flood Hazard Index
                        </div>
                        <div className="text-base font-bold text-white">
                          {waterlogResult.water_hazard_score} <span className="text-xs text-slate-500">/ 100</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              waterlogResult.water_hazard_score > 60
                                ? "bg-red-500"
                                : waterlogResult.water_hazard_score > 30
                                ? "bg-amber-500"
                                : "bg-cyan-500"
                            }`}
                            style={{ width: `${Math.min(100, waterlogResult.water_hazard_score)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Status: <strong className="text-white">{waterlogResult.severity_title}</strong></span>
                      {waterlogResult.needs_alert && (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <Radio className="w-3 h-3 animate-ping" /> Drainage Alert Required
                        </span>
                      )}
                    </div>
                  </div>

                  {waterlogResult.incident && (
                    <div className="flex items-center justify-between pt-1 font-mono text-xs text-slate-400">
                      <span>
                        Incident ID: <strong className="text-white">{waterlogResult.incident.id}</strong> (Bus: {waterlogResult.bus_id})
                      </span>
                      <span className="text-cyan-400 font-bold">Broadcast via WebSocket</span>
                    </div>
                  )}
                </>
              )}

              {/* ─── TRAFFIC RESULT ─── */}
              {selectedModel === "traffic" && trafficResult && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-helios-850 border border-slate-800 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-white">
                        TRAFFIC FLOW: {trafficResult.congestion_status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="success" size="sm">
                        {trafficResult.severity.toUpperCase()}
                      </Badge>
                      <span className="text-[11px] text-emerald-400 font-bold">
                        Density: {Math.round(trafficResult.density_pct)}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({trafficResult.latency_ms} ms)
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black aspect-video max-h-72 flex items-center justify-center">
                    <img
                      src={currentImageUrl || trafficResult.image_url}
                      alt="Traffic Flow Analysis Result"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 bg-helios-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <Car className="w-3 h-3" />
                      YOLO26n Vehicle Classification Active
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-helios-850/60 border border-slate-800 space-y-3 font-mono text-xs">
                    <div className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-between">
                      <span>Vehicle Breakdown ({trafficResult.vehicles_detected} total detected):</span>
                      <span className="text-emerald-400">{trafficResult.total_pcu} PCU</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {Object.entries(trafficResult.breakdown || {}).map(([vType, count]) => (
                        <div
                          key={vType}
                          className="p-2 rounded-lg bg-helios-900 border border-slate-800 text-center"
                        >
                          <div className="text-[10px] text-slate-400 capitalize">{vType}</div>
                          <div className="text-sm font-bold text-white mt-0.5">{count}</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Congestion Density Index</span>
                        <span className="text-white font-bold">{trafficResult.density_pct}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            trafficResult.density_pct > 75
                              ? "bg-red-500"
                              : trafficResult.density_pct > 45
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, trafficResult.density_pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {trafficResult.incident && (
                    <div className="flex items-center justify-between pt-1 font-mono text-xs text-slate-400">
                      <span>
                        Telemetry ID: <strong className="text-white">{trafficResult.incident.id}</strong> (Bus: {trafficResult.bus_id})
                      </span>
                      <span className="text-emerald-400 font-bold">Traffic Telemetry Synchronized</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[260px] rounded-2xl border border-slate-800/80 bg-helios-900/40 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div className="max-w-sm space-y-1">
                <h4 className="text-xs font-bold font-mono text-slate-300 uppercase">
                  Awaiting {activeModelMeta.tag} Frame Input
                </h4>
                <p className="text-[11px] text-slate-500 font-sans">
                  Select an image on the left and click "Run Edge AI Detection" to run real inference using{" "}
                  <code className="text-solar-400 font-mono">{activeModelMeta.badge}</code>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

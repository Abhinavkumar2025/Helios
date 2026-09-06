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
  ArrowRight,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { uploadAndDetectImage, DetectUploadResponse } from "../../services/incidents";
import { Incident } from "../../types";

interface EdgeAIUploadTesterProps {
  onOpenDossier?: (incident: Incident) => void;
}

export const EdgeAIUploadTester: React.FC<EdgeAIUploadTesterProps> = ({ onOpenDossier }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<DetectUploadResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [boostDecel, setBoostDecel] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setResult(null);

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
      const res = await uploadAndDetectImage(
        selectedFile,
        undefined,
        boostDecel ? 0.15 : 0.0,
        false
      );
      setResult(res);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to analyze image with YOLO model");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card
      title="Edge AI Live Model Verification & Custom Image Lab"
      subtitle="Upload your own crash or dashcam frames to test YOLOv8n-Accident-EdgeNet in real time"
      action={
        <div className="flex items-center gap-2">
          <Badge variant="solar" size="sm">
            <Cpu className="w-3 h-3 mr-1" />
            YOLOv8 Weights: best.pt
          </Badge>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone & Controls (5 cols) */}
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
                    Drag & Drop Your Picture Here
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

          {/* Telemetry Sensor Fusion Toggle */}
          <div className="p-3 rounded-xl bg-helios-850/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
            <div>
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-solar-400" />
                Telemetry Deceleration Signal
              </div>
              <div className="text-[10px] text-slate-400">
                Fuse sudden brake telemetry (+15% confidence boost)
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
                Running YOLO Inference...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run Edge AI Detection
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

        {/* Right Column: Visual Result with Bounding Boxes (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          {result ? (
            <div className="space-y-3.5">
              {/* Status Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-helios-850 border border-slate-800 font-mono">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      result.detected ? "bg-red-500 animate-ping" : "bg-emerald-400"
                    }`}
                  />
                  <span className="text-xs font-bold text-white">
                    {result.detected ? "ACCIDENT DETECTED!" : "NO ACCIDENT DETECTED"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Badge variant={result.detected ? "danger" : "neutral"} size="sm">
                    {result.severity.toUpperCase()} SEVERITY
                  </Badge>
                  <span className="text-[11px] text-solar-400 font-bold">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({result.latency_ms} ms)
                  </span>
                </div>
              </div>

              {/* Annotated Frame Output */}
              <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black aspect-video max-h-72 flex items-center justify-center">
                <img
                  src={result.image_url}
                  alt="AI Detected Frame with Bounding Boxes"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-helios-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-solar-400 border border-solar-500/30 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" />
                  YOLO Bounding Box Overlay Active
                </div>
              </div>

              {/* Detections Breakdown */}
              <div className="p-3.5 rounded-xl bg-helios-850/60 border border-slate-800 space-y-2 font-mono text-xs">
                <div className="text-[10px] uppercase text-slate-400 font-bold">
                  Detected Classes ({result.boxes.length} found):
                </div>
                {result.boxes.length === 0 ? (
                  <div className="text-slate-500 text-[11px]">No bounding boxes found.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {result.boxes.map((box, idx) => (
                      <span
                        key={idx}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border font-bold flex items-center gap-1 ${
                          box.is_crash
                            ? "bg-red-500/20 text-red-300 border-red-500/40"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {box.is_crash ? (
                          <ShieldAlert className="w-3 h-3 text-red-400" />
                        ) : (
                          <FileImage className="w-3 h-3 text-slate-400" />
                        )}
                        {box.class_name}: {Math.round(box.confidence * 100)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action row */}
              {result.incident && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-slate-400">
                    Incident ID: <strong className="text-white">{result.incident.id}</strong> (Bus: {result.bus_id})
                  </span>

                  {onOpenDossier && (
                    <button
                      onClick={() => onOpenDossier(result.incident!)}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-glow-emergency transition-all cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Open Emergency Dossier
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[220px] rounded-2xl border border-slate-800/80 bg-helios-900/40 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div className="max-w-sm space-y-1">
                <h4 className="text-xs font-bold font-mono text-slate-300 uppercase">
                  Awaiting Dashcam Frame Input
                </h4>
                <p className="text-[11px] text-slate-500 font-sans">
                  Select an image on the left and click "Run Edge AI Detection" to see how the model places bounding boxes and calculates collision risk.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

import React, { useEffect, useState } from "react";
import {
  Cpu,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  HardDrive,
  BarChart,
  ShieldCheck,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { fetchAIModels } from "../services/models";
import { AIModelStatus as AIModelStatusType } from "../types";

export const AIModelStatus: React.FC = () => {
  const [models, setModels] = useState<AIModelStatusType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchAIModels();
      setModels(data);
    } catch (err) {
      console.error("Failed to load AI models", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-solar-400" />
            Edge AI Models & Jetson Nano Health
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time inference latency, confidence distributions, and model runtime benchmarks
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Model Health
        </button>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && models.length === 0 ? (
          <LoadingSkeleton count={5} className="h-64 rounded-2xl" />
        ) : (
          models.map((model) => (
            <div
              key={model.id}
              className="p-6 rounded-2xl border border-slate-800/80 bg-helios-900/80 hover:border-slate-700 backdrop-blur-md transition-all duration-200 shadow-card-subtle flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-solar-400">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-sm text-white">{model.name}</h3>
                      <div className="text-[10px] font-mono text-slate-400 uppercase">
                        Module ID: {model.id}
                      </div>
                    </div>
                  </div>

                  <Badge variant={model.status === "ONLINE" ? "success" : "warning"} dot>
                    {model.status}
                  </Badge>
                </div>

                <div className="py-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Model Architecture</span>
                    <span className="text-solar-400 font-bold">{model.version}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Inference Latency</span>
                    <span className="text-white font-bold">{model.latency_ms} ms</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Average Confidence</span>
                    <span className="text-emerald-400 font-bold">
                      {Math.round(model.avg_confidence * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Inferences Processed</span>
                    <span className="text-slate-200 font-bold">
                      {model.requests_count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Heartbeat: {new Date(model.last_heartbeat).toLocaleTimeString()}
                </span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Jetson Ready
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hardware Architecture Blueprint Card */}
      <Card
        title="Hardware Execution Layer (NVIDIA Jetson Nano)"
        subtitle="Edge AI inference workflow inside electric city buses"
      >
        <div className="p-4 rounded-xl bg-helios-850/60 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
          <p>
            • <b>Edge Ingestion:</b> Front-facing dashcam connects via USB/CSI into NVIDIA Jetson Nano 4GB unit.
          </p>
          <p>
            • <b>TensorRT Optimization:</b> YOLO models run locally on the 128-core Maxwell GPU at ~30 FPS without relying on cloud bandwidth.
          </p>
          <p>
            • <b>Payload Transmission:</b> Only verified anomaly events (accidents, potholes, floods) trigger HTTP POST to the central Helios backend over mobile 4G/5G.
          </p>
        </div>
      </Card>
    </div>
  );
};

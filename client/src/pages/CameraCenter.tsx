import React, { useState } from "react";
import {
  Camera,
  Layers,
  Pause,
  Play,
  Maximize2,
  RefreshCw,
  Sliders,
  Tv,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

interface CameraFeed {
  id: string;
  busId: string;
  cameraType: "Front" | "Rear";
  status: "live" | "paused" | "offline";
  fps: number;
  resolution: string;
  image: string;
  boxes: { label: string; conf: number; top: string; left: string; width: string; height: string; color: string }[];
}

const INITIAL_FEEDS: CameraFeed[] = [
  {
    id: "CAM-01",
    busId: "BUS-101",
    cameraType: "Front",
    status: "live",
    fps: 29.9,
    resolution: "1080p",
    image: "https://images.unsplash.com/photo-1560782205-4dd83ceb0270?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8cG90aG9sZXN8ZW58MHx8MHx8fDA%3D?w=800&auto=format&fit=crop&q=80",
    boxes: [
      { label: "Pothole", conf: 91, top: "30%", left: "25%", width: "55%", height: "50%", color: "border-solar-400 text-solar-400" },
    ],
  },
  {
    id: "CAM-02",
    busId: "BUS-102",
    cameraType: "Front",
    status: "live",
    fps: 30.0,
    resolution: "1080p",
    image: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%2Fid%2FOIP.Qeac6rUuIUPeZnZVeduAFQHaEK%3Fpid%3DApi&f=1&ipt=18be7e4d5d290d81d4920b1406e7e3abd143a3138c8333199bce351a0e32a76e&ipo=images?w=800&auto=format&fit=crop&q=80",
    boxes: [
      { label: "Waterlogging", conf: 93, top: "55%", left: "20%", width: "70%", height: "40%", color: "border-cyan-400 text-cyan-400" },
    ],
  },
  {
    id: "CAM-03",
    busId: "BUS-104",
    cameraType: "Front",
    status: "live",
    fps: 29.8,
    resolution: "1080p",
    image: "https://images.unsplash.com/photo-1575830941656-6f6df67ef0a7?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mjg3fHxtb3ZpbmclMjBjYXJ8ZW58MHx8MHx8fDA%3D?w=800&auto=format&fit=crop&q=80",
    boxes: [
      { label: "Vehicle", conf: 98, top: "35%", left: "40%", width: "28%", height: "35%", color: "border-red-400 text-red-400" },
    ],
  },
  {
    id: "CAM-04",
    busId: "BUS-105",
    cameraType: "Front",
    status: "live",
    fps: 25.0,
    resolution: "720p",
    image: "https://images.unsplash.com/photo-1676165851361-da68616d4fb8?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDh8fHplYnJhJTIwY3Jvc3Npbmd8ZW58MHx8MHx8fDA%3D",
    boxes: [
      { label: "Zebra Crossing", conf: 94, top: "45%", left: "15%", width: "90%", height: "30%", color: "border-amber-400 text-amber-400" },
    ],
  },
];

export const CameraCenter: React.FC = () => {
  const [feeds, setFeeds] = useState<CameraFeed[]>(INITIAL_FEEDS);
  const [aiOverlay, setAiOverlay] = useState<boolean>(true);
  const [gridLayout, setGridLayout] = useState<"2x2" | "1x1">("2x2");
  const [fullscreenFeed, setFullscreenFeed] = useState<string | null>(null);

  const toggleFeedStatus = (feedId: string) => {
    setFeeds((prev) =>
      prev.map((f) =>
        f.id === feedId
          ? { ...f, status: f.status === "live" ? "paused" : "live" }
          : f
      )
    );
  };

  const displayedFeeds = fullscreenFeed
    ? feeds.filter((f) => f.id === fullscreenFeed)
    : feeds;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <Tv className="w-5 h-5 text-solar-400" />
            Multi-Camera Surveillance Wall
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time H.265 RTSP streams from electric bus dashcams with Jetson Nano YOLO inference
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* AI Overlay Toggle */}
          <button
            onClick={() => setAiOverlay(!aiOverlay)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              aiOverlay
                ? "bg-solar-500 text-helios-950 shadow-glow-solar"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            <Layers className="w-4 h-4" />
            AI Overlay: {aiOverlay ? "ACTIVE" : "OFF"}
          </button>

          {/* Grid Layout Switcher */}
          <div className="flex rounded-xl bg-helios-850 p-0.5 border border-slate-700 font-mono text-xs">
            <button
              onClick={() => {
                setFullscreenFeed(null);
                setGridLayout("2x2");
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                gridLayout === "2x2" && !fullscreenFeed
                  ? "bg-solar-500 text-helios-950"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              2x2 Grid
            </button>
            <button
              onClick={() => {
                setGridLayout("1x1");
                setFullscreenFeed(feeds[0].id);
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                fullscreenFeed
                  ? "bg-solar-500 text-helios-950"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Solo Feed
            </button>
          </div>
        </div>
      </div>

      {/* Surveillance Camera Grid */}
      <div
        className={`grid gap-6 ${
          fullscreenFeed || gridLayout === "1x1"
            ? "grid-cols-1"
            : "grid-cols-1 lg:grid-cols-2"
        }`}
      >
        {displayedFeeds.map((feed) => (
          <div
            key={feed.id}
            className="rounded-2xl border border-slate-800 bg-helios-900/90 overflow-hidden shadow-2xl flex flex-col justify-between"
          >
            {/* Feed Header */}
            <div className="px-4 py-3 border-b border-slate-800/80 bg-helios-850/60 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{feed.busId}</span>
                <span className="text-slate-400">({feed.cameraType} Cam)</span>
                <Badge
                  variant={feed.status === "live" ? "success" : "warning"}
                  size="sm"
                  dot={feed.status === "live"}
                >
                  {feed.status}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <span className="text-emerald-400 font-bold">{feed.fps} FPS</span>
                <span>{feed.resolution}</span>
                <button
                  onClick={() => toggleFeedStatus(feed.id)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title={feed.status === "live" ? "Pause Feed" : "Resume Live"}
                >
                  {feed.status === "live" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() =>
                    setFullscreenFeed(fullscreenFeed === feed.id ? null : feed.id)
                  }
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="Toggle Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Video Surface */}
            <div className="relative bg-black aspect-video overflow-hidden group">
              <img
                src={feed.image}
                alt={`Feed ${feed.id}`}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  feed.status === "paused" ? "opacity-60" : "opacity-100"
                }`}
              />

              {/* Pause Watermark */}
              {feed.status === "paused" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="px-3 py-1.5 rounded-lg bg-black/80 border border-amber-500/50 text-amber-400 font-mono text-xs font-bold uppercase">
                    FEED PAUSED
                  </span>
                </div>
              )}

              {/* AI Detection Overlays */}
              {aiOverlay && feed.status === "live" && (
                <div className="absolute inset-0 pointer-events-none">
                  {feed.boxes.map((box, i) => (
                    <div
                      key={i}
                      style={{
                        top: box.top,
                        left: box.left,
                        width: box.width,
                        height: box.height,
                      }}
                      className={`absolute border-2 rounded bg-black/10 backdrop-blur-[1px] ${box.color}`}
                    >
                      <span className="absolute -top-5 left-0 bg-black/80 font-mono text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border border-current">
                        {box.label} [{box.conf}%]
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stream Diagnostics Overlay */}
              <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 flex items-center gap-2">
                <span>RTSP://JETSON-{feed.busId}</span>
                <span className="text-solar-400">EDGE INFERENCE NOMINAL</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

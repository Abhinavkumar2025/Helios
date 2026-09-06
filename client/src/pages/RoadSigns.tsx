import React, { useEffect, useState } from "react";
import {
  Milestone,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Search,
  Eye,
  Sliders,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { StatCard } from "../components/ui/StatCard";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { fetchIncidents } from "../services/incidents";
import { Incident } from "../types";

export const RoadSigns: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchIncidents({ event_type: "road_sign", limit: 40 });
      setIncidents(data);
    } catch (err) {
      console.error("Error loading road signs", err);
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
            <Milestone className="w-5 h-5 text-yellow-400" />
            Road Infrastructure & Sign Detection
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Zebra crossings, speed limit signs, broken lane dividers, and pedestrian zone assets
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Asset Stream
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Scanned Today"
          value={1840}
          icon={<Milestone className="w-5 h-5" />}
          trend="Traffic asset OCR active"
          trendUp={true}
          color="solar"
        />
        <StatCard
          label="Faded Zebra Crossings"
          value={24}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend="Flagged for municipal painting"
          trendUp={false}
          color="amber"
        />
        <StatCard
          label="Damaged / Bent Signs"
          value={11}
          icon={<Sliders className="w-5 h-5" />}
          trend="Speed limit 40 / Stop signs"
          trendUp={false}
          color="red"
        />
        <StatCard
          label="Lane Dividers Missing"
          value={7}
          icon={<CheckCircle2 className="w-5 h-5" />}
          trend="Cyberabad corridor"
          trendUp={true}
          color="purple"
        />
      </div>

      {/* Grid of Road Sign Detections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && incidents.length === 0 ? (
          <LoadingSkeleton count={6} className="h-64 rounded-xl" />
        ) : incidents.length === 0 ? (
          <div className="col-span-3 p-12 text-center rounded-2xl border border-slate-800 bg-helios-900 font-mono text-slate-400">
            No road sign anomalies flagged.
          </div>
        ) : (
          incidents.map((inc) => (
            <div
              key={inc.id}
              className="rounded-2xl border border-slate-800 bg-helios-900/80 overflow-hidden shadow-card-subtle flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-video bg-black">
                  <img
                    src={
                      inc.image_url ||
                      "https://images.unsplash.com/photo-1584897093602-40761fbeff57?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzB8fHR3aXN0ZWQlMjByb2FkJTIwc2lnbnN8ZW58MHx8MHx8fDA%3D"
                    }
                    alt="Road Asset"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-[10px] font-mono text-white">
                    {inc.bus_id} // FRONT CAM
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-yellow-500 text-helios-950 text-[10px] font-mono font-bold uppercase">
                    Confidence {Math.round(inc.confidence * 100)}%
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-xs">{inc.id}</span>
                    <Badge variant="warning">{inc.severity}</Badge>
                  </div>
                  <p className="text-xs text-slate-300 font-sans line-clamp-2">
                    {inc.notes || "Traffic asset visibility degradation detected."}
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-solar-400" />
                  {inc.gps.lat.toFixed(3)}, {inc.gps.lng.toFixed(3)}
                </span>
                <span className="text-slate-500">
                  {new Date(inc.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

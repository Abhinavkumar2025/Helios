import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Car,
  Bike,
  Bus as BusIcon,
  Truck,
  Users,
  TrendingUp,
  RefreshCw,
  Gauge,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { fetchTrafficAnalytics } from "../services/analytics";
import { TrafficAnalytics as TrafficAnalyticsType } from "../types";

const COLORS = ["#f59e0b", "#10b981", "#06b6d4", "#a855f7", "#ef4444"];

export const TrafficAnalytics: React.FC = () => {
  const [trafficData, setTrafficData] = useState<TrafficAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchTrafficAnalytics();
      setTrafficData(data);
    } catch (err) {
      console.error("Error loading traffic analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const counts = trafficData?.live_counts || {
    cars: 2480,
    bikes: 3920,
    buses: 380,
    trucks: 195,
    pedestrians: 840,
  };

  const pieData = [
    { name: "Motorbikes", value: counts.bikes },
    { name: "Cars", value: counts.cars },
    { name: "Pedestrians", value: counts.pedestrians },
    { name: "Buses", value: counts.buses },
    { name: "Trucks", value: counts.trucks },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Live Traffic Flow & Vehicle Classification
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-class object counting on board electric bus edge cameras
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-helios-850 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Vehicle Counters
        </button>
      </div>

      {/* 5 Vehicle Category Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Cars Counted"
          value={counts.cars.toLocaleString()}
          icon={<Car className="w-5 h-5" />}
          trend="32% of total volume"
          trendUp={true}
          color="solar"
        />
        <StatCard
          label="Two-Wheelers"
          value={counts.bikes.toLocaleString()}
          icon={<Bike className="w-5 h-5" />}
          trend="48% of total volume"
          trendUp={true}
          color="emerald"
        />
        <StatCard
          label="Electric Buses"
          value={counts.buses.toLocaleString()}
          icon={<BusIcon className="w-5 h-5" />}
          trend="City fleet & private"
          trendUp={true}
          color="cyan"
        />
        <StatCard
          label="Heavy Trucks"
          value={counts.trucks.toLocaleString()}
          icon={<Truck className="w-5 h-5" />}
          trend="Freight corridor"
          trendUp={false}
          color="purple"
        />
        <StatCard
          label="Pedestrians"
          value={counts.pedestrians.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          trend="Crosswalk scans"
          trendUp={true}
          color="red"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Volume Curve */}
        <div className="lg:col-span-2">
          <Card
            title="Hourly Traffic Volume (24h Aggregate)"
            subtitle="Vehicle throughput calculated across all active bus routes"
          >
            <div className="h-72 w-full pt-4">
              {loading && !trafficData ? (
                <LoadingSkeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficData?.hourly_flow || []}>
                    <defs>
                      <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="vehicles"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorVehicles)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Vehicle Classification Distribution */}
        <div className="lg:col-span-1">
          <Card
            title="Vehicle Type Share"
            subtitle="Modal share distribution across scanned vehicles"
          >
            <div className="h-72 w-full flex items-center justify-center">
              {loading && !trafficData ? (
                <LoadingSkeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Corridor Density Breakdown Table */}
      <Card
        title="Corridor Congestion & Vehicle Density Index"
        subtitle="Real-time road occupancy scores (0-100)"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-3 font-semibold">City Corridor</th>
                <th className="pb-3 font-semibold">Cars</th>
                <th className="pb-3 font-semibold">Bikes</th>
                <th className="pb-3 font-semibold">Buses</th>
                <th className="pb-3 font-semibold">Trucks</th>
                <th className="pb-3 font-semibold">Pedestrians</th>
                <th className="pb-3 font-semibold text-right">Congestion Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(trafficData?.corridor_breakdown || []).map((c, i) => (
                <tr key={i} className="hover:bg-slate-850/40 transition-colors">
                  <td className="py-3 font-bold text-slate-200">{c.corridor}</td>
                  <td className="py-3 text-slate-300">{c.cars}</td>
                  <td className="py-3 text-slate-300">{c.bikes}</td>
                  <td className="py-3 text-slate-300">{c.buses}</td>
                  <td className="py-3 text-slate-300">{c.trucks}</td>
                  <td className="py-3 text-slate-300">{c.pedestrians}</td>
                  <td className="py-3 text-right">
                    <span
                      className={`px-2.5 py-1 rounded font-bold ${
                        c.density_score > 75
                          ? "bg-red-500/20 text-red-400"
                          : c.density_score > 50
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {c.density_score} / 100
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import {
  LineChart,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  Layers,
  AlertTriangle,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { fetchAnalyticsSummary } from "../services/analytics";
import { AnalyticsSummary as AnalyticsSummaryType } from "../types";

const COLORS = ["#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#10b981"];

export const Analytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsSummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days">("7days");

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchAnalyticsSummary();
      setAnalytics(data);
    } catch (err) {
      console.error("Error loading analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = analytics?.summary || {
    active_buses: 18,
    total_buses: 20,
    accidents_today: 12,
    potholes_detected: 153,
    waterlogging_alerts: 27,
    traffic_events: 68,
    sos_alerts: 4,
  };

  return (
    <div className="space-y-6">
      {/* Header and Date Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-helios-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <LineChart className="w-5 h-5 text-solar-400" />
            City Intelligence & Incident Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Macro trends, road condition hot-spots, and mobile fleet coverage metrics
          </p>
        </div>

        {/* Date Filter Buttons */}
        <div className="flex rounded-xl bg-helios-850 p-0.5 border border-slate-700 font-mono text-xs">
          <button
            onClick={() => setDateRange("today")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
              dateRange === "today"
                ? "bg-solar-500 text-helios-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange("7days")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
              dateRange === "7days"
                ? "bg-solar-500 text-helios-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRange("30days")}
            className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
              dateRange === "30days"
                ? "bg-solar-500 text-helios-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trends Area Chart */}
        <Card
          title="Daily Incident Trajectory (Last 7 Days)"
          subtitle="Potholes, accidents, floods, and traffic events aggregated by day"
        >
          <div className="h-72 w-full pt-4">
            {loading && !analytics ? (
              <LoadingSkeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.daily_trends || []}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="potholes"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="traffic"
                    stackId="1"
                    stroke="#a855f7"
                    fill="#a855f7"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="waterlogging"
                    stackId="1"
                    stroke="#06b6d4"
                    fill="#06b6d4"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="accidents"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Incidents by Category Bar Chart */}
        <Card
          title="Incidents by Hazard Category"
          subtitle="Distribution of detected road anomalies"
        >
          <div className="h-72 w-full pt-4">
            {loading && !analytics ? (
              <LoadingSkeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.by_category || []}>
                  <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Top Affected Corridors & Severity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Corridors Table */}
        <div className="lg:col-span-2">
          <Card
            title="Top Affected City Corridors"
            subtitle="Prioritized road segments needing municipal maintenance intervention"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-semibold">Corridor Name</th>
                    <th className="pb-3 font-semibold">Incidents Logged</th>
                    <th className="pb-3 font-semibold text-right">Risk Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(analytics?.top_affected_corridors || []).map((corridor, i) => (
                    <tr key={i} className="hover:bg-slate-850/40 transition-colors">
                      <td className="py-3.5 font-bold text-slate-200 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-solar-400 shrink-0" />
                        {corridor.corridor}
                      </td>
                      <td className="py-3.5 text-white font-bold">{corridor.incidents}</td>
                      <td className="py-3.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            corridor.risk_level === "High"
                              ? "bg-red-500/20 text-red-400"
                              : corridor.risk_level === "Medium"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {corridor.risk_level} Priority
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Severity Pie Chart */}
        <div className="lg:col-span-1">
          <Card
            title="Severity Breakdown"
            subtitle="Critical vs Moderate events"
          >
            <div className="h-64 w-full flex items-center justify-center">
              {loading && !analytics ? (
                <LoadingSkeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics?.by_severity || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="severity"
                    >
                      {(analytics?.by_severity || []).map((entry, index) => (
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
    </div>
  );
};

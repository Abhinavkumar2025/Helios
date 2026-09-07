import React from "react";
import clsx from "clsx";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: "solar" | "red" | "amber" | "cyan" | "purple" | "emerald";
  activePulse?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  trend,
  trendUp,
  color = "solar",
  activePulse = false,
}) => {
  const colorStyles = {
    solar: {
      border: "border-solar-500/30 hover:border-solar-500/60",
      iconBg: "bg-solar-500/10 text-solar-400 border-solar-500/20",
      pulse: "bg-solar-400",
      glow: "shadow-[0_0_18px_rgba(250,204,21,0.22)]",
    },
    red: {
      border: "border-red-500/40 hover:border-red-500/70",
      iconBg: "bg-red-500/15 text-red-400 border-red-500/30",
      pulse: "bg-red-400",
      glow: "shadow-[0_0_18px_rgba(239,68,68,0.22)]",
    },
    amber: {
      border: "border-amber-500/30 hover:border-amber-500/60",
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      pulse: "bg-amber-400",
      glow: "shadow-[0_0_18px_rgba(245,158,11,0.22)]",
    },
    cyan: {
      border: "border-cyan-500/30 hover:border-cyan-500/60",
      iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      pulse: "bg-cyan-400",
      glow: "shadow-[0_0_18px_rgba(6,182,212,0.22)]",
    },
    purple: {
      border: "border-purple-500/30 hover:border-purple-500/60",
      iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      pulse: "bg-purple-400",
      glow: "shadow-[0_0_18px_rgba(168,85,247,0.22)]",
    },
    emerald: {
      border: "border-emerald-500/30 hover:border-emerald-500/60",
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      pulse: "bg-emerald-400",
      glow: "shadow-[0_0_18px_rgba(16,185,129,0.22)]",
    },
  };

  const currentTheme = colorStyles[color];

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={clsx(
        "relative p-5 rounded-xl border bg-helios-900/80 backdrop-blur-md transition-all duration-200 shadow-card-subtle overflow-hidden",
        currentTheme.border
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/[0.03] to-transparent pointer-events-none" />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono tracking-wider uppercase text-slate-400 font-medium">
              {label}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {value}
            </span>

            {subValue && (
              <span className="text-xs text-slate-400 font-mono">
                {subValue}
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <div
            className={clsx(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 animate-pulse",
              currentTheme.iconBg,
              currentTheme.glow
            )}
          >
            {icon}
          </div>
        </div>
      </div>

      {trend && (
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
          <span
            className={clsx(
              "font-medium",
              trendUp ? "text-emerald-400" : "text-slate-400"
            )}
          >
            {trend}
          </span>

          <span className="text-slate-500 font-mono">
            Live telemetry
          </span>
        </div>
      )}
    </motion.div>
  );
};
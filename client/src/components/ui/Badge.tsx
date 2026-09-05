import React from "react";
import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "solar" | "danger" | "warning" | "success" | "info" | "purple" | "neutral";
  size?: "sm" | "md";
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  className,
  dot = false,
}) => {
  const variantStyles = {
    solar: "bg-solar-500/15 text-solar-400 border-solar-500/30",
    danger: "bg-red-500/15 text-red-400 border-red-500/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    info: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    neutral: "bg-slate-800/60 text-slate-300 border-slate-700/50",
  };

  const dotColors = {
    solar: "bg-solar-400",
    danger: "bg-red-400 animate-ping-slow",
    warning: "bg-amber-400",
    success: "bg-emerald-400",
    info: "bg-cyan-400",
    purple: "bg-purple-400",
    neutral: "bg-slate-400",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-medium rounded-full border tracking-wide uppercase font-mono",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && <span className={clsx("w-1.5 h-1.5 rounded-full", dotColors[variant])} />}
      {children}
    </span>
  );
};

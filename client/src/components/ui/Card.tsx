import React from "react";
import clsx from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: "solar" | "emergency" | "cyan" | "none";
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glow = "none",
  title,
  subtitle,
  action,
}) => {
  const glowStyles = {
    none: "border-slate-800/80 bg-helios-900/70",
    solar: "border-solar-500/30 bg-helios-900/85 shadow-glow-solar",
    emergency: "border-red-500/40 bg-helios-900/90 shadow-glow-emergency",
    cyan: "border-cyan-500/30 bg-helios-900/85 shadow-glow-cyan",
  };

  return (
    <div
      className={clsx(
        "rounded-xl border backdrop-blur-md transition-all duration-200",
        glowStyles[glow],
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

import React from "react";
import clsx from "clsx";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "warning" | "outline" | "ghost" | "cyan";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  icon,
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      "bg-solar-500 hover:bg-solar-600 text-helios-950 font-semibold shadow-glow-solar border border-solar-400 active:scale-[0.98]",
    danger:
      "bg-red-600 hover:bg-red-700 text-white font-semibold shadow-glow-emergency border border-red-500 active:scale-[0.98]",
    warning:
      "bg-amber-600 hover:bg-amber-700 text-white font-semibold border border-amber-500 active:scale-[0.98]",
    cyan:
      "bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow-glow-cyan border border-cyan-400 active:scale-[0.98]",
    outline:
      "bg-helios-900/80 hover:bg-helios-800 text-slate-200 border border-slate-700 active:scale-[0.98]",
    ghost:
      "bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border-transparent",
  };

  const sizeStyles = {
    sm: "px-2.5 py-1.5 text-xs rounded-md gap-1.5",
    md: "px-4 py-2 text-sm rounded-lg gap-2",
    lg: "px-5 py-2.5 text-base rounded-lg gap-2.5",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={clsx(
        "inline-flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-solar-500/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

import React from "react";
import clsx from "clsx";

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const LoadingSkeleton: React.FC<SkeletonProps> = ({ className = "h-6 w-full", count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            "animate-pulse bg-slate-800/60 rounded-md",
            className
          )}
        />
      ))}
    </>
  );
};

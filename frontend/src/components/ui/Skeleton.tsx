import React from "react";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={`rounded-lg bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800 ${className || ""}`}
      aria-hidden="true"
      {...props}
    />
  );
}

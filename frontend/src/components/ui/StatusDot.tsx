type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

type StatusDotProps = {
  tone?: StatusTone;
  label?: string;
  pulse?: boolean;
  className?: string;
};

const tones: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
};

export function StatusDot({ tone = "neutral", label, pulse = false, className }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className || ""}`}>
      <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
        {pulse && <span className={`absolute inline-flex h-full w-full rounded-full opacity-40 motion-safe:animate-ping ${tones[tone]}`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tones[tone]}`} />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}

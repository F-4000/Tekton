"use client";

interface StepItemProps {
  label: string;
  active: boolean;
  done: boolean;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}

export function StepItem({
  label,
  active,
  done,
  actionLabel,
  onAction,
  disabled,
}: StepItemProps) {
  return (
    <div
      className={`flex items-center justify-between p-3.5 rounded-xl text-sm transition-all duration-300 ${
        active
          ? "bg-orange-50 border border-orange-200"
          : done
          ? "bg-black/[0.02] border border-black/[0.06]"
          : "bg-black/[0.01] border border-black/[0.04]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {done ? (
          <span className="text-emerald-500 text-sm">&#10003;</span>
        ) : active ? (
          <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-black/20" />
        )}
        <span
          className={
            done ? "text-black/40" : active ? "text-[#0a0a0a]" : "text-black/30"
          }
        >
          {label}
        </span>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          disabled={disabled}
          className="btn-primary text-xs px-4 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

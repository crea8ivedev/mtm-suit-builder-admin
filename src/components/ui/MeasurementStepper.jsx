import { cn } from "../../utils/cn";

export function MeasurementStepper({
  value,
  onChange,
  rangeMin,
  rangeMax,
  className,
}) {
  const STEP = 0.5;
  const low = rangeMin ?? -Infinity;
  const high = rangeMax ?? Infinity;

  const num = parseFloat(value);
  const canDec = !isNaN(num) && Math.round((num - STEP) * 10) / 10 >= low;
  const canInc = !isNaN(num) && Math.round((num + STEP) * 10) / 10 <= high;

  function adjust(dir) {
    const current = isNaN(num) ? (dir > 0 ? low : high) : num;
    const next = Math.round((current + dir * STEP) * 10) / 10;
    const clamped = Math.max(low, Math.min(high, next));
    onChange(String(clamped));
  }

  return (
    <div className={cn("flex items-center gap-[6px]", className)}>
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={!canDec}
        className={cn(
          "flex-shrink-0 w-[28px] h-[28px] rounded-full border flex items-center justify-center transition-all select-none",
          canDec
            ? "border-gc-border-warm bg-white text-gc-dark hover:bg-gc-bg-warm hover:border-gc-primary hover:text-gc-primary active:scale-95 cursor-pointer shadow-sm"
            : "border-gc-border-warm/50 bg-gc-bg-warm text-[#c5bdb6] cursor-not-allowed",
        )}
      >
        <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
          <rect
            x="0"
            y="0.5"
            width="10"
            height="1"
            rx="0.5"
            fill="currentColor"
          />
        </svg>
      </button>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent font-garamond text-[15px] sm:text-[18px] text-center outline-none border-b border-[#d1c7bd] focus:border-gc-primary transition-colors py-[2px]"
      />

      <button
        type="button"
        onClick={() => adjust(1)}
        disabled={!canInc}
        className={cn(
          "flex-shrink-0 w-[28px] h-[28px] rounded-full border flex items-center justify-center transition-all select-none",
          canInc
            ? "border-gc-border-warm bg-white text-gc-dark hover:bg-gc-bg-warm hover:border-gc-primary hover:text-gc-primary active:scale-95 cursor-pointer shadow-sm"
            : "border-gc-border-warm/50 bg-gc-bg-warm text-[#c5bdb6] cursor-not-allowed",
        )}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect
            x="4.5"
            y="0"
            width="1"
            height="10"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="0"
            y="4.5"
            width="10"
            height="1"
            rx="0.5"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}

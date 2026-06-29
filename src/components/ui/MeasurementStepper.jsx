import { cn } from "../../utils/cn";

export function MeasurementStepper({
  value,
  onChange,
  rangeMin,
  rangeMax,
  baseValue,
  className,
}) {
  const STEP = 0.5;
  const SPREAD = 3;

  const low =
    baseValue !== undefined && baseValue !== "" && !isNaN(parseFloat(baseValue))
      ? Math.max(rangeMin ?? -Infinity, parseFloat(baseValue) - SPREAD)
      : (rangeMin ?? -Infinity);
  const high =
    baseValue !== undefined && baseValue !== "" && !isNaN(parseFloat(baseValue))
      ? Math.min(rangeMax ?? Infinity, parseFloat(baseValue) + SPREAD)
      : (rangeMax ?? Infinity);

  const num = parseFloat(value);
  const canDec = !isNaN(num) && Math.round((num - STEP) * 10) / 10 >= low;
  const canInc = !isNaN(num) && Math.round((num + STEP) * 10) / 10 <= high;

  function adjust(dir) {
    const current = isNaN(num) ? (dir > 0 ? low : high) : num;
    const next = Math.round((current + dir * STEP) * 10) / 10;
    const clamped = Math.max(low, Math.min(high, next));
    onChange(String(clamped));
  }

  const btnBase =
    "flex-shrink-0 w-[22px] h-[22px] rounded-[4px] flex items-center justify-center font-hanken text-[14px] font-medium leading-none transition-colors select-none";
  const btnActive =
    "bg-gc-bg-warm border border-gc-border-warm text-gc-dark hover:bg-gc-section-divider/30 active:scale-95 cursor-pointer";
  const btnDisabled =
    "bg-gc-bg-warm border border-gc-border-warm text-[#c5bdb6] cursor-not-allowed";

  return (
    <div className={cn("flex items-center gap-[4px]", className)}>
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={!canDec}
        className={cn(btnBase, canDec ? btnActive : btnDisabled)}
      >
        −
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-[22px] bg-transparent font-garamond text-[14px] sm:text-[18px] text-center outline-none border-b border-[#d1c7bd] focus:border-gc-primary transition-colors"
      />
      <button
        type="button"
        onClick={() => adjust(1)}
        disabled={!canInc}
        className={cn(btnBase, canInc ? btnActive : btnDisabled)}
      >
        +
      </button>
    </div>
  );
}

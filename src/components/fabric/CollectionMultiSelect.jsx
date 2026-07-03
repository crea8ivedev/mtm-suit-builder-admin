import { useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

export default function CollectionMultiSelect({
  collections,
  selectedIds,
  onChange,
  loading,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const selected = collections.filter((c) => selectedIds.includes(c.id));

  function toggle(id) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div ref={ref} className="relative w-full max-w-[480px]">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-[8px] mb-[8px]">
          {selected.map((c) => (
            <span
              key={c.id}
              className="font-hanken flex items-center gap-[6px] pl-[12px] pr-[8px] py-[6px] rounded-[6px] text-[12px] font-medium text-white bg-gc-primary"
            >
              {c.title}
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="cursor-pointer hover:opacity-70"
                title="Remove"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => !loading && setOpen((v) => !v)}
        className="font-hanken flex items-center w-full h-[48px] rounded-[4px] px-[14px] bg-white cursor-pointer border border-gc-scrollbar-thumb/60"
      >
        <span className="flex-1 text-left text-[14px] text-gc-muted truncate">
          {loading
            ? "Loading collections…"
            : collections.length === 0
              ? "No collections found"
              : "Select collections…"}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform text-gc-muted ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      {open && collections.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] max-h-[260px] overflow-y-auto bg-white rounded-[8px] border border-gc-border-warm shadow-md">
          {collections.map((c) => {
            const active = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center justify-between text-left px-[14px] py-[10px] font-hanken text-[13px] transition-colors cursor-pointer ${
                  active
                    ? "text-gc-primary bg-gc-primary/[6%] font-semibold"
                    : "text-gc-near-black font-normal hover:bg-gc-bg-warm"
                }`}
              >
                {c.title}
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

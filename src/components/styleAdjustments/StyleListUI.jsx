import { useState, useRef } from "react";
import { ChevronDown, ListFilter, Eye, Pencil, Trash2 } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

export function GarmentDropdown({ garments, selected, onSelect, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => !loading && garments.length > 0 && setOpen((v) => !v)}
        className="flex items-center w-full h-[40px] rounded-[8px] pl-[13px] pr-[9px] py-[7px] bg-white cursor-pointer border border-gc-border-warm"
      >
        <ListFilter
          size={12}
          className="flex-shrink-0 mr-[8px] text-gc-primary-deep"
        />
        <span
          className={`flex-1 text-left text-[14px] font-hanken truncate ${selected ? "text-gc-near-black" : "text-gc-muted-warm"}`}
        >
          {loading ? "Loading…" : selected || "Filter garments..."}
        </span>
        <ChevronDown
          size={12}
          className={`flex-shrink-0 transition-transform text-gc-muted-warm ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] bg-white rounded-[8px] overflow-hidden border border-gc-border-warm shadow-md">
          {garments.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                onSelect(g);
                setOpen(false);
              }}
              className={`w-full text-left px-[13px] py-[10px] font-hanken text-[14px] transition-colors cursor-pointer ${selected === g ? "text-gc-primary bg-gc-primary/[6%] font-semibold" : "text-gc-near-black font-normal"}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative flex-shrink-0 focus:outline-none cursor-pointer w-[40px] h-[20px] rounded-[12px]"
      aria-checked={on}
      role="switch"
    >
      <span
        className={`absolute inset-0 rounded-[12px] transition-colors ${on ? "bg-gc-primary-deep" : "bg-gc-border-warm"}`}
      />
      <span
        className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform shadow-sm ${on ? "translate-x-[20px]" : "translate-x-0"}`}
      />
    </button>
  );
}

export function OptionCard({
  option,
  visible,
  onChange,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="bg-white flex items-center h-[52px] md:h-[64px] rounded-[8px] px-[8px] md:px-[11px] py-[8px] md:py-[12px] border border-gc-border-warm">
      {!option.isContrastOption &&
        !option.isLiningCode &&
        !option.isButtonCode &&
        !option.isContrastLocation && (
          <span className="flex-shrink-0 flex items-center justify-center font-hanken font-bold text-[11px] rounded-[4px] mr-[8px] w-[24px] h-[24px] bg-gc-bg-warm text-gc-primary">
            {option.sortOrder ?? "—"}
          </span>
        )}

      <div className="flex-shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center w-[40px] h-[40px] border border-gc-border-warm bg-white">
        {option.imageUrl ? (
          <img
            src={option.imageUrl}
            alt={option.label}
            className="object-cover pointer-events-none w-[30px] h-[30px]"
          />
        ) : option.colorHex ? (
          <div
            className="w-[30px] h-[30px] rounded-sm border border-gc-border-warm/40"
            style={{ backgroundColor: option.colorHex }}
          />
        ) : (
          <div className="w-[30px] h-[30px] bg-gc-scrollbar-track rounded-sm" />
        )}
      </div>

      <div className="flex items-center flex-1 min-w-0 ml-[12px]">
        <span className="font-hanken font-medium text-[13px] md:text-[16px] text-black leading-[24px] block truncate">
          {option.label}
        </span>
      </div>

      <div className="flex items-center gap-[8px] pl-[12px] ml-[8px] flex-shrink-0 border-l border-gc-border-warm/40">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView(option);
          }}
          className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 flex-shrink-0 w-[28px] h-[28px] bg-gc-bg-warm"
          title="View option"
        >
          <Eye size={12} className="text-gc-primary-deep" />
        </button>
        {!option.isLiningCode && !option.isButtonCode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(option);
            }}
            className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 flex-shrink-0 w-[28px] h-[28px] bg-gc-bg-warm"
            title="Edit option"
          >
            <Pencil size={12} className="text-gc-primary-deep" />
          </button>
        )}
        {!option.isLiningCode && !option.isButtonCode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(option);
            }}
            className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 flex-shrink-0 w-[28px] h-[28px] bg-red-50"
            title="Delete option"
          >
            <Trash2 size={12} className="text-red-700" />
          </button>
        )}
        <span className="font-hanken font-semibold text-[12px] tracking-[0.6px] w-[24px] text-right text-gc-primary-deep">
          {visible ? "ON" : "OFF"}
        </span>
        <Toggle on={visible} onChange={onChange} />
      </div>
    </div>
  );
}

import { Check, Trash2 } from "lucide-react";
import { cn } from "../../utils/cn";
import { GARMENT_TYPES } from "../../lib/shopify";

// `selections`: { [garmentType]: { price: string, quantity: string } }
export default function GarmentTypeVariantManager({ selections, onChange }) {
  function toggleType(type) {
    if (selections[type]) {
      const next = { ...selections };
      delete next[type];
      onChange(next);
    } else {
      onChange({ ...selections, [type]: { price: "", quantity: "" } });
    }
  }

  function updateType(type, patch) {
    onChange({ ...selections, [type]: { ...selections[type], ...patch } });
  }

  const selectedTypes = GARMENT_TYPES.filter((t) => selections[t]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-wrap gap-[10px]">
        {GARMENT_TYPES.map((type) => {
          const active = !!selections[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={cn(
                "font-hanken flex items-center gap-[6px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                active
                  ? "text-white border border-gc-primary bg-gc-primary"
                  : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
              )}
            >
              {active && <Check size={13} />}
              {type}
            </button>
          );
        })}
      </div>

      {selectedTypes.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          {selectedTypes.map((type) => (
            <div
              key={type}
              className="flex flex-col sm:flex-row sm:items-center gap-[8px] sm:gap-[12px] p-[12px] rounded-[8px] border border-gc-border-input bg-white"
            >
              <span className="font-hanken text-[13px] font-semibold text-gc-heading sm:w-[140px] flex-shrink-0">
                {type}
              </span>
              <div className="flex items-center gap-[8px] flex-1">
                <div className="relative flex-1 max-w-[140px]">
                  <span className="absolute left-[10px] top-1/2 -translate-y-1/2 text-gc-muted text-[13px]">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selections[type].price}
                    onChange={(e) =>
                      updateType(type, { price: e.target.value })
                    }
                    className="w-full border border-gc-border-input rounded-md pl-[20px] pr-[10px] py-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
                    placeholder="Price"
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  value={selections[type].quantity}
                  onChange={(e) =>
                    updateType(type, { quantity: e.target.value })
                  }
                  className="flex-1 max-w-[120px] border border-gc-border-input rounded-md px-[10px] py-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
                  placeholder="Quantity"
                />
              </div>
              <button
                type="button"
                onClick={() => toggleType(type)}
                className="w-[28px] h-[28px] flex items-center justify-center rounded-md text-gc-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer self-end sm:self-auto"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

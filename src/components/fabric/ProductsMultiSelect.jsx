import { useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

// Multi-select of product VARIANTS, grouped under their product title —
// selectedIds holds variant gids (custom.separates is list.variant_reference).
export default function ProductsMultiSelect({
  products,
  selectedIds,
  onChange,
  loading,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const variantIndex = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      for (const v of p.variants ?? []) {
        map.set(v.id, { ...v, productTitle: p.title });
      }
    }
    return map;
  }, [products]);

  const selected = selectedIds
    .map((id) => variantIndex.get(id))
    .filter(Boolean);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, search]);

  const MAX_SELECTED = 2;

  function toggle(id) {
    if (!selectedIds.includes(id) && selectedIds.length >= MAX_SELECTED) return;
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
          {selected.map((v) => (
            <span
              key={v.id}
              className="font-hanken flex items-center gap-[6px] pl-[12px] pr-[8px] py-[6px] rounded-[6px] text-[12px] font-medium text-white bg-gc-primary"
            >
              {v.productTitle}
              {v.title && v.title !== "Default Title" ? (
                <span className="opacity-80">— {v.title}</span>
              ) : null}
              <button
                type="button"
                onClick={() => toggle(v.id)}
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
            ? "Loading products…"
            : products.length === 0
              ? "No fabric products found"
              : "Select product variants…"}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform text-gc-muted ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] max-h-[360px] overflow-y-auto bg-white rounded-[8px] border border-gc-border-warm shadow-md">
          <div className="sticky top-0 z-10 bg-white border-b border-gc-divider p-[8px]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-[10px] top-1/2 -translate-y-1/2 text-gc-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="font-hanken w-full h-[36px] pl-[30px] pr-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
              />
            </div>
          </div>
          {filtered.map((p) => (
            <div key={p.id} className="border-b border-gc-divider/50 last:border-b-0">
              <div className="font-hanken px-[14px] pt-[10px] pb-[4px] text-[13px] font-semibold text-gc-near-black">
                {p.title}
              </div>
              {(p.variants ?? []).map((v) => {
                const active = selectedIds.includes(v.id);
                const disabled = !active && selectedIds.length >= MAX_SELECTED;
                return (
                  <label
                    key={v.id}
                    className={`flex items-center gap-[8px] pl-[24px] pr-[14px] py-[7px] font-hanken text-[13px] transition-colors ${
                      disabled
                        ? "text-gc-muted font-normal cursor-not-allowed opacity-50"
                        : active
                          ? "text-gc-primary bg-gc-primary/[6%] font-semibold cursor-pointer"
                          : "text-gc-near-black font-normal hover:bg-gc-bg-warm cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={disabled}
                      onChange={() => toggle(v.id)}
                      className="accent-gc-primary cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="truncate">
                      {v.title && v.title !== "Default Title"
                        ? v.title
                        : p.title}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

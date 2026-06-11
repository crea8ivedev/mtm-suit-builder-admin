import { Check } from "lucide-react";

export function ProductSelector({
  products,
  loading,
  selectedProduct,
  onSelect,
  customerOrders,
}) {
  if (loading) {
    return (
      <p className="font-hanken text-[14px] text-[#6b7280]">
        Loading products…
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="font-hanken text-[14px] text-[#6b7280]">
        No gc_builder products found in store.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[12px] sm:gap-[19px]">
      {products.map((product) => {
        const isSelected = selectedProduct?.id === product.id;
        const variants = product.variants?.edges ?? [];
        const hasVariantOptions =
          variants.length > 1 ||
          (variants.length === 1 &&
            variants[0].node?.title !== "Default Title");
        const variantPrice =
          variants[0]?.node?.price ||
          product.priceRangeV2?.minVariantPrice?.amount;
        const pastCount = customerOrders.filter((o) =>
          o.lineItems?.edges?.some(
            ({ node }) =>
              node.title?.toLowerCase() === product.title?.toLowerCase(),
          ),
        ).length;
        return (
          <button
            key={product.id}
            onClick={() => onSelect(isSelected ? null : product)}
            className={`flex flex-col items-start gap-[16px] sm:gap-[30px] p-[14px] sm:p-[22px] rounded-[8px] text-left transition-all cursor-pointer bg-white w-full ${isSelected ? "border-2 border-gc-near-black" : "border border-gc-section-divider/30"}`}
          >
            <div className="flex items-center justify-between w-full gap-[8px]">
              <span className="font-hanken text-[12px] font-bold tracking-[0.6px] uppercase text-[#1c1c19] leading-tight">
                {product.title}
              </span>
              {isSelected && (
                <span className="font-hanken text-[10px] font-bold px-[8px] py-[2px] rounded-full flex-shrink-0 text-white bg-black">
                  Selected
                </span>
              )}
            </div>
            <div className="flex flex-col gap-[12px] w-full">
              {variantPrice && (
                <span className="font-hanken text-[11px] font-semibold text-[rgba(76,69,70,0.6)]">
                  {hasVariantOptions ? `From ${variantPrice}` : variantPrice}
                </span>
              )}
              {pastCount > 0 && (
                <span className="font-hanken text-[10px] font-semibold px-[12px] py-[4px] rounded-full self-start tracking-[0.9px] bg-gc-bg-image text-[#4c4546]">
                  {pastCount} past order{pastCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function VariantSelector({
  variants,
  fabricOptions,
  selected,
  onSelect,
}) {
  return (
    <div className="bg-white/40 rounded-[12px] p-[31px] border border-gc-border-input">
      <h2 className="font-garamond text-[28px] font-semibold text-gc-primary mb-[20px]">
        Variant
      </h2>
      <div className="w-full border-t border-gc-section-divider/30 pt-[20px]">
        <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mb-[14px]">
          Select Variant
        </label>
        <div className="flex flex-wrap gap-[10px]">
          {variants.map((v) => {
            const isSelected = selected?.id === v.id;
            const fabric = fabricOptions.find(
              (f) => f.label.toLowerCase() === v.title.toLowerCase(),
            );
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v)}
                style={{
                  backgroundColor: "#fff",
                  color: "#1c1c19",
                  borderColor: isSelected ? "#a45d41" : "#d1cac6",
                  borderWidth: isSelected ? 2 : 1,
                  boxShadow: isSelected
                    ? "0 0 0 3px rgba(164,93,65,0.12)"
                    : "none",
                }}
                className="font-hanken flex items-center gap-[10px] pl-[6px] pr-[14px] h-[52px] rounded-[10px] text-[13px] font-medium transition-all cursor-pointer border"
              >
                <div
                  className="flex-shrink-0 rounded-[6px] overflow-hidden"
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid rgba(0,0,0,0.08)",
                    backgroundColor: fabric?.color ?? "#ede9e3",
                  }}
                >
                  {fabric?.imageUrl && (
                    <img
                      src={fabric.imageUrl}
                      alt={v.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                </div>

                <div className="flex flex-col items-start gap-[2px]">
                  <span className="font-hanken text-[13px] font-semibold leading-tight text-[#1c1c19]">
                    {v.title}
                  </span>
                  <span className="font-hanken text-[11px] font-medium text-[#7e7576]">
                    {v.price}
                  </span>
                </div>

                {isSelected && (
                  <Check
                    size={13}
                    className="flex-shrink-0 ml-[2px] text-[#a45d41]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import ModalBase, { ModalHeader } from "../ui/ModalBase";

export function ViewButtonCodeModal({ option, onClose }) {
  const rows = [
    { label: "Code", value: option.code || option.handle || "—" },
    { label: "Color Name", value: option.rawFields?.color_name || "—" },
    {
      label: "Garment",
      value: (() => {
        try {
          const g = JSON.parse(option.rawFields?.garment || "[]");
          return Array.isArray(g) && g.length ? g.join(", ") : "All Garments";
        } catch {
          return option.rawFields?.garment || "All Garments";
        }
      })(),
    },
    { label: "Default", value: option.isDefault ? "Yes" : "No" },
  ];

  return (
    <ModalBase onClose={onClose} maxWidth="max-w-[480px]">
      <ModalHeader onClose={onClose}>
        <div>
          <p className="font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[2px] text-gc-primary">
            {option.garment} · Button Code
          </p>
          <h2 className="font-garamond font-bold text-[22px] text-gc-heading">
            {option.label}
          </h2>
        </div>
      </ModalHeader>

      <div className="px-[20px] py-[16px] flex flex-col gap-[12px]">
        {option.imageUrl && (
          <div className="flex justify-center pb-[4px]">
            <img
              src={option.imageUrl}
              alt={option.label}
              className="rounded-[8px] object-contain w-[80px] h-[80px] border border-gc-border-warm"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-[8px]">
          <span
            className={`font-hanken font-semibold text-[11px] px-[10px] py-[4px] rounded-full ${option.visible ? "bg-green-100 text-green-800" : "bg-gc-bg-warm text-gc-primary-deep"}`}
          >
            {option.visible ? "Visible" : "Hidden"}
          </span>
        </div>

        <div className="rounded-[8px] overflow-hidden border border-gc-border-warm">
          {rows.map(({ label, value }, i) => (
            <div
              key={label}
              className={`grid grid-cols-2 gap-[12px] px-[14px] py-[10px] ${i > 0 ? "border-t border-gc-bg-warm" : ""} ${i % 2 !== 0 ? "bg-gc-row-alt" : "bg-white"}`}
            >
              <span className="font-hanken font-semibold text-[11px] tracking-[0.4px] text-gc-primary-deep">
                {label}
              </span>
              <span className="font-hanken text-[13px] text-gc-near-black">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ModalBase>
  );
}

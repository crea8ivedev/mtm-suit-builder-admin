import { X } from "lucide-react";

export default function ModalBase({
  onClose,
  maxWidth = "max-w-[520px]",
  children,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative bg-white rounded-[12px] w-full mx-[16px] overflow-y-auto ${maxWidth} max-h-[90vh] border border-gc-border-warm`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, children, actions }) {
  return (
    <div className="flex items-center justify-between px-[20px] py-[16px] flex-shrink-0 border-b border-gc-border-warm">
      {children ?? (
        <div>
          {subtitle && (
            <p className="font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[2px] text-gc-primary">
              {subtitle}
            </p>
          )}
          <h2 className="font-garamond font-bold text-[22px] text-gc-heading">
            {title}
          </h2>
        </div>
      )}
      <div className="flex items-center gap-[8px]">
        {actions}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 w-[30px] h-[30px] bg-gc-bg-warm"
        >
          <X size={14} className="text-gc-primary-deep" />
        </button>
      </div>
    </div>
  );
}

export function ModalFooter({
  onClose,
  submitLabel = "Save",
  disabled = false,
  loading = false,
  loadingLabel,
  destructive = false,
}) {
  return (
    <div className="flex items-center justify-end gap-[8px] pt-[8px] border-t border-gc-border-warm">
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="font-hanken font-semibold text-[13px] h-[38px] px-[16px] rounded-[8px] cursor-pointer hover:opacity-80 disabled:opacity-50 border border-gc-border-warm text-gc-primary-deep"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled || loading}
        className={`font-hanken font-semibold text-[13px] text-white h-[38px] px-[20px] rounded-[8px] cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${destructive ? "bg-red-700" : "bg-gc-primary"}`}
      >
        {loading ? (loadingLabel ?? "Saving…") : submitLabel}
      </button>
    </div>
  );
}

import { Loader2 } from "lucide-react";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  loading,
  disabled = false,
}) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-[16px]">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-[420px] p-[20px] sm:p-[24px] border border-gc-border">
        <h3 className="text-[16px] font-semibold text-gc-heading mb-[8px]">
          {title}
        </h3>
        <div className="text-[14px] text-gc-text mb-[20px]">{message}</div>
        <div className="flex flex-col-reverse sm:flex-row gap-[8px] sm:gap-[10px] sm:justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto px-[16px] py-[10px] sm:py-[8px] text-[13px] text-gc-text rounded-lg hover:bg-gc-bg-warm transition-colors disabled:opacity-50 cursor-pointer border border-gc-border sm:border-0"
          >
            Cancel
          </button>
          {!disabled && (
            <button
              onClick={onConfirm}
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-[6px] px-[16px] py-[10px] sm:py-[8px] text-[13px] bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

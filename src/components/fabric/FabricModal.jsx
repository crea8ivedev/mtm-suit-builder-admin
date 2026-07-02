import { Check, Loader2, X } from "lucide-react";
import FabricForm from "./FabricForm";

export default function FabricModal({
  title,
  form,
  setForm,
  fileRef,
  onImageUpload,
  imageUploading,
  onSave,
  onCancel,
  saving,
  onFetchKutetailor,
  kutetailorFetching,
}) {
  return (
    <div
      className="fixed inset-0 z-[150] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-[16px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-[480px] p-[20px] sm:p-[24px] border border-gc-border-warm">
        <div className="flex items-center justify-between mb-[16px]">
          <h3 className="text-[16px] font-semibold text-gc-heading font-garamond">
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full text-gc-muted hover:text-gc-heading hover:bg-gc-bg-warm transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <FabricForm
          form={form}
          setForm={setForm}
          fileRef={fileRef}
          onImageUpload={onImageUpload}
          imageUploading={imageUploading}
          onFetchKutetailor={onFetchKutetailor}
          kutetailorFetching={kutetailorFetching}
        />

        <div className="flex gap-[8px] mt-[18px]">
          <button
            onClick={onSave}
            disabled={saving || !form.label.trim()}
            className="flex items-center gap-[6px] bg-gc-primary-deep text-white text-[13px] px-[14px] py-[9px] sm:py-[7px] rounded-lg disabled:opacity-50 hover:bg-gc-primary-dark transition-colors cursor-pointer"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Save
          </button>
          <button
            onClick={onCancel}
            className="text-[13px] text-gc-text px-[14px] py-[9px] sm:py-[7px] rounded-lg hover:bg-gc-bg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

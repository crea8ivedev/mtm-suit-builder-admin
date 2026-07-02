import { Upload, Loader2, Download } from "lucide-react";

export default function FabricForm({
  form,
  setForm,
  fileRef,
  onImageUpload,
  imageUploading,
  showInventory = false,
  onFetchKutetailor,
  kutetailorFetching = false,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Label <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="w-full border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
          placeholder="e.g. Navy Blue"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Color Hex
        </label>
        <div className="flex gap-[6px]">
          <input
            type="color"
            value={form.color || "#000000"}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="w-[40px] h-[36px] sm:w-[36px] sm:h-[34px] border border-gc-border-input rounded-md cursor-pointer p-[2px] flex-shrink-0"
          />
          <input
            type="text"
            value={form.color || ""}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="flex-1 border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-gc-primary"
            placeholder="#000000"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          KuteTailor Code
        </label>
        <div className="flex gap-[6px]">
          <input
            type="text"
            value={form.code || ""}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="flex-1 min-w-0 border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
            placeholder="e.g. DAP277A"
          />
          {onFetchKutetailor && (
            <button
              type="button"
              onClick={onFetchKutetailor}
              disabled={kutetailorFetching || !form.code?.trim()}
              title="Fetch label, color, brand & image from KuteTailor"
              className="flex-shrink-0 flex items-center gap-[5px] border border-gc-border-input rounded-md px-[10px] text-[12px] text-gc-primary hover:bg-gc-bg-warm disabled:opacity-50 transition-colors cursor-pointer"
            >
              {kutetailorFetching ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              Fetch
            </button>
          )}
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Brand
        </label>
        <input
          type="text"
          value={form.brand || ""}
          onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          className="w-full border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
          placeholder="e.g. Cerruti 1881"
        />
      </div>
      {showInventory && (
        <div>
          <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
            Quantity <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min="0"
            value={form.quantity ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, quantity: e.target.value }))
            }
            className="w-full border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
            placeholder="e.g. 100"
            required
          />
        </div>
      )}
      {showInventory && (
        <div>
          <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
            Price
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gc-muted text-[13px]">
              $
            </span>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
              className="w-full border border-gc-border-input rounded-md pl-[22px] pr-3 py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
              placeholder="0.00"
            />
          </div>
        </div>
      )}
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Image
        </label>
        <div className="flex items-center gap-[8px]">
          <div className="w-[36px] h-[36px] sm:w-[34px] sm:h-[34px] rounded-md overflow-hidden border border-gc-border bg-gc-bg-warm flex-shrink-0 flex items-center justify-center">
            {form.imageUrl ? (
              <img
                src={form.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Upload size={12} className="text-gc-muted" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={imageUploading}
            className="text-[13px] sm:text-[12px] text-gc-primary hover:text-gc-primary-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {imageUploading
              ? "Uploading…"
              : form.imageUrl
                ? "Change"
                : "Upload"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}

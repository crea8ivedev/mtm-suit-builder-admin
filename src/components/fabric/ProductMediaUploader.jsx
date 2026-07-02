import { useRef } from "react";
import { Loader2, Plus, Upload, X } from "lucide-react";

// `images` entries: { key, url, uploading, isExisting, cdnUrl?, mediaId? }
export default function ProductMediaUploader({ images, onAddFiles, onRemove }) {
  const fileRef = useRef(null);

  return (
    <div className="flex flex-wrap gap-[10px]">
      {images.map((img) => (
        <div
          key={img.key}
          className="relative w-[84px] h-[84px] rounded-[8px] overflow-hidden border border-gc-border-warm bg-gc-bg-warm flex-shrink-0"
        >
          {img.uploading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={16} className="animate-spin text-gc-muted" />
            </div>
          ) : (
            <img src={img.url} alt="" className="w-full h-full object-cover" />
          )}
          {!img.uploading && (
            <button
              type="button"
              onClick={() => onRemove(img.key)}
              className="absolute top-[4px] right-[4px] w-[20px] h-[20px] flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              title="Remove image"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-[84px] h-[84px] rounded-[8px] border border-dashed border-gc-border-input flex flex-col items-center justify-center gap-[4px] text-gc-muted hover:border-gc-primary hover:text-gc-primary transition-colors cursor-pointer flex-shrink-0"
      >
        <Plus size={16} />
        <span className="font-hanken text-[10px]">Add image</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onAddFiles(files);
          e.target.value = "";
        }}
      />

      {images.length === 0 && (
        <div className="flex items-center gap-[6px] text-gc-muted self-center">
          <Upload size={13} />
          <span className="font-hanken text-[12px]">No gallery images yet</span>
        </div>
      )}
    </div>
  );
}

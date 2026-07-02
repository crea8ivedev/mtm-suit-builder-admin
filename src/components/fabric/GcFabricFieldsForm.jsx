import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Upload } from "lucide-react";
import { cn } from "../../utils/cn";

const INPUT_LABEL_CLASS =
  "font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mb-[7px]";
const INPUT_CLASS =
  "font-hanken w-full bg-white px-[14px] h-[48px] rounded-[4px] text-[14px] text-[#1c1c19] outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted";

const OTHER_FIELDS = [
  { key: "color", label: "Color", placeholder: "e.g. Bluethen" },
  { key: "material", label: "Material", placeholder: "e.g. Wool" },
  { key: "weight", label: "Weight", placeholder: "e.g. 280g" },
];

export default function GcFabricFieldsForm({
  showPicker,
  fabrics,
  fabricsLoading,
  useExisting,
  onToggleUseExisting,
  selectedFabricId,
  onSelectFabric,
  fields,
  onFieldsChange,
  imageUrl,
  imageUploading,
  onImageUpload,
  onFetchFromKuteTailor,
  fetchingFromKuteTailor,
  kuteTailorFetchError,
}) {
  const [search, setSearch] = useState("");

  const filteredFabrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fabrics;
    return fabrics.filter((f) =>
      [f.fabricHouse, f.fabricCode, f.color].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
  }, [fabrics, search]);

  return (
    <div className="flex flex-col gap-[20px]">
      {showPicker && (
        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={() => onToggleUseExisting(false)}
            className={cn(
              "font-hanken px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
              !useExisting
                ? "text-white border border-gc-primary bg-gc-primary"
                : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
            )}
          >
            + New Fabric Entry
          </button>
          <button
            type="button"
            onClick={() => onToggleUseExisting(true)}
            className={cn(
              "font-hanken px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
              useExisting
                ? "text-white border border-gc-primary bg-gc-primary"
                : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
            )}
          >
            Use Existing Fabric
          </button>
        </div>
      )}

      {showPicker && useExisting ? (
        <div>
          <label className={INPUT_LABEL_CLASS}>Search Fabrics</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(INPUT_CLASS, "mb-[10px]")}
            placeholder="Search by house, code, or color…"
          />
          {fabricsLoading ? (
            <div className="flex items-center gap-[8px] text-gc-muted py-[16px]">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[13px] font-hanken">Loading fabrics…</span>
            </div>
          ) : filteredFabrics.length === 0 ? (
            <p className="font-hanken text-[13px] text-gc-muted py-[16px]">
              No fabrics found.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px] max-h-[280px] overflow-y-auto">
              {filteredFabrics.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFabric(f)}
                  className={cn(
                    "flex items-center gap-[10px] p-[10px] rounded-[8px] border text-left transition-colors cursor-pointer",
                    selectedFabricId === f.id
                      ? "border-gc-primary bg-gc-primary/[4%]"
                      : "border-gc-border-input bg-white hover:bg-gc-bg-warm",
                  )}
                >
                  <div className="w-[40px] h-[40px] rounded-[6px] overflow-hidden border border-gc-border-warm bg-gc-bg-warm flex-shrink-0">
                    {f.imageUrl && (
                      <img
                        src={f.imageUrl}
                        alt={f.fabricCode}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-hanken text-[13px] font-semibold text-gc-heading truncate">
                      {f.fabricHouse} - {f.fabricCode}
                    </p>
                    <p className="font-hanken text-[12px] text-gc-muted truncate">
                      {f.color}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
            <div>
              <label className={INPUT_LABEL_CLASS}>Fabric Code</label>
              <div className="flex gap-[8px]">
                <input
                  type="text"
                  value={fields.fabricCode ?? ""}
                  onChange={(e) =>
                    onFieldsChange({ ...fields, fabricCode: e.target.value })
                  }
                  className={INPUT_CLASS}
                  placeholder="e.g. DAQ1865"
                />
                <button
                  type="button"
                  onClick={onFetchFromKuteTailor}
                  disabled={
                    fetchingFromKuteTailor || !fields.fabricCode?.trim()
                  }
                  className="font-hanken flex items-center gap-[6px] px-[14px] h-[48px] rounded-[4px] text-[13px] font-medium text-white bg-gc-primary hover:bg-gc-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
                  title="Fetch fabric details from KuteTailor"
                >
                  {fetchingFromKuteTailor ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Fetch
                </button>
              </div>
              {kuteTailorFetchError && (
                <p className="font-hanken text-[12px] text-red-600 mt-[6px]">
                  {kuteTailorFetchError}
                </p>
              )}
            </div>
            <div>
              <label className={INPUT_LABEL_CLASS}>Fabric House</label>
              <input
                type="text"
                value={fields.fabricHouse ?? ""}
                onChange={(e) =>
                  onFieldsChange({ ...fields, fabricHouse: e.target.value })
                }
                className={INPUT_CLASS}
                placeholder="e.g. Dormeuil"
              />
            </div>
            {OTHER_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className={INPUT_LABEL_CLASS}>{label}</label>
                <input
                  type="text"
                  value={fields[key] ?? ""}
                  onChange={(e) =>
                    onFieldsChange({ ...fields, [key]: e.target.value })
                  }
                  className={INPUT_CLASS}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <div className="max-w-[240px]">
            <label className={INPUT_LABEL_CLASS}>Fabric Image</label>
            <div className="flex items-center gap-[10px]">
              <div className="w-[48px] h-[48px] rounded-[6px] overflow-hidden border border-gc-border-warm bg-gc-bg-warm flex items-center justify-center flex-shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload size={14} className="text-gc-muted" />
                )}
              </div>
              <label className="font-hanken text-[13px] text-gc-primary hover:text-gc-primary-dark cursor-pointer">
                {imageUploading ? "Uploading…" : imageUrl ? "Change" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={imageUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImageUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

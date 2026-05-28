import { useEffect, useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";

function JacketIcon() {
  return (
    <svg
      viewBox="0 0 80 90"
      fill="none"
      stroke="#555"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[56px] h-[64px]"
    >
      <path d="M20 8 L8 24 L8 82 L72 82 L72 24 L60 8" />
      <path d="M20 8 C20 8 28 14 40 14 C52 14 60 8 60 8" />
      <path d="M40 14 L40 82" />
      <path d="M20 8 L28 30 L40 26 L52 30 L60 8" />
      <path d="M8 30 L28 30" />
      <path d="M52 30 L72 30" />
      <path d="M14 46 L22 46" />
      <path d="M14 54 L22 54" />
      <path d="M14 62 L22 62" />
      <circle cx="44" cy="44" r="1.5" fill="#555" stroke="none" />
      <circle cx="44" cy="52" r="1.5" fill="#555" stroke="none" />
      <circle cx="44" cy="60" r="1.5" fill="#555" stroke="none" />
    </svg>
  );
}

function CraftIllustration({ code, category }) {
  const label = code ?? category?.charAt(0) ?? "?";
  return (
    <div className="w-[64px] h-[64px] rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-mono text-gray-400 text-center leading-tight px-[2px]">
        {label}
      </span>
    </div>
  );
}

function CraftItem({ craft }) {
  return (
    <div className="flex items-center gap-[12px] py-[10px]">
      <CraftIllustration code={craft.code} category={craft.category} />
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 leading-tight mb-[2px]">
          {craft.category}
        </p>
        <p className="text-[14px] font-semibold text-gray-800 leading-tight">
          {craft.name}
        </p>
        {craft.code && (
          <p className="text-[11px] text-gray-500 font-mono mt-[1px]">
            {craft.code}
          </p>
        )}
      </div>
    </div>
  );
}

export default function FabricDetailModal({ fabric, onClose }) {
  const [imgError, setImgError] = useState(false);
  const [crafts, setCrafts] = useState([]);
  const [craftsLoading, setCraftsLoading] = useState(true);
  const [craftsError, setCraftsError] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setCraftsLoading(true);
    setCraftsError(null);
    fetch("/api/kutetailor/crafts")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success)
          throw new Error(json.error || "Failed to load craft data");
        setCrafts(json.data);
      })
      .catch((e) => setCraftsError(e.message))
      .finally(() => setCraftsLoading(false));
  }, []);

  if (!fabric) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-[16px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[960px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-[28px] py-[18px] border-b border-gray-200 flex-shrink-0">
          <h2 className="text-[18px] font-semibold text-gray-800">
            Product Detail
          </h2>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="overflow-y-auto flex-1 px-[28px] py-[24px]">
          {/* ── Category + Fabric row ── */}
          <div className="flex gap-[48px] mb-[28px]">
            {/* Category */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-gray-400 mb-[12px] font-medium">
                Category
              </p>
              <div className="flex items-start gap-[16px]">
                <div className="w-[64px] h-[72px] border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 flex-shrink-0">
                  <JacketIcon />
                </div>
                <div className="flex flex-col gap-[6px] flex-1">
                  <div className="bg-blue-50 text-blue-700 text-[14px] font-medium px-[14px] py-[8px] rounded-md">
                    Men
                  </div>
                  <div className="bg-blue-50 text-blue-700 text-[14px] font-medium px-[14px] py-[8px] rounded-md">
                    Jacket
                  </div>
                </div>
              </div>
            </div>

            {/* Fabric */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-gray-400 mb-[12px] font-medium">
                Fabric
              </p>
              <div className="flex items-center gap-[16px]">
                <div className="w-[80px] h-[80px] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                  {fabric.imageUrl && !imgError ? (
                    <img
                      src={fabric.imageUrl}
                      alt={fabric.fabricCode}
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[11px]">
                      No image
                    </div>
                  )}
                </div>
                <div className="border border-gray-300 rounded-md px-[14px] py-[10px] bg-white flex-1">
                  <p className="text-[15px] font-semibold text-gray-700">
                    {fabric.fabricCode}
                  </p>
                  {fabric.colorName && (
                    <p className="text-[12px] text-gray-400 mt-[2px]">
                      {fabric.colorName}
                    </p>
                  )}
                  {fabric.material && (
                    <p className="text-[12px] text-gray-400">
                      {fabric.material}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-gray-200 mb-[24px]" />

          {/* ── Customization heading ── */}
          <p className="text-[13px] font-bold text-gray-700 uppercase tracking-widest mb-[16px]">
            Customization
          </p>

          {/* ── JACKET tab ── */}
          <div className="flex items-center gap-[10px] mb-[20px]">
            <button className="bg-gray-800 text-white text-[12px] font-semibold px-[14px] py-[6px] rounded-md flex items-center gap-[6px]">
              JACKET ({crafts.length})
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-[14px] h-[14px] opacity-70"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="10" cy="7" r="1.5" />
                <path
                  d="M10 10 L10 14"
                  strokeWidth="1.5"
                  stroke="currentColor"
                />
              </svg>
            </button>
          </div>

          {/* ── Crafts content ── */}
          {craftsLoading && (
            <div className="flex items-center justify-center py-[48px] gap-[10px] text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[13px]">
                Loading customization options…
              </span>
            </div>
          )}

          {!craftsLoading && craftsError && (
            <div className="flex items-start gap-[10px] p-[16px] bg-red-50 rounded-lg border border-red-200">
              <AlertCircle
                size={16}
                className="text-red-500 flex-shrink-0 mt-[1px]"
              />
              <p className="text-[13px] text-red-600">{craftsError}</p>
            </div>
          )}

          {!craftsLoading && !craftsError && crafts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y divide-x divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {crafts.map((craft, i) => (
                <div
                  key={craft.category}
                  className={[
                    "px-[16px]",
                    i >= 3 ? "border-t border-gray-100" : "",
                  ].join(" ")}
                >
                  <CraftItem craft={craft} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

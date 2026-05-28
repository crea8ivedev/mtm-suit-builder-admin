import { useState, useEffect, useMemo } from "react";
import {
  Package,
  Layers,
  Palette,
  DollarSign,
  BarChart3,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import FabricDetailModal from "../components/ui/FabricDetailModal";

function StockBadge({ value }) {
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const [bg, text] =
    num > 500
      ? ["bg-green-100", "text-green-700"]
      : num > 100
        ? ["bg-yellow-100", "text-yellow-700"]
        : num > 0
          ? ["bg-orange-100", "text-orange-700"]
          : ["bg-red-100", "text-red-600"];
  return (
    <span
      className={`text-11 font-semibold px-[8px] py-[2px] rounded-full ${bg} ${text}`}
    >
      {num.toFixed(1)} m
    </span>
  );
}

function FabricCard({ fabric, onClick }) {
  const [imgError, setImgError] = useState(false);
  const stock = parseFloat(fabric.stock);

  return (
    <div
      className="card overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative bg-gray-100 h-[180px] flex items-center justify-center flex-shrink-0">
        {fabric.imageUrl && !imgError ? (
          <img
            src={fabric.imageUrl}
            alt={fabric.fabricCode}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-[6px] text-gray-300">
            <Layers size={28} />
            <span className="text-11">No image</span>
          </div>
        )}
        {/* Category pill */}
        <div className="absolute top-[8px] left-[8px] flex gap-[4px]">
          <span className="text-[10px] font-bold bg-brand-600 text-white px-[7px] py-[2px] rounded-full">
            Men
          </span>
          <span className="text-[10px] font-bold bg-brand-600/75 text-white px-[7px] py-[2px] rounded-full">
            Jacket
          </span>
        </div>
        {/* Stock badge */}
        <div className="absolute top-[8px] right-[8px]">
          <StockBadge value={fabric.stock} />
        </div>
      </div>

      {/* Info */}
      <div className="p-[14px] flex flex-col gap-[8px] flex-1">
        <div>
          <p className="text-15 font-bold text-text-primary">
            {fabric.fabricCode}
          </p>
          {fabric.factoryCode && (
            <p className="text-11 text-text-muted font-mono">
              Factory: {fabric.factoryCode}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-[6px]">
          {fabric.colorName && (
            <div className="flex items-center gap-[5px]">
              <Palette size={12} className="text-text-muted flex-shrink-0" />
              <span className="text-12 text-text-secondary truncate">
                {fabric.colorName}
              </span>
            </div>
          )}
          {fabric.material && (
            <div className="flex items-center gap-[5px]">
              <Layers size={12} className="text-text-muted flex-shrink-0" />
              <span className="text-12 text-text-secondary truncate">
                {fabric.material}
              </span>
            </div>
          )}
          {fabric.price != null && (
            <div className="flex items-center gap-[5px]">
              <DollarSign size={12} className="text-text-muted flex-shrink-0" />
              <span className="text-12 text-text-secondary">
                ${fabric.price}/m
              </span>
            </div>
          )}
          {!isNaN(stock) && (
            <div className="flex items-center gap-[5px]">
              <BarChart3 size={12} className="text-text-muted flex-shrink-0" />
              <span className="text-12 text-text-secondary">
                {stock.toFixed(1)} m
              </span>
            </div>
          )}
        </div>

        {fabric.fabricBookList?.length > 0 && (
          <div className="pt-[8px] border-t border-border-light">
            <div className="flex flex-wrap gap-[4px]">
              {fabric.fabricBookList.slice(0, 2).map((b) => (
                <span
                  key={b}
                  className="text-[10px] bg-brand-50 text-brand-600 px-[6px] py-[2px] rounded-full truncate max-w-full"
                >
                  {b}
                </span>
              ))}
              {fabric.fabricBookList.length > 2 && (
                <span className="text-[10px] text-text-muted">
                  +{fabric.fabricBookList.length - 2}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Kuttailor() {
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeColor, setActiveColor] = useState("All");
  const [selectedFabric, setSelectedFabric] = useState(null);

  const loadFabrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kutetailor/jackets");
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error || "Failed to load fabrics");
      setFabrics(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFabrics();
  }, []);

  // Build unique color list from fetched fabrics
  const colorOptions = useMemo(() => {
    const set = new Set(fabrics.map((f) => f.colorName).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [fabrics]);

  const filtered = useMemo(
    () =>
      activeColor === "All"
        ? fabrics
        : fabrics.filter((f) => f.colorName === activeColor),
    [fabrics, activeColor],
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-[24px]">
        <div>
          <h1 className="text-24 font-bold text-text-primary">
            Kuttailor — Jackets
          </h1>
          <p className="text-14 text-text-muted mt-[2px]">
            {loading ? "Loading…" : `${fabrics.length} jacket fabrics`}
          </p>
        </div>
        <button
          onClick={loadFabrics}
          disabled={loading}
          className="btn-secondary gap-[6px] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Color filter chips */}
      {!loading && !error && fabrics.length > 0 && (
        <div className="flex flex-wrap gap-[6px] mb-[20px]">
          {colorOptions.map((color) => (
            <button
              key={color}
              onClick={() => setActiveColor(color)}
              className={[
                "text-12 font-medium px-[12px] py-[5px] rounded-full border transition-colors",
                activeColor === color
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-border text-text-secondary hover:border-brand-600 hover:text-brand-600",
              ].join(" ")}
            >
              {color}
              {color !== "All" && (
                <span className="ml-[4px] opacity-60">
                  ({fabrics.filter((f) => f.colorName === color).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-[64px] flex flex-col items-center gap-[14px]">
          <Loader2 size={32} className="animate-spin text-brand-600" />
          <div className="text-center">
            <p className="text-15 font-semibold text-text-primary">
              Loading jacket fabrics…
            </p>
            <p className="text-13 text-text-muted mt-[4px]">
              Fetching 60 fabrics from Kuttailor
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card p-[24px] flex items-start gap-[12px] border-l-4 border-red-500">
          <AlertCircle
            size={18}
            className="text-red-500 flex-shrink-0 mt-[1px]"
          />
          <div>
            <p className="text-14 font-semibold text-red-700">
              Failed to load fabrics
            </p>
            <p className="text-13 text-red-600 mt-[2px]">{error}</p>
            <button
              onClick={loadFabrics}
              className="mt-[10px] btn-secondary text-12"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Empty filtered */}
      {!loading && !error && filtered.length === 0 && fabrics.length > 0 && (
        <div className="card p-[48px] flex flex-col items-center gap-[8px] text-text-muted">
          <Package size={28} />
          <p className="text-14">No fabrics for color "{activeColor}"</p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <p className="text-12 text-text-muted mb-[12px]">
            Showing {filtered.length} of {fabrics.length} fabrics
            {activeColor !== "All" && ` · ${activeColor}`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[16px]">
            {filtered.map((fabric) => (
              <FabricCard
                key={fabric.fabricCode}
                fabric={fabric}
                onClick={() => setSelectedFabric(fabric)}
              />
            ))}
          </div>
        </>
      )}
      {selectedFabric && (
        <FabricDetailModal
          fabric={selectedFabric}
          onClose={() => setSelectedFabric(null)}
        />
      )}
    </DashboardLayout>
  );
}

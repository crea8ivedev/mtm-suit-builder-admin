import { useState, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Upload,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  getCrafts,
  getCraftOptions,
  buildSyncPayload,
} from "../lib/kutetailor";
import { setShopMetafield } from "../lib/shopify";

function Toggle({ on }) {
  return (
    <div
      className={[
        "relative w-[44px] h-[24px] rounded-full transition-colors flex-shrink-0",
        on ? "bg-[#9e7272]" : "bg-gray-200",
      ].join(" ")}
    >
      <div
        className={[
          "absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform",
          on ? "translate-x-[23px]" : "translate-x-[3px]",
        ].join(" ")}
      />
    </div>
  );
}

function OptionCards({ craft }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offIds, setOffIds] = useState(new Set());
  const [failedImgs, setFailedImgs] = useState(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOffIds(new Set());
    setFailedImgs(new Set());
    getCraftOptions(craft.pid, craft.categoryId ?? 2)
      .then((data) => setOptions(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [craft.pid]);

  if (loading) {
    return (
      <div className="flex items-center gap-[8px] px-[24px] py-[16px] text-text-muted">
        <Loader2 size={15} className="animate-spin" />
        <span className="text-[13px]">Loading options…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-[24px] py-[12px]">
        <p className="text-[12px] text-red-500">{error}</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="px-[24px] py-[12px] text-[13px] text-text-muted">
        No options available
      </div>
    );
  }

  return (
    <div className="px-[24px] py-[16px] flex flex-wrap gap-[12px] bg-gray-50 border-t border-border-light">
      {options.map((opt) => {
        const isOn = !offIds.has(opt.id);
        const toggle = (e) => {
          e.stopPropagation();
          setOffIds((prev) => {
            const next = new Set(prev);
            if (next.has(opt.id)) next.delete(opt.id);
            else next.add(opt.id);
            return next;
          });
        };
        return (
          <div
            key={opt.id}
            className={[
              "flex items-center gap-[12px] w-[240px] p-[12px] rounded-lg border transition-all",
              isOn
                ? "border-[#9e7272] bg-white shadow-sm"
                : "border-border bg-white opacity-60",
            ].join(" ")}
          >
            {opt.imgUrl && !failedImgs.has(opt.id) ? (
              <img
                src={opt.imgUrl}
                alt={opt.name}
                onError={() =>
                  setFailedImgs((prev) => new Set([...prev, opt.id]))
                }
                className="w-[52px] h-[52px] flex-shrink-0 rounded-md object-cover border border-border-light bg-gray-100"
              />
            ) : (
              <div className="w-[52px] h-[52px] flex-shrink-0 rounded-md bg-gray-100 border border-border-light flex items-center justify-center p-[4px]">
                <span className="text-[9px] font-medium text-text-muted text-center leading-tight line-clamp-3">
                  {opt.name}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p
                className={[
                  "text-[13px] font-medium leading-tight truncate",
                  isOn ? "text-[#9e7272]" : "text-text-secondary",
                ].join(" ")}
              >
                {opt.name}
              </p>
              {opt.code && (
                <p className="text-[11px] font-mono text-text-muted mt-[2px]">
                  {opt.code}
                </p>
              )}
            </div>
            <div onClick={toggle} className="cursor-pointer">
              <Toggle on={isOn} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CATEGORIES = [
  { label: "Men Jacket", categoryId: 2 },
  { label: "Men Pants", categoryId: 1001 },
  { label: "Men Vest", categoryId: 1002 },
  { label: "Men Shirt", categoryId: 1100 },
  { label: "Men Tuxedo", categoryId: 2853 },
];

export default function Kuttailor() {
  const [selected, setSelected] = useState("Men Jacket");
  const [crafts, setCrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPid, setExpandedPid] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const payload = await buildSyncPayload();
      await setShopMetafield("custom", "fabric_options", payload);
      const totalPositions = Object.values(payload).reduce(
        (s, c) => s + Object.keys(c).length,
        0,
      );
      const totalOptions = Object.values(payload).reduce(
        (s, c) =>
          s + Object.values(c).reduce((ss, p) => ss + p.options.length, 0),
        0,
      );
      setSyncMsg({
        ok: true,
        text: `Saved — ${totalPositions} positions, ${totalOptions} options`,
      });
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const loadCrafts = async (categoryId) => {
    if (!categoryId) {
      setCrafts([]);
      setError(null);
      setLoading(false);
      setExpandedPid(null);
      return;
    }
    setLoading(true);
    setError(null);
    setExpandedPid(null);
    try {
      const data = await getCrafts(categoryId);
      setCrafts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (cat) => {
    setSelected(cat.label);
    loadCrafts(cat.categoryId);
  };

  const handleRowClick = (pid) => {
    setExpandedPid((prev) => (prev === pid ? null : pid));
  };

  useEffect(() => {
    loadCrafts(CATEGORIES.find((c) => c.label === "Men Jacket").categoryId);
  }, []);

  return (
    <DashboardLayout>
      <div className="flex gap-[20px] items-start">
        {/* ── Left sidebar ── */}
        <div className="w-[200px] flex-shrink-0 card p-[16px]">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-[10px]">
            Category
          </p>
          <div className="flex flex-col">
            {CATEGORIES.map((cat) => {
              const isActive = selected === cat.label;
              return (
                <button
                  key={cat.categoryId}
                  onClick={() => handleCategorySelect(cat)}
                  className={[
                    "text-left px-[12px] py-[9px] rounded-md text-[14px] transition-colors",
                    isActive
                      ? "bg-[#9e7272] text-white font-medium"
                      : "text-text-secondary hover:bg-gray-100",
                  ].join(" ")}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main accordion ── */}
        <div className="flex-1 min-w-0 card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-[24px] py-[16px] border-b border-border-light">
            <p className="text-[15px] font-semibold text-text-primary">
              Default process
            </p>
            <div className="flex items-center gap-[10px]">
              {syncMsg && (
                <span
                  className={`text-[12px] ${syncMsg.ok ? "text-green-600" : "text-red-500"}`}
                >
                  {syncMsg.text}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-secondary gap-[6px] disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                {syncing ? "Syncing…" : "Sync to Shopify"}
              </button>
              <button
                onClick={() =>
                  loadCrafts(
                    CATEGORIES.find((c) => c.label === selected)?.categoryId,
                  )
                }
                disabled={loading}
                className="btn-secondary gap-[6px] disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-[72px] gap-[10px] text-text-muted">
              <Loader2 size={20} className="animate-spin text-brand-600" />
              <span className="text-[14px]">Loading…</span>
            </div>
          )}

          {!loading && error && (
            <div className="m-[24px] flex items-start gap-[10px] p-[16px] bg-red-50 rounded-lg border border-red-200">
              <AlertCircle
                size={16}
                className="text-red-500 flex-shrink-0 mt-[1px]"
              />
              <div>
                <p className="text-[13px] text-red-600">{error}</p>
                <button
                  onClick={() =>
                    loadCrafts(
                      CATEGORIES.find((c) => c.label === selected)?.categoryId,
                    )
                  }
                  className="mt-[8px] btn-secondary text-[12px]"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && crafts.length === 0 && (
            <div className="py-[64px] text-center text-text-muted">
              <p className="text-[14px] font-medium">
                No data configured for {selected}
              </p>
              <p className="text-[12px] mt-[4px]">
                This category has not been set up in KuteTailor yet.
              </p>
            </div>
          )}

          {!loading && !error && crafts.length > 0 && (
            <div className="divide-y divide-border-light">
              <div className="grid grid-cols-[1fr_120px_1fr_40px] px-[24px] py-[10px] bg-gray-50 border-b border-border-light">
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                  Process Position
                </span>
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                  Process Code
                </span>
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                  Process Description
                </span>
                <span />
              </div>

              {crafts.map((craft) => {
                const isExpanded = expandedPid === craft.pid;
                return (
                  <div key={craft.pid}>
                    <div
                      onClick={() => handleRowClick(craft.pid)}
                      className={[
                        "grid grid-cols-[1fr_120px_1fr_40px] px-[24px] py-[13px] cursor-pointer transition-colors items-center",
                        isExpanded ? "bg-[#f9f4f4]" : "hover:bg-gray-50/70",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "text-[14px] font-medium",
                          isExpanded ? "text-[#9e7272]" : "text-text-primary",
                        ].join(" ")}
                      >
                        {craft.category}
                      </span>
                      <span className="text-[13px] font-mono text-text-secondary">
                        {craft.code ?? "—"}
                      </span>
                      <span className="text-[14px] text-text-secondary">
                        {craft.name}
                      </span>
                      <ChevronDown
                        size={16}
                        className={[
                          "text-text-muted transition-transform justify-self-end",
                          isExpanded ? "rotate-180 text-[#9e7272]" : "",
                        ].join(" ")}
                      />
                    </div>
                    {isExpanded && <OptionCards craft={craft} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  fetchStyleOptions,
  updateStyleOptionVisible,
  clearStyleOptionsCache,
} from "../lib/shopify";
import LoadingState from "../components/ui/LoadingState";

// ─── Toggle ────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative flex-shrink-0 focus:outline-none"
      style={{ width: 48, height: 26 }}
    >
      <span
        className="absolute inset-0 rounded-full transition-colors"
        style={{ backgroundColor: on ? "#8b7355" : "#d1cbc5" }}
      />
      <span
        className="absolute top-[3px] w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform"
        style={{
          left: 3,
          transform: on ? "translateX(22px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

// ─── Option Card ───────────────────────────────────────────────────────────
function OptionCard({ option, visible, onChange }) {
  return (
    <div
      className="flex items-center gap-[12px] rounded-[8px] p-[12px] transition-opacity"
      style={{
        background: "#ffffff",
        border: "1px solid #e4ddd7",
        opacity: visible ? 1 : 0.55,
      }}
    >
      <div
        className="flex-shrink-0 rounded-[6px]"
        style={{
          width: 52,
          height: 52,
          background: "#ede8e3",
          border: "1px solid #ddd6ce",
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-semibold truncate"
          style={{ color: "#1a1c1b" }}
        >
          {option.label}
        </p>
        <p
          className="text-[10px] font-mono mt-[2px]"
          style={{ color: "#a89f99" }}
        >
          {option.handle}
        </p>
      </div>
      <Toggle on={visible} onChange={onChange} />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function StyleAdjustments() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overrides, setOverrides] = useState(new Map()); // id → boolean
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    fetchStyleOptions()
      .then((data) => {
        setOptions(data);
        if (data.length > 0) {
          const garments = [
            ...new Set(data.map((o) => o.garment).filter(Boolean)),
          ].sort();
          const first = garments[0];
          setSelectedGarment(first);
          const cats = [
            ...new Set(
              data.filter((o) => o.garment === first).map((o) => o.category),
            ),
          ];
          setSelectedCategory(cats[0] ?? null);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Unique garments from data
  const garments = useMemo(
    () => [...new Set(options.map((o) => o.garment).filter(Boolean))].sort(),
    [options],
  );

  // Helper: effective visible state
  const getVisible = (opt) =>
    overrides.has(opt.id) ? overrides.get(opt.id) : opt.visible;

  // Categories for selected garment (with live counts)
  const categoriesForGarment = useMemo(() => {
    if (!selectedGarment) return [];
    const map = new Map();
    for (const opt of options) {
      if (opt.garment !== selectedGarment) continue;
      if (!map.has(opt.category))
        map.set(opt.category, {
          displayLabel: opt.displayLabel,
          total: 0,
          visible: 0,
        });
      const e = map.get(opt.category);
      e.total++;
      if (getVisible(opt)) e.visible++;
    }
    return [...map.entries()]
      .map(([slug, info]) => ({ slug, ...info }))
      .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, selectedGarment, overrides]);

  // Options for selected category
  const categoryOptions = useMemo(
    () =>
      options.filter(
        (o) => o.garment === selectedGarment && o.category === selectedCategory,
      ),
    [options, selectedGarment, selectedCategory],
  );

  // Filtered by search
  const filteredOptions = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return categoryOptions;
    return categoryOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.handle.toLowerCase().includes(q),
    );
  }, [categoryOptions, filterText]);

  const categoryInfo = categoriesForGarment.find(
    (c) => c.slug === selectedCategory,
  );
  const catVisible = categoryOptions.filter((o) => getVisible(o)).length;
  const totalHidden = options.filter((o) => !getVisible(o)).length;
  const pendingCount = overrides.size;

  // ── Toggle handler ──────────────────────────────────────────────────────
  function toggleOption(opt) {
    setOverrides((prev) => {
      const next = new Map(prev);
      const cur = prev.has(opt.id) ? prev.get(opt.id) : opt.visible;
      if (cur === opt.visible) next.set(opt.id, !cur);
      else next.delete(opt.id);
      return next;
    });
  }

  function showAll() {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const opt of filteredOptions) {
        if (opt.visible) next.delete(opt.id);
        else next.set(opt.id, true);
      }
      return next;
    });
  }

  function hideAll() {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const opt of filteredOptions) {
        if (!opt.visible) next.delete(opt.id);
        else next.set(opt.id, false);
      }
      return next;
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!pendingCount) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(
        [...overrides.entries()].map(([id, vis]) =>
          updateStyleOptionVisible(id, vis),
        ),
      );
      setOptions((prev) =>
        prev.map((o) =>
          overrides.has(o.id) ? { ...o, visible: overrides.get(o.id) } : o,
        ),
      );
      setOverrides(new Map());
      clearStyleOptionsCache();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function selectGarment(g) {
    setSelectedGarment(g);
    setFilterText("");
    const cats = [
      ...new Set(options.filter((o) => o.garment === g).map((o) => o.category)),
    ];
    setSelectedCategory(cats[0] ?? null);
  }

  return (
    <DashboardLayout>
      {/* Override page bg to warm cream */}
      <div
        className="absolute inset-0 -z-10 lg:left-[260px] top-[64px]"
        style={{ backgroundColor: "#f2ede7" }}
      />

      <div
        className="flex gap-[28px] items-start pb-[72px]"
        style={{ minHeight: "calc(100vh - 160px)" }}
      >
        {/* ── Left inner sidebar ─────────────────────────────────────────── */}
        <div className="w-[210px] flex-shrink-0 sticky top-[20px]">
          {/* Garment section */}
          <p
            className="text-[10px] font-bold uppercase tracking-[1.6px] mb-[10px]"
            style={{ color: "#8b7355" }}
          >
            Garment
          </p>
          <div className="flex flex-wrap gap-[6px] mb-[22px]">
            {garments.map((g) => (
              <button
                key={g}
                onClick={() => selectGarment(g)}
                className="px-[10px] py-[5px] rounded-[6px] text-[11px] font-bold uppercase tracking-[0.8px] transition-colors"
                style={
                  selectedGarment === g
                    ? { backgroundColor: "#1a1c1b", color: "#ffffff" }
                    : { backgroundColor: "#e8e2db", color: "#6b5c4e" }
                }
              >
                {g}
              </button>
            ))}
          </div>

          {/* Categories section */}
          <p
            className="text-[10px] font-bold uppercase tracking-[1.6px] mb-[10px]"
            style={{ color: "#8b7355" }}
          >
            Categories
          </p>
          {loading ? (
            <p className="text-[12px]" style={{ color: "#9a8f89" }}>
              Loading…
            </p>
          ) : (
            <div
              className="flex flex-col gap-[2px]"
              style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}
            >
              {categoriesForGarment.map((cat) => {
                const active = selectedCategory === cat.slug;
                return (
                  <button
                    key={cat.slug}
                    onClick={() => {
                      setSelectedCategory(cat.slug);
                      setFilterText("");
                    }}
                    className="flex items-center justify-between w-full px-[10px] py-[8px] rounded-[6px] text-left transition-colors"
                    style={
                      active
                        ? { backgroundColor: "#1a1c1b", color: "#ffffff" }
                        : { color: "#3a3228" }
                    }
                  >
                    <span className="text-[13px] font-medium truncate mr-[6px]">
                      {cat.displayLabel}
                    </span>
                    <span
                      className="text-[10px] font-bold px-[6px] py-[1px] rounded-full flex-shrink-0"
                      style={
                        active
                          ? {
                              backgroundColor: "rgba(255,255,255,0.18)",
                              color: "#fff",
                            }
                          : cat.visible < cat.total
                            ? { backgroundColor: "#fde68a", color: "#92400e" }
                            : { backgroundColor: "#e8e2db", color: "#6b5c4e" }
                      }
                    >
                      {cat.visible}/{cat.total}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="flex justify-center pt-[80px]">
              <LoadingState message="Loading style options…" />
            </div>
          )}

          {error && (
            <div className="p-[20px] text-[14px]" style={{ color: "#dc2626" }}>
              {error}
            </div>
          )}

          {!loading && !error && selectedCategory && (
            <>
              {/* Header */}
              <div className="mb-[20px]">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[1.2px] mb-[4px]"
                  style={{ color: "#a89f99" }}
                >
                  {selectedGarment} › {categoryInfo?.displayLabel}
                </p>
                <h1
                  className="text-[30px] font-bold"
                  style={{ color: "#1a1c1b" }}
                >
                  {categoryInfo?.displayLabel}
                </h1>
                <p
                  className="text-[13px] mt-[4px]"
                  style={{ color: "#a89f99" }}
                >
                  {categoryOptions.length} options total · {catVisible} visible
                  to staff
                </p>
              </div>

              {/* Filter + Show/Hide All */}
              <div className="flex items-center gap-[10px] mb-[20px]">
                <input
                  type="text"
                  placeholder="Filter options in this category…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="flex-1 h-[42px] px-[14px] rounded-[8px] text-[13px] focus:outline-none focus:ring-2"
                  style={{
                    border: "1px solid #ddd6ce",
                    background: "#ffffff",
                    color: "#1a1c1b",
                    "--tw-ring-color": "rgba(139,115,85,0.25)",
                  }}
                />
                <button
                  onClick={showAll}
                  className="h-[42px] px-[16px] rounded-[8px] text-[13px] font-semibold transition-colors"
                  style={{
                    border: "1px solid #ddd6ce",
                    background: "#ffffff",
                    color: "#3a3228",
                  }}
                >
                  SHOW ALL
                </button>
                <button
                  onClick={hideAll}
                  className="h-[42px] px-[16px] rounded-[8px] text-[13px] font-semibold transition-colors"
                  style={{
                    border: "1px solid #ddd6ce",
                    background: "#ffffff",
                    color: "#3a3228",
                  }}
                >
                  HIDE ALL
                </button>
              </div>

              {/* Option grid */}
              {filteredOptions.length === 0 ? (
                <p
                  className="text-[13px] py-[32px] text-center"
                  style={{ color: "#a89f99" }}
                >
                  No options match your filter.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[10px]">
                  {filteredOptions.map((opt) => (
                    <OptionCard
                      key={opt.handle}
                      option={opt}
                      visible={getVisible(opt)}
                      onChange={() => toggleOption(opt)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !error && !selectedCategory && (
            <div
              className="flex items-center justify-center py-[100px] text-[14px]"
              style={{ color: "#a89f99" }}
            >
              Select a category to view its options
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed bottom bar ─────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 right-0 lg:left-[260px] left-0 h-[56px] flex items-center justify-between px-[32px] z-40"
        style={{ backgroundColor: "#1a1c1b" }}
      >
        <div className="flex items-center gap-[10px]">
          <span
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white text-[11px] font-bold"
            style={{ backgroundColor: totalHidden > 0 ? "#8b7355" : "#3a3c3b" }}
          >
            {totalHidden}
          </span>
          <span className="text-[13px]" style={{ color: "#c8c0b8" }}>
            options hidden across the catalog.
          </span>
        </div>

        <div className="flex items-center gap-[14px]">
          {saveError && (
            <span className="text-[12px]" style={{ color: "#f87171" }}>
              {saveError}
            </span>
          )}
          {pendingCount > 0 && !saving && (
            <span className="text-[12px]" style={{ color: "#8b7355" }}>
              {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || pendingCount === 0}
            className="h-[36px] px-[22px] rounded-[6px] text-[13px] font-bold uppercase tracking-[0.6px] transition-all disabled:cursor-not-allowed"
            style={{
              backgroundColor: pendingCount > 0 ? "#f2ede7" : "#2e302f",
              color: pendingCount > 0 ? "#1a1c1b" : "#5a5c5b",
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, ChevronRight, Save, ChevronDown } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  fetchStyleOptions,
  updateStyleOptionVisible,
  clearStyleOptionsCache,
} from "../lib/shopify";
import LoadingState from "../components/ui/LoadingState";

// ─── Garment Dropdown ──────────────────────────────────────────────────────
function GarmentDropdown({ garments, selected, onSelect, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger — styled exactly like Figma filter input */}
      <button
        type="button"
        onClick={() => !loading && garments.length > 0 && setOpen((v) => !v)}
        className="flex items-center w-full h-[40px] rounded-[8px] pl-[13px] pr-[9px] py-[7px] bg-white cursor-pointer"
        style={{ border: "1px solid #dac1ba" }}
      >
        <Filter
          size={12}
          className="flex-shrink-0 mr-[8px]"
          style={{ color: "#9b9b9b" }}
        />
        <span
          className="flex-1 text-left text-[14px] font-hanken truncate"
          style={{ color: selected ? "#1c1c19" : "#9b9b9b" }}
        >
          {loading ? "Loading…" : selected || "Filter garments..."}
        </span>
        <ChevronDown
          size={12}
          className="flex-shrink-0 transition-transform"
          style={{
            color: "#9b9b9b",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-[4px] bg-white rounded-[8px] overflow-hidden"
          style={{
            border: "1px solid #dac1ba",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {garments.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                onSelect(g);
                setOpen(false);
              }}
              className="w-full text-left px-[13px] py-[10px] font-hanken text-[14px] transition-colors cursor-pointer"
              style={{
                color: selected === g ? "#a45d41" : "#1c1c19",
                backgroundColor: selected === g ? "#fdf5f0" : "transparent",
                fontWeight: selected === g ? 600 : 400,
              }}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative flex-shrink-0 focus:outline-none cursor-pointer"
      style={{ width: 40, height: 20, borderRadius: 12 }}
      aria-checked={on}
      role="switch"
    >
      <span
        className="absolute inset-0 rounded-[12px] transition-colors"
        style={{ backgroundColor: on ? "#7c3820" : "#dac1ba" }}
      />
      <span
        className="absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform"
        style={{
          left: 2,
          transform: on ? "translateX(20px)" : "translateX(0)",
          boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
        }}
      />
    </button>
  );
}

// ─── Option Card ───────────────────────────────────────────────────────────
function OptionCard({ option, visible, onChange }) {
  return (
    <div
      className="bg-white flex items-center h-[64px] rounded-[8px] px-[11px] py-[12px] cursor-pointer transition-opacity"
      style={{ border: "1px solid #dac1ba" }}
      onClick={onChange}
    >
      {/* Image thumbnail */}
      <div
        className="flex-shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center relative"
        style={{
          width: 40,
          height: 40,
          border: "1px solid #dac1ba",
          background: "#fff",
        }}
      >
        {option.imageUrl ? (
          <img
            src={option.imageUrl}
            alt={option.label}
            className="object-cover pointer-events-none"
            style={{ width: 30, height: 30 }}
          />
        ) : (
          <div className="w-[30px] h-[30px] bg-[#f0ebe6] rounded-sm" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0 ml-[16px]">
        <span className="font-hanken font-medium text-[16px] text-black leading-[24px] block truncate">
          {option.label}
        </span>
      </div>

      {/* ON/OFF + Toggle */}
      <div
        className="flex items-center gap-[16px] pl-[17px] ml-[8px] flex-shrink-0"
        style={{ borderLeft: "1px solid rgba(218,193,186,0.4)" }}
      >
        <span
          className="font-hanken font-semibold text-[12px] tracking-[0.6px] w-[24px] text-right"
          style={{ color: "#7c3820" }}
        >
          {visible ? "ON" : "OFF"}
        </span>
        <Toggle on={visible} onChange={onChange} />
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function StyleAdjustments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overrides, setOverrides] = useState(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [optionFilter, setOptionFilter] = useState("");
  const mainRef = useRef(null);

  const selectedGarment = searchParams.get("garment") || null;
  const selectedCategory = searchParams.get("category") || null;

  function setSelectedGarment(val) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set("garment", val);
      else next.delete("garment");
      next.delete("category");
      return next;
    });
  }

  function setSelectedCategory(val) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set("category", val);
      else next.delete("category");
      return next;
    });
  }

  useEffect(() => {
    fetchStyleOptions()
      .then((data) => {
        setOptions(data);
        if (data.length > 0) {
          const garments = [
            ...new Set(data.map((o) => o.garment).filter(Boolean)),
          ].sort();
          const urlGarment = searchParams.get("garment");
          const first =
            urlGarment && garments.includes(urlGarment)
              ? urlGarment
              : (garments.find((g) => g.toLowerCase() === "jacket") ??
                garments[0]);
          const urlCategory = searchParams.get("category");
          const cats = [
            ...new Set(
              data.filter((o) => o.garment === first).map((o) => o.category),
            ),
          ];
          const firstCat =
            urlCategory && cats.includes(urlCategory)
              ? urlCategory
              : (cats[0] ?? null);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (first) next.set("garment", first);
              else next.delete("garment");
              if (firstCat) next.set("category", firstCat);
              else next.delete("category");
              return next;
            },
            { replace: true },
          );
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const garments = useMemo(
    () => [...new Set(options.map((o) => o.garment).filter(Boolean))].sort(),
    [options],
  );

  const getVisible = (opt) =>
    overrides.has(opt.id) ? overrides.get(opt.id) : opt.visible;

  const categoriesForGarment = useMemo(() => {
    if (!selectedGarment) return [];
    const map = new Map();
    for (const opt of options) {
      if (opt.garment !== selectedGarment) continue;
      if (!map.has(opt.category))
        map.set(opt.category, {
          displayLabel: opt.displayLabel,
          sortOrder: opt.sortOrder,
          total: 0,
          visible: 0,
        });
      const e = map.get(opt.category);
      e.total++;
      if (getVisible(opt)) e.visible++;
    }
    return [...map.entries()]
      .map(([slug, info]) => ({ slug, ...info }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, selectedGarment, overrides]);

  const categoryOptions = useMemo(
    () =>
      options.filter(
        (o) => o.garment === selectedGarment && o.category === selectedCategory,
      ),
    [options, selectedGarment, selectedCategory],
  );

  const filteredOptions = useMemo(() => {
    const q = optionFilter.trim().toLowerCase();
    if (!q) return categoryOptions;
    return categoryOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.handle.toLowerCase().includes(q),
    );
  }, [categoryOptions, optionFilter]);

  const categoryInfo = categoriesForGarment.find(
    (c) => c.slug === selectedCategory,
  );
  const catVisible = categoryOptions.filter((o) => getVisible(o)).length;
  const totalHidden = options.filter((o) => !getVisible(o)).length;
  const pendingCount = overrides.size;

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
    setOptionFilter("");
    const cats = [
      ...new Set(options.filter((o) => o.garment === g).map((o) => o.category)),
    ];
    const firstCat = cats[0] ?? null;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (g) next.set("garment", g);
      else next.delete("garment");
      if (firstCat) next.set("category", firstCat);
      else next.delete("category");
      return next;
    });
  }

  return (
    <DashboardLayout bgColor="#f4f1ed">
      {/* Break out of page-content padding to make aside flush */}
      <div
        className="-mx-[20px] md:-mx-[28px] -mt-[20px] md:-mt-[28px] flex overflow-hidden"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* ── Left aside ──────────────────────────────────────────────────── */}
        <aside
          className="flex-shrink-0 flex flex-col sticky top-[64px]"
          style={{
            width: 280,
            height: "calc(100vh - 64px)",
            background: "#f7f3ee",
            borderRight: "1px solid #dac1ba",
          }}
        >
          {/* Garment filter — click to open garment dropdown */}
          <div className="px-[8px] pt-[16px] pb-[8px] flex-shrink-0 relative">
            <GarmentDropdown
              garments={garments}
              selected={selectedGarment}
              onSelect={selectGarment}
              loading={loading}
            />
          </div>

          {/* Category list */}
          <div className="flex-1 overflow-y-auto pb-[16px] scroll-hidden">
            {loading ? (
              <p className="px-[16px] text-[12px]" style={{ color: "#9a8f89" }}>
                Loading…
              </p>
            ) : (
              <div className="flex flex-col gap-px px-[8px]">
                {categoriesForGarment.map((cat) => {
                  const active = selectedCategory === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => {
                        setSelectedCategory(cat.slug);
                        setOptionFilter("");
                      }}
                      className="flex items-center justify-between w-full text-left transition-colors cursor-pointer"
                      style={
                        active
                          ? {
                              background: "#fff",
                              borderTop: "1px solid #dac1ba",
                              borderBottom: "1px solid #dac1ba",
                              borderLeft: "4px solid #a45d41",
                              paddingLeft: 20,
                              paddingRight: 16,
                              paddingTop: 13,
                              paddingBottom: 13,
                            }
                          : {
                              paddingLeft: 16,
                              paddingRight: 16,
                              paddingTop: 12,
                              paddingBottom: 12,
                            }
                      }
                    >
                      <span
                        className="font-hanken font-semibold text-[12px] leading-[16px] truncate mr-[8px]"
                        style={{ color: active ? "#1c1c19" : "#a45d41" }}
                      >
                        {cat.displayLabel}
                      </span>
                      <div className="flex items-center gap-[8px] flex-shrink-0">
                        {active && (
                          <div
                            className="rounded-[12px] flex-shrink-0"
                            style={{
                              width: 6,
                              height: 6,
                              background: "#a45d41",
                            }}
                          />
                        )}
                        <div
                          className="flex items-center justify-center font-hanken font-medium text-[12px]"
                          style={{
                            background: "#f1ede8",
                            color: "#a45d41",
                            borderRadius: active ? 2 : "0px 2px 2px 2px",
                            width: 40,
                            height: 20,
                          }}
                        >
                          {cat.visible}/{cat.total}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div
          ref={mainRef}
          className="flex-1 min-w-0 flex flex-col overflow-y-auto pb-[80px] scroll-hidden"
        >
          {loading && (
            <div className="flex justify-center pt-[80px]">
              <LoadingState message="Loading style options…" />
            </div>
          )}

          {error && (
            <div className="p-[40px] text-[14px]" style={{ color: "#dc2626" }}>
              {error}
            </div>
          )}

          {!loading && !error && selectedCategory && (
            <>
              {/* Header */}
              <div className="px-[40px] pt-[40px] pb-[24px]">
                {/* Breadcrumb */}
                <div className="flex items-center gap-[4px] mb-[8px]">
                  <span
                    className="font-hanken font-medium text-[11px] leading-[14px]"
                    style={{ color: "#a45d41" }}
                  >
                    {selectedGarment}
                  </span>
                  <ChevronRight size={10} style={{ color: "#a45d41" }} />
                  <span
                    className="font-hanken font-medium text-[11px] leading-[14px]"
                    style={{ color: "#1c1c19" }}
                  >
                    {categoryInfo?.displayLabel}
                  </span>
                </div>
                {/* Title */}
                <h1
                  className="font-garamond font-bold text-[40px] leading-tight"
                  style={{ color: "#3c3c3c" }}
                >
                  {categoryInfo?.displayLabel}
                </h1>
                <p
                  className="font-hanken font-semibold text-[14px] leading-[16px] mt-[2px]"
                  style={{ color: "#a45d41" }}
                >
                  Total: {categoryOptions.length} options | Visible:{" "}
                  {catVisible}
                </p>
              </div>

              {/* Sticky filter bar */}
              <div
                className="sticky top-[64px] z-10 flex items-center justify-between px-[24px] py-[20px]"
                style={{
                  background: "rgba(253,249,244,0.9)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <div
                  className="flex items-center gap-[14px] h-[48px] rounded-[8px] overflow-hidden flex-1 max-w-[608px] pl-[21px] pr-[19px]"
                  style={{
                    background: "rgba(255,255,255,0.5)",
                    border: "1px solid #d1c7bd",
                  }}
                >
                  <Search
                    size={17}
                    className="flex-shrink-0"
                    style={{ color: "#6b7280" }}
                  />
                  <input
                    type="text"
                    placeholder="Filter options in this category..."
                    value={optionFilter}
                    onChange={(e) => setOptionFilter(e.target.value)}
                    className="flex-1 text-[14px] font-hanken font-medium outline-none bg-transparent"
                    style={{ color: "#1c1c19" }}
                  />
                </div>
                <div className="flex items-center gap-[4px] ml-[16px]">
                  <button
                    onClick={showAll}
                    className="font-hanken font-semibold text-[14px] text-white uppercase h-[44px] px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90"
                    style={{ background: "#a45d41" }}
                  >
                    Show All
                  </button>
                  <button
                    onClick={hideAll}
                    className="font-hanken font-semibold text-[14px] text-white uppercase h-[44px] px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90"
                    style={{ background: "#a45d41" }}
                  >
                    Hide All
                  </button>
                </div>
              </div>

              {/* Options grid — 2 columns */}
              <div className="px-[24px] pt-[20px]">
                {filteredOptions.length === 0 ? (
                  <p
                    className="font-hanken text-[13px] py-[40px] text-center"
                    style={{ color: "#9a8f89" }}
                  >
                    No options match your filter.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-[13px]">
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
              </div>
            </>
          )}

          {!loading && !error && !selectedCategory && (
            <div
              className="flex items-center justify-center py-[100px] font-hanken text-[14px]"
              style={{ color: "#a89f99" }}
            >
              Select a category to view its options
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed footer ─────────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 right-0 lg:left-[260px] left-0 flex items-center justify-between px-[40px] z-40"
        style={{
          background: "#fff",
          borderTop: "1px solid #dac1ba",
          paddingTop: 17,
          paddingBottom: 16,
        }}
      >
        {/* Hidden count */}
        <div className="flex items-center gap-[8px]">
          <div
            className="flex items-center justify-center font-hanken font-medium text-[12px] rounded-full flex-shrink-0"
            style={{
              width: 26,
              height: 26,
              background: "#f1ede8",
              color: "#a45d41",
            }}
          >
            {String(totalHidden).padStart(2, "0")}
          </div>
          <span
            className="font-hanken font-semibold text-[16px]"
            style={{ color: "#a45d41" }}
          >
            options hidden across the catalog.
          </span>
        </div>

        {/* Unsaved changes + save */}
        <div className="flex items-center gap-[10px]">
          {saveError && (
            <span
              className="font-hanken text-[12px]"
              style={{ color: "#dc2626" }}
            >
              {saveError}
            </span>
          )}
          {pendingCount > 0 && !saving && (
            <span
              className="font-hanken font-medium text-[12px] text-center leading-[16px]"
              style={{ color: "#a45d41" }}
            >
              {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || pendingCount === 0}
            className="flex items-center gap-[8px] font-hanken font-semibold text-[12px] text-white text-center tracking-[0.6px] uppercase rounded-[8px] cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "#a45d41",
              height: 42,
              width: 175,
              justifyContent: "center",
            }}
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

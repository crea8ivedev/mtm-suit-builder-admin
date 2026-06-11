import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, ChevronRight, Save, Plus } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import {
  fetchStyleOptions,
  fetchContrastOptions,
  updateStyleOptionVisible,
  clearStyleOptionsCache,
  syncStyleOptionImageUrls,
  GARMENT_TO_STYLE_TYPE,
} from "../lib/shopify";
import {
  AddStyleOptionModal,
  ViewStyleOptionModal,
  EditStyleOptionModal,
  DeleteConfirmModal,
} from "../components/styleAdjustments/StyleOptionModals";
import {
  ViewContrastOptionModal,
  EditContrastOptionModal,
} from "../components/styleAdjustments/ContrastOptionModals";
import {
  GarmentDropdown,
  OptionCard,
} from "../components/styleAdjustments/StyleListUI";

export default function StyleAdjustments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overrides, setOverrides] = useState(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [optionFilter, setOptionFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewingOption, setViewingOption] = useState(null);
  const [editingOption, setEditingOption] = useState(null);
  const [deletingOption, setDeletingOption] = useState(null);
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
    Promise.all([fetchStyleOptions(), fetchContrastOptions()])
      .then(([styleData, contrastData]) => {
        const data = [...styleData, ...contrastData];
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
              data
                .filter(
                  (o) =>
                    o.garment === first && o.category !== "contrast_option",
                )
                .map((o) => o.category),
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
  }, []);

  useEffect(() => {
    if (!options.length) return;
    const timer = setTimeout(() => {
      syncStyleOptionImageUrls(options).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [options]);

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
  }, [options, selectedGarment, overrides]);

  const categoryOptions = useMemo(
    () =>
      options
        .filter(
          (o) =>
            o.garment === selectedGarment && o.category === selectedCategory,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
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

  function handleCreated(node, garment, formFields) {
    const cat = (formFields.category ?? "").trim();
    const sortOrder = parseInt(formFields.sort_order || "0", 10);
    const kuteCode = formFields.kutetailer_code || null;
    const uploadedImageUrl = formFields.image_url || null;
    const newOpt = {
      id: node.id,
      handle: node.handle,
      label: formFields.label ?? "",
      category: cat,
      garment,
      displayLabel: formFields.display_label || cat,
      upcharge: parseFloat(formFields.upcharge || 0),
      visible: true,
      isDefault: formFields.is_default === "true",
      sortOrder,
      kutetailerCode: kuteCode,
      conditionalHide: formFields.conditional_hide || "",
      imageGid: formFields.image || null,
      imageUrlStored: uploadedImageUrl,
      imageUrl:
        uploadedImageUrl ||
        (kuteCode
          ? `https://aws-static-webp.kutetailor.com/comm/process/craft/${kuteCode}.jpeg`
          : null),
      rawFields: formFields,
      fieldTypes: {},
    };
    setOptions((prev) => [...prev, newOpt]);
    clearStyleOptionsCache();
    setSelectedCategory(cat);
  }

  function handleUpdated(id, updatedFields) {
    setOptions((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updatedFields } : o)),
    );
    setOverrides((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function handleDeleted(id) {
    setOptions((prev) => prev.filter((o) => o.id !== id));
    setOverrides((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
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
      <div className="-mx-[20px] md:-mx-[28px] -mt-[20px] md:-mt-[28px] -mb-[20px] md:-mb-[28px] flex overflow-hidden relative h-[calc(100vh-64px)]">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 md:hidden bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`flex-shrink-0 transition-transform duration-300 w-[280px] h-[calc(100vh-64px)] bg-gc-bg-image border-r border-gc-border-warm flex flex-col overflow-hidden
            fixed z-40 top-[64px] md:relative md:z-auto md:top-auto md:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div
            className="px-[8px] pt-[16px] pb-[8px] relative z-[2]"
            id="aside-dropdown"
          >
            <GarmentDropdown
              garments={garments}
              selected={selectedGarment}
              onSelect={selectGarment}
              loading={loading}
            />
          </div>

          <div
            className={`overflow-x-hidden flex-1 min-h-0 pb-[120px] ${
              categoriesForGarment.length > 15
                ? "style-cat-scroll-always"
                : "style-cat-scroll-mobile"
            }`}
          >
            {loading ? (
              <p className="px-[16px] text-[12px] text-gc-muted-warm">
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
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center justify-between w-full text-left transition-colors cursor-pointer ${
                        active
                          ? "bg-white border-t border-b border-gc-primary border-l-[4px] pl-[20px] pr-[16px] py-[13px]"
                          : "px-[16px] py-[12px]"
                      }`}
                    >
                      <span
                        className={`font-hanken font-semibold text-[12px] md:text-[14px] leading-[16px] md:leading-[18px] truncate mr-[8px] ${active ? "text-gc-near-black" : "text-gc-primary"}`}
                      >
                        {cat.displayLabel}
                      </span>
                      <div className="flex items-center gap-[8px] flex-shrink-0">
                        {active && (
                          <div className="w-[6px] h-[6px] rounded-[12px] flex-shrink-0 bg-gc-primary" />
                        )}
                        <div
                          className={`flex items-center justify-center font-hanken font-medium text-[12px] w-[40px] h-[20px] bg-gc-bg-warm text-gc-primary ${active ? "rounded-[2px]" : "rounded-[0px_2px_2px_2px]"}`}
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

        <div
          ref={mainRef}
          className="flex-1 min-w-0 flex flex-col overflow-y-auto pb-[100px] scroll-hidden"
        >
          {loading && (
            <div className="flex justify-center pt-[80px]">
              <LoadingState message="Loading style options…" />
            </div>
          )}

          {error && (
            <div className="p-[20px] md:p-[40px] text-[14px] text-failed">
              {error}
            </div>
          )}

          {!loading && !error && selectedCategory && (
            <>
              <div className="px-[16px] md:px-[40px] pt-[16px] md:pt-[40px] pb-[16px] md:pb-[24px]">
                <div className="flex items-center gap-[8px] mb-[8px]">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden flex-shrink-0 flex items-center justify-center rounded-[6px] cursor-pointer w-[32px] h-[32px] bg-gc-bg-warm border border-gc-border-warm"
                    aria-label="Open categories"
                  >
                    <Filter size={14} className="text-gc-primary" />
                  </button>
                  <div className="flex items-center gap-[4px]">
                    <span className="font-hanken font-medium text-[11px] leading-[14px] text-gc-primary">
                      {selectedGarment}
                    </span>
                    <ChevronRight size={10} className="text-gc-primary" />
                    <span className="font-hanken font-medium text-[11px] leading-[14px] text-gc-near-black">
                      {categoryInfo?.displayLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-[12px]">
                  <h1 className="font-garamond font-bold text-[28px] md:text-[40px] leading-tight text-gc-heading">
                    {categoryInfo?.displayLabel}
                  </h1>
                  {selectedGarment &&
                    GARMENT_TO_STYLE_TYPE[selectedGarment] &&
                    selectedCategory !== "contrast_option" && (
                      <button
                        onClick={() => setAddModalOpen(true)}
                        className="flex items-center gap-[4px] font-hanken font-semibold text-[11px] md:text-[14px] uppercase text-white h-[32px] md:h-[44px] px-[8px] md:px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90 flex-shrink-0 bg-gc-primary"
                      >
                        <Plus size={14} />
                        {selectedGarment}
                      </button>
                    )}
                </div>
                <p className="font-hanken font-semibold text-[13px] md:text-[14px] leading-[16px] mt-[2px] text-gc-primary">
                  Total: {categoryOptions.length} options | Visible:{" "}
                  {catVisible}
                </p>
              </div>

              <div className="sticky top-0 z-10 px-[16px] md:px-[24px] py-[8px] md:py-[20px] flex flex-row items-center gap-[6px] md:gap-[12px] bg-gc-surface-warm/90 backdrop-blur-[2px]">
                <div className="flex items-center gap-[8px] h-[34px] md:h-[48px] rounded-[8px] overflow-hidden flex-1 px-[10px] md:px-[21px] bg-white/50 border border-gc-border-input">
                  <Search size={14} className="flex-shrink-0 text-gc-muted" />
                  <input
                    type="text"
                    placeholder="Filter options in this category..."
                    value={optionFilter}
                    onChange={(e) => setOptionFilter(e.target.value)}
                    className="flex-1 text-[12px] md:text-[14px] font-hanken font-medium outline-none bg-transparent text-gc-near-black"
                  />
                </div>
                <button
                  onClick={showAll}
                  className="font-hanken font-semibold text-[11px] md:text-[14px] text-white uppercase h-[34px] md:h-[44px] px-[10px] md:px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90 flex-shrink-0 bg-gc-primary"
                >
                  Show All
                </button>
                <button
                  onClick={hideAll}
                  className="font-hanken font-semibold text-[11px] md:text-[14px] text-white uppercase h-[34px] md:h-[44px] px-[10px] md:px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90 flex-shrink-0 bg-gc-primary"
                >
                  Hide All
                </button>
              </div>

              <div className="px-[16px] md:px-[24px] pt-[16px] md:pt-[20px]">
                {filteredOptions.length === 0 ? (
                  <p className="font-hanken text-[13px] py-[40px] text-center text-gc-muted-warm">
                    No options match your filter.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px] md:gap-[13px]">
                    {filteredOptions.map((opt) => (
                      <OptionCard
                        key={opt.handle}
                        option={opt}
                        visible={getVisible(opt)}
                        onChange={() => toggleOption(opt)}
                        onView={setViewingOption}
                        onEdit={setEditingOption}
                        onDelete={setDeletingOption}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !error && !selectedCategory && (
            <div className="flex flex-col items-center justify-center py-[60px] md:py-[100px] gap-[16px]">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="md:hidden flex items-center gap-[8px] font-hanken font-semibold text-[14px] text-white uppercase h-[44px] px-[20px] rounded-[8px] cursor-pointer bg-gc-primary"
              >
                <Filter size={14} />
                Browse Categories
              </button>
              <p className="font-hanken text-[14px] text-gc-scrollbar-thumb">
                Select a category to view its options
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 right-0 left-0 lg:left-[540px] z-40 bg-white border-t border-gc-border-warm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[6px] sm:gap-[8px] px-[16px] md:px-[40px] py-[8px] md:py-[10px]">
          <div className="flex items-center gap-[8px]">
            <div className="flex items-center justify-center font-hanken font-medium text-[12px] rounded-full flex-shrink-0 w-[26px] h-[26px] bg-gc-bg-warm text-gc-primary">
              {String(totalHidden).padStart(2, "0")}
            </div>
            <span className="font-hanken font-semibold text-[13px] md:text-[16px] text-gc-primary">
              options hidden across the catalog.
            </span>
          </div>

          <div className="flex items-center gap-[10px] sm:justify-end">
            {saveError && (
              <span className="font-hanken text-[12px] text-failed">
                {saveError}
              </span>
            )}
            {pendingCount > 0 && !saving && (
              <span className="font-hanken font-medium text-[12px] text-center leading-[16px] text-gc-primary">
                {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || pendingCount === 0}
              className="flex items-center justify-center gap-[6px] font-hanken font-semibold text-[11px] md:text-[12px] text-white text-center tracking-[0.6px] uppercase rounded-[8px] cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed px-[12px] md:px-[20px] h-[34px] bg-gc-primary"
            >
              <Save size={14} />
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {addModalOpen && selectedGarment && (
        <AddStyleOptionModal
          garment={selectedGarment}
          garmentOptions={options.filter((o) => o.garment === selectedGarment)}
          onClose={() => setAddModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
      {viewingOption &&
        (viewingOption.isContrastOption ? (
          <ViewContrastOptionModal
            option={viewingOption}
            onClose={() => setViewingOption(null)}
            onEdit={(opt) => {
              setViewingOption(null);
              setEditingOption(opt);
            }}
          />
        ) : (
          <ViewStyleOptionModal
            option={viewingOption}
            garment={selectedGarment}
            onClose={() => setViewingOption(null)}
            onEdit={(opt) => {
              setViewingOption(null);
              setEditingOption(opt);
            }}
          />
        ))}
      {editingOption &&
        (editingOption.isContrastOption ? (
          <EditContrastOptionModal
            option={editingOption}
            onClose={() => setEditingOption(null)}
            onUpdated={handleUpdated}
          />
        ) : (
          <EditStyleOptionModal
            option={editingOption}
            garment={selectedGarment}
            onClose={() => setEditingOption(null)}
            onUpdated={handleUpdated}
          />
        ))}
      {deletingOption && (
        <DeleteConfirmModal
          option={deletingOption}
          onClose={() => setDeletingOption(null)}
          onDeleted={handleDeleted}
        />
      )}
    </DashboardLayout>
  );
}

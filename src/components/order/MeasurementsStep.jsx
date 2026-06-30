import { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import SectionHeader from "../ui/SectionHeader";
import LoadingState from "../ui/LoadingState";
import { MeasurementStepper } from "../ui/MeasurementStepper";
import { useClickOutside } from "../../hooks/useClickOutside";
import { cn } from "../../utils/cn";
import { getRangeForKey, groupAttributes } from "../../utils/measurementUtils";

function FitSizeDropdown({ label, opts, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="flex flex-col gap-[6px] min-w-0">
      <span className="font-hanken text-[9px] sm:text-[12px] font-semibold text-[rgba(28,28,25,0.7)] uppercase leading-tight truncate">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-hanken w-full flex items-center justify-between gap-[6px] px-[8px] sm:px-[13px] h-[36px] sm:h-[40px] rounded-[8px] text-[13px] font-medium text-gc-near-black2 bg-white cursor-pointer border border-gc-section-divider/80"
        >
          <span
            className={`truncate text-[14px] sm:text-[18px] font-garamond ${selected ? "text-[#1c1c19]" : "text-[#9ca3af]"}`}
          >
            {selected || "—"}
          </span>
          <ChevronDown
            size={14}
            className={`flex-shrink-0 text-[#424656] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-[4px] bg-white rounded-[8px] shadow-lg z-50 overflow-hidden border border-gc-border-input">
            <ul className="max-h-[200px] overflow-y-auto py-[4px]">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onSelect("");
                    setOpen(false);
                  }}
                  className="font-hanken w-full text-left px-[14px] py-[9px] text-[13px] text-[#9ca3af] hover:bg-gc-bg flex items-center justify-between cursor-pointer"
                >
                  — Select —
                  {!selected && <Check size={12} className="text-gc-primary" />}
                </button>
              </li>
              {opts.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(opt.label);
                      setOpen(false);
                    }}
                    className="font-hanken w-full text-left px-[14px] py-[9px] text-[13px] text-gc-near-black2 hover:bg-gc-bg flex items-center justify-between gap-[8px] cursor-pointer"
                  >
                    <span className="flex flex-col items-start min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.sizeLabel && (
                        <span className="text-[10px] text-[#9ca3af]">
                          {opt.sizeLabel}
                        </span>
                      )}
                    </span>
                    {selected === opt.label && (
                      <Check
                        size={12}
                        className="flex-shrink-0 text-gc-primary"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function AttributeEditor({
  attributes,
  onChange,
  rangeGroups = [],
  onValidChange,
  fitSizeOptions = [],
  fitSizeSelections = {},
  onFitSizeChange,
}) {
  const [touchedFields, setTouchedFields] = useState(new Set());

  const keySignature = attributes.map((a) => a.key).join("\0");
  const { general, sections } = useMemo(
    () => groupAttributes(attributes, rangeGroups),
    [keySignature, rangeGroups],
  );

  function updateAttr(originalKey, value) {
    setTouchedFields((prev) => new Set([...prev, originalKey]));
    onChange(
      attributes.map((a) => (a.key === originalKey ? { ...a, value } : a)),
    );
  }

  useEffect(() => {
    if (!onValidChange) return;
    if (!sections.length) {
      onValidChange(true);
      return;
    }
    const hasError = sections.some((sec) =>
      sec.items.some(({ key, originalKey }) => {
        const val = attributes.find((a) => a.key === originalKey)?.value ?? "";
        if (!val) return false;
        const range = getRangeForKey(sec.ranges, key);
        if (!range) return false;
        const n = parseFloat(val);
        return !isNaN(n) && (n < range.min || n > range.max);
      }),
    );
    onValidChange(!hasError);
  }, [attributes, sections]);

  if (attributes.length === 0) {
    return (
      <div className="bg-white rounded-[12px] px-[31px] py-[24px] border border-gc-divider">
        <p className="font-hanken text-[14px] text-[#6b7280]">
          No fields loaded for this product.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[12px] p-[31px] flex flex-col gap-[48px] border border-gc-divider">
      {general.length > 0 && (
        <div className="flex flex-col gap-[16px]">
          <SectionHeader title="Details" badge={`${general.length} fields`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-[8px] sm:gap-x-[32px] gap-y-[16px] sm:gap-y-[24px]">
            {general.map(({ key, originalKey }) => (
              <div
                key={originalKey}
                className="flex flex-col gap-[4px] min-w-0 sm:relative sm:h-[74px]"
              >
                <label className="font-hanken text-[9px] sm:text-[12px] font-semibold text-[rgba(28,28,25,0.7)] uppercase leading-tight truncate sm:absolute sm:top-0">
                  {key}
                </label>
                <input
                  type="text"
                  value={
                    attributes.find((a) => a.key === originalKey)?.value || ""
                  }
                  onChange={(e) => updateAttr(originalKey, e.target.value)}
                  className="w-full h-[36px] sm:h-[40px] bg-white rounded-[8px] px-[8px] sm:px-[13px] font-garamond text-[14px] sm:text-[18px] text-[#1c1c19] outline-none transition-colors sm:absolute sm:top-[20px] border border-gc-section-divider/80"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((sec) => {
        if (!sec.items.length) return null;
        return (
          <div key={sec.label} className="flex flex-col gap-[16px]">
            <SectionHeader
              title={`${sec.label} Measurements`}
              badge={`${sec.items.length} measurements`}
              color="text-[#a45d41]"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-[8px] sm:gap-x-[32px] gap-y-[16px] sm:gap-y-[24px]">
              {sec.items.map(({ key, originalKey }) => {
                const val =
                  attributes.find((a) => a.key === originalKey)?.value ?? "";
                const range = getRangeForKey(sec.ranges, key);
                const isTouched = touchedFields.has(originalKey);
                const n = parseFloat(val);
                const isInvalid =
                  isTouched &&
                  range &&
                  val !== "" &&
                  !isNaN(n) &&
                  (n < range.min || n > range.max);
                const isValid =
                  isTouched &&
                  range &&
                  val !== "" &&
                  !isNaN(n) &&
                  n >= range.min &&
                  n <= range.max;
                return (
                  <div
                    key={originalKey}
                    className="flex flex-col gap-[4px] min-w-0 sm:relative sm:h-[84px]"
                  >
                    <label className="font-hanken text-[9px] sm:text-[12px] font-semibold text-[rgba(28,28,25,0.7)] uppercase leading-tight truncate sm:absolute sm:top-0">
                      {getRangeForKey(sec.ranges, key)?.label ?? key}
                    </label>
                    {range ? (
                      <MeasurementStepper
                        value={val}
                        onChange={(v) => updateAttr(originalKey, v)}
                        rangeMin={range.min}
                        rangeMax={range.max}
                        className={cn(
                          "sm:absolute sm:top-[20px] sm:left-0 sm:right-0",
                          isValid
                            ? "[&_input]:text-green-700 [&_input]:border-green-500"
                            : isInvalid
                              ? "[&_input]:text-red-500 [&_input]:border-red-400"
                              : "",
                        )}
                      />
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          updateAttr(originalKey, e.target.value)
                        }
                        className="w-full h-[36px] sm:h-[40px] bg-white rounded-[8px] px-[8px] sm:px-[13px] font-garamond text-[14px] sm:text-[18px] text-[#1c1c19] outline-none transition-colors sm:absolute sm:top-[20px] border border-gc-section-divider/80"
                      />
                    )}
                    <p
                      className={cn(
                        "font-hanken text-[10px] font-medium sm:absolute sm:top-[50px] sm:left-[4px]",
                        isValid
                          ? "text-green-600"
                          : isInvalid
                            ? "text-red-500"
                            : "text-[rgba(28,28,25,0.4)]",
                      )}
                    >
                      {range ? `${range.min}–${range.max}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>

            {(() => {
              const garmentFitOpts = fitSizeOptions.filter(
                (o) => o.garment === sec.label,
              );
              if (!garmentFitOpts.length) return null;
              const byType = {};
              for (const o of garmentFitOpts) {
                if (!byType[o.sizeType]) byType[o.sizeType] = [];
                byType[o.sizeType].push(o);
              }
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-[8px] sm:gap-x-[32px] gap-y-[16px] sm:gap-y-[24px] pt-[16px] border-t border-gc-primary-dark/10">
                  {Object.entries(byType).map(([sizeType, opts]) => (
                    <FitSizeDropdown
                      key={`${sec.label}__${sizeType}`}
                      label={sizeType}
                      opts={opts}
                      selected={
                        fitSizeSelections[`${sec.label}__${sizeType}`] ?? ""
                      }
                      onSelect={(val) =>
                        onFitSizeChange?.({
                          ...fitSizeSelections,
                          [`${sec.label}__${sizeType}`]: val,
                        })
                      }
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

function StyleDropdown({ label, opts, selected, onSelect, searchable }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef(null);
  useClickOutside(ref, () => {
    setOpen(false);
    setSearchTerm("");
  });

  const selectedLabel = opts.find((o) => o.label === selected)?.label ?? "";

  const filteredOpts = useMemo(() => {
    if (!searchTerm) return opts;
    const lower = searchTerm.toLowerCase();
    return opts.filter(
      (o) =>
        o.label.toLowerCase().includes(lower) ||
        (o.colorName && o.colorName.toLowerCase().includes(lower)),
    );
  }, [opts, searchTerm]);

  return (
    <div ref={ref} className="flex flex-col gap-[6px] min-w-0">
      <span className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide truncate">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-hanken w-full flex items-center justify-between gap-[6px] px-[10px] py-[9px] rounded-[8px] text-[12px] sm:text-[13px] font-medium text-gc-near-black2 bg-white cursor-pointer border border-gc-border-input"
        >
          <span
            className={`truncate ${selectedLabel ? "text-gc-near-black2" : "text-[#9ca3af]"}`}
          >
            {selectedLabel || "— Select —"}
          </span>
          <ChevronDown
            size={14}
            className={`flex-shrink-0 text-[#424656] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-[4px] bg-white rounded-[8px] shadow-lg z-50 overflow-hidden border border-gc-border-input flex flex-col">
            {searchable && (
              <div className="p-[8px] border-b border-gc-border-input bg-gray-50 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="w-full bg-white border border-gc-border-input rounded-[4px] px-[8px] py-[6px] text-[12px] font-hanken outline-none focus:border-gc-primary transition-colors"
                />
              </div>
            )}
            <ul className="max-h-[200px] overflow-y-auto py-[4px]">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onSelect("");
                    setOpen(false);
                  }}
                  className="font-hanken w-full text-left px-[14px] py-[9px] text-[13px] text-[#9ca3af] hover:bg-gc-bg flex items-center justify-between cursor-pointer"
                >
                  — Select —
                  {!selected && <Check size={12} className="text-gc-primary" />}
                </button>
              </li>
              {filteredOpts.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(opt.label);
                      setOpen(false);
                    }}
                    className="font-hanken w-full text-left px-[14px] py-[9px] text-[13px] text-gc-near-black2 hover:bg-gc-bg flex items-center justify-between gap-[8px] cursor-pointer"
                  >
                    <span className="flex items-center gap-[6px] min-w-0">
                      <span className="truncate">
                        {opt.isLiningCode && opt.colorName
                          ? `${opt.label} - ${opt.colorName}`
                          : opt.label}
                      </span>
                      {opt.upcharge > 0 && (
                        <span className="font-hanken text-[10px] font-semibold flex-shrink-0 px-[5px] py-[1px] rounded-[4px] bg-gc-primary/[8%] text-gc-primary">
                          +{opt.upcharge}
                        </span>
                      )}
                    </span>
                    {selected === opt.label && (
                      <Check
                        size={12}
                        className="flex-shrink-0 text-gc-primary"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function StyleOptionsSection({
  styleOptions,
  contrastOptions,
  contrastLocations = [],
  liningCodes = [],
  buttonCodes = [],
  selections,
  onChange,
  loading,
}) {
  // Build label→id lookup for resolving selections to option IDs
  const optionLabelToId = useMemo(() => {
    const map = new Map();
    for (const o of [
      ...styleOptions,
      ...contrastOptions,
      ...liningCodes,
      ...buttonCodes,
    ]) {
      map.set(`${o.garment}__${o.category}__${o.label}`, o.id);
    }
    return map;
  }, [styleOptions, contrastOptions, liningCodes, buttonCodes]);

  // IDs of all currently selected options (used to evaluate hide_when rules)
  const selectedOptionIds = useMemo(() => {
    const ids = new Set();
    for (const [key, label] of Object.entries(selections)) {
      if (!label) continue;
      const id = optionLabelToId.get(`${key}__${label}`);
      if (id) ids.add(id);
    }
    return ids;
  }, [selections, optionLabelToId]);

  const byGarment = useMemo(() => {
    const map = {};
    const mappedLocations = contrastLocations
      .filter((l) => l.visible)
      .map((l) => ({
        ...l,
        category: "contrast_location",
        displayLabel: "Contrast Color Location",
        sortOrder: 0,
        garment: l.garment || "General",
      }));
    const all = [
      ...styleOptions.filter((o) => o.visible),
      ...contrastOptions.filter((o) => o.visible),
      ...mappedLocations,
      ...liningCodes.filter((o) => o.visible),
      ...buttonCodes.filter((o) => o.visible),
    ];
    // catSort tracks min categorySort per [garment][category]
    const catSort = {};
    for (const opt of all) {
      const g = opt.garment || "General";
      if (!map[g]) map[g] = {};
      const cat = opt.category || "General";
      if (!map[g][cat]) map[g][cat] = [];
      map[g][cat].push(opt);
      if (!catSort[g]) catSort[g] = {};
      const cs = opt.categorySort ?? 9999;
      if (catSort[g][cat] === undefined || cs < catSort[g][cat])
        catSort[g][cat] = cs;
    }
    for (const g in map) {
      for (const cat in map[g]) {
        map[g][cat].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      }
      // Sort categories by their minimum categorySort value
      const sorted = {};
      Object.keys(map[g])
        .sort((a, b) => (catSort[g][a] ?? 9999) - (catSort[g][b] ?? 9999))
        .forEach((cat) => {
          sorted[cat] = map[g][cat];
        });
      map[g] = sorted;
    }
    return map;
  }, [
    styleOptions,
    contrastOptions,
    contrastLocations,
    liningCodes,
    buttonCodes,
  ]);

  const garments = Object.keys(byGarment);

  if (loading) {
    return (
      <div className="bg-white rounded-[12px] p-[31px] border border-gc-divider">
        <LoadingState message="Loading style options…" />
      </div>
    );
  }
  if (!garments.length) return null;

  return (
    <div className="bg-white rounded-[12px] p-[31px] flex flex-col gap-[40px] border border-gc-divider">
      <SectionHeader title="Style Options" />

      {garments.map((garment) => {
        const catMap = byGarment[garment];
        const categories = Object.keys(catMap);
        return (
          <div key={garment} className="flex flex-col gap-[12px]">
            <div className="flex items-center justify-between gap-[8px]">
              <span className="font-hanken text-[12px] font-semibold text-[#a45d41] uppercase tracking-[0.8px]">
                {garment}
              </span>
              <span className="font-hanken text-[10px] font-medium text-[rgba(28,28,25,0.35)] tracking-[0.6px] uppercase">
                {categories.length} option{categories.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-[12px] sm:gap-x-[24px] gap-y-[12px] sm:gap-y-[20px]">
              {categories.map((cat) => {
                const opts = catMap[cat];
                // Filter out options hidden by hide_when rules
                const visibleOpts = opts.filter(
                  (o) =>
                    !o.hideWhenGids?.length ||
                    !o.hideWhenGids.some((gid) => selectedOptionIds.has(gid)),
                );
                const selectionKey = `${garment}__${cat}`;
                const isLiningOrButton = opts.some(
                  (o) => o.isLiningCode || o.isButtonCode,
                );
                const isSearchable = opts.length > 10 || isLiningOrButton;
                const fieldLabel =
                  cat === "contrast_option"
                    ? "Contrast Color"
                    : opts[0]?.displayLabel || cat;

                if (isLiningOrButton) {
                  const typedVal = selections[selectionKey] ?? "";
                  const isValid =
                    !typedVal || opts.some((o) => o.label === typedVal);
                  return (
                    <div
                      key={`${garment}-${cat}`}
                      className="flex flex-col gap-[6px] min-w-0"
                    >
                      <span className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide truncate">
                        {fieldLabel}
                      </span>
                      <input
                        type="text"
                        value={typedVal}
                        onChange={(e) =>
                          onChange({
                            ...selections,
                            [selectionKey]: e.target.value,
                          })
                        }
                        placeholder="Enter code..."
                        className={`font-hanken w-full px-[10px] py-[9px] rounded-[8px] text-[12px] sm:text-[13px] font-medium text-gc-near-black2 bg-white border outline-none focus:border-gc-primary transition-colors ${typedVal && !isValid ? "border-red-500" : "border-gc-border-input"}`}
                      />
                      {typedVal && !isValid && (
                        <span className="font-hanken text-[10px] text-red-500">
                          Invalid code — not found in Kutetailor
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <StyleDropdown
                    key={`${garment}-${cat}`}
                    searchable={isSearchable}
                    label={fieldLabel}
                    opts={visibleOpts}
                    selected={selections[selectionKey] ?? ""}
                    onSelect={(val) => {
                      const next = { ...selections, [selectionKey]: val };
                      // Compute IDs selected after this change
                      const nextIds = new Set();
                      for (const [k, l] of Object.entries(next)) {
                        if (!l) continue;
                        const id = optionLabelToId.get(`${k}__${l}`);
                        if (id) nextIds.add(id);
                      }
                      // Auto-clear any selection whose option is now hidden
                      const allOpts = [
                        ...styleOptions,
                        ...contrastOptions,
                        ...liningCodes,
                        ...buttonCodes,
                      ];
                      for (const [k, l] of Object.entries(next)) {
                        if (!l || k === selectionKey) continue;
                        const [g, ...cParts] = k.split("__");
                        const c = cParts.join("__");
                        const o = allOpts.find(
                          (x) =>
                            x.garment === g &&
                            x.category === c &&
                            x.label === l,
                        );
                        if (o?.hideWhenGids?.some((gid) => nextIds.has(gid))) {
                          next[k] = "";
                        }
                      }
                      onChange(next);
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  X,
  FileText,
  AlertCircle,
  ChevronDown,
  Search,
  Plus,
  History,
  Check,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import {
  fetchCustomersPage,
  fetchGcBuilderProducts,
  fetchCustomerWithOrders,
  transformCustomer,
  clearOrdersCache,
  clearCustomerDetailCache,
  getProductFields,
  createDraftOrder,
  completeDraftOrder,
  setCustomerProductsMetafield,
  fetchVestRanges,
  fetchShirtRanges,
  fetchTrouserRanges,
  fetchJacketRanges,
  fetchVestMeasurementFields,
  fetchTrouserMeasurementFields,
  fetchShirtMeasurementFields,
  fetchJacketMeasurementFields,
  fetchStyleOptions,
  fetchContrastOptions,
} from "../lib/shopify";
import { cn } from "../utils/cn";

function buildProfilesFromOrders(orders) {
  const result = {};
  let counter = Math.floor(Date.now() / 1000);
  for (const order of orders) {
    const created = (order.createdAt ?? "").split("T")[0];
    for (const { node: item } of order.lineItems?.edges ?? []) {
      const allAttrs = item.customAttributes ?? [];
      const measureAttrs = allAttrs.filter((a) => !a.key.startsWith("_"));
      if (!measureAttrs.length) continue;
      const productName = item.title;
      if (!result[productName]) result[productName] = [];
      const profileName = allAttrs.find(
        (a) => a.key === "_profile_name",
      )?.value;
      const idx = result[productName].length + 1;
      result[productName].push({
        id: `prof_${counter++}`,
        name: profileName || `Measurement ${idx}`,
        created,
        measurements: Object.fromEntries(
          measureAttrs.map(({ key, value }) => [
            key,
            value?.endsWith('"') ? value.slice(0, -1) : value,
          ]),
        ),
      });
    }
  }
  return result;
}

function getRangeForKey(rangeMap, key) {
  if (!rangeMap) return null;
  if (rangeMap[key]) return rangeMap[key];
  const n = key.toLowerCase().trim();
  for (const [k, v] of Object.entries(rangeMap)) {
    if (k.toLowerCase().trim() === n) return v;
  }
  return null;
}

function deduplicateByRange(attrs, rangeMap) {
  const seenRangeKeys = new Set();
  const seenNormKeys = new Set();
  return attrs.filter((a) => {
    const normKey = a.key.trim().toLowerCase();
    const entry = getRangeForKey(rangeMap, a.key);
    if (entry) {
      const rk = `${entry.label}|${entry.min}|${entry.max}`;
      if (seenRangeKeys.has(rk)) return false;
      seenRangeKeys.add(rk);
    } else {
      if (seenNormKeys.has(normKey)) return false;
    }
    seenNormKeys.add(normKey);
    return true;
  });
}

const SECTION_COLORS = {
  Jacket: {
    border: "border-blue-500",
    icon: "text-blue-600",
    heading: "text-blue-700",
    badge: "bg-blue-50 text-blue-700",
  },
  Trouser: {
    border: "border-brand-600",
    icon: "text-brand-700",
    heading: "text-brand-700",
    badge: "bg-brand-50 text-brand-700",
  },
  Vest: {
    border: "border-amber-500",
    icon: "text-amber-600",
    heading: "text-amber-700",
    badge: "bg-amber-50 text-amber-700",
  },
  Shirt: {
    border: "border-green-500",
    icon: "text-green-600",
    heading: "text-green-700",
    badge: "bg-green-50 text-green-700",
  },
  default: {
    border: "border-brand-600",
    icon: "text-brand-700",
    heading: "text-brand-700",
    badge: "bg-brand-50 text-brand-700",
  },
};

function groupAttributes(attributes, rangeGroups) {
  const general = [];
  const sections = rangeGroups.map((g) => ({
    label: g.label,
    ranges: g.ranges,
    items: [],
  }));
  const hasGroups = sections.length > 0;

  const findSec = (label) => sections.find((s) => s.label === label);

  const PREFIX_ROUTES = [
    ["Vest ", "Vest"],
    ["Jacket ", "Jacket"],
    ["Trouser ", "Trouser"],
    ["Shirt ", "Shirt"],
  ];

  for (const attr of attributes) {
    if (attr.key.startsWith("_")) continue;
    const kl = attr.key.toLowerCase();

    if (kl === "size type") {
      general.push({ key: attr.key, originalKey: attr.key });
      continue;
    }

    if (hasGroups && kl.startsWith("standard")) continue;

    let placed = false;
    for (const [prefix, label] of PREFIX_ROUTES) {
      if (attr.key.startsWith(prefix)) {
        const sec = findSec(label);
        if (sec) {
          sec.items.push({
            key: attr.key.slice(prefix.length),
            originalKey: attr.key,
          });
          placed = true;
          break;
        }
      }
    }
    if (placed) continue;

    if (hasGroups) {
      for (const sec of sections) {
        if (getRangeForKey(sec.ranges, attr.key)) {
          sec.items.push({ key: attr.key, originalKey: attr.key });
          placed = true;
          break;
        }
      }
    }

    if (!placed) general.push({ key: attr.key, originalKey: attr.key });
  }

  return { general, sections };
}

function parseGcBuilderFields(jsonValue) {
  try {
    const parsed = JSON.parse(jsonValue);
    const fields = [];
    function extract(obj) {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        obj.forEach((item) => {
          if (typeof item === "string") fields.push({ key: item, value: "" });
          else extract(item);
        });
        return;
      }
      const keyProp = obj.key || obj.name || obj.label;
      const hasChildren = [
        "fields",
        "sections",
        "measurements",
        "components",
        "children",
        "items",
      ].some((k) => Array.isArray(obj[k]));
      if (keyProp && typeof keyProp === "string" && !hasChildren) {
        fields.push({ key: keyProp, value: "" });
        return;
      }
      [
        "fields",
        "measurements",
        "sections",
        "components",
        "children",
        "items",
        "attributes",
      ].forEach((k) => {
        if (Array.isArray(obj[k])) extract(obj[k]);
      });
    }
    extract(parsed);
    return fields.length > 0 ? fields : null;
  } catch {
    return null;
  }
}

function isCustomSizeLineItem(node) {
  const sizeType = (node.customAttributes ?? [])
    .find((a) => a.key.toLowerCase() === "size type")
    ?.value?.toLowerCase();
  return sizeType !== "standard";
}

function findPastLineItem(customerOrders, selectedProductId, productTitle) {
  const numericId = selectedProductId.split("/").pop();
  const titleLower = (productTitle ?? "").toLowerCase();
  for (const order of customerOrders) {
    for (const { node } of order.lineItems?.edges ?? []) {
      const nodeNumericId = node.product?.id?.split("/").pop();
      const idMatch = nodeNumericId === numericId;
      const titleMatch =
        titleLower && (node.title ?? "").toLowerCase() === titleLower;
      if ((idMatch || titleMatch) && isCustomSizeLineItem(node)) {
        return node;
      }
    }
  }
  return null;
}

function attrsFromLineItem(node, emptyValues = false) {
  return (node.customAttributes ?? [])
    .filter(
      (a) =>
        !a.key.startsWith("_") && !a.key.toLowerCase().startsWith("standard"),
    )
    .map((a) =>
      a.key.toLowerCase() === "size type"
        ? { key: a.key, value: "Custom" }
        : { key: a.key, value: emptyValues ? "" : a.value },
    );
}

// ─── Step Indicator ─────────────────────────────────────────────────────────
function StepIndicator({ currentStep }) {
  const steps = [
    { num: "01", label: "SELECT CUSTOMER" },
    { num: "02", label: "SELECT PRODUCT" },
    { num: "03", label: "MEASUREMENTS & DETAILS" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-[24px] sm:gap-[48px] pb-[25px] border-b border-gc-section-divider/30">
      {steps.map((step, idx) => {
        const active = idx + 1 <= currentStep;
        return (
          <div
            key={step.num}
            className={cn(
              "flex items-center gap-[12px]",
              !active && "opacity-30",
            )}
          >
            {active ? (
              <div className="flex items-center justify-center rounded-full size-[32px] flex-shrink-0 bg-gc-primary">
                <span className="font-hanken text-[14px] font-medium text-white tracking-[0.6px]">
                  {step.num}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-full size-[32px] border border-black flex-shrink-0">
                <span className="font-hanken text-[14px] font-medium text-[#1c1c19] tracking-[0.6px]">
                  {step.num}
                </span>
              </div>
            )}
            <span
              className={cn(
                "font-hanken text-[13px] sm:text-[14px] tracking-[1.2px] uppercase whitespace-nowrap",
                active
                  ? "font-bold text-[#a45d41]"
                  : "font-medium text-[#1c1c19]",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const AVATAR_PALETTE = [
  { bg: "rgba(42,10,10,0.05)", border: "rgba(42,10,10,0.1)", text: "#2a0a0a" },
  {
    bg: "rgba(146,73,50,0.05)",
    border: "rgba(146,73,50,0.1)",
    text: "#924932",
  },
  {
    bg: "rgba(119,90,25,0.05)",
    border: "rgba(119,90,25,0.1)",
    text: "#775a19",
  },
  {
    bg: "rgba(164,93,65,0.05)",
    border: "rgba(164,93,65,0.1)",
    text: "#a45d41",
  },
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(idx) {
  return AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
}

function OrdersBadge({ count }) {
  if (count == null)
    return (
      <span className="font-hanken text-[12px] tracking-[0.9px] text-[#7e7576]">
        No history
      </span>
    );
  const many = count >= 2;
  const label = count === 1 ? "1 ORDER" : `${count} ORDERS`;
  return (
    <span
      className={`font-hanken text-[10px] font-medium tracking-[0.8px] uppercase px-[6px] py-[3px] rounded-[4px] ${many ? "bg-gc-avatar-gold/10 text-gc-avatar-gold" : "bg-gc-section-divider/20 text-[#4c4546]"}`}
    >
      {label}
    </span>
  );
}

// ─── Customer Selector ──────────────────────────────────────────────────────
function CustomerSelector({ value, onChange }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);
  const initialFetched = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function doFetch(query) {
    setResultsLoading(true);
    fetchCustomersPage({ pageSize: 20, searchQuery: query })
      .then(({ customers: raw }) => {
        setResults(raw.map(transformCustomer));
        setResultsLoading(false);
      })
      .catch(() => setResultsLoading(false));
  }

  function handleFocus() {
    setOpen(true);
    if (!initialFetched.current) {
      initialFetched.current = true;
      doFetch("");
    }
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(val), 300);
  }

  if (value) {
    const color = avatarColor(0);
    return (
      <div className="flex items-center gap-[16px] px-[16px] py-[16px] bg-white rounded-[8px] border border-gc-border-input">
        <div
          className="w-[48px] h-[48px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: color.bg,
            border: `1px solid ${color.border}`,
          }}
        >
          <span
            className="font-garamond text-[18px]"
            style={{ color: color.text }}
          >
            {getInitials(value.name)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-hanken text-[16px] font-semibold text-black leading-tight">
            {value.name}
          </p>
          {value.email && (
            <p className="font-hanken text-[10px] font-semibold text-[#4c4546] tracking-[0.9px] lowercase mt-[2px]">
              {value.email}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 mr-[8px]">
          <OrdersBadge count={value.numberOfOrders} />
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-gc-near-black2 hover:text-gc-primary transition-colors cursor-pointer p-[6px] rounded-[6px] hover:bg-[rgba(164,93,65,0.08)]"
          title="Change customer"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center h-[60px] bg-white rounded-[8px] px-[17px] gap-[10px] overflow-hidden border border-gc-border-input">
        <Search size={16} className="text-[#6b7280] flex-shrink-0" />
        <input
          type="text"
          placeholder="Search customer by name or email...."
          value={search}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          className="flex-1 font-hanken text-[14px] text-gc-near-black2 placeholder:text-gc-muted outline-none bg-transparent"
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-[4px] bg-white rounded-[8px] shadow-xl flex flex-col overflow-hidden border border-gc-border-input max-h-[min(458px,60vh)]">
          <div className="overflow-y-auto flex-1 px-px pt-[9px]">
            {resultsLoading ? (
              <div className="font-hanken p-[16px] text-[14px] text-[#6b7280] text-center">
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="font-hanken p-[16px] text-[14px] text-[#6b7280] text-center">
                No customers found
              </div>
            ) : (
              results.map((customer, idx) => {
                const color = avatarColor(idx);
                return (
                  <button
                    key={customer.id}
                    onClick={() => {
                      onChange(customer);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full flex items-center justify-between px-[12px] sm:px-[16px] py-[12px] sm:py-[16px] text-left transition-colors cursor-pointer hover:bg-gc-bg-warm border-b border-gc-section-divider/10"
                  >
                    <div className="flex items-center gap-[10px] sm:gap-[16px] min-w-0">
                      <div
                        className="w-[36px] h-[36px] sm:w-[48px] sm:h-[48px] rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: color.bg,
                          border: `1px solid ${color.border}`,
                        }}
                      >
                        <span
                          className="font-garamond text-[14px] sm:text-[18px]"
                          style={{ color: color.text }}
                        >
                          {getInitials(customer.name)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-hanken text-[14px] sm:text-[16px] font-semibold text-black leading-tight truncate max-w-full">
                          {customer.name}
                        </span>
                        {customer.email && (
                          <span className="font-hanken text-[10px] font-semibold text-[#4c4546] tracking-[0.9px] lowercase truncate max-w-full">
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-[8px]">
                      <OrdersBadge count={customer.numberOfOrders} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/customers", {
                state: { autoCreateModal: true, returnTo: "/orders/new" },
              });
            }}
            className="w-full flex items-center justify-center gap-[8px] h-[44px] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-90 rounded-bl-[8px] rounded-br-[8px] bg-gc-primary"
          >
            <Plus size={11} color="white" />
            <span className="font-hanken text-[14px] font-semibold text-white uppercase tracking-[0.5px]">
              New Customer
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function AttributeEditor({
  attributes,
  onChange,
  rangeGroups = [],
  onValidChange,
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
          <div className="flex items-center justify-between pb-[9px] border-b border-gc-primary-dark/20">
            <div className="flex items-center gap-[13px]">
              <div className="w-[3px] h-[20px] rounded-sm bg-gc-primary" />
              <h3 className="font-garamond text-[20px] sm:text-[28px] font-semibold text-gc-primary">
                Details
              </h3>
            </div>
            <span className="font-hanken text-[10px] font-bold text-[rgba(28,28,25,0.5)] tracking-[1px] uppercase">
              {general.length} fields
            </span>
          </div>
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
            <div className="flex items-center justify-between pb-[9px] border-b border-gc-primary-dark/20">
              <div className="flex items-center gap-[13px]">
                <div className="w-[3px] h-[20px] rounded-sm bg-gc-primary" />
                <h3 className="font-garamond text-[20px] sm:text-[28px] font-semibold text-[#a45d41]">
                  {sec.label} Measurements
                </h3>
              </div>
              <span className="font-hanken text-[10px] font-bold text-[rgba(28,28,25,0.5)] tracking-[1px] uppercase">
                {sec.items.length} measurements
              </span>
            </div>
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
                    className="flex flex-col gap-[4px] min-w-0 sm:relative sm:h-[74px]"
                  >
                    <label className="font-hanken text-[9px] sm:text-[12px] font-semibold text-[rgba(28,28,25,0.7)] uppercase leading-tight truncate sm:absolute sm:top-0">
                      {getRangeForKey(sec.ranges, key)?.label ?? key}
                    </label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => updateAttr(originalKey, e.target.value)}
                      className={cn(
                        "w-full h-[36px] sm:h-[40px] bg-white rounded-[8px] px-[8px] sm:px-[13px] font-garamond text-[14px] sm:text-[18px] outline-none transition-colors sm:absolute sm:top-[20px] border",
                        isValid
                          ? "text-green-700 border-green-500"
                          : isInvalid
                            ? "text-red-500 border-red-400"
                            : "text-[#1c1c19] border-gc-section-divider/80",
                      )}
                    />
                    <p
                      className={cn(
                        "font-hanken text-[10px] font-medium sm:absolute sm:top-[67px] sm:left-[4px]",
                        isValid
                          ? "text-green-600"
                          : isInvalid
                            ? "text-red-500"
                            : "text-[rgba(28,28,25,0.4)]",
                      )}
                    >
                      {range ? `Range: ${range.min}–${range.max}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Read garments purely from the gc_builder metafield value (a choice string).
// e.g. "jacket" → ["Jacket"],  "Suit — 3 piece (jacket + trouser + vest)" → ["Jacket","Trouser","Vest"]
function garmentsFromGcBuilderValue(value) {
  if (!value) return [];
  const v = value.toLowerCase();
  const found = [];
  if (v.includes("jacket")) found.push("Jacket");
  if (v.includes("trouser")) found.push("Trouser");
  if (v.includes("vest")) found.push("Vest");
  if (v.includes("shirt")) found.push("Shirt");
  // plain "suit" with no explicit garment words → jacket + trouser
  if (!found.length && v.includes("suit")) {
    found.push("Jacket");
    found.push("Trouser");
  }
  return found;
}

function styleGarmentsForProduct(product) {
  return garmentsFromGcBuilderValue(product?.metafield?.value);
}

function StyleDropdown({ label, opts, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedLabel = opts.find((o) => o.label === selected)?.label ?? "";

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
                    <span className="flex items-center gap-[6px] min-w-0">
                      <span className="truncate">{opt.label}</span>
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

function StyleOptionsSection({
  styleOptions,
  contrastOptions,
  selections,
  onChange,
  loading,
}) {
  // Group by garment → then by category
  const byGarment = useMemo(() => {
    const map = {};
    const all = [
      ...styleOptions.filter((o) => o.visible),
      ...contrastOptions.filter((o) => o.visible),
    ];
    for (const opt of all) {
      const g = opt.garment || "General";
      if (!map[g]) map[g] = {};
      const cat = opt.category || "General";
      if (!map[g][cat]) map[g][cat] = [];
      map[g][cat].push(opt);
    }
    for (const g in map) {
      for (const cat in map[g]) {
        map[g][cat].sort((a, b) => a.sortOrder - b.sortOrder);
      }
    }
    return map;
  }, [styleOptions, contrastOptions]);

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
      {/* Section header */}
      <div className="flex items-center justify-between pb-[9px] border-b border-gc-primary-dark/20">
        <div className="flex items-center gap-[13px]">
          <div className="w-[3px] h-[20px] rounded-sm bg-gc-primary" />
          <h3 className="font-garamond text-[20px] sm:text-[28px] font-semibold text-gc-primary">
            Style Options
          </h3>
        </div>
      </div>

      {garments.map((garment) => {
        const catMap = byGarment[garment];
        const categories = Object.keys(catMap);
        return (
          <div key={garment} className="flex flex-col gap-[12px]">
            {/* Garment label */}
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
                return (
                  <StyleDropdown
                    key={`${garment}-${cat}`}
                    label={opts[0]?.displayLabel || cat}
                    opts={opts}
                    selected={selections[`${garment}__${cat}`] ?? ""}
                    onSelect={(val) =>
                      onChange({
                        ...selections,
                        [`${garment}__${cat}`]: val,
                      })
                    }
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

// ─── Page ──────────────────────────────────────
export default function CreateOrder() {
  const navigate = useNavigate();
  const location = useLocation();

  const [gcProducts, setGcProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [customerOrders, setCustomerOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [attributes, setAttributes] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [price, setPrice] = useState("0.00");
  const [note, setNote] = useState("");
  const [measurementsValid, setMeasurementsValid] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [vestRanges, setVestRanges] = useState(null);
  const [shirtRanges, setShirtRanges] = useState(null);
  const [trouserRanges, setTrouserRanges] = useState(null);
  const [jacketRanges, setJacketRanges] = useState(null);

  const [styleOptions, setStyleOptions] = useState([]);
  const [contrastOptions, setContrastOptions] = useState([]);
  const [styleSelections, setStyleSelections] = useState({});
  const [styleOptionsLoading, setStyleOptionsLoading] = useState(false);

  useEffect(() => {
    fetchVestRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setVestRanges(data);
      })
      .catch(() => {});
    fetchShirtRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setShirtRanges(data);
      })
      .catch(() => {});
    fetchTrouserRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setTrouserRanges(data);
      })
      .catch(() => {});
    fetchJacketRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setJacketRanges(data);
      })
      .catch(() => {});
  }, []);

  const rangeGroups = useMemo(() => {
    if (!selectedProduct) return [];
    const garments = garmentsFromGcBuilderValue(
      selectedProduct.metafield?.value,
    );
    const groups = [];
    if (garments.includes("Jacket") && jacketRanges)
      groups.push({ label: "Jacket", ranges: jacketRanges });
    if (garments.includes("Trouser") && trouserRanges)
      groups.push({ label: "Trouser", ranges: trouserRanges });
    if (garments.includes("Vest") && vestRanges)
      groups.push({ label: "Vest", ranges: vestRanges });
    if (garments.includes("Shirt") && shirtRanges)
      groups.push({ label: "Shirt", ranges: shirtRanges });
    return groups;
  }, [selectedProduct, jacketRanges, trouserRanges, vestRanges, shirtRanges]);

  const pastOrdersForProduct = useMemo(() => {
    if (!selectedProduct || !customerOrders.length) return [];
    const numericId = selectedProduct.id.split("/").pop();
    const titleLower = selectedProduct.title.toLowerCase();
    const matchesProduct = (node) =>
      node.product?.id?.split("/").pop() === numericId ||
      (node.title ?? "").toLowerCase() === titleLower;
    return customerOrders
      .filter((o) =>
        o.lineItems?.edges?.some(({ node }) => matchesProduct(node)),
      )
      .map((o) => {
        const item = o.lineItems?.edges?.find(({ node }) =>
          matchesProduct(node),
        )?.node;
        return {
          orderId: o.name,
          date: (o.createdAt ?? "").split("T")[0],
          attributes: (item?.customAttributes ?? []).filter(
            (a) => !a.key.startsWith("_"),
          ),
        };
      })
      .filter((o) => o.attributes.length > 0);
  }, [selectedProduct, customerOrders]);

  useEffect(() => {
    if (location.state?.newCustomer) {
      setSelectedCustomer(location.state.newCustomer);
      window.history.replaceState({}, "");
    }
  }, []);

  useEffect(() => {
    fetchGcBuilderProducts()
      .then((products) => {
        setGcProducts(products);
        setProductsLoading(false);
      })
      .catch(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([]);
      setSelectedProduct(null);
      return;
    }
    setOrdersLoading(true);
    fetchCustomerWithOrders(selectedCustomer.id)
      .then((data) => {
        setCustomerOrders(data.allOrders);
        setOrdersLoading(false);
      })
      .catch(() => setOrdersLoading(false));
  }, [selectedCustomer]);

  function applyDefaultSizeType(attrs) {
    return attrs
      .filter((a) => !a.key.toLowerCase().startsWith("standard"))
      .map((a) =>
        a.key.toLowerCase() === "size type" && !a.value
          ? { ...a, value: "Custom" }
          : a,
      );
  }

  async function getCanonicalFieldsForGarments(garments) {
    const FETCHERS = {
      Jacket: fetchJacketMeasurementFields,
      Trouser: fetchTrouserMeasurementFields,
      Vest: fetchVestMeasurementFields,
      Shirt: fetchShirtMeasurementFields,
    };
    const results = await Promise.all(
      garments.filter((g) => FETCHERS[g]).map((g) => FETCHERS[g]()),
    );
    return results.flat();
  }

  function prefillFromPastOrder(canonicalFields, pastAttrs, rangeMap) {
    const directMap = new Map(
      pastAttrs.map((a) => [a.key.trim().toLowerCase(), a.value]),
    );
    const fingerMap = new Map();
    for (const a of pastAttrs) {
      const e = getRangeForKey(rangeMap, a.key);
      if (e) {
        const fp = `${e.label}|${e.min}|${e.max}`;
        if (!fingerMap.has(fp)) fingerMap.set(fp, a.value);
      }
    }
    return canonicalFields.map((f) => {
      let value = directMap.get(f.key.toLowerCase()) ?? "";
      if (!value) {
        const e = getRangeForKey(rangeMap, f.key);
        if (e) value = fingerMap.get(`${e.label}|${e.min}|${e.max}`) ?? "";
      }
      return { key: f.key, value };
    });
  }

  async function getFieldsForProduct(product) {
    const garments = garmentsFromGcBuilderValue(product.metafield?.value);
    if (garments.length) {
      const canonical = await getCanonicalFieldsForGarments(garments);
      if (canonical.length)
        return canonical.map((f) => ({ key: f.key, value: "" }));
    }
    const serverFields = await getProductFields(product.id);
    if (serverFields.length > 0)
      return serverFields.map((key) => ({ key, value: "" }));
    return [];
  }

  async function handleNewOrder() {
    setSelectedTemplate(null);
    if (!selectedProduct) return;

    const pastNode = findPastLineItem(
      customerOrders,
      selectedProduct.id,
      selectedProduct.title,
    );
    const combinedRanges = {
      ...vestRanges,
      ...trouserRanges,
      ...jacketRanges,
      ...shirtRanges,
    };
    const garments = garmentsFromGcBuilderValue(
      selectedProduct.metafield?.value,
    );

    if (pastNode?.customAttributes?.length > 0 && garments.length) {
      setFieldsLoading(true);
      try {
        const canonical = await getCanonicalFieldsForGarments(garments);
        setAttributes(
          applyDefaultSizeType(
            canonical.map((f) => ({ key: f.key, value: "" })),
          ),
        );
      } catch {
        setAttributes([]);
      } finally {
        setFieldsLoading(false);
      }
      return;
    }

    if (pastNode?.customAttributes?.length > 0) {
      setAttributes(
        deduplicateByRange(attrsFromLineItem(pastNode, true), combinedRanges),
      );
      return;
    }

    setFieldsLoading(true);
    try {
      const fields = await getFieldsForProduct(selectedProduct);
      setAttributes(applyDefaultSizeType(fields));
    } catch {
      setAttributes([]);
    } finally {
      setFieldsLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedProduct) {
      setAttributes([]);
      setPrice("0.00");
      setSelectedTemplate(null);
      return;
    }

    const variantPrice =
      selectedProduct.variants?.edges?.[0]?.node?.price || "0.00";
    setPrice(variantPrice);

    if (!selectedProduct.metafield?.value) {
      setAttributes([]);
      return;
    }

    const pastNode = findPastLineItem(
      customerOrders,
      selectedProduct.id,
      selectedProduct.title,
    );

    const combinedRanges = {
      ...vestRanges,
      ...trouserRanges,
      ...jacketRanges,
      ...shirtRanges,
    };
    const garments = garmentsFromGcBuilderValue(
      selectedProduct.metafield?.value,
    );

    if (pastNode?.customAttributes?.length > 0 && garments.length) {
      setFieldsLoading(true);
      const pastAttrs = attrsFromLineItem(pastNode, false);
      getCanonicalFieldsForGarments(garments)
        .then((canonical) => {
          const filled = prefillFromPastOrder(
            canonical,
            pastAttrs,
            combinedRanges,
          );
          setAttributes(applyDefaultSizeType(filled));
        })
        .catch(() =>
          setAttributes(deduplicateByRange(pastAttrs, combinedRanges)),
        )
        .finally(() => setFieldsLoading(false));
      return;
    }

    if (pastNode?.customAttributes?.length > 0) {
      setAttributes(
        deduplicateByRange(attrsFromLineItem(pastNode, false), combinedRanges),
      );
      return;
    }

    if (!selectedProduct.metafield?.value) {
      setAttributes([]);
      return;
    }
    setFieldsLoading(true);
    getFieldsForProduct(selectedProduct)
      .then((fields) => setAttributes(applyDefaultSizeType(fields)))
      .catch(() => setAttributes([]))
      .finally(() => setFieldsLoading(false));
  }, [selectedProduct, customerOrders]);

  useEffect(() => {
    setStyleOptions([]);
    setContrastOptions([]);
    setStyleSelections({});
    if (!selectedProduct?.metafield?.value) return;
    const garments = styleGarmentsForProduct(selectedProduct);
    if (!garments.length) return;
    setStyleOptionsLoading(true);
    Promise.all([fetchStyleOptions(), fetchContrastOptions()])
      .then(([allStyle, allContrast]) => {
        const filtered = allStyle.filter((o) => garments.includes(o.garment));
        setStyleOptions(filtered);
        setContrastOptions(
          allContrast.filter((o) => garments.includes(o.garment)),
        );
        const defaults = {};
        filtered
          .filter((o) => o.isDefault && o.visible)
          .forEach((o) => {
            const key = `${o.garment}__${o.category}`;
            if (!defaults[key]) defaults[key] = o.label;
          });
        setStyleSelections(defaults);
      })
      .catch(() => {})
      .finally(() => setStyleOptionsLoading(false));
  }, [selectedProduct]);

  useEffect(() => {
    if (pastOrdersForProduct.length > 0) {
      setSelectedTemplate(pastOrdersForProduct[0].orderId);
    } else {
      setSelectedTemplate(null);
    }
  }, [pastOrdersForProduct]);

  async function handleSubmit() {
    if (!selectedCustomer || !selectedProduct) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // styleSelections keys are "Garment__category" — store as "Garment - category" on the order
      const styleAttrs = Object.entries(styleSelections)
        .filter(([, v]) => v)
        .map(([key, value]) => ({
          key: key.replace("__", " - "),
          value,
        }));

      const upchargeAttrs = Object.entries(styleSelections)
        .filter(([compKey, label]) => {
          const [garment, category] = compKey.split("__");
          const opt = styleOptions.find(
            (o) =>
              o.garment === garment &&
              o.category === category &&
              o.label === label,
          );
          return opt?.upcharge > 0;
        })
        .map(([compKey, label]) => {
          const [garment, category] = compKey.split("__");
          const opt = styleOptions.find(
            (o) =>
              o.garment === garment &&
              o.category === category &&
              o.label === label,
          );
          return {
            key: `_upcharge_${garment}_${category}`,
            value: String(opt.upcharge),
          };
        });

      const finalPrice = (parseFloat(price || "0.00") + totalUpcharge).toFixed(
        2,
      );

      const draft = await createDraftOrder({
        customerId: selectedCustomer.id,
        lineItems: [
          {
            title: selectedProduct.title,
            quantity: 1,
            originalUnitPrice: finalPrice,
            requiresShipping: true,
            customAttributes: [
              ...attributes
                .filter((a) => a.key)
                .map(({ key, value }) => ({ key, value: String(value) })),
              ...styleAttrs,
              ...upchargeAttrs,
            ],
          },
        ],
        note: note || "",
        tags: ["admin-created"],
      });
      const order = await completeDraftOrder(draft.id, true);
      const numericId = order.id.split("/").pop();

      const measureAttrs = attributes.filter(
        (a) => a.key && !a.key.startsWith("_"),
      );
      if (measureAttrs.length > 0) {
        try {
          const allProfiles = buildProfilesFromOrders(customerOrders);
          const productName = selectedProduct.title;
          const existingList = allProfiles[productName] ?? [];
          const today = new Date().toISOString().split("T")[0];
          const newProfile = {
            id: `prof_${Date.now()}`,
            name: `Measurement ${existingList.length + 1}`,
            created: today,
            measurements: Object.fromEntries(
              measureAttrs.map(({ key, value }) => [key, String(value)]),
            ),
          };
          const fullProfiles = {
            ...allProfiles,
            [productName]: [...existingList, newProfile],
          };
          await setCustomerProductsMetafield(selectedCustomer.id, fullProfiles);
        } catch (err) {
          console.error("Failed to save measurement profile:", err);
        }
      }

      clearOrdersCache();
      clearCustomerDetailCache(selectedCustomer.id);
      navigate(`/orders/${numericId}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  const totalUpcharge = useMemo(() => {
    if (!styleOptions.length) return 0;
    return Object.entries(styleSelections)
      .filter(([, label]) => label)
      .reduce((sum, [compKey, label]) => {
        const [garment, category] = compKey.split("__");
        const opt = styleOptions.find(
          (o) =>
            o.garment === garment &&
            o.category === category &&
            o.label === label,
        );
        return sum + (opt?.upcharge > 0 ? opt.upcharge : 0);
      }, 0);
  }, [styleSelections, styleOptions]);

  const hasMissingMeasurements = useMemo(() => {
    if (!attributes.length) return false;
    const { sections } = groupAttributes(attributes, rangeGroups);
    if (!sections.length) return false;
    return sections.some((sec) =>
      sec.items.some(({ originalKey }) => {
        const val = attributes.find((a) => a.key === originalKey)?.value ?? "";
        return !val.trim();
      }),
    );
  }, [attributes, rangeGroups]);

  const canSubmit =
    !!selectedCustomer &&
    !!selectedProduct &&
    !submitting &&
    measurementsValid &&
    !hasMissingMeasurements;

  const currentStep = selectedProduct ? 3 : selectedCustomer ? 2 : 1;

  return (
    <DashboardLayout bgColor="#f4f1ed">
      <img
        src="/watermark-tailor.png"
        alt=""
        className="fixed pointer-events-none select-none bottom-[-110px] right-0 w-[360px] h-[360px] opacity-[0.06] rotate-12 origin-bottom-right z-[1]"
      />

      <div className="relative flex flex-col gap-[40px] pb-[80px] z-[2]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="font-garamond text-[28px] sm:text-[40px] font-bold text-[#3c3c3c] leading-tight">
            Create New Order
          </h1>
          <p className="font-hanken text-[14px] text-black">
            Select customer, pick a product, fill measurements and create
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />

        <CustomerSelector
          value={selectedCustomer}
          onChange={(c) => {
            setSelectedCustomer(c);
            setSelectedProduct(null);
          }}
        />

        {selectedCustomer && (
          <div className="flex flex-col gap-[23px]">
            <div className="flex flex-wrap items-center justify-between gap-[8px]">
              <span className="font-garamond text-[28px] font-semibold text-[#a45d41]">
                Select Product
              </span>
            </div>

            {productsLoading ? (
              <p className="font-hanken text-[14px] text-[#6b7280]">
                Loading products…
              </p>
            ) : gcProducts.length === 0 ? (
              <p className="font-hanken text-[14px] text-[#6b7280]">
                No gc_builder products found in store.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[12px] sm:gap-[19px]">
                {gcProducts.map((product) => {
                  const isSelected = selectedProduct?.id === product.id;
                  const variantPrice =
                    product.variants?.edges?.[0]?.node?.price;
                  const pastCount = customerOrders.filter((o) =>
                    o.lineItems?.edges?.some(
                      ({ node }) =>
                        node.title?.toLowerCase() ===
                        product.title?.toLowerCase(),
                    ),
                  ).length;
                  return (
                    <button
                      key={product.id}
                      onClick={() =>
                        setSelectedProduct(isSelected ? null : product)
                      }
                      className={`flex flex-col items-start gap-[16px] sm:gap-[30px] p-[14px] sm:p-[22px] rounded-[8px] text-left transition-all cursor-pointer bg-white w-full ${isSelected ? "border-2 border-gc-near-black" : "border border-gc-section-divider/30"}`}
                    >
                      <div className="flex items-center justify-between w-full gap-[8px]">
                        <span className="font-hanken text-[12px] font-bold tracking-[0.6px] uppercase text-[#1c1c19] leading-tight">
                          {product.title}
                        </span>
                        {isSelected && (
                          <span className="font-hanken text-[10px] font-bold px-[8px] py-[2px] rounded-full flex-shrink-0 text-white bg-black">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-[12px] w-full">
                        {variantPrice && (
                          <span className="font-hanken text-[11px] font-semibold text-[rgba(76,69,70,0.6)]">
                            From {variantPrice}
                          </span>
                        )}
                        {pastCount > 0 && (
                          <span className="font-hanken text-[10px] font-semibold px-[12px] py-[4px] rounded-full self-start tracking-[0.9px] bg-gc-bg-image text-[#4c4546]">
                            {pastCount} past order{pastCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedCustomer &&
          selectedProduct &&
          pastOrdersForProduct.length > 0 && (
            <div className="flex flex-col gap-[16px]">
              <div className="flex flex-wrap items-center gap-[8px] pb-[17px] border-b border-gc-section-divider/30">
                <History size={16} className="text-gc-primary" />
                <span className="font-garamond text-[14px] font-medium uppercase text-[#A45D41]">
                  Use Past Order as Template
                </span>
                <span className="font-hanken text-[12px] text-[#6b7280] ml-auto">
                  {pastOrdersForProduct.length} past order
                  {pastOrdersForProduct.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-[10px]">
                <button
                  onClick={handleNewOrder}
                  className={cn(
                    "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                    !selectedTemplate
                      ? "text-white border border-gc-primary bg-gc-primary"
                      : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                  )}
                >
                  <Plus size={13} />
                  New
                </button>
                {pastOrdersForProduct.map((o) => (
                  <button
                    key={o.orderId}
                    onClick={async () => {
                      setSelectedTemplate(o.orderId);
                      const garments = garmentsFromGcBuilderValue(
                        selectedProduct.metafield?.value,
                      );
                      const combinedRanges = {
                        ...vestRanges,
                        ...trouserRanges,
                        ...jacketRanges,
                        ...shirtRanges,
                      };
                      if (garments.length) {
                        setFieldsLoading(true);
                        try {
                          const canonical =
                            await getCanonicalFieldsForGarments(garments);
                          setAttributes(
                            applyDefaultSizeType(
                              prefillFromPastOrder(
                                canonical,
                                o.attributes,
                                combinedRanges,
                              ),
                            ),
                          );
                        } catch {
                          setAttributes(
                            deduplicateByRange(o.attributes, combinedRanges),
                          );
                        } finally {
                          setFieldsLoading(false);
                        }
                      } else {
                        setAttributes(
                          deduplicateByRange(o.attributes, combinedRanges),
                        );
                      }
                    }}
                    className={cn(
                      "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                      selectedTemplate === o.orderId
                        ? "text-gc-primary border border-gc-primary bg-gc-primary/[6%]"
                        : "text-[#44474c] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                    )}
                  >
                    {selectedTemplate === o.orderId && (
                      <CheckCircle2 size={13} className="text-gc-primary" />
                    )}
                    {o.orderId}
                    <span className="text-[11px] text-[#9ca3af]">{o.date}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* ── Measurements + Details ── */}
        {selectedCustomer && selectedProduct && (
          <>
            <div className="bg-white/40 rounded-[12px] p-[31px] border border-gc-border-input">
              <h2 className="font-garamond text-[28px] font-semibold text-gc-primary mb-[20px]">
                Price (store currency)
              </h2>
              <div className="w-full border-t border-gc-section-divider/30">
                <div className="max-w-[200px] mt-[20px]">
                  <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mb-[7px]">
                    Price
                  </label>
                  <div className="bg-white rounded-[4px] h-[48px] flex items-center px-[8px] overflow-hidden border border-gc-scrollbar-thumb/60">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="font-garamond flex-1 text-[20px] text-[#1c1c19] outline-none bg-transparent"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </div>

            {selectedProduct?.metafield?.value && (
              <StyleOptionsSection
                styleOptions={styleOptions}
                contrastOptions={contrastOptions}
                selections={styleSelections}
                onChange={setStyleSelections}
                loading={styleOptionsLoading}
              />
            )}

            {fieldsLoading ? (
              <div className="bg-white rounded-[12px] p-[31px] border border-gc-divider">
                <LoadingState message="Loading product fields…" />
              </div>
            ) : attributes.length === 0 ? (
              <div className="bg-white rounded-[12px] px-[31px] py-[24px] border border-gc-divider">
                <p className="font-hanken text-[14px] text-[#6b7280]">
                  No fields loaded for this product.
                </p>
              </div>
            ) : (
              <AttributeEditor
                attributes={attributes}
                onChange={setAttributes}
                rangeGroups={rangeGroups}
                onValidChange={setMeasurementsValid}
              />
            )}

            {/* Note */}
            <div className="p-[31px]">
              <div className="flex items-center gap-[8px] mb-[20px]">
                <FileText size={18} className="text-gc-primary" />
                <h2 className="font-garamond text-[28px] font-semibold text-[#a45d41]">
                  Order Note
                </h2>
              </div>
              <div className="border-t border-gc-primary-dark/20">
                <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mt-[16px] mb-[8px]">
                  Notes
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Add a note for this order..."
                  className="font-hanken w-full bg-white px-[14px] py-[12px] rounded-[10px] text-[14px] text-gc-near-black2 placeholder:text-gc-muted outline-none resize-none transition-colors border border-gc-border-input"
                />
              </div>
            </div>

            {hasMissingMeasurements && (
              <div className="flex items-start gap-[10px] px-[16px] py-[12px] rounded-[8px] bg-red-50 border border-red-200">
                <AlertCircle
                  size={16}
                  className="text-red-500 flex-shrink-0 mt-[1px]"
                />
                <p className="font-hanken text-[13px] text-red-700">
                  Please fill in all measurement fields before creating the
                  order.
                </p>
              </div>
            )}

            {!measurementsValid && (
              <div className="flex items-start gap-[10px] px-[16px] py-[12px] rounded-[8px] bg-amber-50 border border-amber-200">
                <AlertCircle
                  size={16}
                  className="text-amber-500 flex-shrink-0 mt-[1px]"
                />
                <p className="font-hanken text-[13px] text-amber-700">
                  Some measurements are outside the valid range. Fix the red
                  fields before creating the order.
                </p>
              </div>
            )}

            {submitError && (
              <div className="flex items-start gap-[10px] px-[16px] py-[12px] rounded-[8px] bg-red-50 border border-red-200">
                <AlertCircle
                  size={16}
                  className="text-red-500 flex-shrink-0 mt-[1px]"
                />
                <div>
                  <p className="font-hanken text-[13px] font-semibold text-red-700">
                    Failed to create order
                  </p>
                  <p className="font-hanken text-[12px] text-red-600 mt-[2px]">
                    {submitError}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-[12px] pb-[8px]">
              <Link
                to="/orders"
                className="font-hanken flex items-center gap-[6px] text-[14px] font-medium text-black uppercase px-[20px] py-[11px] rounded-[8px] hover:opacity-70 transition-opacity border border-gray-300"
              >
                <X size={14} />
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="font-hanken flex items-center gap-[8px] h-[44px] px-[20px] rounded-[8px] text-white text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-gc-primary"
              >
                {submitting ? (
                  <>
                    <Plus size={14} className="animate-pulse" />
                    Creating Order…
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

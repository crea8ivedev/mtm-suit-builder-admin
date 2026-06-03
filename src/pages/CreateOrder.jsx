import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  X,
  Ruler,
  Tag,
  FileText,
  PlusCircle,
  AlertCircle,
  ChevronRight,
  Search,
  Plus,
  Clock,
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

// Remove duplicate attrs where two different keys resolve to the same range entry
// (e.g. "t_waist" and "Waist" both map to the same trouser measurement).
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

// Section colors indexed by label
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

// Groups attributes into general (detail) fields and per-section measurement fields.
//
// Priority order for field placement:
//  1. Explicit section prefix ("Vest X", "Jacket X", "Trouser X", "Shirt X") → that section
//  2. Range-map match against each section in order (Jacket → Trouser → Vest → Shirt)
//  3. No match → general Details section
//
// Using prefix detection FIRST prevents key-name collisions (e.g. "Chest" exists in both
// jacketRanges and vestRanges/shirtRanges) from wrongly assigning fields in tuxedo products.
function groupAttributes(attributes, rangeGroups) {
  const general = [];
  const sections = rangeGroups.map((g) => ({
    label: g.label,
    ranges: g.ranges,
    items: [],
  }));
  const hasGroups = sections.length > 0;

  const findSec = (label) => sections.find((s) => s.label === label);

  // Prefix → [section label, strip length]
  const PREFIX_ROUTES = [
    ["Vest ", "Vest"],
    ["Jacket ", "Jacket"],
    ["Trouser ", "Trouser"],
    ["Shirt ", "Shirt"],
  ];

  for (const attr of attributes) {
    if (attr.key.startsWith("_")) continue;
    const kl = attr.key.toLowerCase();

    // Always keep Size Type in Details (forced to "Custom" on load)
    if (kl === "size type") {
      general.push({ key: attr.key, originalKey: attr.key });
      continue;
    }

    // Drop standard-size fields — we only show custom measurements
    if (hasGroups && kl.startsWith("standard")) continue;

    // ── Step 1: explicit prefix match ─────────────────────────────────────────
    let placed = false;
    for (const [prefix, label] of PREFIX_ROUTES) {
      if (attr.key.startsWith(prefix)) {
        const sec = findSec(label);
        if (sec) {
          sec.items.push({
            key: attr.key.slice(prefix.length), // display without prefix
            originalKey: attr.key,
          });
          placed = true;
          break;
        }
      }
    }
    if (placed) continue;

    // ── Step 2: range-map match (for un-prefixed plain field names) ───────────
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

// Try to extract field keys from gc_builder JSON
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

// Returns true if a line-item node is custom-size (not standard)
function isCustomSizeLineItem(node) {
  const sizeType = (node.customAttributes ?? [])
    .find((a) => a.key.toLowerCase() === "size type")
    ?.value?.toLowerCase();
  return sizeType !== "standard";
}

// Finds the most recent custom-size line item for a product.
// Matches by product ID first; falls back to title match for admin-created orders
// (draft orders without variantId have product: null on their line items).
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

// Converts a line-item's customAttributes into the attributes state array.
// Strips internal (_) and standard-size keys. Forces Size Type = "Custom".
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
    <div
      className="flex flex-wrap items-center gap-[24px] sm:gap-[48px] pb-[25px]"
      style={{ borderBottom: "1px solid rgba(207,196,197,0.3)" }}
    >
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
              <div
                className="flex items-center justify-center rounded-full size-[32px] flex-shrink-0"
                style={{ backgroundColor: "#a45d41" }}
              >
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

// ─── Customer Selector helpers ───────────────────────────────────────────────
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
  const bg = many ? "rgba(119,90,25,0.1)" : "rgba(207,196,197,0.2)";
  const col = many ? "#775a19" : "#4c4546";
  const label = count === 1 ? "1 ORDER" : `${count} ORDERS`;
  return (
    <span
      className="font-hanken text-[12px] font-medium tracking-[1.2px] uppercase px-[8px] py-[6px] rounded-[5px]"
      style={{ background: bg, color: col }}
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
      <div
        className="flex items-center gap-[16px] px-[16px] py-[16px] bg-white rounded-[8px]"
        style={{ border: "1px solid #d1c7bd" }}
      >
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
          className="text-[#1a1c1b] hover:text-[#a45d41] transition-colors cursor-pointer p-[6px] rounded-[6px] hover:bg-[rgba(164,93,65,0.08)]"
          title="Change customer"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center h-[60px] bg-white rounded-[8px] px-[17px] gap-[10px] overflow-hidden"
        style={{ border: "1px solid #d1c7bd" }}
      >
        <Search size={16} className="text-[#6b7280] flex-shrink-0" />
        <input
          type="text"
          placeholder="Search customer by name or email...."
          value={search}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          className="flex-1 font-hanken text-[14px] text-[#1a1c1b] placeholder:text-[#6b7280] outline-none bg-transparent"
        />
      </div>
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-[4px] bg-white rounded-[8px] shadow-xl flex flex-col overflow-hidden"
          style={{ border: "1px solid #d1c7bd", maxHeight: "458px" }}
        >
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
                    className="w-full flex items-center justify-between px-[16px] pt-[16px] pb-[17px] text-left transition-colors cursor-pointer hover:bg-[#f4f1ed]"
                    style={{ borderBottom: "1px solid rgba(207,196,197,0.1)" }}
                  >
                    <div className="flex items-center gap-[16px]">
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
                          {getInitials(customer.name)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-hanken text-[16px] font-semibold text-black leading-tight">
                          {customer.name}
                        </span>
                        {customer.email && (
                          <span className="font-hanken text-[10px] font-semibold text-[#4c4546] tracking-[0.9px] lowercase">
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <OrdersBadge count={customer.numberOfOrders} />
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
            className="w-full flex items-center justify-center gap-[8px] h-[44px] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-90 rounded-bl-[8px] rounded-br-[8px]"
            style={{ backgroundColor: "#a45d41" }}
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

// ─── Attribute Editor ───────────────────────────────────────────────────────
function AttributeEditor({
  attributes,
  onChange,
  rangeGroups = [],
  onValidChange,
}) {
  const [touchedFields, setTouchedFields] = useState(new Set());

  // Stable key signature — prevents inputs unmounting/remounting on every keystroke
  const keySignature = attributes.map((a) => a.key).join("\0");
  const { general, sections } = useMemo(
    () => groupAttributes(attributes, rangeGroups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keySignature, rangeGroups],
  );

  function updateAttr(originalKey, value) {
    setTouchedFields((prev) => new Set([...prev, originalKey]));
    onChange(
      attributes.map((a) => (a.key === originalKey ? { ...a, value } : a)),
    );
  }

  // Notify parent on validity changes — uses section ranges for correct per-field check
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, sections]);

  if (attributes.length === 0) {
    return (
      <div
        className="bg-white rounded-[12px] px-[31px] py-[24px]"
        style={{ border: "1px solid #c5c6cd" }}
      >
        <p className="font-hanken text-[14px] text-[#6b7280]">
          No fields loaded for this product.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-[12px] p-[31px] flex flex-col gap-[48px]"
      style={{ border: "1px solid #c5c6cd" }}
    >
      {/* ── Details (Size Type etc.) ── */}
      {general.length > 0 && (
        <div className="flex flex-col gap-[16px]">
          <div
            className="flex items-center justify-between pb-[9px]"
            style={{ borderBottom: "1px solid rgba(146,73,50,0.2)" }}
          >
            <div className="flex items-center gap-[13px]">
              <div
                className="w-[3px] h-[20px] rounded-sm"
                style={{ backgroundColor: "#a45d41" }}
              />
              <h3 className="font-garamond text-[28px] font-semibold text-[#a45d41]">
                Details
              </h3>
            </div>
            <span className="font-hanken text-[10px] font-bold text-[rgba(28,28,25,0.5)] tracking-[1px] uppercase">
              {general.length} fields
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-[32px] gap-y-[24px]">
            {general.map(({ key, originalKey }) => (
              <div key={originalKey} className="relative h-[74px]">
                <label className="absolute top-0 font-hanken text-[12px] font-semibold text-[rgba(28,28,25,0.7)] uppercase">
                  {key}
                </label>
                <input
                  type="text"
                  value={
                    attributes.find((a) => a.key === originalKey)?.value || ""
                  }
                  onChange={(e) => updateAttr(originalKey, e.target.value)}
                  className="absolute top-[20px] left-0 right-0 h-[40px] bg-white rounded-[8px] px-[13px] font-garamond text-[18px] text-[#1c1c19] outline-none transition-colors"
                  style={{ border: "1px solid rgba(207,196,197,0.8)" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-section measurement grids ── */}
      {sections.map((sec) => {
        if (!sec.items.length) return null;
        return (
          <div key={sec.label} className="flex flex-col gap-[16px]">
            <div
              className="flex items-center justify-between pb-[9px]"
              style={{ borderBottom: "1px solid rgba(146,73,50,0.2)" }}
            >
              <div className="flex items-center gap-[13px]">
                <div
                  className="w-[3px] h-[20px] rounded-sm"
                  style={{ backgroundColor: "#a45d41" }}
                />
                <h3 className="font-garamond text-[28px] font-semibold text-[#a45d41]">
                  {sec.label} Measurements
                </h3>
              </div>
              <span className="font-hanken text-[10px] font-bold text-[rgba(28,28,25,0.5)] tracking-[1px] uppercase">
                {sec.items.length} measurements
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-[32px] gap-y-[24px]">
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
                  <div key={originalKey} className="relative h-[74px]">
                    <label className="absolute top-0 font-hanken text-[12px] font-semibold text-[rgba(28,28,25,0.7)] uppercase">
                      {getRangeForKey(sec.ranges, key)?.label ?? key}
                    </label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => updateAttr(originalKey, e.target.value)}
                      className={cn(
                        "absolute top-[20px] left-0 right-0 h-[40px] bg-white rounded-[8px] px-[13px] font-garamond text-[18px] outline-none transition-colors",
                        isValid
                          ? "text-green-700"
                          : isInvalid
                            ? "text-red-500"
                            : "text-[#1c1c19]",
                      )}
                      style={{
                        border: isValid
                          ? "1px solid #22c55e"
                          : isInvalid
                            ? "1px solid #f87171"
                            : "1px solid rgba(207,196,197,0.8)",
                      }}
                    />
                    <p
                      className={cn(
                        "absolute top-[67px] left-[4px] font-hanken text-[10px] font-medium",
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

// ─── Page ──────────────────────────────────────────────────────────────────
export default function CreateOrder() {
  const navigate = useNavigate();
  const location = useLocation();

  const [gcProducts, setGcProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null); // past order template

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

  // Separate range groups per product section — drives labeled sections in AttributeEditor
  const rangeGroups = useMemo(() => {
    if (!selectedProduct) return [];
    const t = selectedProduct.title.toLowerCase();
    const isSuit = t.includes("tuxedo") || t.includes("suit");
    const groups = [];
    if (
      (isSuit || t.includes("jacket") || t.includes("overcoat")) &&
      jacketRanges
    )
      groups.push({ label: "Jacket", ranges: jacketRanges });
    if ((isSuit || t.includes("trouser")) && trouserRanges)
      groups.push({ label: "Trouser", ranges: trouserRanges });
    if ((isSuit || t.includes("vest")) && vestRanges)
      groups.push({ label: "Vest", ranges: vestRanges });
    if ((isSuit || t.includes("shirt")) && shirtRanges)
      groups.push({ label: "Shirt", ranges: shirtRanges });
    return groups;
  }, [selectedProduct, jacketRanges, trouserRanges, vestRanges, shirtRanges]);

  // Past orders for selected product.
  // Matches by product ID OR title — title fallback covers admin-created orders
  // (draft orders without variantId have product: null on their line items).
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

  // Pre-select customer returned from "New Customer" flow
  useEffect(() => {
    if (location.state?.newCustomer) {
      setSelectedCustomer(location.state.newCustomer);
      window.history.replaceState({}, "");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load gc_builder products on mount
  useEffect(() => {
    fetchGcBuilderProducts()
      .then((products) => {
        setGcProducts(products);
        setProductsLoading(false);
      })
      .catch(() => setProductsLoading(false));
  }, []);

  // When customer changes → fetch their orders
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

  function productType(product) {
    const t = (product?.title ?? "").toLowerCase();
    if (t.includes("tuxedo") || t.includes("suit")) return "suit";
    if (t.includes("trouser")) return "trouser";
    if (t.includes("vest")) return "vest";
    if (t.includes("shirt")) return "shirt";
    if (t.includes("jacket") || t.includes("overcoat")) return "jacket";
    return "unknown";
  }

  // Returns ordered canonical field list for known product types, null for unknown.
  async function getCanonicalFieldsForType(ptype) {
    if (ptype === "vest") return fetchVestMeasurementFields();
    if (ptype === "trouser") return fetchTrouserMeasurementFields();
    if (ptype === "shirt") return fetchShirtMeasurementFields();
    if (ptype === "jacket") return fetchJacketMeasurementFields();
    if (ptype === "suit") {
      const [jf, tf, vf, sf] = await Promise.all([
        fetchJacketMeasurementFields(),
        fetchTrouserMeasurementFields(),
        fetchVestMeasurementFields(),
        fetchShirtMeasurementFields(),
      ]);
      return [...jf, ...tf, ...vf, ...sf];
    }
    return null;
  }

  // Pre-fills canonical fields with values from a past order's attributes.
  // Tries direct key match first, then range-fingerprint match (handles key variants).
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
    const ptype = productType(product);
    // Known types: always use canonical metaobject structure — never infer from past orders
    const canonical = await getCanonicalFieldsForType(ptype);
    if (canonical) return canonical.map((f) => ({ key: f.key, value: "" }));
    // Unknown type: fall back to past-order key discovery → gc_builder
    const serverFields = await getProductFields(product.id);
    if (serverFields.length > 0)
      return serverFields.map((key) => ({ key, value: "" }));
    const gcFields = parseGcBuilderFields(product.metafield?.value);
    return (gcFields ?? []).map((a) => ({ ...a, value: "" }));
  }

  // Load empty measurement fields for a fresh new order entry.
  // Uses field NAMES from a past order (same keys as real Shopify data) but clears all values.
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
    const ptype = productType(selectedProduct);

    if (pastNode?.customAttributes?.length > 0 && ptype !== "unknown") {
      // Known type: canonical fields, empty values
      setFieldsLoading(true);
      try {
        const canonical = await getCanonicalFieldsForType(ptype);
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

  // When product or customer orders change → fetch field keys from server, pre-fill values from customer history
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

    // No gc_builder value → skip measurement fields entirely
    if (!selectedProduct.metafield?.value) {
      setAttributes([]);
      return;
    }

    // Find the most recent custom-size line item for this product by product ID
    // (same traversal CustomerDetail uses in buildMeasurementProfiles)
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
    const ptype = productType(selectedProduct);

    if (pastNode?.customAttributes?.length > 0 && ptype !== "unknown") {
      // Known type + past order: use canonical field structure, pre-fill values from past order
      setFieldsLoading(true);
      const pastAttrs = attrsFromLineItem(pastNode, false);
      getCanonicalFieldsForType(ptype)
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
      // Unknown type: use past order attrs directly
      setAttributes(
        deduplicateByRange(attrsFromLineItem(pastNode, false), combinedRanges),
      );
      return;
    }

    // ── No gc_builder value → no measurement fields ──
    if (!selectedProduct.metafield?.value) {
      setAttributes([]);
      return;
    }

    // ── No past order → fetch canonical field list with empty values ──
    setFieldsLoading(true);
    getFieldsForProduct(selectedProduct)
      .then((fields) => setAttributes(applyDefaultSizeType(fields)))
      .catch(() => setAttributes([]))
      .finally(() => setFieldsLoading(false));
  }, [selectedProduct, customerOrders]);

  // Auto-select most recent past order as active template when product changes
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
      const draft = await createDraftOrder({
        customerId: selectedCustomer.id,
        lineItems: [
          {
            title: selectedProduct.title,
            variantId:
              selectedProduct.variants?.edges?.[0]?.node?.id ?? undefined,
            quantity: 1,
            originalUnitPrice: String(price || "0.00"),
            customAttributes: attributes
              .filter((a) => a.key)
              .map(({ key, value }) => ({ key, value: String(value) })),
          },
        ],
        note: note || "",
        tags: ["admin-created"],
      });
      const order = await completeDraftOrder(draft.id, true);
      const numericId = order.id.split("/").pop();

      // Save ALL measurements (past orders + this new one) to profiles.gc_measurements.
      // We build from customerOrders already in state — no separate metafield fetch needed,
      // so there is no silent-catch hiding a failed read that would wipe prior entries.
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
      {/* Watermark — anchored to bottom-right corner, rotated 12deg around that point */}
      <img
        src="/watermark-tailor.png"
        alt=""
        className="fixed pointer-events-none select-none"
        style={{
          bottom: -110,
          right: 0,
          width: 360,
          height: 360,
          opacity: 0.06,
          transform: "rotate(12deg)",
          transformOrigin: "bottom right",
          zIndex: 1,
        }}
      />

      {/* All page content at z-2 — above the watermark */}
      <div
        className="relative flex flex-col gap-[40px] pb-[80px]"
        style={{ zIndex: 2 }}
      >
        {/* ── Page header ── */}
        <div className="flex flex-col gap-[4px]">
          <h1 className="font-garamond text-[28px] sm:text-[40px] font-bold text-[#3c3c3c] leading-tight">
            Create New Order
          </h1>
          <p className="font-hanken text-[14px] text-black">
            Select customer, pick a product, fill measurements and create
          </p>
        </div>

        {/* ── Step flow indicator ── */}
        <StepIndicator currentStep={currentStep} />

        {/* ── Step 1: Customer search / selected ── */}
        <CustomerSelector
          value={selectedCustomer}
          onChange={(c) => {
            setSelectedCustomer(c);
            setSelectedProduct(null);
          }}
        />

        {/* ── Step 2: Product grid ── */}
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
              <div className="flex flex-wrap gap-[19px]">
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
                      className="flex flex-col items-start gap-[30px] p-[22px] rounded-[8px] text-left transition-all cursor-pointer bg-white w-[270px] flex-shrink-0"
                      style={{
                        border: isSelected
                          ? "2px solid #1c1c19"
                          : "1px solid rgba(207,196,197,0.3)",
                      }}
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
                          <span
                            className="font-hanken text-[10px] font-semibold px-[12px] py-[4px] rounded-full self-start tracking-[0.9px]"
                            style={{
                              backgroundColor: "#f0ede8",
                              color: "#4c4546",
                            }}
                          >
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

        {/* ── Past order template ── */}
        {selectedCustomer &&
          selectedProduct &&
          pastOrdersForProduct.length > 0 && (
            <div className="flex flex-col gap-[16px]">
              <div
                className="flex flex-wrap items-center gap-[8px] pb-[17px]"
                style={{ borderBottom: "1px solid rgba(207,196,197,0.3)" }}
              >
                <Clock size={14} style={{ color: "#6b7280" }} />
                <span className="font-garamond text-[20px] font-medium text-[#1a1c1b]">
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
                      ? "text-white"
                      : "text-[#6b7280] bg-white hover:bg-[rgba(164,93,65,0.04)]",
                  )}
                  style={{
                    border: !selectedTemplate
                      ? "1px solid #a45d41"
                      : "1px solid #d1c7bd",
                    backgroundColor: !selectedTemplate ? "#a45d41" : undefined,
                  }}
                >
                  <Plus size={13} />
                  New
                </button>
                {pastOrdersForProduct.map((o) => (
                  <button
                    key={o.orderId}
                    onClick={async () => {
                      setSelectedTemplate(o.orderId);
                      const ptype = productType(selectedProduct);
                      const combinedRanges = {
                        ...vestRanges,
                        ...trouserRanges,
                        ...jacketRanges,
                        ...shirtRanges,
                      };
                      if (ptype !== "unknown") {
                        setFieldsLoading(true);
                        try {
                          const canonical =
                            await getCanonicalFieldsForType(ptype);
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
                        ? "text-[#a45d41]"
                        : "text-[#44474c] bg-white hover:bg-[rgba(164,93,65,0.04)]",
                    )}
                    style={{
                      border:
                        selectedTemplate === o.orderId
                          ? "1px solid #a45d41"
                          : "1px solid #d1c7bd",
                      backgroundColor:
                        selectedTemplate === o.orderId
                          ? "rgba(164,93,65,0.06)"
                          : undefined,
                    }}
                  >
                    {selectedTemplate === o.orderId && (
                      <CheckCircle2 size={13} style={{ color: "#a45d41" }} />
                    )}
                    {o.orderId}
                    <span className="text-[11px] text-[#9ca3af]">{o.date}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* ── Step 3: Measurements + Details ── */}
        {selectedCustomer && selectedProduct && (
          <>
            {/* Section divider */}
            <div
              className="flex flex-wrap items-center gap-[8px] pb-[17px]"
              style={{ borderBottom: "1px solid rgba(207,196,197,0.3)" }}
            >
              <Ruler size={16} style={{ color: "#a45d41" }} />
              <span className="font-garamond text-[24px] font-medium text-[#1a1c1b]">
                Measurements &amp; Details
              </span>
            </div>

            {/* Price */}
            <div
              className="bg-white rounded-[12px] p-[31px]"
              style={{ border: "1px solid #d1c7bd" }}
            >
              <h2 className="font-garamond text-[28px] font-semibold text-[#a45d41] mb-[20px]">
                Price (store currency)
              </h2>
              <div
                className="w-full"
                style={{ borderTop: "1px solid rgba(207,196,197,0.3)" }}
              >
                <div className="max-w-[200px] mt-[20px]">
                  <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mb-[7px]">
                    Price (store currency)
                  </label>
                  <div
                    className="bg-white rounded-[4px] h-[48px] flex items-center px-[11px] overflow-hidden"
                    style={{ border: "1px solid #ddd6cf" }}
                  >
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

            {/* Attribute form */}
            {fieldsLoading ? (
              <div
                className="bg-white rounded-[12px] p-[31px]"
                style={{ border: "1px solid #c5c6cd" }}
              >
                <LoadingState message="Loading product fields…" />
              </div>
            ) : attributes.length === 0 ? (
              <div
                className="bg-white rounded-[12px] px-[31px] py-[24px]"
                style={{ border: "1px solid #c5c6cd" }}
              >
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
            <div
              className="bg-white rounded-[12px] p-[31px]"
              style={{ border: "1px solid #d1c7bd" }}
            >
              <div className="flex items-center gap-[8px] mb-[20px]">
                <FileText size={16} style={{ color: "#a45d41" }} />
                <h2 className="font-garamond text-[28px] font-semibold text-[#a45d41]">
                  Order Note
                </h2>
              </div>
              <div style={{ borderTop: "1px solid rgba(207,196,197,0.3)" }}>
                <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mt-[16px] mb-[8px]">
                  Internal Notes &amp; Special Instructions
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Add a note for this order..."
                  className="font-hanken w-full px-[14px] py-[12px] rounded-[8px] text-[14px] text-[#1a1c1b] placeholder:text-[#6b7280] outline-none resize-none transition-colors"
                  style={{ border: "1px solid #d1c7bd" }}
                />
              </div>
            </div>

            {/* Missing measurements warning */}
            {hasMissingMeasurements && (
              <div
                className="flex items-start gap-[10px] px-[16px] py-[12px] rounded-[8px]"
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
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

            {/* Out-of-range warning */}
            {!measurementsValid && (
              <div
                className="flex items-start gap-[10px] px-[16px] py-[12px] rounded-[8px]"
                style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                }}
              >
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

            {/* Submit error */}
            {submitError && (
              <div
                className="flex items-start gap-[10px] px-[16px] py-[12px] rounded-[8px]"
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
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

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-[12px] pb-[8px]">
              <Link
                to="/orders"
                className="font-hanken text-[14px] font-medium text-black uppercase px-[20px] py-[11px] hover:opacity-70 transition-opacity"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="font-hanken flex items-center gap-[8px] h-[44px] px-[20px] rounded-[8px] text-white text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: canSubmit ? "#a45d41" : "#a45d41" }}
              >
                {submitting ? (
                  <>
                    <PlusCircle size={14} className="animate-pulse" />
                    Creating Order…
                  </>
                ) : (
                  <>
                    <PlusCircle size={14} />
                    Create Order
                    <ChevronRight size={14} />
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

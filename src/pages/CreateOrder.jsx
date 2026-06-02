import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  X,
  Ruler,
  Tag,
  FileText,
  PlusCircle,
  AlertCircle,
  ChevronRight,
  User,
  ShoppingBag,
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
    return (
      <div className="flex items-center gap-[12px] p-[14px] border border-border rounded-lg bg-white">
        <div className="w-[40px] h-[40px] bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-16 font-bold">
            {value.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary text-15">
            {value.name}
          </p>
          {value.email && (
            <p className="text-12 text-text-muted">{value.email}</p>
          )}
        </div>
        <span className="text-12 text-text-muted mr-[8px]">
          {value.numberOfOrders} orders
        </span>
        <button
          onClick={() => onChange(null)}
          className="btn-icon"
          title="Change customer"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="Search customer by name or email…"
        value={search}
        onChange={handleSearchChange}
        onFocus={handleFocus}
        className="input pl-[38px]"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] bg-white border border-border rounded-lg shadow-lg flex flex-col max-h-[280px]">
          <button
            onClick={() => {
              setOpen(false);
              navigate("/customers", {
                state: { autoCreateModal: true, returnTo: "/orders/new" },
              });
            }}
            className="w-full flex items-center gap-[10px] px-[14px] py-[10px] hover:bg-brand-50 text-left transition-colors border-b border-border flex-shrink-0"
          >
            <div className="w-[32px] h-[32px] bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Plus size={14} className="text-brand-600" />
            </div>
            <span className="text-14 font-semibold text-brand-600">
              New Customer
            </span>
          </button>
          <div className="overflow-y-auto">
            {resultsLoading ? (
              <div className="p-[16px] text-14 text-text-muted text-center">
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="p-[16px] text-14 text-text-muted text-center">
                No customers found
              </div>
            ) : (
              results.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => {
                    onChange(customer);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-[10px] px-[14px] py-[10px] hover:bg-gray-50 text-left transition-colors border-b border-border-light last:border-b-0"
                >
                  <div className="w-[32px] h-[32px] bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-12 font-bold">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-14 font-medium text-text-primary">
                      {customer.name}
                    </p>
                    {customer.email && (
                      <p className="text-12 text-text-muted truncate">
                        {customer.email}
                      </p>
                    )}
                  </div>
                  <span className="text-12 text-text-muted flex-shrink-0">
                    {customer.numberOfOrders} orders
                  </span>
                </button>
              ))
            )}
          </div>
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
      <div className="card p-[20px]">
        <p className="text-14 text-text-muted">
          No fields loaded for this product.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-[16px]">
      {/* ── Details (Size Type etc.) ── */}
      {general.length > 0 && (
        <div className="card overflow-hidden border-l-4 border-gray-300">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <Tag size={14} className="text-text-muted" />
            <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
              Details
            </h3>
            <span className="ml-auto text-11 text-text-muted">
              {general.length} fields
            </span>
          </div>
          <div className="p-[20px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[14px]">
            {general.map(({ key, originalKey }) => (
              <div key={originalKey}>
                <label className="input-label">{key}</label>
                <input
                  type="text"
                  value={
                    attributes.find((a) => a.key === originalKey)?.value || ""
                  }
                  onChange={(e) => updateAttr(originalKey, e.target.value)}
                  className="input"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-section measurement grids ── */}
      {sections.map((sec) => {
        if (!sec.items.length) return null;
        const colors = SECTION_COLORS[sec.label] ?? SECTION_COLORS.default;
        return (
          <div
            key={sec.label}
            className={cn("card overflow-hidden border-l-4", colors.border)}
          >
            <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
              <Ruler size={14} className={colors.icon} />
              <h3
                className={cn(
                  "text-13 font-bold uppercase tracking-wider",
                  colors.heading,
                )}
              >
                {sec.label} Measurements
              </h3>
              <span
                className={cn(
                  "ml-auto text-11 font-semibold px-[8px] py-[2px] rounded-full",
                  colors.badge,
                )}
              >
                {sec.items.length} measurements
              </span>
            </div>
            <div className="p-[16px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[10px]">
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
                  <div key={originalKey}>
                    <label className="input-label text-11">
                      {getRangeForKey(sec.ranges, key)?.label ?? key}
                    </label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => updateAttr(originalKey, e.target.value)}
                      className={cn(
                        "input py-[8px] text-15 font-bold",
                        isValid
                          ? "border-green-500 focus:ring-green-400"
                          : isInvalid
                            ? "border-red-400 focus:ring-red-400"
                            : "",
                      )}
                    />
                    <p
                      className={cn(
                        "text-[10px] mt-[2px] leading-tight",
                        isValid
                          ? "text-green-600"
                          : isInvalid
                            ? "text-red-500"
                            : "text-text-muted",
                      )}
                    >
                      {range ? `${range.min}–${range.max}` : ""}
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

  const canSubmit =
    !!selectedCustomer && !!selectedProduct && !submitting && measurementsValid;

  return (
    <DashboardLayout>
      {/* Back */}
      <div className="mb-[20px]">
        <Link
          to="/orders"
          className="inline-flex items-center gap-[6px] text-13 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Orders
        </Link>
      </div>

      {/* Page header */}
      <div className="section-header mb-[24px]">
        <div>
          <h2 className="text-24 font-bold text-text-primary">
            Create New Order
          </h2>
          <p className="text-14 text-text-muted mt-[3px]">
            Select customer, pick a product, fill measurements and create
          </p>
        </div>
      </div>

      <div className="space-y-[20px]">
        {/* ── Step 1: Customer ── */}
        <div className="card">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <div className="w-[20px] h-[20px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-11 font-bold">1</span>
            </div>
            <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
              Select Customer
            </h3>
          </div>
          <div className="p-[20px]">
            <CustomerSelector
              value={selectedCustomer}
              onChange={(c) => {
                setSelectedCustomer(c);
                setSelectedProduct(null);
              }}
            />
          </div>
        </div>

        {/* ── Step 2: Product ── */}
        {selectedCustomer && (
          <div className="card">
            <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
              <div className="w-[20px] h-[20px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-11 font-bold">2</span>
              </div>
              <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
                Select Product
              </h3>
              {!productsLoading && (
                <span className="ml-auto text-12 text-text-muted">
                  {gcProducts.length} products
                </span>
              )}
            </div>
            <div className="p-[20px]">
              {productsLoading ? (
                <p className="text-14 text-text-muted">Loading products…</p>
              ) : gcProducts.length === 0 ? (
                <p className="text-14 text-text-muted">
                  No gc_builder products found in store.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[12px]">
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
                        className={cn(
                          "flex flex-col items-start gap-[6px] p-[14px] rounded-lg border-2 text-left transition-all",
                          isSelected
                            ? "border-brand-600 bg-brand-50"
                            : "border-border bg-white hover:border-brand-300 hover:bg-gray-50",
                        )}
                      >
                        <div className="flex items-center gap-[8px] w-full">
                          <ShoppingBag
                            size={14}
                            className={
                              isSelected ? "text-brand-600" : "text-text-muted"
                            }
                          />
                          <span
                            className={cn(
                              "text-14 font-semibold flex-1",
                              isSelected
                                ? "text-brand-700"
                                : "text-text-primary",
                            )}
                          >
                            {product.title}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold bg-brand-600 text-white px-[6px] py-[2px] rounded-full">
                              Selected
                            </span>
                          )}
                        </div>
                        {variantPrice && (
                          <span className="text-12 text-text-muted ml-[22px]">
                            From {variantPrice}
                          </span>
                        )}
                        {pastCount > 0 && (
                          <span className="text-11 text-brand-700 bg-brand-50 border border-brand-200 px-[7px] py-[2px] rounded-full ml-[22px]">
                            {pastCount} past order{pastCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2.5: Past order template ── */}
        {selectedCustomer &&
          selectedProduct &&
          pastOrdersForProduct.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
                <Clock size={14} className="text-text-muted" />
                <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
                  Use Past Order as Template
                </h3>
                <span className="ml-auto text-12 text-text-muted">
                  {pastOrdersForProduct.length} past order
                  {pastOrdersForProduct.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="p-[16px] flex flex-wrap gap-[10px]">
                <button
                  onClick={handleNewOrder}
                  className={cn(
                    "flex items-center gap-[7px] px-[14px] py-[8px] rounded-lg border-2 text-13 font-medium transition-all",
                    !selectedTemplate
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-border bg-white text-text-muted hover:border-brand-300",
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
                      "flex items-center gap-[7px] px-[14px] py-[8px] rounded-lg border-2 text-13 font-medium transition-all",
                      selectedTemplate === o.orderId
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-border bg-white text-text-secondary hover:border-brand-300 hover:bg-gray-50",
                    )}
                  >
                    {selectedTemplate === o.orderId && (
                      <CheckCircle2 size={13} />
                    )}
                    {o.orderId}
                    <span className="text-11 text-text-muted">{o.date}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* ── Step 3: Measurements + Details ── */}
        {selectedCustomer && selectedProduct && (
          <>
            <div className="flex items-center gap-[8px]">
              <div className="flex-1 h-[1px] bg-border" />
              <div className="flex items-center gap-[8px] px-[12px]">
                <div className="w-[20px] h-[20px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-11 font-bold">3</span>
                </div>
                <span className="text-12 font-bold uppercase tracking-wider text-text-muted">
                  Measurements &amp; Details
                </span>
              </div>
              <div className="flex-1 h-[1px] bg-border" />
            </div>

            {/* Price */}
            <div className="card p-[20px]">
              <div className="max-w-[280px]">
                <label className="input-label">Price (store currency)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="input"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Attribute form — only for products with custom.gc_builder value */}
            {selectedProduct?.metafield?.value &&
              (fieldsLoading ? (
                <div className="card p-[24px]">
                  <LoadingState message="Loading product fields…" />
                </div>
              ) : (
                <AttributeEditor
                  attributes={attributes}
                  onChange={setAttributes}
                  rangeGroups={rangeGroups}
                  onValidChange={setMeasurementsValid}
                />
              ))}

            {/* Note */}
            <div className="card p-[20px]">
              <div className="flex items-center gap-[8px] mb-[12px]">
                <FileText size={14} className="text-text-muted" />
                <h3 className="text-13 font-semibold text-text-primary">
                  Order Note
                </h3>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add a note for this order…"
                className="input resize-none"
              />
            </div>

            {/* Measurement validation warning */}
            {!measurementsValid && (
              <div className="flex items-start gap-[10px] px-[16px] py-[12px] bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle
                  size={16}
                  className="text-amber-600 flex-shrink-0 mt-[1px]"
                />
                <p className="text-13 text-amber-700">
                  Some measurements are outside the valid range. Fix the red
                  fields before creating the order.
                </p>
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-[10px] px-[16px] py-[12px] bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle
                  size={16}
                  className="text-red-600 flex-shrink-0 mt-[1px]"
                />
                <div>
                  <p className="text-13 font-semibold text-red-700">
                    Failed to create order
                  </p>
                  <p className="text-12 text-red-600 mt-[2px]">{submitError}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-[10px] pb-[8px]">
              <Link to="/orders" className="btn-secondary">
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-primary gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusCircle size={15} />
                {submitting ? "Creating Order…" : "Create Order"}
                {!submitting && <ChevronRight size={14} />}
              </button>
            </div>
          </>
        )}

        {/* Empty state */}
        {!selectedCustomer && (
          <div className="card p-[48px] text-center">
            <User size={32} className="mx-auto text-text-muted mb-[12px]" />
            <p className="text-16 font-semibold text-text-primary mb-[4px]">
              Select a customer to start
            </p>
            <p className="text-14 text-text-muted">
              Choose a customer to begin creating their order
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

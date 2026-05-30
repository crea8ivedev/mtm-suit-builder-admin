import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  X,
  Ruler,
  Package,
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
  fetchAllCustomers,
  fetchGcBuilderProducts,
  fetchCustomerWithOrders,
  transformCustomer,
  clearOrdersCache,
  getProductFields,
  createDraftOrder,
  completeDraftOrder,
  fetchVestRanges,
} from "../lib/shopify";
import { cn } from "../utils/cn";
import {
  SHIRT_MEASUREMENT_RANGES,
  JACKET_MEASUREMENT_RANGES,
  TROUSER_MEASUREMENT_RANGES,
  SUIT_MEASUREMENT_RANGES,
} from "../constants/data";

function getRangeForKey(rangeMap, key) {
  if (!rangeMap) return null;
  if (rangeMap[key]) return rangeMap[key];
  const n = key.toLowerCase().trim();
  for (const [k, v] of Object.entries(rangeMap)) {
    if (k.toLowerCase().trim() === n) return v;
  }
  return null;
}

function getProductRanges(title, vestRanges) {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes("tuxedo") || t.includes("suit"))
    return { ...SUIT_MEASUREMENT_RANGES, ...(vestRanges ?? {}) };
  if (t.includes("jacket") || t.includes("overcoat"))
    return JACKET_MEASUREMENT_RANGES;
  if (t.includes("trouser")) return TROUSER_MEASUREMENT_RANGES;
  if (t.includes("vest")) return vestRanges;
  if (t.includes("shirt")) return SHIRT_MEASUREMENT_RANGES;
  return null;
}

function categorize(customAttributes = []) {
  const general = [],
    measurements = [],
    vest = [];
  for (const attr of customAttributes) {
    if (attr.key.startsWith("_")) continue;
    if (attr.key.startsWith("Vest ")) {
      vest.push({
        key: attr.key.replace("Vest ", ""),
        originalKey: attr.key,
        value: attr.value,
      });
    } else if (attr.value && /^\d/.test(attr.value)) {
      measurements.push({
        key: attr.key,
        originalKey: attr.key,
        value: attr.value,
      });
    } else {
      general.push({ key: attr.key, originalKey: attr.key, value: attr.value });
    }
  }
  return { general, measurements, vest };
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

// ─── Customer Selector ──────────────────────────────────────────────────────
function CustomerSelector({ customers, value, onChange }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)),
      )
      .slice(0, 20);
  }, [customers, search]);

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
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="input pl-[38px]"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] bg-white border border-border rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-[16px] text-14 text-text-muted text-center">
              No customers found
            </div>
          ) : (
            filtered.map((customer) => (
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
      )}
    </div>
  );
}

// ─── Attribute Editor ───────────────────────────────────────────────────────
function AttributeEditor({
  attributes,
  onChange,
  ranges = null,
  onValidChange,
}) {
  const [touchedFields, setTouchedFields] = useState(new Set());
  const { general, measurements, vest } = useMemo(
    () => categorize(attributes),
    [attributes],
  );

  function updateAttr(originalKey, value) {
    const newTouched = new Set([...touchedFields, originalKey]);
    setTouchedFields(newTouched);
    onChange(
      attributes.map((a) => (a.key === originalKey ? { ...a, value } : a)),
    );
  }

  // Notify parent whenever validity changes
  useEffect(() => {
    if (!onValidChange) return;
    if (!ranges) {
      onValidChange(true);
      return;
    }
    const allM = [...measurements, ...vest];
    const hasError = allM.some(({ key, originalKey }) => {
      const val = attributes.find((a) => a.key === originalKey)?.value ?? "";
      if (!val) return false;
      const range = getRangeForKey(ranges, key);
      if (!range) return false;
      const n = parseFloat(val);
      return !isNaN(n) && (n < range.min || n > range.max);
    });
    onValidChange(!hasError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, ranges]);

  function addField() {
    onChange([...attributes, { key: "", value: "" }]);
  }

  function updateRawKey(idx, key) {
    onChange(attributes.map((a, i) => (i === idx ? { ...a, key } : a)));
  }

  function updateRawValue(idx, value) {
    onChange(attributes.map((a, i) => (i === idx ? { ...a, value } : a)));
  }

  function removeField(idx) {
    onChange(attributes.filter((_, i) => i !== idx));
  }

  // Raw attrs that don't fit categorize (empty key or unrecognized)
  const rawNewFields = attributes.filter(
    (a) => !a.key || a.key.startsWith("_new_"),
  );

  if (attributes.length === 0) {
    return (
      <div className="card p-[20px] space-y-[12px]">
        <p className="text-14 text-text-muted">
          No fields loaded. Add fields manually below.
        </p>
        <button onClick={addField} className="btn-secondary gap-[8px]">
          <Plus size={14} />
          Add Field
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-[16px]">
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

      {measurements.length > 0 && (
        <div className="card overflow-hidden border-l-4 border-brand-600">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <Ruler size={14} className="text-brand-700" />
            <h3 className="text-13 font-bold uppercase tracking-wider text-brand-700">
              Measurements
            </h3>
            <span className="ml-auto text-11 font-semibold text-brand-700 bg-brand-50 px-[8px] py-[2px] rounded-full">
              {measurements.length} measurements
            </span>
          </div>
          <div className="p-[16px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[10px]">
            {measurements.map(({ key, originalKey }) => {
              const val =
                attributes.find((a) => a.key === originalKey)?.value ?? "";
              const range = getRangeForKey(ranges, key);
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
                  <label className="input-label text-11">{key}</label>
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
                  {range && (isTouched || val) && (
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
                      {range.label}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vest.length > 0 && (
        <div className="card overflow-hidden border-l-4 border-pending">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <Package size={14} className="text-pending" />
            <h3 className="text-13 font-bold uppercase tracking-wider text-pending">
              Vest Measurements
            </h3>
            <span className="ml-auto text-11 font-semibold text-pending bg-pending-bg px-[8px] py-[2px] rounded-full">
              {vest.length} measurements
            </span>
          </div>
          <div className="p-[16px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[10px]">
            {vest.map(({ key, originalKey }) => {
              const val =
                attributes.find((a) => a.key === originalKey)?.value ?? "";
              const range = getRangeForKey(ranges, key);
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
                  <label className="input-label text-11">{key}</label>
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
                  {range && (isTouched || val) && (
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
                      {range.label}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function CreateOrder() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
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

  useEffect(() => {
    fetchVestRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setVestRanges(data);
      })
      .catch(() => {});
  }, []);

  const productRanges = useMemo(
    () => getProductRanges(selectedProduct?.title, vestRanges),
    [selectedProduct, vestRanges],
  );

  // Past orders for selected product
  const pastOrdersForProduct = useMemo(() => {
    if (!selectedProduct || !customerOrders.length) return [];
    return customerOrders
      .filter((o) =>
        o.lineItems?.edges?.some(
          ({ node }) =>
            node.title?.toLowerCase() === selectedProduct.title?.toLowerCase(),
        ),
      )
      .map((o) => {
        const item = o.lineItems?.edges?.find(
          ({ node }) =>
            node.title?.toLowerCase() === selectedProduct.title?.toLowerCase(),
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

  // Load customers + gc_builder products on mount
  useEffect(() => {
    fetchAllCustomers()
      .then((raw) => {
        setCustomers(raw.map(transformCustomer));
        setCustomersLoading(false);
      })
      .catch(() => setCustomersLoading(false));

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
    return attrs.map((a) =>
      a.key.toLowerCase() === "size type" && !a.value
        ? { ...a, value: "Custom" }
        : a,
    );
  }

  // Load empty measurement fields for a fresh new order entry
  async function handleNewOrder() {
    setSelectedTemplate(null);
    if (!selectedProduct) return;
    setFieldsLoading(true);
    try {
      const serverFields = await getProductFields(selectedProduct.id);
      let attrs;
      if (serverFields.length > 0) {
        attrs = serverFields.map((key) => ({
          key,
          value: key.toLowerCase() === "size type" ? "Custom" : "",
        }));
      } else {
        const gcFields = parseGcBuilderFields(selectedProduct.metafield?.value);
        attrs = (gcFields ?? []).map((a) =>
          a.key.toLowerCase() === "size type"
            ? { ...a, value: "Custom" }
            : { ...a, value: "" },
        );
      }
      setAttributes(attrs);
    } catch {
      const gcFields = parseGcBuilderFields(selectedProduct.metafield?.value);
      setAttributes(applyDefaultSizeType(gcFields ?? []));
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

    // Build a value map from customer's latest order for this product (for pre-filling)
    const matchingOrder = customerOrders.find((order) =>
      order.lineItems?.edges?.some(
        ({ node }) =>
          node.title?.toLowerCase() === selectedProduct.title?.toLowerCase(),
      ),
    );
    const pastItem = matchingOrder?.lineItems?.edges?.find(
      ({ node }) =>
        node.title?.toLowerCase() === selectedProduct.title?.toLowerCase(),
    )?.node;
    const valueMap = Object.fromEntries(
      (pastItem?.customAttributes ?? [])
        .filter((a) => !a.key.startsWith("_"))
        .map((a) => [a.key, a.value]),
    );

    setFieldsLoading(true);

    getProductFields(selectedProduct.id)
      .then((serverFields) => {
        if (serverFields.length > 0) {
          setAttributes(
            applyDefaultSizeType(
              serverFields.map((key) => ({ key, value: valueMap[key] ?? "" })),
            ),
          );
        } else if (pastItem?.customAttributes?.length > 0) {
          setAttributes(
            applyDefaultSizeType(
              pastItem.customAttributes.filter((a) => !a.key.startsWith("_")),
            ),
          );
        } else {
          const gcFields = parseGcBuilderFields(
            selectedProduct.metafield?.value,
          );
          setAttributes(applyDefaultSizeType(gcFields ?? []));
        }
      })
      .catch(() => {
        if (pastItem?.customAttributes?.length > 0) {
          setAttributes(
            applyDefaultSizeType(
              pastItem.customAttributes.filter((a) => !a.key.startsWith("_")),
            ),
          );
        } else {
          const gcFields = parseGcBuilderFields(
            selectedProduct.metafield?.value,
          );
          setAttributes(applyDefaultSizeType(gcFields ?? []));
        }
      })
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
      clearOrdersCache();
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
          className="inline-flex items-center gap-[6px] text-13 text-text-muted hover:text-text-primary transition-colors"
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
            {customersLoading ? (
              <p className="text-14 text-text-muted">Loading customers…</p>
            ) : (
              <CustomerSelector
                customers={customers}
                value={selectedCustomer}
                onChange={(c) => {
                  setSelectedCustomer(c);
                  setSelectedProduct(null);
                }}
              />
            )}
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
                    onClick={() => {
                      setSelectedTemplate(o.orderId);
                      setAttributes(o.attributes);
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

            {/* Attribute form */}
            {fieldsLoading ? (
              <div className="card p-[24px]">
                <LoadingState message="Loading product fields…" />
              </div>
            ) : (
              <AttributeEditor
                attributes={attributes}
                onChange={setAttributes}
                ranges={productRanges}
                onValidChange={setMeasurementsValid}
              />
            )}

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
        {!selectedCustomer && !customersLoading && (
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

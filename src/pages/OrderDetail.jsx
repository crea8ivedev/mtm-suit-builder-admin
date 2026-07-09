import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  ExternalLink,
  RotateCw,
  Send,
  ChevronDown,
  Check,
  AlertCircle,
  CalendarCheck2,
  ListChecks,
  Download,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useClickOutside } from "../hooks/useClickOutside";
import { useOrderDetail } from "../hooks/useOrderDetail";
import { useSupplierSubmit, SUPPLIERS } from "../hooks/useSupplierSubmit";
import {
  formatCurrency,
  formatDate,
  fetchFabricOptions,
  fetchJacketMeasurementFields,
  fetchTrouserMeasurementFields,
  fetchVestMeasurementFields,
  fetchShirtMeasurementFields,
  fetchFitSizeOptions,
  addUpchargeLineItem,
  setOrderMetafields,
} from "../lib/shopify";
import { generateSingleOrderExcel } from "../utils/exportUtils";

function formatAmount(amount, currencyCode) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${parseFloat(amount).toFixed(2)}`;
  }
}

function mapPaymentBadge(s) {
  return (
    {
      PAID: "paid",
      PENDING: "pending",
      REFUNDED: "failed",
      PARTIALLY_REFUNDED: "pending",
      VOIDED: "failed",
      AUTHORIZED: "pending",
      PARTIALLY_PAID: "pending",
    }[s] || "pending"
  );
}

function parseSupplierMeta(order) {
  const edges = order?.metafields?.edges ?? [];
  const map = Object.fromEntries(edges.map((e) => [e.node.key, e.node.value]));
  return {
    supplierName: map.supplier_name ?? null,
    supplierStatus: map.supplier_status ?? null,
    supplierError: map.supplier_error ?? null,
    supplierSubmittedAt: map.supplier_submitted_at ?? null,
    supplierReference: map.supplier_reference ?? null,
    upchargeSynced: parseFloat(map.upcharge_synced || "0"),
  };
}

const INLINE_KEYS = new Set([
  "fabric",
  "size type",
  "price",
  "total",
  "upcharge",
  "upcharge value",
  "product price",
  "style upcharge",
  "order total",
  "measurestype",
]);

function resolveLabel(rawKey, labelMap) {
  if (labelMap[rawKey]) return labelMap[rawKey];
  if (rawKey.startsWith("Jacket ") && !rawKey.includes(" - ")) {
    const stripped = rawKey.slice("Jacket ".length);
    return labelMap[stripped] ?? stripped;
  }
  if (rawKey.startsWith("Trouser ") && !rawKey.includes(" - ")) {
    const stripped = rawKey.slice("Trouser ".length);
    return labelMap[stripped] ?? stripped;
  }
  if (rawKey.startsWith("Vest ") && !rawKey.includes(" - ")) {
    const stripped = rawKey.slice("Vest ".length);
    return labelMap[stripped] ?? stripped;
  }
  if (rawKey.startsWith("Style: ")) {
    const label = rawKey.slice("Style: ".length);
    if (label === "Contrast Color & Locations") return "Contrast Color";
    return label;
  }
  if (rawKey.includes(" - ")) {
    const cat = rawKey.split(" - ").slice(1).join(" - ");
    return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return rawKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const _GARMENT_PREFIXES = new Set(["Jacket", "Trouser", "Vest", "Shirt"]);
const _FIT_SIZE_TYPE_WORDS = new Set([
  "Fit",
  "Length",
  "Size",
  "Width",
  "Type",
]);

function isFitSizeKey(rawKey, fitSizeKeySet) {
  if (fitSizeKeySet.has(rawKey)) return true;
  if (rawKey.toLowerCase().includes("fit_size")) return true;
  // Fallback pattern: "Garment FitType" only — e.g. "Jacket Fit", "Trouser Length"
  // Deliberately excludes "Jacket Bicep", "Jacket Seat" etc.
  const parts = rawKey.split(" ");
  return (
    parts.length === 2 &&
    _GARMENT_PREFIXES.has(parts[0]) &&
    _FIT_SIZE_TYPE_WORDS.has(parts[1]) &&
    !rawKey.includes(" - ")
  );
}

function categorize(
  customAttributes = [],
  labelMap = {},
  fitSizeKeySet = new Set(),
) {
  const options = [];
  const measurements = [];
  const fitSize = [];
  for (const attr of customAttributes) {
    if (attr.key.startsWith("_")) continue;
    const value = attr.value?.endsWith('"')
      ? attr.value.slice(0, -1)
      : (attr.value ?? "");
    const isFitSizeMatch = isFitSizeKey(attr.key, fitSizeKeySet);
    // Physical measurements are always numeric; numeric values under fit/size keys belong in measurements
    const isNumericValue = isFitSizeMatch && /^\d+(\.\d+)?$/.test(value.trim());
    const isFitSize = isFitSizeMatch && !isNumericValue;
    // Strip garment prefix for fit/size labels (e.g. "Jacket - Fit" → "Fit", "Trouser Length" → "Length")
    const key = isFitSize
      ? (() => {
          const raw = attr.key;
          if (raw.includes(" - ")) {
            const [prefix, ...rest] = raw.split(" - ");
            if (_GARMENT_PREFIXES.has(prefix)) return rest.join(" - ");
          }
          const spaceIdx = raw.indexOf(" ");
          if (spaceIdx !== -1 && _GARMENT_PREFIXES.has(raw.slice(0, spaceIdx)))
            return raw.slice(spaceIdx + 1);
          return raw;
        })()
      : resolveLabel(attr.key, labelMap);
    if (INLINE_KEYS.has(key.toLowerCase())) continue;
    const entry = { key, rawKey: attr.key, value };
    const isStyleOption =
      !isFitSize &&
      (attr.key.startsWith("Style: ") || attr.key.includes(" - "));
    if (isFitSize) {
      fitSize.push(entry);
    } else if (isStyleOption) {
      options.push(entry);
    } else {
      measurements.push(entry);
    }
  }
  return { options, measurements, fitSize };
}

function SectionLabel({ children }) {
  return (
    <p className="font-hanken text-[12px] font-medium tracking-[2.4px] uppercase text-[#929292]">
      {children}
    </p>
  );
}

function GCCard({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-[12px] p-[25px] border border-gc-divider shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

const PAYMENT_BADGE_CLS = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-100 text-red-600",
};

function PaymentBadge({ status }) {
  const s = (status ?? "").toLowerCase();
  const cls = PAYMENT_BADGE_CLS[s] || PAYMENT_BADGE_CLS.pending;
  return (
    <span
      className={`font-hanken inline-flex items-center px-[16px] py-[6px] rounded-full text-[12px] font-semibold uppercase ${cls}`}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

const SUPPLIER_PILL_CLS = {
  verified: "bg-green-100 text-green-700",
  submitted: "bg-blue-100 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-100 text-red-600",
  processing: "bg-slate-100 text-slate-700",
};

function SupplierPill({ status }) {
  const s = (status ?? "").toLowerCase();
  const cls = SUPPLIER_PILL_CLS[s] || SUPPLIER_PILL_CLS.pending;
  return (
    <span
      className={`font-hanken inline-flex items-center px-[9px] py-[2px] rounded-full text-[10px] font-semibold uppercase shadow-[0_0_0_0.8px_rgba(22,163,74,0.2)] ${cls}`}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function SupplierCard({ orderId, supplierMeta, onSettled }) {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedId, setSelectedId] = useState(supplierMeta.supplierName ?? "");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { submit, retry, submitting, submitError } = useSupplierSubmit(
    orderId,
    onSettled,
  );

  useEffect(() => {
    setSuppliers(SUPPLIERS);
  }, []);
  useEffect(() => {
    if (supplierMeta.supplierName) setSelectedId(supplierMeta.supplierName);
  }, [supplierMeta.supplierName]);

  useClickOutside(dropdownRef, () => setDropdownOpen(false));

  const selectedSupplier = suppliers.find((s) => s.id === selectedId);
  const selectedLabel = selectedSupplier
    ? selectedSupplier.name
    : "— Choose supplier —";
  const { supplierStatus, supplierError, supplierSubmittedAt } = supplierMeta;
  const isFailed = supplierStatus === "failed";
  const isProcessing = supplierStatus === "processing" || submitting;
  const isSubmitted = supplierStatus === "submitted";

  return (
    <GCCard>
      <SectionLabel>Select Supplier</SectionLabel>
      <div className="flex gap-[8px] items-stretch mt-[16px]" ref={dropdownRef}>
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => !isProcessing && setDropdownOpen((o) => !o)}
            disabled={isProcessing}
            className="font-hanken w-full flex items-center justify-between gap-[8px] px-[17px] py-[9px] rounded-[8px] text-[14px] font-semibold tracking-[0.7px] text-gc-near-black2 bg-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed border border-gc-border-input"
          >
            <span>{selectedLabel}</span>
            <ChevronDown
              size={15}
              className={`flex-shrink-0 text-[#424656] transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`absolute left-0 right-0 bottom-full mb-[4px] bg-white rounded-[8px] shadow-lg z-50 overflow-hidden transition-all duration-200 origin-bottom border border-gc-border-input ${dropdownOpen ? "opacity-100 scale-y-100 pointer-events-auto" : "opacity-0 scale-y-95 pointer-events-none"}`}
          >
            <ul className="max-h-[220px] overflow-y-auto py-[4px]">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId("");
                    setDropdownOpen(false);
                  }}
                  className="font-hanken w-full text-left px-[14px] py-[9px] text-[14px] text-[#424656] hover:bg-gc-bg flex items-center justify-between cursor-pointer"
                >
                  — Choose supplier —
                  {!selectedId && (
                    <Check size={13} className="text-gc-primary" />
                  )}
                </button>
              </li>
              {suppliers.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id);
                      setDropdownOpen(false);
                    }}
                    className="font-hanken w-full text-left px-[14px] py-[9px] text-[14px] text-gc-near-black2 hover:bg-gc-bg flex items-center justify-between cursor-pointer"
                  >
                    {s.name}
                    {selectedId === s.id && (
                      <Check size={13} className="text-gc-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {isFailed ? (
          <button
            onClick={() => retry(selectedId)}
            disabled={!selectedId || isProcessing}
            className="flex items-center justify-center w-[35px] rounded-[8px] text-gc-near-black2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-black"
          >
            <RotateCw
              size={14}
              className={isProcessing ? "animate-spin" : ""}
            />
          </button>
        ) : (
          <button
            onClick={() => submit(selectedId)}
            disabled={!selectedId || isProcessing || isSubmitted}
            className="flex items-center justify-center w-[35px] rounded-[8px] text-gc-near-black2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-black"
          >
            <Send size={14} />
          </button>
        )}
      </div>

      {isSubmitted && supplierSubmittedAt && (
        <p className="font-hanken text-[12px] mt-[10px] text-[#44474c]">
          Sent on {formatDate(supplierSubmittedAt)}
        </p>
      )}
      {((isFailed && supplierError) || (submitError && !isSubmitted)) && (
        <div className="mt-[12px] px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-[8px]">
          <p className="font-hanken text-[12px] font-semibold text-red-700 mb-[2px]">
            Submission failed
          </p>
          <p className="font-hanken text-[12px] text-red-600 break-words">
            {supplierError || submitError}
          </p>
        </div>
      )}
    </GCCard>
  );
}

function AttrGrid({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 border-l border-t border-gc-divider/30">
      {items.map(({ key, rawKey, value }) => (
        <div
          key={rawKey ?? key}
          className="flex flex-col items-start px-[10px] py-[10px] sm:px-[16px] sm:py-[14px] min-w-0 overflow-hidden border-r border-b border-gc-divider/30"
        >
          <span className="font-hanken text-[9px] sm:text-[10px] text-[#44474c] uppercase leading-[15px] truncate w-full">
            {key}
          </span>
          <span className="font-hanken text-[12px] sm:text-[16px] font-medium text-gc-near-black2 leading-[20px] sm:leading-[26px] break-words w-full">
            {value || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function GroupedAttrGrid({ items }) {
  const GARMENT_ORDER = ["Jacket", "Trouser", "Vest", "Shirt"];
  const garmentGroups = {};
  const ungrouped = [];
  for (const m of items) {
    const rk = m.rawKey ?? m.key;
    let g = null;
    if (rk.includes(" - ")) {
      const prefix = rk.split(" - ")[0].trim();
      if (GARMENT_ORDER.includes(prefix)) g = prefix;
    }
    if (!g) g = GARMENT_ORDER.find((gg) => rk.startsWith(gg + " "));
    if (!g) g = GARMENT_ORDER.find((gg) => rk.startsWith(gg));
    if (g) {
      if (!garmentGroups[g]) garmentGroups[g] = [];
      garmentGroups[g].push(m);
    } else {
      ungrouped.push(m);
    }
  }
  const garmentKeys = GARMENT_ORDER.filter((g) => garmentGroups[g]?.length);
  if (garmentKeys.length === 0 && ungrouped.length === 0) return null;
  if (garmentKeys.length === 0) return <AttrGrid items={ungrouped} />;
  return (
    <div className="flex flex-col gap-[16px]">
      {garmentKeys.map((g) => (
        <div key={g} className="flex flex-col gap-[8px]">
          <span className="font-hanken text-[11px] font-semibold text-[#a45d41] uppercase tracking-[0.8px]">
            {g}
          </span>
          <AttrGrid items={garmentGroups[g]} />
        </div>
      ))}
      {ungrouped.length > 0 && <AttrGrid items={ungrouped} />}
    </div>
  );
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const shopifyGid = `gid://shopify/Order/${orderId}`;
  const { order, loading, error, refetch } = useOrderDetail(shopifyGid);

  const [fabricOptions, setFabricOptions] = useState([]);
  const [labelMap, setLabelMap] = useState({});
  const [fitSizeKeySet, setFitSizeKeySet] = useState(new Set());
  const [syncingUpcharge, setSyncingUpcharge] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const upchargeSyncFiredRef = useRef(false);

  useEffect(() => {
    fetchFabricOptions()
      .then(setFabricOptions)
      .catch(() => {});
    Promise.all([
      fetchJacketMeasurementFields(),
      fetchTrouserMeasurementFields(),
      fetchVestMeasurementFields(),
      fetchShirtMeasurementFields(),
    ])
      .then(([jacket, trouser, vest, shirt]) => {
        const map = {};
        for (const f of [...jacket, ...trouser, ...vest, ...shirt]) {
          if (f.key && f.label) map[f.key] = f.label;
        }
        setLabelMap(map);
      })
      .catch(() => {});
    fetchFitSizeOptions()
      .then((opts) => {
        const keys = new Set();
        for (const o of opts) {
          keys.add(`${o.garment} ${o.sizeType}`);
          keys.add(`${o.garment} - ${o.sizeType}`);
        }
        setFitSizeKeySet(keys);
      })
      .catch(() => {});
  }, []);

  const lineItems = order?.lineItems?.edges?.map((e) => e.node) ?? [];

  const orderCurrencyCode =
    order?.totalPriceSet?.shopMoney?.currencyCode || "USD";

  // Upcharges from _upcharge_* custom attributes (admin orders)
  const attrUpchargeAmount = lineItems.reduce(
    (sum, item) =>
      sum +
      (item.customAttributes ?? [])
        .filter((a) => a.key.startsWith("_upcharge_"))
        .reduce((s, ua) => s + parseFloat(ua.value || 0), 0),
    0,
  );

  // Upcharges as separate Shopify line items (site orders)
  const separateUpchargeItems = lineItems.filter((item) =>
    item.title.toLowerCase().includes("upcharge"),
  );
  const separateUpchargeAmount = separateUpchargeItems.reduce(
    (sum, item) =>
      sum +
      parseFloat(
        item.discountedTotalSet?.shopMoney?.amount ||
          item.originalUnitPriceSet?.shopMoney?.amount ||
          0,
      ),
    0,
  );

  const totalUpchargeAmount = attrUpchargeAmount + separateUpchargeAmount;

  const subtotalAmount = parseFloat(
    order?.subtotalPriceSet?.shopMoney?.amount || 0,
  );
  const taxAmount = parseFloat(order?.totalTaxSet?.shopMoney?.amount || 0);
  const shopifyTotal = parseFloat(order?.totalPriceSet?.shopMoney?.amount || 0);

  const supplierMeta = parseSupplierMeta(order);
  const {
    supplierError,
    supplierStatus,
    supplierSubmittedAt,
    supplierReference,
    upchargeSynced,
  } = supplierMeta;
  const isFailed = supplierStatus === "failed";

  const upchargeEmbedded =
    upchargeSynced > 0 && Math.abs(upchargeSynced - attrUpchargeAmount) < 0.01;

  // Shopify subtotal = true base price (upcharge stored separately in custom attributes).
  // Only strip separate upcharge line items (added by auto-sync) to avoid double-count.
  const displaySubtotalAmount = subtotalAmount - separateUpchargeAmount;

  // Show attr-based upcharge for admin orders, separate line item for site orders.
  const displayUpchargeAmount =
    attrUpchargeAmount > 0 ? attrUpchargeAmount : separateUpchargeAmount;

  // Total = base subtotal + upcharge + tax.
  const displayTotal =
    displaySubtotalAmount + displayUpchargeAmount + taxAmount;

  const needsUpchargeSync = attrUpchargeAmount > 0.01 && !upchargeEmbedded;

  // Auto-sync: push upcharge as a separate line item and mark with metafield
  useEffect(() => {
    if (!order || !needsUpchargeSync || upchargeSyncFiredRef.current) return;
    upchargeSyncFiredRef.current = true;
    setSyncingUpcharge(true);
    setSyncError(null);
    const gid = `gid://shopify/Order/${orderId}`;
    addUpchargeLineItem(gid, totalUpchargeAmount, orderCurrencyCode)
      .then(() =>
        setOrderMetafields(gid, [
          { key: "upcharge_synced", value: totalUpchargeAmount.toFixed(2) },
        ]),
      )
      .then(() => {
        setSyncingUpcharge(false);
        refetch();
      })
      .catch((err) => {
        setSyncError(err.message);
        setSyncingUpcharge(false);
        upchargeSyncFiredRef.current = false;
      });
  }, [order, needsUpchargeSync]);

  const _categorized = lineItems.map((item) =>
    categorize(item.customAttributes, labelMap, fitSizeKeySet),
  );
  const allOptions = _categorized.flatMap((c) => c.options);
  const allMeasurements = _categorized.flatMap((c) => c.measurements);
  const allFitSize = _categorized.flatMap((c) => c.fitSize);
  const _prefixOrder = [];
  for (const m of allMeasurements) {
    const raw = m.rawKey ?? m.key;
    const prefix = raw.includes(" ") ? raw.split(" ")[0] : "";
    if (prefix && !_prefixOrder.includes(prefix)) _prefixOrder.push(prefix);
  }
  // Combine: measurements first so they appear before fit/size within each garment group
  const allMeasurementsAndFitSize = [...allMeasurements, ...allFitSize];
  allMeasurementsAndFitSize.sort((a, b) => {
    const rawA = a.rawKey ?? a.key;
    const rawB = b.rawKey ?? b.key;
    const pa = rawA.includes(" ") ? rawA.split(" ")[0] : "";
    const pb = rawB.includes(" ") ? rawB.split(" ")[0] : "";
    return _prefixOrder.indexOf(pa) - _prefixOrder.indexOf(pb);
  });

  const storeDomain = (import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? "").replace(
    /\/$/,
    "",
  );
  const shopifyAdminUrl = `${storeDomain}/admin/orders/${orderId}`;

  return (
    <DashboardLayout>
      {loading && (
        <div className="bg-white rounded-[12px] border border-[#c5c6cd]">
          <LoadingState message="Loading order…" />
        </div>
      )}
      {error && (
        <div className="bg-white rounded-[12px] border border-[#c5c6cd]">
          <ErrorState message={error} />
        </div>
      )}

      {!loading && !error && order && (
        <div className="space-y-[20px]">
          {(isFailed || supplierError) && (
            <div className="flex flex-wrap items-start justify-between gap-[16px] pl-[20px] sm:pl-[28px] pr-[16px] sm:pr-[24px] py-[20px] sm:py-[24px] rounded-[4px] bg-red-100 border-l-4 border-l-red-800">
              <div className="flex gap-[16px] items-start">
                <AlertCircle
                  size={20}
                  className="flex-shrink-0 mt-[2px] text-red-900"
                />
                <div className="flex flex-col gap-[4px]">
                  <p className="font-hanken text-[14px] font-semibold tracking-[0.7px] uppercase text-red-900">
                    SUBMISSION FAILED: KUTETAILOR
                  </p>
                  <p className="font-hanken text-[16px] opacity-80 text-red-900">
                    {order.name}:{" "}
                    {supplierError || "Submission failed. Please retry."}
                  </p>
                </div>
              </div>
              <button
                onClick={refetch}
                className="font-hanken flex items-center gap-[8px] px-[20px] py-[8px] rounded-[8px] text-[12px] font-medium tracking-[1.2px] uppercase text-white bg-red-700"
              >
                <RotateCw size={12} />
                RETRY SYNC
              </button>
            </div>
          )}

          <div className="bg-white rounded-[12px] p-[20px] sm:p-[33px] border border-gc-divider shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px]">
              <div className="flex flex-wrap items-start gap-[16px] sm:gap-[24px]">
                <div className="flex flex-col gap-[8px]">
                  <h1 className="font-garamond text-[28px] sm:text-[36px] font-normal text-black leading-[1.1]">
                    Order {order.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-[8px] sm:gap-[12px]">
                    <PaymentBadge
                      status={mapPaymentBadge(order.displayFinancialStatus)}
                    />
                    <span className="font-hanken text-[13px] sm:text-[14px] text-[#44474c]">
                      Placed on {formatDate(order.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-[48px] flex-shrink-0 mt-[14px] bg-gc-divider" />
                <div className="flex gap-[24px] sm:gap-[48px] items-start">
                  <div className="flex flex-col gap-[3px] mt-[14px]">
                    <span className="font-hanken text-[10px] tracking-[1px] uppercase text-[#44474c]">
                      TOTAL AMOUNT
                    </span>
                    <span className="font-garamond text-[20px] sm:text-[24px] text-gc-near-black2 leading-[32px]">
                      {syncingUpcharge
                        ? "Syncing…"
                        : formatAmount(displayTotal, orderCurrencyCode)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[3px] mt-[14px]">
                    <span className="font-hanken text-[10px] tracking-[1px] uppercase text-[#44474c]">
                      ITEMS
                    </span>
                    <span className="font-garamond text-[20px] sm:text-[24px] text-gc-near-black2 leading-[32px]">
                      {lineItems.length}{" "}
                      {lineItems.length === 1 ? "Item" : "Items"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-[10px] self-start sm:self-auto flex-shrink-0">
                <button
                  onClick={() => generateSingleOrderExcel(order, labelMap)}
                  className="font-hanken inline-flex items-center gap-[8px] px-[16px] sm:px-[25px] py-[10px] sm:py-[13px] rounded-[8px] text-[12px] font-bold uppercase text-black border border-black hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  EXPORT
                </button>
                <a
                  href={shopifyAdminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-hanken inline-flex items-center gap-[8px] px-[16px] sm:px-[25px] py-[10px] sm:py-[13px] rounded-[8px] text-[12px] font-bold uppercase text-black border border-black hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink size={13} />
                  OPEN IN SHOPIFY
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-[20px] lg:gap-[30px] items-start">
            <div className="flex flex-col gap-[20px] w-full lg:w-[326px] lg:flex-shrink-0">
              {order.customer && (
                <GCCard>
                  <SectionLabel>Customer Information</SectionLabel>
                  <div className="flex items-center justify-between mt-[7px]">
                    <span className="font-garamond text-[24px] font-medium text-black leading-[31px]">
                      {[order.customer.firstName, order.customer.lastName]
                        .filter(Boolean)
                        .join(" ") || "Guest"}
                    </span>
                  </div>
                  {order.customer.email && (
                    <p className="font-hanken italic text-[16px] text-black mt-[8px] leading-[25.6px]">
                      {order.customer.email}
                    </p>
                  )}
                  {order.customer.id && (
                    <p className="font-hanken text-[14px] font-semibold tracking-[0.7px] mt-[4px] text-gc-primary">
                      CLIENT ID: #{order.customer.id.split("/").pop()}
                    </p>
                  )}
                </GCCard>
              )}

              {(order.shippingAddress || order.billingAddress) && (
                <GCCard className="flex flex-col gap-[24px]">
                  {order.shippingAddress && (
                    <div className="flex flex-col gap-[12px]">
                      <SectionLabel>Shipping Address</SectionLabel>
                      <AddressLines address={order.shippingAddress} />
                    </div>
                  )}
                  {order.shippingAddress && order.billingAddress && (
                    <div className="border-t border-gc-divider/30" />
                  )}
                  {order.billingAddress && (
                    <div className="flex flex-col gap-[12px]">
                      <SectionLabel>Billing Address</SectionLabel>
                      <AddressLines address={order.billingAddress} />
                    </div>
                  )}
                </GCCard>
              )}

              <SupplierCard
                orderId={orderId}
                supplierMeta={supplierMeta}
                onSettled={refetch}
              />
            </div>

            <div className="flex flex-col gap-[20px] w-full flex-1 min-w-0">
              {lineItems
                .filter(
                  (item) => !item.title.toLowerCase().includes("upcharge"),
                )
                .map((item, idx) => {
                  const { options } = categorize(
                    item.customAttributes,
                    labelMap,
                    fitSizeKeySet,
                  );
                  const sizeType = (item.customAttributes ?? []).find(
                    (a) => a.key.toLowerCase() === "size type",
                  )?.value;
                  const fabricLabel =
                    (item.customAttributes ?? []).find(
                      (a) => a.key.toLowerCase() === "fabric",
                    )?.value ?? null;
                  const fabricData = fabricLabel
                    ? fabricOptions.find(
                        (f) =>
                          f.label.toLowerCase() === fabricLabel.toLowerCase(),
                      )
                    : null;

                  const itemBaseTotal = parseFloat(
                    item.discountedTotalSet?.shopMoney?.amount || 0,
                  );
                  const qty = item.quantity || 1;
                  const itemBaseUnitPrice = itemBaseTotal / qty;

                  return (
                    <div key={item.id} className="flex flex-col gap-[20px]">
                      <div className="bg-white rounded-[12px] overflow-hidden border border-gc-divider shadow-sm">
                        <div className="flex items-center justify-between px-[24px] py-[12px] bg-gc-bg-warm">
                          <span className="font-hanken text-[14px] font-semibold tracking-[1.4px] uppercase text-gc-near-black2">
                            ORDER ITEMS
                            {lineItems.length > 1 ? ` · ${idx + 1}` : ""}
                          </span>
                          {item.variant?.sku && (
                            <span className="font-hanken text-[12px] text-[#44474c]">
                              ID: {item.variant.sku}
                            </span>
                          )}
                        </div>

                        <div className="p-[24px] flex flex-col gap-[24px]">
                          <div className="flex flex-col gap-[8px]">
                            <div className="flex items-start justify-between">
                              <span className="font-garamond text-[24px] font-medium text-gc-near-black2 leading-[31px]">
                                {item.title}
                              </span>
                              <span className="font-hanken text-[16px] font-semibold text-gc-primary">
                                {item.discountedTotalSet
                                  ? formatAmount(
                                      itemBaseTotal,
                                      orderCurrencyCode,
                                    )
                                  : "—"}
                              </span>
                            </div>
                            <p className="font-hanken text-[14px] font-semibold text-[#6d6d6d]">
                              {sizeType ? `Size type: ${sizeType} • ` : ""}
                              {item.quantity} ×{" "}
                              {item.originalUnitPriceSet
                                ? formatAmount(
                                    itemBaseUnitPrice,
                                    orderCurrencyCode,
                                  )
                                : "—"}
                            </p>

                            {(() => {
                              const upchargeEntries = (
                                item.customAttributes ?? []
                              ).filter((a) => a.key.startsWith("_upcharge_"));
                              if (!upchargeEntries.length) return null;
                              const currencyCode =
                                order.totalPriceSet?.shopMoney?.currencyCode ||
                                "USD";
                              return (
                                <div className="flex flex-col gap-[6px] mt-[8px] pt-[10px] border-t border-gc-divider/40">
                                  <span className="font-hanken text-[11px] font-semibold uppercase tracking-[1px] text-[#44474c]">
                                    Upcharge
                                  </span>
                                  {upchargeEntries.map((ua) => {
                                    const category = ua.key.slice(
                                      "_upcharge_".length,
                                    );
                                    const selection =
                                      (item.customAttributes ?? []).find(
                                        (a) => a.key === category,
                                      )?.value || "";
                                    const amount = parseFloat(ua.value || 0);
                                    let formatted;
                                    try {
                                      formatted = new Intl.NumberFormat(
                                        "en-US",
                                        {
                                          style: "currency",
                                          currency: currencyCode,
                                        },
                                      ).format(amount);
                                    } catch {
                                      formatted = `${currencyCode} ${amount.toFixed(2)}`;
                                    }
                                    return (
                                      <div
                                        key={ua.key}
                                        className="flex items-center justify-between"
                                      >
                                        <span className="font-hanken text-[13px] text-[#44474c]">
                                          {category}
                                          {selection ? `: ${selection}` : ""}
                                        </span>
                                        <span className="font-hanken text-[13px] font-semibold text-gc-primary">
                                          +{formatted}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {fabricLabel && (
                              <div className="flex items-center gap-[12px] px-[17px] py-[13px] rounded-[8px] bg-gc-surface-neutral border border-gc-divider/50">
                                <span className="font-hanken text-[12px] font-medium uppercase text-gc-label w-[52px] flex-shrink-0">
                                  FABRIC
                                </span>
                                <div className="flex items-center gap-[10px]">
                                  <div
                                    className="flex-shrink-0 rounded-[6px] overflow-hidden"
                                    style={{
                                      width: 32,
                                      height: 32,
                                      border: "1px solid rgba(0,0,0,0.08)",
                                      backgroundColor:
                                        fabricData?.color ?? "#ede9e3",
                                    }}
                                  >
                                    {fabricData?.imageUrl && (
                                      <img
                                        src={fabricData.imageUrl}
                                        alt={fabricLabel}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                          display: "block",
                                        }}
                                      />
                                    )}
                                  </div>
                                  <span className="font-hanken text-[14px] font-medium text-gc-near-black2">
                                    {fabricLabel}
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="flex flex-col gap-[13px] p-[17px] rounded-[8px] mt-[4px] bg-gc-surface-neutral border border-gc-divider/50">
                              <div className="flex items-center gap-[8px]">
                                <span className="font-hanken text-[12px] font-medium uppercase text-gc-label w-[52px]">
                                  SUPPLIER
                                </span>
                                <SupplierPill
                                  status={supplierStatus || "pending"}
                                />
                              </div>
                              {supplierSubmittedAt && (
                                <div className="flex items-center gap-[8px]">
                                  <CalendarCheck2
                                    size={13}
                                    className="text-gc-near-black2"
                                  />
                                  <span className="font-hanken text-[14px] font-medium text-gc-near-black2">
                                    {formatDate(supplierSubmittedAt)}
                                  </span>
                                </div>
                              )}
                              {supplierReference && (
                                <div className="flex items-center gap-[8px]">
                                  <span className="font-hanken text-[11px] font-medium uppercase text-gc-label">
                                    REF#
                                  </span>
                                  <span className="font-hanken text-[13px] font-semibold text-gc-near-black2">
                                    {supplierReference}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-[12px] w-full sm:w-[256px] self-start">
                            <div className="flex items-center justify-between">
                              <span className="font-hanken text-[14px] text-[#44474c]">
                                Subtotal
                              </span>
                              <span className="font-hanken text-[14px] text-gc-near-black2">
                                {formatAmount(
                                  displaySubtotalAmount,
                                  orderCurrencyCode,
                                )}
                              </span>
                            </div>
                            {displayUpchargeAmount > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="font-hanken text-[14px] text-[#44474c]">
                                  Upcharge
                                </span>
                                <span className="font-hanken text-[14px] text-gc-near-black2">
                                  +
                                  {formatAmount(
                                    displayUpchargeAmount,
                                    orderCurrencyCode,
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="font-hanken text-[14px] text-[#44474c]">
                                Taxes & Fees
                              </span>
                              <span className="font-hanken text-[14px] text-gc-near-black2">
                                {order.totalTaxSet
                                  ? formatCurrency(order.totalTaxSet)
                                  : "—"}
                              </span>
                            </div>
                            {syncError && (
                              <p className="font-hanken text-[11px] text-red-600 break-words">
                                Sync failed: {syncError}
                              </p>
                            )}
                            <div className="flex items-center justify-between pt-[9px] border-t border-gc-divider">
                              <span className="font-garamond text-[18px] font-bold text-gc-primary">
                                Total
                              </span>
                              <span className="font-garamond text-[18px] font-bold text-gc-primary">
                                {formatAmount(displayTotal, orderCurrencyCode)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {allOptions.length > 0 && (
                <GCCard className="flex flex-col gap-[20px]">
                  <div className="flex items-center gap-[8px]">
                    <ListChecks size={20} className="text-gc-primary" />
                    <span className="font-garamond text-[24px] font-medium text-gc-near-black2 leading-[31px]">
                      Style Options
                    </span>
                  </div>
                  <GroupedAttrGrid items={allOptions} />
                </GCCard>
              )}

              {allMeasurementsAndFitSize.length > 0 && (
                <GCCard className="flex flex-col gap-[20px]">
                  <div className="flex items-center gap-[8px]">
                    <ListChecks size={20} className="text-gc-primary" />
                    <span className="font-garamond text-[24px] font-medium text-gc-near-black2 leading-[31px]">
                      Measurements
                    </span>
                  </div>
                  <GroupedAttrGrid items={allMeasurementsAndFitSize} />
                </GCCard>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function AddressLines({ address }) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const cityLine = [address.city, address.province, address.zip]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="font-hanken text-[14px] text-gc-near-black2 leading-[22.75px]">
      {name && <p>{name}</p>}
      {address.address1 && <p>{address.address1}</p>}
      {address.address2 && <p>{address.address2}</p>}
      {cityLine && <p>{cityLine}</p>}
      {address.country && <p>{address.country}</p>}
    </div>
  );
}

import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  ExternalLink,
  RefreshCw,
  RotateCw,
  ChevronDown,
  Check,
  AlertCircle,
  Calendar,
  Ruler,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useOrderDetail } from "../hooks/useOrderDetail";
import { useSupplierSubmit, SUPPLIERS } from "../hooks/useSupplierSubmit";
import { formatCurrency, formatDate } from "../lib/shopify";

// ─── Helpers ───────────────────────────────────────────────────────────────

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
  };
}

function categorize(customAttributes = []) {
  const general = [];
  const measurements = [];
  const vest = [];
  for (const attr of customAttributes) {
    if (attr.key.startsWith("_")) continue;
    if (attr.key.startsWith("Vest ")) {
      vest.push({ key: attr.key.replace("Vest ", ""), value: attr.value });
    } else if (attr.value && /^\d/.test(attr.value)) {
      measurements.push(attr);
    } else {
      general.push(attr);
    }
  }
  return { general, measurements, vest };
}

// ─── GC Section label ──────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p
      className="font-hanken text-[12px] font-medium tracking-[2.4px] uppercase"
      style={{ color: "#929292" }}
    >
      {children}
    </p>
  );
}

// ─── GC White card ─────────────────────────────────────────────────────────
function GCCard({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-[12px] p-[25px] ${className}`}
      style={{
        border: "1px solid #c5c6cd",
        boxShadow: "0px 1px 1px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Payment badge ─────────────────────────────────────────────────────────
function PaymentBadge({ status }) {
  const s = (status ?? "").toLowerCase();
  const styles = {
    paid: { bg: "#ecfdf5", text: "#047857" },
    pending: { bg: "#fef3c7", text: "#b45309" },
    failed: { bg: "#fee2e2", text: "#dc2626" },
  };
  const { bg, text } = styles[s] || styles.pending;
  return (
    <span
      className="font-hanken inline-flex items-center px-[16px] py-[6px] rounded-full text-[12px] font-semibold uppercase"
      style={{ backgroundColor: bg, color: text }}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

// ─── Supplier status pill ──────────────────────────────────────────────────
function SupplierPill({ status }) {
  const s = (status ?? "").toLowerCase();
  const styles = {
    verified: { bg: "#dcfce7", text: "#15803d" },
    submitted: { bg: "#dbeafe", text: "#1d4ed8" },
    pending: { bg: "#fef3c7", text: "#b45309" },
    failed: { bg: "#fee2e2", text: "#dc2626" },
    processing: { bg: "#f1f5f9", text: "#334155" },
  };
  const { bg, text } = styles[s] || styles.pending;
  return (
    <span
      className="font-hanken inline-flex items-center px-[9px] py-[2px] rounded-full text-[10px] font-semibold uppercase"
      style={{
        backgroundColor: bg,
        color: text,
        boxShadow: "0 0 0 0.8px rgba(22,163,74,0.2)",
      }}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

// ─── Supplier Card ─────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

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
            className="font-hanken w-full flex items-center justify-between gap-[8px] px-[17px] py-[9px] rounded-[8px] text-[14px] font-semibold tracking-[0.7px] text-[#1a1c1b] bg-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ border: "1px solid #d1c7bd" }}
          >
            <span>{selectedLabel}</span>
            <ChevronDown
              size={15}
              className={`flex-shrink-0 text-[#424656] transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>
          {dropdownOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-[4px] bg-white rounded-[8px] shadow-lg z-50 overflow-hidden"
              style={{ border: "1px solid #d1c7bd" }}
            >
              <ul className="max-h-[220px] overflow-y-auto py-[4px]">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId("");
                      setDropdownOpen(false);
                    }}
                    className="font-hanken w-full text-left px-[14px] py-[9px] text-[14px] text-[#424656] hover:bg-[#f4f1ed] flex items-center justify-between cursor-pointer"
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
                      className="font-hanken w-full text-left px-[14px] py-[9px] text-[14px] text-[#1a1c1b] hover:bg-[#f4f1ed] flex items-center justify-between cursor-pointer"
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
          )}
        </div>

        {/* Action button */}
        {isFailed ? (
          <button
            onClick={() => retry(selectedId)}
            disabled={!selectedId || isProcessing}
            className="flex items-center justify-center w-[35px] rounded-[8px] text-[#1a1c1b] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "1px solid #000" }}
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
            className="flex items-center justify-center w-[35px] rounded-[8px] text-[#1a1c1b] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "1px solid #000" }}
          >
            <RefreshCw
              size={14}
              className={isProcessing ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>

      {isSubmitted && supplierSubmittedAt && (
        <p
          className="font-hanken text-[12px] mt-[10px]"
          style={{ color: "#44474c" }}
        >
          Sent on {formatDate(supplierSubmittedAt)}
        </p>
      )}
      {((isFailed && supplierError) || submitError) && (
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

// ─── Page ──────────────────────────────────────────────────────────────────
export default function OrderDetail() {
  const { orderId } = useParams();
  const shopifyGid = `gid://shopify/Order/${orderId}`;
  const { order, loading, error, refetch } = useOrderDetail(shopifyGid);

  const lineItems = order?.lineItems?.edges?.map((e) => e.node) ?? [];
  const supplierMeta = parseSupplierMeta(order);
  const { supplierError, supplierStatus, supplierSubmittedAt } = supplierMeta;
  const isFailed = supplierStatus === "failed";

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
          {/* ── Error alert banner ── */}
          {(isFailed || supplierError) && (
            <div
              className="flex flex-wrap items-start justify-between gap-[16px] pl-[20px] sm:pl-[28px] pr-[16px] sm:pr-[24px] py-[20px] sm:py-[24px] rounded-[4px]"
              style={{
                backgroundColor: "#ffdad6",
                borderLeft: "4px solid #ba1a1a",
              }}
            >
              <div className="flex gap-[16px] items-start">
                <AlertCircle
                  size={20}
                  className="flex-shrink-0 mt-[2px]"
                  style={{ color: "#93000a" }}
                />
                <div className="flex flex-col gap-[4px]">
                  <p
                    className="font-hanken text-[14px] font-semibold tracking-[0.7px] uppercase"
                    style={{ color: "#93000a" }}
                  >
                    SUBMISSION FAILED: KUTETAILOR
                  </p>
                  <p
                    className="font-hanken text-[16px] opacity-80"
                    style={{ color: "#93000a" }}
                  >
                    {order.name}:{" "}
                    {supplierError || "Submission failed. Please retry."}
                  </p>
                </div>
              </div>
              <button
                onClick={refetch}
                className="font-hanken flex items-center gap-[8px] px-[20px] py-[8px] rounded-[8px] text-[12px] font-medium tracking-[1.2px] uppercase text-white"
                style={{ backgroundColor: "#ba1a1a" }}
              >
                <RotateCw size={12} />
                RETRY SYNC
              </button>
            </div>
          )}

          {/* ── Order header card ── */}
          <div
            className="bg-white rounded-[12px] p-[20px] sm:p-[33px]"
            style={{
              border: "1px solid #c5c6cd",
              boxShadow: "0px 1px 1px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px]">
              <div className="flex flex-wrap items-start gap-[16px] sm:gap-[24px]">
                {/* Order # + status + date */}
                <div className="flex flex-col gap-[8px]">
                  <h1 className="font-garamond text-[28px] sm:text-[36px] font-normal text-black leading-[1.1]">
                    {order.name}
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

                {/* Vertical divider — hidden on mobile */}
                <div
                  className="hidden sm:block w-px h-[48px] flex-shrink-0"
                  style={{ backgroundColor: "#c5c6cd" }}
                />

                {/* Stats */}
                <div className="flex gap-[24px] sm:gap-[48px] items-start">
                  <div className="flex flex-col gap-[3px]">
                    <span className="font-hanken text-[10px] tracking-[1px] uppercase text-[#44474c]">
                      TOTAL AMOUNT
                    </span>
                    <span className="font-garamond text-[20px] sm:text-[24px] text-[#1a1c1b] leading-[32px]">
                      {formatCurrency(order.totalPriceSet)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    <span className="font-hanken text-[10px] tracking-[1px] uppercase text-[#44474c]">
                      ITEMS
                    </span>
                    <span className="font-garamond text-[20px] sm:text-[24px] text-[#1a1c1b] leading-[32px]">
                      {lineItems.length}{" "}
                      {lineItems.length === 1 ? "Item" : "Items"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Open in Shopify */}
              <a
                href={shopifyAdminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-hanken inline-flex items-center gap-[8px] px-[16px] sm:px-[25px] py-[10px] sm:py-[13px] rounded-[8px] text-[12px] font-bold uppercase text-black border border-black hover:bg-gray-50 transition-colors self-start sm:self-auto flex-shrink-0"
              >
                <ExternalLink size={13} />
                OPEN IN SHOPIFY
              </a>
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div className="flex flex-col lg:flex-row gap-[20px] lg:gap-[30px] items-start">
            {/* Left column */}
            <div className="flex flex-col gap-[20px] w-full lg:w-[326px] lg:flex-shrink-0">
              {/* Customer card */}
              {order.customer && (
                <GCCard>
                  <SectionLabel>Customer Information</SectionLabel>
                  <div className="flex items-center justify-between mt-[7px]">
                    <span className="font-garamond text-[24px] font-medium text-black leading-[31px]">
                      {[order.customer.firstName, order.customer.lastName]
                        .filter(Boolean)
                        .join(" ") || "Guest"}
                    </span>
                    {order.customer.tags?.includes("premium") && (
                      <span
                        className="font-hanken text-[10px] font-bold uppercase text-black px-[8px] py-[2px] rounded-[8px]"
                        style={{ backgroundColor: "#ffdea5" }}
                      >
                        PREMIUM MEMBER
                      </span>
                    )}
                  </div>
                  {order.customer.email && (
                    <p className="font-hanken italic text-[16px] text-black mt-[8px] leading-[25.6px]">
                      {order.customer.email}
                    </p>
                  )}
                  {order.customer.id && (
                    <p
                      className="font-hanken text-[14px] font-semibold tracking-[0.7px] mt-[4px]"
                      style={{ color: "#a45d41" }}
                    >
                      CLIENT ID: #{order.customer.id.split("/").pop()}
                    </p>
                  )}
                </GCCard>
              )}

              {/* Address card */}
              {(order.shippingAddress || order.billingAddress) && (
                <GCCard className="flex flex-col gap-[24px]">
                  {order.shippingAddress && (
                    <div className="flex flex-col gap-[12px]">
                      <SectionLabel>Shipping Address</SectionLabel>
                      <AddressLines address={order.shippingAddress} />
                    </div>
                  )}
                  {order.shippingAddress && order.billingAddress && (
                    <div
                      style={{ borderTop: "1px solid rgba(197,198,205,0.3)" }}
                    />
                  )}
                  {order.billingAddress && (
                    <div className="flex flex-col gap-[12px]">
                      <SectionLabel>Billing Address</SectionLabel>
                      <AddressLines address={order.billingAddress} />
                    </div>
                  )}
                </GCCard>
              )}

              {/* Supplier card */}
              <SupplierCard
                orderId={orderId}
                supplierMeta={supplierMeta}
                onSettled={refetch}
              />
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-[20px] flex-1 min-w-0">
              {/* Order items card */}
              {lineItems.map((item, idx) => {
                const { general, measurements, vest } = categorize(
                  item.customAttributes,
                );
                const allMeasurements = [...measurements, ...vest];
                const sizeType = general.find(
                  (a) => a.key.toLowerCase() === "size type",
                )?.value;

                return (
                  <div key={item.id} className="flex flex-col gap-[20px]">
                    {/* Items card */}
                    <div
                      className="bg-white rounded-[12px] overflow-hidden"
                      style={{
                        border: "1px solid #c5c6cd",
                        boxShadow: "0px 1px 1px rgba(0,0,0,0.05)",
                      }}
                    >
                      {/* Card header */}
                      <div
                        className="flex items-center justify-between px-[24px] py-[12px]"
                        style={{ backgroundColor: "#f2e9e5" }}
                      >
                        <span className="font-hanken text-[14px] font-semibold tracking-[1.4px] uppercase text-[#1a1c1b]">
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
                        {/* Item row */}
                        <div className="flex flex-col gap-[8px]">
                          <div className="flex items-start justify-between">
                            <span className="font-garamond text-[24px] font-medium text-[#1a1c1b] leading-[31px]">
                              {item.title}
                            </span>
                            <span
                              className="font-hanken text-[16px] font-semibold"
                              style={{ color: "#a45d41" }}
                            >
                              {item.discountedTotalSet
                                ? formatCurrency(item.discountedTotalSet)
                                : "—"}
                            </span>
                          </div>
                          <p className="font-hanken text-[14px] font-semibold text-[#6d6d6d]">
                            {sizeType ? `Size type: ${sizeType} • ` : ""}
                            {item.quantity} ×{" "}
                            {item.originalUnitPriceSet
                              ? formatCurrency(item.originalUnitPriceSet)
                              : "—"}
                          </p>

                          {/* Fulfillment info box */}
                          <div
                            className="flex flex-col gap-[13px] p-[17px] rounded-[8px] mt-[4px]"
                            style={{
                              backgroundColor: "#f4f4f2",
                              border: "1px solid rgba(197,198,205,0.5)",
                            }}
                          >
                            <div className="flex items-center gap-[8px]">
                              <span className="font-hanken text-[12px] font-medium uppercase text-[#535353] w-[52px]">
                                SUPPLIER
                              </span>
                              <SupplierPill
                                status={supplierStatus || "pending"}
                              />
                            </div>
                            {supplierSubmittedAt && (
                              <div className="flex items-center gap-[8px]">
                                <Calendar
                                  size={13}
                                  style={{ color: "#1a1c1b" }}
                                />
                                <span className="font-hanken text-[14px] font-medium text-[#1a1c1b]">
                                  {formatDate(supplierSubmittedAt)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Ledger */}
                        <div className="flex flex-col gap-[12px] w-[256px] self-start">
                          {[
                            {
                              label: "Subtotal",
                              value: order.subtotalPriceSet,
                            },
                            { label: "Taxes & Fees", value: order.totalTaxSet },
                          ].map(({ label, value }) => (
                            <div
                              key={label}
                              className="flex items-center justify-between"
                            >
                              <span className="font-hanken text-[14px] text-[#44474c]">
                                {label}
                              </span>
                              <span className="font-hanken text-[14px] text-[#1a1c1b]">
                                {value ? formatCurrency(value) : "—"}
                              </span>
                            </div>
                          ))}
                          <div
                            className="flex items-center justify-between pt-[9px]"
                            style={{ borderTop: "1px solid #c5c6cd" }}
                          >
                            <span
                              className="font-garamond text-[18px] font-bold"
                              style={{ color: "#a45d41" }}
                            >
                              Total
                            </span>
                            <span
                              className="font-garamond text-[18px] font-bold"
                              style={{ color: "#a45d41" }}
                            >
                              {formatCurrency(order.totalPriceSet)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Measurements card */}
                    {allMeasurements.length > 0 && (
                      <GCCard className="flex flex-col gap-[24px]">
                        <div className="flex items-center gap-[8px]">
                          <Ruler size={18} style={{ color: "#1a1c1b" }} />
                          <span className="font-garamond text-[24px] font-medium text-[#1a1c1b] leading-[31px]">
                            Anatomical Measurements
                          </span>
                        </div>

                        {/* 4-col grid */}
                        <div
                          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                          style={{
                            borderLeft: "1px solid rgba(197,198,205,0.3)",
                            borderTop: "1px solid rgba(197,198,205,0.3)",
                          }}
                        >
                          {allMeasurements.map(({ key, value }) => (
                            <div
                              key={key}
                              className="flex flex-col items-start px-[16px] py-[16px]"
                              style={{
                                borderRight: "1px solid rgba(197,198,205,0.3)",
                                borderBottom: "1px solid rgba(197,198,205,0.3)",
                              }}
                            >
                              <span className="font-hanken text-[10px] text-[#44474c] uppercase leading-[15px]">
                                {key}
                              </span>
                              <span className="font-hanken text-[18px] font-medium text-[#1a1c1b] leading-[28px]">
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </GCCard>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Address lines helper ──────────────────────────────────────────────────
function AddressLines({ address }) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const cityLine = [address.city, address.province, address.zip]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="font-hanken text-[14px] text-[#1a1c1b] leading-[22.75px]">
      {name && <p>{name}</p>}
      {address.address1 && <p>{address.address1}</p>}
      {address.address2 && <p>{address.address2}</p>}
      {cityLine && <p>{cityLine}</p>}
      {address.country && <p>{address.country}</p>}
    </div>
  );
}

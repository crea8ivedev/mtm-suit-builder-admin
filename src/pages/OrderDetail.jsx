import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Ruler,
  Scissors,
  Tag,
  FileText,
  Package,
  Send,
  RotateCw,
  Truck,
  User,
  MapPin,
  ChevronDown,
  Check,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import Badge from "../components/ui/Badge";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useOrderDetail } from "../hooks/useOrderDetail";
import { useSupplierSubmit, SUPPLIERS } from "../hooks/useSupplierSubmit";
import { formatCurrency, formatDate } from "../lib/shopify";

// Categorize purely from Shopify data — no hardcoded key lists.
// 'Vest ' prefix → vest section. Everything else → measurements or general.
// "General" = short values (≤30 chars, no digits after space) used as attribute tags.
function categorize(customAttributes = []) {
  const general = [];
  const measurements = [];
  const vest = [];

  for (const attr of customAttributes) {
    if (attr.key.startsWith("_")) continue;
    if (attr.key.startsWith("Vest ")) {
      vest.push({ key: attr.key.replace("Vest ", ""), value: attr.value });
    } else if (attr.value && /^\d/.test(attr.value)) {
      // Starts with a digit → numeric measurement
      measurements.push(attr);
    } else {
      general.push(attr);
    }
  }

  return { general, measurements, vest };
}

// ─── Shared components ─────────────────────────────────────────────────────
function MeasurementGrid({ title, icon: Icon, items, accent }) {
  if (!items.length) return null;

  const accentColors = {
    jacket: {
      border: "border-brand-600",
      bg: "bg-brand-50",
      text: "text-brand-700",
      dot: "bg-brand-600",
    },
    trouser: {
      border: "border-submitted",
      bg: "bg-submitted-bg",
      text: "text-submitted",
      dot: "bg-submitted",
    },
    vest: {
      border: "border-pending",
      bg: "bg-pending-bg",
      text: "text-pending",
      dot: "bg-pending",
    },
  };
  const c = accentColors[accent] || accentColors.jacket;

  return (
    <div className={`card overflow-hidden border-l-4 ${c.border}`}>
      <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
        {Icon && <Icon size={14} className={c.text} />}
        <h3 className={`text-13 font-bold uppercase tracking-wider ${c.text}`}>
          {title}
        </h3>
        <span
          className={`ml-auto text-11 font-semibold ${c.text} ${c.bg} px-[8px] py-[2px] rounded-full`}
        >
          {items.length} measurements
        </span>
      </div>
      <div className="p-[16px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[10px]">
        {items.map(({ key, value }) => (
          <div
            key={key}
            className="bg-gray-50 rounded-lg px-[12px] py-[10px] border border-border-light"
          >
            <p className="text-11 text-text-muted font-medium mb-[3px] truncate">
              {key}
            </p>
            <p className="text-15 font-bold text-text-primary">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function mapPaymentBadge(s) {
  return (
    {
      PAID: "paid",
      PENDING: "pending",
      REFUNDED: "failed",
      PARTIALLY_REFUNDED: "partial",
      VOIDED: "failed",
      AUTHORIZED: "pending",
      PARTIALLY_PAID: "partial",
    }[s] || "pending"
  );
}

// Parse suit_admin metafields from order into a plain object
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

// ─── Address Card ───────────────────────────────────────────────────────────
function AddressCard({ title, address }) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const cityLine = [address.city, address.province, address.zip]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="card p-[20px]">
      <div className="flex items-center gap-[8px] mb-[12px]">
        <MapPin size={14} className="text-text-muted" />
        <h3 className="text-13 font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="text-14 text-text-secondary space-y-[2px]">
        {name && <p className="font-medium text-text-primary">{name}</p>}
        {address.address1 && <p>{address.address1}</p>}
        {address.address2 && <p>{address.address2}</p>}
        {cityLine && <p>{cityLine}</p>}
        {address.country && <p>{address.country}</p>}
        {address.phone && <p className="text-text-muted">{address.phone}</p>}
      </div>
    </div>
  );
}

// ─── Supplier Card ──────────────────────────────────────────────────────────
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

  // Keep dropdown in sync when order refetches
  useEffect(() => {
    if (supplierMeta.supplierName) setSelectedId(supplierMeta.supplierName);
  }, [supplierMeta.supplierName]);

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
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

  const statusLabel = isProcessing
    ? "processing"
    : (supplierStatus ?? "pending");

  return (
    <div className="card">
      <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
        <Truck size={14} className="text-text-muted" />
        <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
          Supplier
        </h3>
        {supplierStatus && (
          <span className="ml-auto">
            <Badge status={statusLabel} />
          </span>
        )}
      </div>

      <div className="p-[20px] flex flex-wrap items-end gap-[16px]">
        {/* Supplier select — custom dropdown always opens downward */}
        <div className="flex-1 min-w-[200px] relative" ref={dropdownRef}>
          <label className="block text-11 font-semibold text-text-muted uppercase tracking-wider mb-[6px]">
            Select Supplier
          </label>
          <button
            type="button"
            onClick={() => !isProcessing && setDropdownOpen((o) => !o)}
            disabled={isProcessing}
            className="input w-full py-[9px] flex items-center justify-between gap-[8px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-left"
          >
            <span
              className={selectedId ? "text-text-primary" : "text-text-muted"}
            >
              {selectedLabel}
            </span>
            <ChevronDown
              size={15}
              className={`flex-shrink-0 text-text-muted transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-[4px] bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <ul className="max-h-[220px] overflow-y-auto py-[4px]">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId("");
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-[14px] py-[9px] text-14 text-text-muted hover:bg-gray-50 flex items-center justify-between"
                  >
                    — Choose supplier —
                    {!selectedId && (
                      <Check size={13} className="text-brand-600" />
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
                      className="w-full text-left px-[14px] py-[9px] text-14 text-text-primary hover:bg-gray-50 flex items-center justify-between"
                    >
                      {s.name}
                      {selectedId === s.id && (
                        <Check size={13} className="text-brand-600" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex flex-col gap-[8px]">
          {isFailed ? (
            <button
              onClick={() => retry(selectedId)}
              disabled={!selectedId || isProcessing}
              className="btn-secondary gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw
                size={14}
                className={isProcessing ? "animate-spin" : ""}
              />
              {isProcessing ? "Retrying…" : "Retry"}
            </button>
          ) : (
            <button
              onClick={() => submit(selectedId)}
              disabled={!selectedId || isProcessing || isSubmitted}
              className="btn-primary gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              {isProcessing
                ? "Sending…"
                : isSubmitted
                  ? "Submitted"
                  : "Send to Supplier"}
            </button>
          )}
        </div>
      </div>

      {/* Submitted timestamp */}
      {isSubmitted && supplierSubmittedAt && (
        <div className="px-[20px] pb-[14px]">
          <p className="text-12 text-text-muted">
            Sent on {formatDate(supplierSubmittedAt)}
          </p>
        </div>
      )}

      {/* Error message */}
      {(isFailed && supplierError) || submitError ? (
        <div className="mx-[20px] mb-[16px] px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-lg">
          <p className="text-12 font-semibold text-red-700 mb-[2px]">
            Submission failed
          </p>
          <p className="text-12 text-red-600 break-words">
            {supplierError || submitError}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function OrderDetail() {
  const { orderId } = useParams();
  const { state: navState } = useLocation();
  const shopifyGid = `gid://shopify/Order/${orderId}`;
  const { order, loading, error, refetch } = useOrderDetail(shopifyGid);

  const lineItems = order?.lineItems?.edges?.map((e) => e.node) ?? [];
  const supplierMeta = parseSupplierMeta(order);

  return (
    <DashboardLayout>
      {/* Back nav */}
      <div className="mb-[20px]">
        {navState?.fromCustomer ? (
          <Link
            to={`/customers/${navState.fromCustomer}`}
            className="inline-flex items-center gap-[6px] text-13 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Customer
          </Link>
        ) : (
          <Link
            to="/orders"
            className="inline-flex items-center gap-[6px] text-13 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Orders
          </Link>
        )}
      </div>

      {loading && (
        <div className="card">
          <LoadingState message="Loading order details…" />
        </div>
      )}
      {error && (
        <div className="card">
          <ErrorState message={error} />
        </div>
      )}

      {!loading && !error && order && (
        <div className="space-y-[20px]">
          {/* ── Order header ── */}
          <div className="card p-[20px] md:p-[24px]">
            <div className="flex flex-wrap items-start justify-between gap-[16px]">
              <div>
                <div className="flex items-center gap-[12px] flex-wrap mb-[6px]">
                  <h1 className="text-28 font-bold text-text-primary">
                    {order.name}
                  </h1>
                  <Badge
                    status={mapPaymentBadge(order.displayFinancialStatus)}
                  />
                </div>
                <p className="text-14 text-text-muted">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-[8px]">
                <a
                  href={`https://admin.shopify.com/orders/${orderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary gap-[8px]"
                >
                  <ExternalLink size={14} />
                  Open in Shopify
                </a>
              </div>
            </div>

            {/* Quick stats row */}
            <div className="flex flex-wrap gap-[24px] mt-[20px] pt-[20px] border-t border-border">
              <div>
                <p className="text-11 text-text-muted font-semibold uppercase tracking-wider mb-[2px]">
                  Items
                </p>
                <p className="text-16 font-bold text-text-primary">
                  {lineItems.length}
                </p>
              </div>
              <div>
                <p className="text-11 text-text-muted font-semibold uppercase tracking-wider mb-[2px]">
                  Total
                </p>
                <p className="text-16 font-bold text-text-primary">
                  {formatCurrency(order.totalPriceSet)}
                </p>
              </div>
              <div>
                <p className="text-11 text-text-muted font-semibold uppercase tracking-wider mb-[2px]">
                  Payment
                </p>
                <p className="text-14 font-medium text-text-primary capitalize">
                  {order.displayFinancialStatus
                    ?.replace(/_/g, " ")
                    .toLowerCase()}
                </p>
              </div>
              <div>
                <p className="text-11 text-text-muted font-semibold uppercase tracking-wider mb-[2px]">
                  Fulfillment
                </p>
                <p className="text-14 font-medium text-text-primary capitalize">
                  {order.displayFulfillmentStatus
                    ?.replace(/_/g, " ")
                    .toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          {/* ── Customer ── */}
          {order.customer && (
            <div className="card p-[20px]">
              <div className="flex items-center gap-[8px] mb-[14px]">
                <User size={14} className="text-text-muted" />
                <h3 className="text-13 font-semibold text-text-primary">
                  Customer
                </h3>
              </div>
              <div className="flex items-start gap-[12px]">
                <div className="w-[40px] h-[40px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-16 font-bold">
                    {(order.customer.firstName || order.customer.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-15">
                    {[order.customer.firstName, order.customer.lastName]
                      .filter(Boolean)
                      .join(" ") || "Guest"}
                  </p>
                  {order.customer.email && (
                    <p className="text-13 text-text-muted mt-[2px]">
                      {order.customer.email}
                    </p>
                  )}
                  {order.customer.phone && (
                    <p className="text-13 text-text-muted">
                      {order.customer.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Addresses ── */}
          {(order.shippingAddress || order.billingAddress) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
              {order.shippingAddress && (
                <AddressCard
                  title="Shipping Address"
                  address={order.shippingAddress}
                />
              )}
              {order.billingAddress && (
                <AddressCard
                  title="Billing Address"
                  address={order.billingAddress}
                />
              )}
            </div>
          )}

          {/* ── Supplier ── */}
          <SupplierCard
            orderId={orderId}
            supplierMeta={supplierMeta}
            onSettled={refetch}
          />

          {/* ── One section per line item ── */}
          {lineItems.map((item, idx) => {
            const variantLabel =
              item.variant?.title && item.variant.title !== "Default Title"
                ? item.variant.title
                : null;
            const { general, measurements, vest } = categorize(
              item.customAttributes,
            );
            const hasMeasurements = measurements.length || vest.length;

            return (
              <div key={item.id} className="space-y-[14px]">
                {/* ── Product info card ── */}
                <div className="card p-[20px]">
                  <div className="flex flex-wrap items-start justify-between gap-[12px]">
                    <div className="flex items-start gap-[12px]">
                      <div className="w-[40px] h-[40px] rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                        <Scissors size={18} className="text-brand-600" />
                      </div>
                      <div>
                        <p className="text-16 font-bold text-text-primary leading-tight">
                          {item.title}
                        </p>
                        {variantLabel && (
                          <p className="text-13 text-text-muted mt-[2px]">
                            {variantLabel}
                          </p>
                        )}
                        {item.variant?.sku && (
                          <p className="text-12 text-text-muted font-mono mt-[2px]">
                            SKU: {item.variant.sku}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-18 font-bold text-text-primary">
                        {item.discountedTotalSet
                          ? formatCurrency(item.discountedTotalSet)
                          : "—"}
                      </p>
                      <p className="text-13 text-text-muted">
                        {item.quantity} ×{" "}
                        {item.originalUnitPriceSet
                          ? formatCurrency(item.originalUnitPriceSet)
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* General attributes (Size type, etc.) */}
                  {general.length > 0 && (
                    <div className="flex flex-wrap gap-[8px] mt-[16px] pt-[14px] border-t border-border">
                      {general.map(({ key, value }) => (
                        <div
                          key={key}
                          className="flex items-center gap-[6px] bg-gray-100 rounded-lg px-[10px] py-[5px]"
                        >
                          <span className="text-12 text-text-muted">
                            {key}:
                          </span>
                          <span className="text-12 font-semibold text-text-primary">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Measurement grids ── */}
                {hasMeasurements > 0 && (
                  <>
                    {lineItems.length > 1 && (
                      <div className="flex items-center gap-[8px]">
                        <div className="flex-1 h-[1px] bg-border" />
                        <span className="text-12 text-text-muted font-semibold uppercase tracking-wider px-[8px]">
                          Measurements — Item {idx + 1}
                        </span>
                        <div className="flex-1 h-[1px] bg-border" />
                      </div>
                    )}

                    <MeasurementGrid
                      title="Measurements"
                      icon={Ruler}
                      items={measurements}
                      accent="jacket"
                    />
                    <MeasurementGrid
                      title="Vest Measurements"
                      icon={Package}
                      items={vest}
                      accent="vest"
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* ── Order summary ── */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
              <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
                Order Summary
              </h3>
            </div>
            <div className="p-[20px] space-y-[10px] max-w-[360px] ml-auto">
              {[
                { label: "Subtotal", value: order.subtotalPriceSet },
                { label: "Shipping", value: order.totalShippingPriceSet },
                { label: "Tax", value: order.totalTaxSet },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-14">
                  <span className="text-text-secondary">{label}</span>
                  <span className="text-text-primary">
                    {value ? formatCurrency(value) : "—"}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-16 font-bold pt-[12px] border-t border-border-light">
                <span className="text-text-primary">Total</span>
                <span className="text-text-primary">
                  {formatCurrency(order.totalPriceSet)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Fulfillment tracking ── */}
          {order.fulfillments?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
                <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
                  Fulfillment
                </h3>
              </div>
              <div className="p-[20px] space-y-[12px]">
                {order.fulfillments.map((f, i) => (
                  <div key={i} className="flex items-start gap-[10px]">
                    <div className="w-[8px] h-[8px] rounded-full bg-submitted mt-[5px] flex-shrink-0" />
                    <div>
                      <p className="text-14 font-semibold text-text-primary capitalize">
                        {f.status.toLowerCase().replace(/_/g, " ")}
                      </p>
                      {f.trackingInfo?.map((t, j) => (
                        <div key={j} className="mt-[4px]">
                          {t.url ? (
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-13 text-brand-600 hover:text-brand-700 flex items-center gap-[4px]"
                            >
                              {t.number}
                              {t.company && (
                                <span className="text-text-muted">
                                  · {t.company}
                                </span>
                              )}
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <p className="text-13 text-text-secondary">
                              {t.number}
                            </p>
                          )}
                        </div>
                      ))}
                      <p className="text-12 text-text-muted mt-[2px]">
                        {formatDate(f.updatedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tags ── */}
          {order.tags?.length > 0 && (
            <div className="card p-[20px]">
              <div className="flex items-center gap-[8px] mb-[12px]">
                <Tag size={14} className="text-text-muted" />
                <h3 className="text-13 font-semibold text-text-primary">
                  Tags
                </h3>
              </div>
              <div className="flex flex-wrap gap-[6px]">
                {order.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-[8px] py-[3px] bg-brand-50 text-brand-600 text-12 font-medium rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Order note ── */}
          {order.note && (
            <div className="card p-[20px]">
              <div className="flex items-center gap-[8px] mb-[10px]">
                <FileText size={14} className="text-text-muted" />
                <h3 className="text-13 font-semibold text-text-primary">
                  Note
                </h3>
              </div>
              <p className="text-14 text-text-secondary leading-relaxed">
                {order.note}
              </p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

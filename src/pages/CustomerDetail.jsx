import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Mail, Phone, Save, X, Pencil } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useCustomerDetail } from "../hooks/useCustomerDetail";
import {
  formatCurrency,
  formatDate,
  formatMoney,
  fetchVestRanges,
  fetchShirtRanges,
  fetchTrouserRanges,
  fetchJacketRanges,
  setCustomerProductsMetafield,
} from "../lib/shopify";
import { cn } from "../utils/cn";

const ORDERS_PER_PAGE = 15;

const PAYMENT_BADGE = {
  PAID: "paid",
  PENDING: "pending",
  AUTHORIZED: "pending",
  PARTIALLY_PAID: "pending",
  PARTIALLY_REFUNDED: "pending",
  REFUNDED: "failed",
  VOIDED: "failed",
};

function mapSupplierStatus(order) {
  const meta = Object.fromEntries(
    (order.metafields?.edges ?? []).map((e) => [e.node.key, e.node.value]),
  );
  return meta.supplier_status || "pending";
}

function mapFulfillmentStatus(order) {
  if (
    order.displayFinancialStatus === "REFUNDED" ||
    order.displayFinancialStatus === "VOIDED"
  )
    return "failed";
  if (order.displayFulfillmentStatus === "FULFILLED") return "shipped";
  return "processing";
}

function itemsLabel(order) {
  const edges = order.lineItems?.edges ?? [];
  const hasMore = order.lineItems?.pageInfo?.hasNextPage;
  return hasMore
    ? `${edges.length}+ items`
    : `${edges.length} ${edges.length === 1 ? "item" : "items"}`;
}

function buildMeasurementProfiles(orders) {
  const result = {};
  let counter = Math.floor(Date.now() / 1000);
  for (const order of orders) {
    const created = (order.createdAt ?? "").split("T")[0];
    for (const { node: item } of order.lineItems?.edges ?? []) {
      if (!item.product?.metafield?.value) continue;
      const allAttrs = item.customAttributes ?? [];
      const measureAttrs = allAttrs.filter((a) => !a.key.startsWith("_"));
      if (!measureAttrs.length) continue;
      const productName = item.title;
      if (!result[productName]) result[productName] = [];
      if (result[productName].length >= 5) continue;
      const profileName = allAttrs.find(
        (a) => a.key === "_profile_name",
      )?.value;
      const idx = result[productName].length + 1;
      const measurements = Object.fromEntries(
        measureAttrs.map(({ key, value }) => [
          key,
          value?.endsWith('"') ? value.slice(0, -1) : value,
        ]),
      );
      result[productName].push({
        id: `prof_${counter++}`,
        name: profileName || `Measurement ${idx}`,
        created,
        measurements,
      });
    }
  }
  return result;
}

function getRangeForKey(rangeMap, key) {
  if (!rangeMap) return null;
  if (rangeMap[key]) return rangeMap[key];
  const normalised = key.toLowerCase().trim();
  for (const [k, v] of Object.entries(rangeMap)) {
    if (k.toLowerCase().trim() === normalised) return v;
  }
  return null;
}

// Status pill — same as Orders page
const SP_CLASS = {
  paid: "sp-paid",
  verified: "sp-verified",
  shipped: "sp-shipped",
  processing: "sp-processing",
  pending: "sp-pending",
  failed: "sp-failed",
};
function StatusPill({ status }) {
  const s = (status ?? "").toLowerCase();
  return (
    <span className={cn("status-pill", SP_CLASS[s] ?? "sp-default")}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const shopifyGid = `gid://shopify/Customer/${customerId}`;
  const { customer, orders, loading, error } = useCustomerDetail(shopifyGid);

  const [currentPage, setCurrentPage] = useState(1);
  const [vestMap, setVestMap] = useState({});
  const [shirtMap, setShirtMap] = useState({});
  const [trouserMap, setTrouserMap] = useState({});
  const [jacketMap, setJacketMap] = useState({});
  const profiles = useMemo(() => buildMeasurementProfiles(orders), [orders]);

  useEffect(() => {
    fetchVestRanges()
      .then((d) => {
        if (d) setVestMap(d);
      })
      .catch(() => {});
    fetchShirtRanges()
      .then((d) => {
        if (d) setShirtMap(d);
      })
      .catch(() => {});
    fetchTrouserRanges()
      .then((d) => {
        if (d) setTrouserMap(d);
      })
      .catch(() => {});
    fetchJacketRanges()
      .then((d) => {
        if (d) setJacketMap(d);
      })
      .catch(() => {});
  }, []);

  const totalSpent = useMemo(() => {
    if (!orders.length) return customer?.totalSpent || "—";
    let sum = 0,
      currencyCode = "USD";
    for (const o of orders) {
      const money = o.totalPriceSet?.shopMoney;
      if (money) {
        sum += parseFloat(money.amount ?? 0);
        currencyCode = money.currencyCode || currencyCode;
      }
    }
    return formatMoney({ amount: sum.toFixed(2), currencyCode });
  }, [orders, customer]);

  const [committedProfiles, setCommittedProfiles] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [touchedFields, setTouchedFields] = useState(new Set());
  const [savingProfileId, setSavingProfileId] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});

  const activeProfiles = committedProfiles ?? profiles;

  const handleProfileEditStart = (entry) => {
    setEditingProfileId(entry.id);
    setEditingValues({ ...entry.measurements });
    setTouchedFields(new Set());
    setProfileErrors((prev) => ({ ...prev, [entry.id]: null }));
  };
  const handleProfileCancel = () => {
    setEditingProfileId(null);
    setEditingValues({});
    setTouchedFields(new Set());
  };
  const handleProfileMeasurementChange = (key, val) => {
    setEditingValues((prev) => ({ ...prev, [key]: val }));
    setTouchedFields((prev) => new Set([...prev, key]));
  };

  const handleProfileSave = async (entry) => {
    const productLower = entry.productName.toLowerCase();
    const isSuit =
      productLower.includes("tuxedo") || productLower.includes("suit");
    const isJacket =
      productLower.includes("jacket") || productLower.includes("overcoat");
    const isTrouser = productLower.includes("trouser");
    const isVest = productLower.includes("vest");
    const isShirt = productLower.includes("shirt");
    const SAVE_RANGES = isSuit
      ? { ...jacketMap, ...trouserMap, ...vestMap, ...shirtMap }
      : isJacket
        ? jacketMap
        : isTrouser
          ? trouserMap
          : isVest
            ? vestMap
            : isShirt
              ? shirtMap
              : null;

    if (SAVE_RANGES) {
      const invalidKeys = Object.entries(editingValues)
        .filter(([key, val]) => {
          const range = getRangeForKey(SAVE_RANGES, key);
          if (!range || !val) return false;
          const n = parseFloat(val);
          return !isNaN(n) && (n < range.min || n > range.max);
        })
        .map(([key]) => key);
      if (invalidKeys.length > 0) {
        setTouchedFields(new Set(Object.keys(editingValues)));
        setProfileErrors((prev) => ({
          ...prev,
          [entry.id]: `${invalidKeys.length} measurement(s) out of valid range`,
        }));
        return;
      }
    }

    setSavingProfileId(entry.id);
    setProfileErrors((prev) => ({ ...prev, [entry.id]: null }));
    const updatedProfiles = JSON.parse(JSON.stringify(activeProfiles));
    updatedProfiles[entry.productName] = updatedProfiles[entry.productName].map(
      (p) =>
        p.id === entry.id ? { ...p, measurements: { ...editingValues } } : p,
    );
    try {
      await setCustomerProductsMetafield(
        `gid://shopify/Customer/${customerId}`,
        updatedProfiles,
      );
      setCommittedProfiles(updatedProfiles);
      setEditingProfileId(null);
      setEditingValues({});
      setTouchedFields(new Set());
    } catch (err) {
      setProfileErrors((prev) => ({ ...prev, [entry.id]: err.message }));
    } finally {
      setSavingProfileId(null);
    }
  };

  const allMeasurements = useMemo(
    () =>
      Object.entries(activeProfiles).flatMap(([productName, list]) =>
        list.map((p) => ({ productName, ...p })),
      ),
    [activeProfiles],
  );

  useEffect(() => {
    if (!orders.length || !customerId) return;
    const data = profiles;
    if (Object.keys(data).length === 0) return;
    setCustomerProductsMetafield(
      `gid://shopify/Customer/${customerId}`,
      data,
    ).catch(() => {});
  }, [orders, customerId]);

  const totalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const paginated = orders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );
  const visiblePages = useMemo(() => {
    const range = 3,
      start = Math.max(1, currentPage - range),
      end = Math.min(totalPages, currentPage + range);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <DashboardLayout>
      {loading && (
        <div className="bg-white rounded-[12px] border border-[rgba(207,196,197,0.3)]">
          <LoadingState message="Loading customer…" />
        </div>
      )}
      {error && (
        <div className="bg-white rounded-[12px] border border-[rgba(207,196,197,0.3)]">
          <ErrorState message={error} />
        </div>
      )}

      {!loading && !error && customer && (
        <div className="flex flex-col gap-[40px]">
          {/* ── Section 1: Customer Profile Header ── */}
          <div
            className="bg-white rounded-[12px] p-[33px] flex flex-col gap-[24px]"
            style={{ border: "1px solid rgba(207,196,197,0.3)" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-[7px]">
                <span className="font-hanken text-[12px] font-semibold uppercase tracking-[1.8px] text-gc-primary">
                  PREMIUM REGISTRY
                </span>
                <h1 className="font-garamond text-[40px] font-bold text-[#3c3c3c] leading-tight">
                  {customer.name}
                </h1>
                <div className="flex items-center gap-[24px] pt-[9px]">
                  {customer.email && (
                    <div className="flex items-center gap-[8px]">
                      <Mail
                        size={13}
                        className="text-[#4c4546] flex-shrink-0"
                      />
                      <span className="font-hanken text-[14px] text-[#4c4546]">
                        {customer.email}
                      </span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-[8px]">
                      <Phone
                        size={10}
                        className="text-[#4c4546] flex-shrink-0"
                      />
                      <span className="font-hanken text-[14px] text-[#4c4546]">
                        {customer.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div
              className="grid grid-cols-3 gap-[32px] pt-[25px]"
              style={{ borderTop: "1px solid rgba(207,196,197,0.4)" }}
            >
              {[
                { label: "TOTAL ORDERS", value: orders.length },
                { label: "TOTAL SPENT", value: totalSpent },
                { label: "CUSTOMER SINCE", value: customer.registrationDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-[4px]">
                  <span className="font-hanken text-[10px] font-medium uppercase text-[#7e7576]">
                    {label}
                  </span>
                  <span className="font-garamond text-[28px] font-medium text-black leading-tight">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 2: Recent Orders ── */}
          <div className="flex flex-col gap-[24px]">
            {/* Section heading */}
            <div
              className="flex items-center gap-[12px] pb-[17px]"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}
            >
              <span className="font-garamond text-[24px] font-medium text-[#1a1c1b]">
                Recent Orders
              </span>
              <span className="font-hanken text-[14px] font-semibold uppercase text-gc-primary">
                {orders.length} total
              </span>
            </div>

            <div
              className="bg-white rounded-[12px] overflow-hidden"
              style={{ border: "1px solid rgba(207,196,197,0.3)" }}
            >
              {orders.length === 0 ? (
                <div className="py-[48px] text-center font-hanken text-[14px] text-gc-text">
                  No orders yet.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr
                          style={{
                            borderBottom: "1px solid rgba(207,196,197,0.4)",
                          }}
                        >
                          {[
                            "ORDER NUMBER",
                            "DATE",
                            "ITEMS",
                            "TOTAL",
                            "PAYMENT",
                            "STATUS",
                            "SUPPLIER",
                          ].map((h) => (
                            <th
                              key={h}
                              className="font-hanken text-[9px] font-semibold uppercase tracking-[0.9px] text-[#7e7576] px-[24px] py-[16px] text-left whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((order, i) => {
                          const numericId = order.id.split("/").pop();
                          return (
                            <tr
                              key={order.id}
                              onClick={() =>
                                navigate(`/orders/${numericId}`, {
                                  state: { fromCustomer: customerId },
                                })
                              }
                              className="cursor-pointer hover:bg-[rgba(164,93,65,0.04)] transition-colors"
                              style={
                                i > 0
                                  ? {
                                      borderTop:
                                        "1px solid rgba(207,196,197,0.2)",
                                    }
                                  : {}
                              }
                            >
                              <td className="font-hanken text-[14px] font-semibold text-black px-[24px] py-[20px] whitespace-nowrap">
                                {order.name}
                              </td>
                              <td className="font-hanken text-[14px] text-[#1c1c19] px-[24px] py-[20px] whitespace-nowrap">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="font-hanken text-[14px] text-[#1c1c19] px-[24px] py-[20px]">
                                {itemsLabel(order)}
                              </td>
                              <td className="font-hanken text-[14px] text-[#1c1c19] px-[24px] py-[20px] whitespace-nowrap">
                                {formatCurrency(order.totalPriceSet)}
                              </td>
                              <td className="px-[24px] py-[20px]">
                                <StatusPill
                                  status={
                                    PAYMENT_BADGE[
                                      order.displayFinancialStatus
                                    ] ?? "pending"
                                  }
                                />
                              </td>
                              <td className="px-[24px] py-[20px]">
                                <StatusPill
                                  status={mapFulfillmentStatus(order)}
                                />
                              </td>
                              <td className="px-[24px] py-[20px]">
                                <StatusPill status={mapSupplierStatus(order)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {orders.length > ORDERS_PER_PAGE && (
                    <div className="flex items-center justify-between px-[24px] py-[16px] gc-divider">
                      <p className="gc-pagination-count">
                        Showing{" "}
                        <strong>
                          {(currentPage - 1) * ORDERS_PER_PAGE + 1}
                        </strong>
                        {" – "}
                        <strong>
                          {Math.min(
                            currentPage * ORDERS_PER_PAGE,
                            orders.length,
                          )}
                        </strong>
                        {" of "}
                        <strong>{orders.length}</strong>
                      </p>
                      <div className="flex items-center gap-[4px]">
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                          className="gc-pagination-btn"
                        >
                          ‹
                        </button>
                        {visiblePages.map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={cn(
                              "gc-pagination-btn",
                              currentPage === page && "active",
                            )}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                          className="gc-pagination-btn"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Section 3: Technical Measurements ── */}
          {allMeasurements.length > 0 && (
            <div className="flex flex-col gap-[24px]">
              {allMeasurements.map((entry) => {
                const isEditing = editingProfileId === entry.id;
                const isSaving = savingProfileId === entry.id;
                const profileError = profileErrors[entry.id];
                const productLower = entry.productName.toLowerCase();
                const isSuit =
                  productLower.includes("tuxedo") ||
                  productLower.includes("suit");
                const isJacket =
                  productLower.includes("jacket") ||
                  productLower.includes("overcoat");
                const isTrouser = productLower.includes("trouser");
                const isVest = productLower.includes("vest");
                const isShirt = productLower.includes("shirt");
                const RANGES = isSuit
                  ? { ...jacketMap, ...trouserMap, ...vestMap, ...shirtMap }
                  : isJacket
                    ? jacketMap
                    : isTrouser
                      ? trouserMap
                      : isVest
                        ? vestMap
                        : isShirt
                          ? shirtMap
                          : null;
                const sizeTypeKey = Object.keys(entry.measurements).find(
                  (k) => k.toLowerCase() === "size type",
                );
                const isStandard =
                  sizeTypeKey &&
                  entry.measurements[sizeTypeKey]?.toLowerCase() === "standard";

                return (
                  <div key={entry.id} className="flex flex-col gap-[24px]">
                    {/* Section header row */}
                    <div
                      className="flex items-end justify-between pb-[17px]"
                      style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}
                    >
                      <div className="flex flex-col gap-[4px]">
                        <span className="font-garamond text-[24px] font-medium text-[#1a1c1b]">
                          Technical Measurements
                        </span>
                        <span className="font-hanken text-[14px] font-semibold text-[#6d6d6d]">
                          Profile: {entry.name} • Last updated: {entry.created}
                        </span>
                      </div>
                      <div className="flex items-center gap-[8px]">
                        {profileError && (
                          <span className="font-hanken text-[12px] text-red-500">
                            {profileError}
                          </span>
                        )}
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleProfileSave(entry)}
                              disabled={isSaving}
                              className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase transition-colors disabled:opacity-50"
                            >
                              <Save size={13} />
                              {isSaving ? "Saving…" : "SAVE LEDGER"}
                            </button>
                            <button
                              onClick={handleProfileCancel}
                              disabled={isSaving}
                              className="gc-btn text-[13px] gap-[5px]"
                            >
                              <X size={12} />
                              Cancel
                            </button>
                          </>
                        ) : (
                          !isStandard && (
                            <button
                              onClick={() => handleProfileEditStart(entry)}
                              disabled={!!editingProfileId}
                              className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase transition-colors disabled:opacity-40"
                            >
                              <Pencil size={13} />
                              EDIT LEDGER
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* 6-col measurement grid — Figma: gray bg + 1px gaps + white cells */}
                    <div
                      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 rounded-[12px] p-px gap-px"
                      style={{ border: "1px solid rgba(207,196,197,0.4)" }}
                    >
                      {Object.entries(
                        isEditing ? editingValues : entry.measurements,
                      ).map(([key, val], idx) => {
                        const metaEntry = isVest
                          ? getRangeForKey(vestMap, key)
                          : isShirt
                            ? getRangeForKey(shirtMap, key)
                            : isTrouser
                              ? getRangeForKey(trouserMap, key)
                              : isJacket
                                ? getRangeForKey(jacketMap, key)
                                : null;
                        const displayKey = metaEntry ? metaEntry.label : key;
                        const isSizeType = key.toLowerCase() === "size type";
                        const range = metaEntry ?? getRangeForKey(RANGES, key);
                        const isTouched = touchedFields.has(key);
                        const numVal = parseFloat(val);
                        const hasRange = !!range;
                        const isValid =
                          isTouched &&
                          hasRange &&
                          !isNaN(numVal) &&
                          numVal >= range.min &&
                          numVal <= range.max;
                        const isInvalid =
                          isTouched &&
                          hasRange &&
                          !isNaN(numVal) &&
                          (numVal < range.min || numVal > range.max);
                        const isFirst = idx === 0;

                        return (
                          <div
                            key={key}
                            className={cn(
                              "bg-white flex flex-col p-[24px] h-[124px]",
                              isFirst && "rounded-tl-[12px]",
                            )}
                          >
                            {/* Label */}
                            <span className="font-hanken text-[9px] font-semibold uppercase tracking-[0.9px] text-[#7e7576] leading-[9px]">
                              {displayKey}
                            </span>

                            {/* Value */}
                            {isEditing && !isSizeType ? (
                              <input
                                type="text"
                                value={val}
                                onChange={(e) =>
                                  handleProfileMeasurementChange(
                                    key,
                                    e.target.value,
                                  )
                                }
                                className={cn(
                                  "font-garamond mt-[5px] w-full text-[28px] text-black bg-transparent outline-none border-b",
                                  isValid
                                    ? "border-green-500 text-green-700"
                                    : isInvalid
                                      ? "border-red-400 text-red-600"
                                      : "border-[#d1c7bd]",
                                )}
                              />
                            ) : (
                              <span className="font-garamond text-[32px] text-black leading-[48px] mt-[5px]">
                                {val}
                              </span>
                            )}

                            {/* Unit or range hint */}
                            {isEditing && range ? (
                              <span
                                className={cn(
                                  "font-hanken text-[10px] mt-auto",
                                  isValid
                                    ? "text-green-600"
                                    : isInvalid
                                      ? "text-red-500"
                                      : "text-[#7e7576]",
                                )}
                              >
                                {range.min}–{range.max}
                              </span>
                            ) : (
                              <span className="font-hanken text-[10px] text-[#7e7576] mt-auto leading-[15px]">
                                Inches
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

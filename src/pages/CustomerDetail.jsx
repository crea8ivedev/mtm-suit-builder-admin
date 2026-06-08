import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  Save,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
      const allAttrs = item.customAttributes ?? [];
      const measureAttrs = allAttrs.filter((a) => !a.key.startsWith("_"));
      if (!measureAttrs.length) continue;
      const productName = item.title;
      if (!result[productName]) result[productName] = [];
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
  const [ordersPerPage, setOrdersPerPage] = useState(15);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const entriesRef = useRef(null);
  const [vestMap, setVestMap] = useState({});
  const [shirtMap, setShirtMap] = useState({});
  const [trouserMap, setTrouserMap] = useState({});
  const [jacketMap, setJacketMap] = useState({});
  const profiles = useMemo(() => buildMeasurementProfiles(orders), [orders]);

  useEffect(() => {
    function handler(e) {
      if (entriesRef.current && !entriesRef.current.contains(e.target)) {
        setEntriesOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const profileTabNames = useMemo(() => {
    const seen = new Set();
    const names = [];
    for (const entry of allMeasurements) {
      if (!seen.has(entry.name)) {
        seen.add(entry.name);
        names.push(entry.name);
      }
    }
    return names;
  }, [allMeasurements]);

  const [activeProfileTab, setActiveProfileTab] = useState(null);

  useEffect(() => {
    if (profileTabNames.length > 0) {
      setActiveProfileTab((prev) =>
        profileTabNames.includes(prev) ? prev : profileTabNames[0],
      );
    }
  }, [profileTabNames]);

  const activeTabEntries = useMemo(
    () => allMeasurements.filter((e) => e.name === activeProfileTab),
    [allMeasurements, activeProfileTab],
  );

  const totalPages = Math.max(1, Math.ceil(orders.length / ordersPerPage));
  const paginated = orders.slice(
    (currentPage - 1) * ordersPerPage,
    currentPage * ordersPerPage,
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
          <div
            className="bg-white rounded-[12px] p-[20px] sm:p-[33px] flex flex-col gap-[20px] sm:gap-[24px]"
            style={{ border: "1px solid rgba(207,196,197,0.3)" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-[7px]">
                <h1 className="font-garamond text-[28px] sm:text-[40px] font-bold text-[#3c3c3c] leading-tight">
                  {customer.name}
                </h1>
                <div className="flex flex-wrap items-center gap-[12px] sm:gap-[24px] pt-[9px]">
                  {customer.email && (
                    <div className="flex items-center gap-[8px]">
                      <Mail
                        size={13}
                        className="text-[#4c4546] flex-shrink-0"
                      />
                      <span className="font-hanken text-[13px] sm:text-[14px] text-[#4c4546] break-all">
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
                      <span className="font-hanken text-[13px] sm:text-[14px] text-[#4c4546]">
                        {customer.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-[20px] sm:gap-[32px] pt-[20px] sm:pt-[25px]"
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
                  <span className="font-garamond text-[22px] sm:text-[28px] font-medium text-black leading-tight">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[24px]">
            <div
              className="flex flex-wrap items-center gap-[12px] pb-[17px]"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}
            >
              <span className="font-garamond text-[20px] sm:text-[24px] font-medium text-[#1a1c1b]">
                Orders
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
                  {orders.length > 0 && (
                    <div className="flex items-center justify-between px-[24px] py-[16px] gc-divider flex-wrap gap-[12px]">
                      <div
                        className="flex items-center gap-[8px]"
                        ref={entriesRef}
                      >
                        <span className="font-hanken text-[13px] text-gc-text">
                          Entries
                        </span>
                        <div className="relative">
                          <button
                            onClick={() => setEntriesOpen((v) => !v)}
                            className="font-hanken text-[13px] text-gc-dark flex items-center gap-[6px] px-[10px] py-[5px] rounded-[6px] cursor-pointer focus:outline-none"
                            style={{
                              border: "1px solid #dac1ba",
                              background: "#fff",
                            }}
                          >
                            {ordersPerPage}
                            <ChevronRight
                              size={13}
                              className={`text-gc-text transition-transform ${entriesOpen ? "-rotate-90" : "rotate-90"}`}
                            />
                          </button>
                          {entriesOpen && (
                            <div
                              className="absolute left-0 bottom-full mb-[4px] z-20 rounded-[6px] overflow-hidden shadow-md"
                              style={{
                                border: "1px solid #dac1ba",
                                background: "#fff",
                                minWidth: "100%",
                              }}
                            >
                              {[10, 20, 40, 100].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => {
                                    setOrdersPerPage(n);
                                    setCurrentPage(1);
                                    setEntriesOpen(false);
                                  }}
                                  className="w-full text-left font-hanken text-[13px] px-[12px] py-[7px] cursor-pointer transition-colors"
                                  style={{
                                    color:
                                      n === ordersPerPage
                                        ? "#a45d41"
                                        : "#3c3c3c",
                                    background:
                                      n === ordersPerPage
                                        ? "rgba(164,93,65,0.06)"
                                        : "transparent",
                                    fontWeight: n === ordersPerPage ? 600 : 400,
                                  }}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Page navigation */}
                      {totalPages > 1 && (
                        <div className="flex items-center gap-[4px]">
                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className="gc-pagination-btn"
                          >
                            <ChevronLeft size={15} />
                          </button>

                          {visiblePages[0] > 1 && (
                            <>
                              <button
                                onClick={() => setCurrentPage(1)}
                                className="gc-pagination-btn"
                              >
                                1
                              </button>
                              {visiblePages[0] > 2 && (
                                <span className="w-[28px] text-center text-gc-text text-[13px]">
                                  …
                                </span>
                              )}
                            </>
                          )}

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

                          {visiblePages[visiblePages.length - 1] <
                            totalPages && (
                            <>
                              {visiblePages[visiblePages.length - 1] <
                                totalPages - 1 && (
                                <span className="w-[28px] text-center text-gc-text text-[13px]">
                                  …
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPage(totalPages)}
                                className="gc-pagination-btn"
                              >
                                {totalPages}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={currentPage === totalPages}
                            className="gc-pagination-btn"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {allMeasurements.length > 0 && (
            <div className="flex flex-col gap-[0]">
              <div className="flex flex-wrap gap-[8px] pb-[20px]">
                {profileTabNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveProfileTab(name)}
                    className="font-hanken text-[13px] font-semibold px-[16px] py-[8px] rounded-[20px] whitespace-nowrap transition-all cursor-pointer"
                    style={{
                      backgroundColor:
                        activeProfileTab === name ? "#a45d41" : "#f4f1ed",
                      color: activeProfileTab === name ? "#ffffff" : "#6d6d6d",
                      border:
                        activeProfileTab === name
                          ? "1px solid #a45d41"
                          : "1px solid #d1c7bd",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-[24px] pt-[24px]">
                {activeTabEntries.map((entry) => {
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
                    entry.measurements[sizeTypeKey]?.toLowerCase() ===
                      "standard";

                  return (
                    <div key={entry.id} className="flex flex-col gap-[24px]">
                      <div
                        className="flex flex-wrap items-start sm:items-end justify-between gap-[12px] pb-[17px]"
                        style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}
                      >
                        <div className="flex flex-col gap-[4px]">
                          <span className="font-garamond text-[20px] sm:text-[24px] font-medium text-[#1a1c1b]">
                            {entry.productName}
                          </span>
                          <span className="font-hanken text-[12px] sm:text-[14px] font-semibold text-[#6d6d6d]">
                            Last updated: {entry.created}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-[8px]">
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
                                className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Save size={13} />
                                {isSaving ? "Saving…" : "SAVE"}
                              </button>
                              <button
                                onClick={handleProfileCancel}
                                disabled={isSaving}
                                className="gc-btn text-[13px] gap-[5px] cursor-pointer disabled:cursor-not-allowed"
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
                                className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Pencil size={13} />
                                EDIT
                              </button>
                            )
                          )}
                        </div>
                      </div>

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
                          const range =
                            metaEntry ?? getRangeForKey(RANGES, key);
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
                                "bg-white flex flex-col p-[10px] sm:p-[20px] h-[90px] sm:h-[120px] overflow-hidden",
                                isFirst && "rounded-tl-[12px]",
                              )}
                            >
                              <span className="font-hanken text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.5px] text-[#7e7576] leading-[10px] sm:leading-[12px] break-words">
                                {displayKey}
                              </span>
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
                                    "font-garamond mt-[3px] w-full text-[16px] sm:text-[20px] text-black bg-transparent outline-none border-b",
                                    isValid
                                      ? "border-green-500 text-green-700"
                                      : isInvalid
                                        ? "border-red-400 text-red-600"
                                        : "border-[#d1c7bd]",
                                  )}
                                />
                              ) : (
                                <span className="font-garamond text-[14px] sm:text-[22px] text-black leading-[18px] sm:leading-[30px] mt-[3px]">
                                  {val}
                                </span>
                              )}

                              {isEditing && range ? (
                                <span
                                  className={cn(
                                    "font-hanken text-[9px] mt-auto",
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
                                <span className="font-hanken text-[9px] text-[#7e7576] mt-auto leading-[13px]">
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
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

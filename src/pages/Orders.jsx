import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useOrders } from "../hooks/useOrders";
import { cn } from "../utils/cn";
import { generateCSV } from "../utils/exportUtils";

const ITEMS_PER_PAGE = 20;
const SUPPLIER_OPTIONS = ["Pending", "Verified"];

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

function ItemsBadge({ count }) {
  return <span className="items-badge">{count}</span>;
}

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const { orders, stats, loading, error, progress, retry } = useOrders();

  const [supplierFilter, setSupplierFilter] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const filterRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const resetPage = () => setCurrentPage(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((order) => {
      const matchSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.email.toLowerCase().includes(q);
      const matchSupplier =
        !supplierFilter ||
        order.supplierStatus?.toLowerCase() === supplierFilter.toLowerCase();
      return matchSearch && matchSupplier;
    });
  }, [orders, search, supplierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const visiblePages = useMemo(() => {
    const range = 3;
    const start = Math.max(1, currentPage - range);
    const end = Math.min(totalPages, currentPage + range);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const handleExportCSV = () => generateCSV(filtered);

  return (
    <DashboardLayout onRefresh={retry}>
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-[30px]">
        <div>
          <h2 className="gc-page-title">Order Management</h2>
          <p className="gc-page-subtitle">
            {loading
              ? "Fetching from Shopify…"
              : error
                ? "Could not load orders"
                : `Real-time overview of ${stats.total} active logistics stream${stats.total !== 1 ? "s" : ""}.`}
          </p>
        </div>

        <div className="flex items-center gap-[10px] mt-[6px]">
          {/* Filter dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                "gc-btn",
                supplierFilter && "border-gc-primary bg-[rgba(164,93,65,0.08)]",
              )}
            >
              <SlidersHorizontal size={14} />
              Filter
              {supplierFilter && (
                <span className="text-[11px] font-semibold text-gc-id">
                  · {supplierFilter}
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[180px] bg-white border border-gc-border rounded-[10px] shadow-lg z-50 overflow-hidden py-[6px]">
                <p className="font-hanken px-[14px] pt-[6px] pb-[8px] text-[11px] font-semibold uppercase tracking-wider text-gc-text">
                  Supplier Status
                </p>
                <button
                  onClick={() => {
                    setSupplierFilter(null);
                    resetPage();
                    setFilterOpen(false);
                  }}
                  className="font-hanken w-full flex items-center justify-between px-[14px] py-[9px] text-[14px] font-medium text-gc-dark hover:bg-gc-bg transition-colors"
                >
                  All
                  {!supplierFilter && (
                    <Check size={14} className="text-gc-primary" />
                  )}
                </button>
                {SUPPLIER_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setSupplierFilter(opt);
                      resetPage();
                      setFilterOpen(false);
                    }}
                    className="font-hanken w-full flex items-center justify-between px-[14px] py-[9px] text-[14px] font-medium text-gc-dark hover:bg-gc-bg transition-colors"
                  >
                    {opt}
                    {supplierFilter === opt && (
                      <Check size={14} className="text-gc-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            disabled={loading || !!error || !filtered.length}
            className="gc-btn"
          >
            <Download size={14} />
            Export
          </button>

          <button
            onClick={() => navigate("/orders/new")}
            className="gc-btn gc-btn-primary"
          >
            <Plus size={14} />
            Create Order
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="gc-table-container">
        {loading && <LoadingState progress={progress} />}
        {error && <ErrorState message={error} onRetry={retry} />}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="gc-table-header-row">
                    {[
                      "ORDER #",
                      "DATE",
                      "CUSTOMER",
                      "TOTAL",
                      "PAYMENT",
                      "ITEMS",
                      "FULFILLMENT",
                      "SUPPLIER",
                    ].map((h) => (
                      <th key={h} className="gc-th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="font-hanken text-center py-[64px] text-[14px] text-gc-text"
                      >
                        No orders match your filters.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((order) => (
                      <tr
                        key={order.shopifyGid}
                        onClick={() => navigate(`/orders/${order.numericId}`)}
                        className="gc-table-row"
                      >
                        <td className="gc-td gc-order-id pl-[22px]">
                          {order.id}
                        </td>
                        <td className="gc-td text-gc-text font-normal">
                          {order.orderDate}
                        </td>
                        <td className="gc-td">
                          <p className="gc-customer-name">
                            {order.customer.name}
                          </p>
                          {order.customer.email && (
                            <p className="gc-customer-email">
                              {order.customer.email}
                            </p>
                          )}
                        </td>
                        <td className="gc-td font-medium text-gc-dark">
                          {order.total}
                        </td>
                        <td className="gc-td">
                          <StatusPill status={order.paymentStatus} />
                        </td>
                        <td className="gc-td">
                          <ItemsBadge count={order.itemCount} />
                        </td>
                        <td className="gc-td">
                          <StatusPill status={order.status} />
                        </td>
                        <td className="gc-td">
                          <StatusPill status={order.supplierStatus} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filtered.length > ITEMS_PER_PAGE && (
              <div className="gc-divider flex items-center justify-between px-[24px] py-[16px] flex-wrap gap-[12px]">
                <p className="gc-pagination-count">
                  Showing{" "}
                  <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong>
                  {" – "}
                  <strong>
                    {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
                  </strong>
                  {" of "}
                  <strong>{filtered.length}</strong> orders
                </p>
                <div className="flex items-center gap-[4px]">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                        <span className="w-[36px] text-center text-gc-text">
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

                  {visiblePages[visiblePages.length - 1] < totalPages && (
                    <>
                      {visiblePages[visiblePages.length - 1] <
                        totalPages - 1 && (
                        <span className="w-[36px] text-center text-gc-text">
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
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

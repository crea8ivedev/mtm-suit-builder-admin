import { useState, useMemo, useRef } from "react";
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
import StatusPill from "../components/ui/StatusPill";
import { useOrders } from "../hooks/useOrders";
import { useClickOutside } from "../hooks/useClickOutside";
import { cn } from "../utils/cn";
import { generateCSV } from "../utils/exportUtils";

const SUPPLIER_OPTIONS = ["Pending", "Processing", "Submitted", "Failed"];

function ItemsBadge({ count }) {
  return <span className="items-badge">{count}</span>;
}

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const supplierFilter = searchParams.get("filter") || null;
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const { orders, stats, loading, error, progress, retry } = useOrders();

  const [filterOpen, setFilterOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const filterRef = useRef(null);
  const entriesRef = useRef(null);

  function setSupplierFilter(val) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set("filter", val);
      else next.delete("filter");
      next.set("page", "1");
      return next;
    });
  }

  function setCurrentPage(page) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(page));
      return next;
    });
  }

  useClickOutside(filterRef, () => setFilterOpen(false));
  useClickOutside(entriesRef, () => setEntriesOpen(false));

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const visiblePages = useMemo(() => {
    const range = 2;
    const start = Math.max(1, currentPage - range);
    const end = Math.min(totalPages, currentPage + range);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const handleExportCSV = () => generateCSV(filtered);

  return (
    <DashboardLayout onRefresh={retry} isRefreshing={loading}>
      <div className="flex flex-wrap items-start justify-between gap-[16px] mb-[30px] overflow-visible">
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

        <div className="flex flex-wrap items-center gap-[10px] w-full sm:w-auto justify-start sm:justify-start">
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
              <div className="absolute left-0 sm:left-auto sm:right-0 top-[calc(100%+6px)] w-[180px] bg-white border border-gc-border rounded-[10px] shadow-lg z-[100] overflow-hidden py-[6px]">
                <p className="font-hanken px-[14px] pt-[6px] pb-[8px] text-[11px] font-semibold uppercase tracking-wider text-gc-text">
                  Supplier Status
                </p>
                <button
                  onClick={() => {
                    setSupplierFilter(null);
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

            {filtered.length > 0 && (
              <div className="gc-divider flex items-center justify-between px-[14px] sm:px-[24px] py-[14px] sm:py-[16px] flex-wrap gap-[10px] sm:gap-[12px]">
                {filtered.length > 10 && (
                  <div className="flex items-center gap-[8px]" ref={entriesRef}>
                    <span className="font-hanken text-[13px] text-gc-text">
                      Entries
                    </span>
                    <div className="relative">
                      <button
                        onClick={() => setEntriesOpen((v) => !v)}
                        className="font-hanken text-[13px] text-gc-dark flex items-center gap-[6px] px-[10px] py-[5px] rounded-[6px] cursor-pointer focus:outline-none border border-gc-border-warm bg-white"
                      >
                        {itemsPerPage}
                        <ChevronRight
                          size={13}
                          className={`text-gc-text transition-transform ${entriesOpen ? "-rotate-90" : "rotate-90"}`}
                        />
                      </button>
                      {entriesOpen && (
                        <div className="absolute left-0 bottom-full mb-[4px] z-20 rounded-[6px] overflow-hidden shadow-md border border-gc-border-warm bg-white min-w-full">
                          {[10, 20, 50, 100].map((n) => (
                            <button
                              key={n}
                              onClick={() => {
                                setItemsPerPage(n);
                                setCurrentPage(1);
                                setEntriesOpen(false);
                              }}
                              className={`w-full text-left font-hanken text-[13px] px-[12px] py-[7px] cursor-pointer transition-colors ${n === itemsPerPage ? "text-gc-primary bg-gc-primary/[6%] font-semibold" : "text-gc-heading font-normal"}`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center gap-[3px] sm:gap-[4px] flex-wrap justify-end">
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
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

                    {visiblePages[visiblePages.length - 1] < totalPages && (
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
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
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
    </DashboardLayout>
  );
}

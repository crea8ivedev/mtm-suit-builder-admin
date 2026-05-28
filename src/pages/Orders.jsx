import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Download, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import Badge from "../components/ui/Badge";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useOrders } from "../hooks/useOrders";
import { cn } from "../utils/cn";
import { generateCSV } from "../utils/exportUtils";

const STATUS_FILTERS = ["All", "Pending", "Submitted", "Failed"];
const PAYMENT_FILTERS = ["All", "Paid", "Unpaid"];

const ITEMS_PER_PAGE = 25;

export default function Orders() {
  const { orders, stats, loading, error, progress, retry } = useOrders();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const resetPage = () => setCurrentPage(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((order) => {
      const matchSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.email.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "All" || order.status === statusFilter.toLowerCase();

      const matchPayment =
        paymentFilter === "All" ||
        order.paymentStatus === paymentFilter.toLowerCase();

      return matchSearch && matchStatus && matchPayment;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Show up to 7 page buttons, centered around current page
  const visiblePages = useMemo(() => {
    const range = 3;
    const start = Math.max(1, currentPage - range);
    const end = Math.min(totalPages, currentPage + range);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const handleExportCSV = () => generateCSV(filtered);

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="section-header">
        <div>
          <h2 className="text-24 font-bold text-text-primary">Orders</h2>
          <p className="text-14 text-text-muted mt-[3px]">
            {loading
              ? "Fetching from Shopify…"
              : error
                ? "Could not load orders"
                : `${filtered.length} of ${stats.total} order${stats.total !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-[8px]">
          {!loading && !error && (
            <button
              onClick={retry}
              className="btn-icon border border-border"
              title="Refresh orders"
            >
              <RefreshCw size={15} />
            </button>
          )}
          <button
            onClick={handleExportCSV}
            disabled={loading || !!error || !filtered.length}
            className="btn-secondary gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card p-[16px] md:p-[20px] mb-[20px]">
        <div className="flex flex-wrap gap-[12px] items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              placeholder="Order #, customer name or email…"
              className="input pl-[38px] py-[9px]"
            />
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className="text-13 text-text-muted font-medium hidden sm:block whitespace-nowrap">
              Status:
            </span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  resetPage();
                }}
                className={cn(
                  "px-[12px] py-[6px] rounded-lg text-13 font-medium transition-colors",
                  statusFilter === s
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200",
                )}
              >
                {s}
                {!loading && !error && s !== "All" && (
                  <span
                    className={cn(
                      "ml-[5px] text-[11px] font-semibold",
                      statusFilter === s ? "opacity-80" : "text-text-muted",
                    )}
                  >
                    {s === "Pending" && stats.pending}
                    {s === "Submitted" && stats.submitted}
                    {s === "Failed" && stats.failed}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Payment select */}
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              resetPage();
            }}
            className="input w-auto py-[9px] cursor-pointer"
          >
            {PAYMENT_FILTERS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="card">
        {loading && <LoadingState progress={progress} />}
        {error && <ErrorState message={error} onRetry={retry} />}

        {!loading && !error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Payment Status</th>
                    <th>Items</th>
                    <th>Fulfillment Status</th>
                    <th>Supplier Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center py-[64px] text-text-muted text-15"
                      >
                        No orders match your filters.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((order) => (
                      <tr key={order.shopifyGid}>
                        {/* Order name — clickable, navigates to detail */}
                        <td>
                          <Link
                            to={`/orders/${order.numericId}`}
                            className="font-bold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                          >
                            {order.id}
                          </Link>
                        </td>

                        {/* Date */}
                        <td className="text-text-secondary whitespace-nowrap">
                          {order.orderDate}
                        </td>

                        {/* Customer */}
                        <td>
                          <p className="font-medium text-text-primary">
                            {order.customer.name}
                          </p>
                          {order.customer.email && (
                            <p className="text-12 text-text-muted">
                              {order.customer.email}
                            </p>
                          )}
                        </td>

                        {/* Total */}
                        <td className="font-semibold text-text-primary">
                          {order.total}
                        </td>

                        {/* Payment status — raw Shopify label + badge */}
                        <td>
                          <Badge status={order.paymentStatus} />
                        </td>

                        {/* Items count */}
                        <td className="text-text-secondary">
                          {order.itemsDisplay}
                        </td>

                        {/* Custom status column */}
                        <td>
                          <Badge status={order.status} />
                        </td>

                        {/* Supplier status column */}
                        <td>
                          <Badge status={order.supplierStatus} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {filtered.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between px-[20px] py-[14px] border-t border-border flex-wrap gap-[10px]">
                <p className="text-13 text-text-muted">
                  Showing{" "}
                  <span className="font-semibold text-text-primary">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                  </span>{" "}
                  –{" "}
                  <span className="font-semibold text-text-primary">
                    {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-text-primary">
                    {filtered.length}
                  </span>
                </p>

                <div className="flex items-center gap-[5px]">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-[7px] rounded-lg border border-border text-text-secondary hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {visiblePages[0] > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentPage(1)}
                        className="w-[34px] h-[34px] rounded-lg text-13 font-medium border border-border text-text-secondary hover:bg-gray-50 transition-colors"
                      >
                        1
                      </button>
                      {visiblePages[0] > 2 && (
                        <span className="text-text-muted px-[4px]">…</span>
                      )}
                    </>
                  )}

                  {visiblePages.map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "w-[34px] h-[34px] rounded-lg text-13 font-medium transition-colors",
                        currentPage === page
                          ? "bg-brand-600 text-white"
                          : "border border-border text-text-secondary hover:bg-gray-50",
                      )}
                    >
                      {page}
                    </button>
                  ))}

                  {visiblePages[visiblePages.length - 1] < totalPages && (
                    <>
                      {visiblePages[visiblePages.length - 1] <
                        totalPages - 1 && (
                        <span className="text-text-muted px-[4px]">…</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-[34px] h-[34px] rounded-lg text-13 font-medium border border-border text-text-secondary hover:bg-gray-50 transition-colors"
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
                    className="p-[7px] rounded-lg border border-border text-text-secondary hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

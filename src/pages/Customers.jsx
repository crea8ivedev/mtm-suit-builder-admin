import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, CheckCircle } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import CreateCustomerModal from "../components/ui/CreateCustomerModal";
import { useCustomers } from "../hooks/useCustomers";
import { cn } from "../utils/cn";

const ITEMS_PER_PAGE = 20;

// Avatar colours cycle for each row
const AVATAR_STYLES = [
  {
    bg: "rgba(146,73,50,0.1)",
    border: "rgba(146,73,50,0.2)",
    color: "#924932",
  },
  {
    bg: "rgba(119,90,25,0.1)",
    border: "rgba(119,90,25,0.2)",
    color: "#775a19",
  },
  {
    bg: "rgba(0,0,0,0.05)",
    border: "rgba(0,0,0,0.1)",
    color: "#1a1c1b",
  },
];

function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

export default function Customers() {
  const { customers, loading, error, progress, retry } = useCustomers();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const topSearch = searchParams.get("search") || "";

  const [inlineSearch, setInlineSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Merge topbar search + inline search (topbar takes priority)
  const search = topSearch || inlineSearch;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  function handleCreated(customer) {
    setModalOpen(false);
    setToast({ name: `${customer.firstName} ${customer.lastName}`.trim() });
    retry();
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone || "").includes(q),
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const visiblePages = useMemo(() => {
    const range = 2;
    const start = Math.max(1, currentPage - range);
    const end = Math.min(totalPages, currentPage + range);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <DashboardLayout onRefresh={retry}>
      {/* Success toast */}
      {toast && (
        <div className="flex items-center gap-[10px] mb-[16px] px-[16px] py-[12px] bg-green-50 border border-green-200 rounded-[8px]">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          <p className="font-hanken text-[13px] text-green-700 font-medium">
            Customer <span className="font-bold">{toast.name}</span> created
            successfully.
          </p>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex items-end justify-between mb-[32px]">
        <div className="flex flex-col gap-[8px]">
          <h2 className="gc-page-title">Customers</h2>
          <div className="flex items-center gap-[8px]">
            <span className="font-hanken text-[14px] text-black">
              {loading
                ? "Fetching from Shopify…"
                : error
                  ? "Could not load customers"
                  : `${filtered.length} OF ${customers.length} CUSTOMERS`}
            </span>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase tracking-wide transition-colors"
        >
          <Plus size={14} />
          CREATE CUSTOMER
        </button>
      </div>

      {/* ── Inline search bar ── */}
      <div
        className="flex items-center gap-[14px] h-[55px] px-[21px] rounded-[8px] mb-[20px]"
        style={{
          backgroundColor: "rgba(255,255,255,0.5)",
          border: "1px solid #d1c7bd",
        }}
      >
        <Search size={17} className="text-[#6b7280] flex-shrink-0" />
        <input
          type="text"
          value={inlineSearch}
          onChange={(e) => setInlineSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="font-hanken flex-1 bg-transparent text-[14px] font-medium text-[#6b7280] outline-none placeholder:text-[#6b7280]"
        />
      </div>

      {/* ── Table ── */}
      <div className="flex flex-col gap-[20px]">
        <div
          className="bg-white rounded-[12px] overflow-hidden"
          style={{ border: "1px solid rgba(197,198,205,0.3)" }}
        >
          {loading && <LoadingState progress={progress} />}
          {error && <ErrorState message={error} onRetry={retry} />}

          {!loading && !error && (
            <table className="w-full">
              <thead>
                <tr className="gc-table-header-row rounded-tl-[12px] rounded-tr-[12px]">
                  {[
                    "CUSTOMER",
                    "EMAIL",
                    "PHONE",
                    "ORDERS",
                    "TOTAL SPENT",
                    "REGISTERED",
                  ].map((h) => (
                    <th key={h} className="gc-th py-[28px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="font-hanken text-center py-[64px] text-[14px] text-gc-text"
                    >
                      No customers match your search.
                    </td>
                  </tr>
                ) : (
                  paginated.map((c, i) => {
                    const style = AVATAR_STYLES[i % AVATAR_STYLES.length];
                    const initials = getInitials(c.name);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/customers/${c.numericId}`)}
                        className="cursor-pointer hover:bg-[rgba(164,93,65,0.04)] transition-colors"
                        style={
                          i > 0
                            ? { borderTop: "1px solid rgba(197,198,205,0.2)" }
                            : {}
                        }
                      >
                        {/* Customer cell */}
                        <td className="pl-[24px] py-[20px] pr-[16px]">
                          <div className="flex items-center gap-[16px]">
                            {/* Avatar square */}
                            <div
                              className="w-[40px] h-[40px] flex-shrink-0 flex items-center justify-center rounded-[3px]"
                              style={{
                                backgroundColor: style.bg,
                                border: `1px solid ${style.border}`,
                              }}
                            >
                              <span
                                className="font-garamond text-[16px] font-normal text-center"
                                style={{ color: style.color }}
                              >
                                {initials}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-hanken text-[14px] font-bold text-black leading-tight">
                                {c.name}
                              </span>
                              <span
                                className="font-hanken text-[10px] italic leading-[15px]"
                                style={{ color: "rgba(66,70,86,0.7)" }}
                              >
                                ID: GC-{c.numericId?.slice(-4) || "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="font-hanken text-[14px] text-black px-[24px] py-[20px] pl-[48px]">
                          {c.email || "—"}
                        </td>

                        {/* Phone */}
                        <td className="font-hanken text-[14px] font-medium text-black px-[24px] py-[20px] whitespace-nowrap">
                          {c.phone || "—"}
                        </td>

                        {/* Orders badge */}
                        <td className="px-[24px] py-[20px]">
                          <span
                            className="font-hanken inline-flex items-center px-[12px] py-[4px] rounded-[3px] text-[10px] font-semibold text-gc-primary-dark"
                            style={{
                              backgroundColor: "rgba(146,73,50,0.1)",
                              border: "1px solid #924932",
                            }}
                          >
                            {String(c.numberOfOrders).padStart(2, "0")}
                          </span>
                        </td>

                        {/* Total spent */}
                        <td className="font-hanken text-[16px] font-semibold text-black px-[24px] py-[20px] whitespace-nowrap">
                          {c.totalSpent}
                        </td>

                        {/* Registered */}
                        <td className="font-hanken text-[16px] text-gc-text px-[24px] py-[20px] whitespace-nowrap">
                          {c.registrationDate}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination footer ── */}
        {!loading && !error && filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between">
            <p
              className="font-hanken text-[14px] font-medium"
              style={{ color: "#656565" }}
            >
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of{" "}
              {filtered.length} entries
            </p>

            <div className="flex items-center gap-[7px]">
              {/* Prev */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-[26px] h-[26px] flex items-center justify-center rounded-[3px] disabled:opacity-30 transition-colors"
                style={{ border: "0.853px solid #8f8f8f" }}
              >
                <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
                  <path
                    d="M4 1L1 4L4 7"
                    stroke="#1a1c1b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Page numbers */}
              {visiblePages[0] > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="font-hanken min-w-[26px] h-[26px] px-[6px] flex items-center justify-center rounded-[3px] text-[10px] font-bold"
                    style={{ border: "0.853px solid #d2d2d2" }}
                  >
                    1
                  </button>
                  {visiblePages[0] > 2 && (
                    <span className="font-hanken text-[#656565] text-[12px]">
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
                    "font-hanken min-w-[26px] h-[26px] px-[10px] flex items-center justify-center rounded-[3px] text-[10px] font-bold transition-colors",
                    currentPage === page ? "text-white" : "",
                  )}
                  style={
                    currentPage === page
                      ? { backgroundColor: "#924932" }
                      : { border: "0.853px solid #d2d2d2" }
                  }
                >
                  {page}
                </button>
              ))}

              {visiblePages[visiblePages.length - 1] < totalPages && (
                <>
                  {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                    <span className="font-hanken text-[#656565] text-[12px]">
                      …
                    </span>
                  )}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="font-hanken min-w-[26px] h-[26px] px-[6px] flex items-center justify-center rounded-[3px] text-[10px] font-bold"
                    style={{ border: "0.853px solid #d2d2d2" }}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              {/* Next */}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="w-[26px] h-[26px] flex items-center justify-center rounded-[3px] disabled:opacity-30 transition-colors"
                style={{ border: "0.853px solid #d2d2d2" }}
              >
                <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
                  <path
                    d="M1 1L4 4L1 7"
                    stroke="#1a1c1b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateCustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </DashboardLayout>
  );
}

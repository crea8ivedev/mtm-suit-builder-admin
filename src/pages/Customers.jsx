import { useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import CreateCustomerModal from "../components/ui/CreateCustomerModal";
import { useCustomers } from "../hooks/useCustomers";
import { transformCustomer } from "../lib/shopify";

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
  { bg: "rgba(0,0,0,0.05)", border: "rgba(0,0,0,0.1)", color: "#1a1c1b" },
];

function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

export default function Customers() {
  const {
    customers,
    loading,
    error,
    currentPage,
    hasNextPage,
    maxKnownPage,
    totalCount,
    load,
    nextPage,
    prevPage,
    goToPage,
    retry,
  } = useCustomers();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const topSearch = searchParams.get("search") || "";

  const [inlineSearch, setInlineSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const returnTo = location.state?.returnTo ?? null;

  const activeSearch = topSearch || inlineSearch;
  const isFirstLoad = useRef(true);

  // Auto-open modal when navigated from "New Customer" in order flow
  useEffect(() => {
    if (location.state?.autoCreateModal) {
      setModalOpen(true);
      window.history.replaceState({}, "");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + debounced search on change
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      load(activeSearch);
      return;
    }
    const t = setTimeout(() => load(activeSearch), 350);
    return () => clearTimeout(t);
  }, [activeSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCreated(customer) {
    setModalOpen(false);
    if (returnTo) {
      navigate(returnTo, {
        state: { newCustomer: transformCustomer(customer) },
      });
      return;
    }
    setToast({ name: `${customer.firstName} ${customer.lastName}`.trim() });
    load(activeSearch);
  }

  return (
    <DashboardLayout onRefresh={retry}>
      {toast && (
        <div className="flex items-center gap-[10px] mb-[16px] px-[16px] py-[12px] bg-green-50 border border-green-200 rounded-[8px]">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          <p className="font-hanken text-[13px] text-green-700 font-medium">
            Customer <span className="font-bold">{toast.name}</span> created
            successfully.
          </p>
        </div>
      )}

      <div className="flex items-end justify-between mb-[32px]">
        <div className="flex flex-col gap-[8px]">
          <h2 className="gc-page-title">Customers</h2>
          <div className="flex items-center gap-[8px]">
            <span className="font-hanken text-[14px] font-normal text-black">
              {loading
                ? "FETCHING FROM SHOPIFY…"
                : error
                  ? "COULD NOT LOAD CUSTOMERS"
                  : totalCount !== null
                    ? `${(currentPage - 1) * 20 + customers.length} OF ${totalCount} CUSTOMERS`
                    : `${customers.length} CUSTOMERS`}
            </span>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase tracking-wide transition-colors cursor-pointer"
        >
          <Plus size={14} />
          CREATE CUSTOMER
        </button>
      </div>

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

      <div className="flex flex-col gap-[20px]">
        <div
          className="bg-white rounded-[12px] overflow-hidden"
          style={{ border: "1px solid rgba(197,198,205,0.3)" }}
        >
          {loading && <LoadingState />}
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
                {customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="font-hanken text-center py-[64px] text-[14px] text-gc-text"
                    >
                      No customers match your search.
                    </td>
                  </tr>
                ) : (
                  customers.map((c, i) => {
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
                        <td className="pl-[24px] py-[20px] pr-[16px]">
                          <div className="flex items-center gap-[16px]">
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

                        <td className="font-hanken text-[14px] text-black px-[24px] py-[20px] pl-[48px]">
                          {c.email || "—"}
                        </td>

                        <td className="font-hanken text-[14px] font-medium text-black px-[24px] py-[20px] whitespace-nowrap">
                          {c.phone || "—"}
                        </td>

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

                        <td className="font-hanken text-[16px] font-semibold text-black px-[24px] py-[20px] whitespace-nowrap">
                          {c.totalSpent}
                        </td>

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

        {!loading && !error && (currentPage > 1 || hasNextPage) && (
          <div className="gc-divider flex items-center justify-between px-[24px] py-[16px] flex-wrap gap-[12px]">
            <p className="gc-pagination-count">
              Showing {(currentPage - 1) * 20 + 1} to{" "}
              {(currentPage - 1) * 20 + customers.length} entries
            </p>
            <div className="flex items-center gap-[4px]">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="gc-pagination-btn"
              >
                <ChevronLeft size={15} />
              </button>
              {(() => {
                const WINDOW = 5;
                let start = Math.max(1, currentPage - Math.floor(WINDOW / 2));
                let end = Math.min(maxKnownPage, start + WINDOW - 1);
                if (end - start + 1 < WINDOW)
                  start = Math.max(1, end - WINDOW + 1);
                return Array.from(
                  { length: end - start + 1 },
                  (_, i) => start + i,
                ).map((page) => (
                  <button
                    key={page}
                    onClick={() => page !== currentPage && goToPage(page)}
                    className={`gc-pagination-btn${page === currentPage ? " active" : ""}`}
                  >
                    {page}
                  </button>
                ));
              })()}
              <button
                onClick={nextPage}
                disabled={!hasNextPage}
                className="gc-pagination-btn"
              >
                <ChevronRight size={15} />
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

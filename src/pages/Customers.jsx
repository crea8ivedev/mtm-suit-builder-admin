import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import CreateCustomerModal from "../components/ui/CreateCustomerModal";
import { useCustomers } from "../hooks/useCustomers";
import { cn } from "../utils/cn";

const ITEMS_PER_PAGE = 25;

export default function Customers() {
  const { customers, loading, error, progress, retry } = useCustomers();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState(null); // { name }
  // const [syncing, setSyncing]         = useState(false)
  // const [syncResult, setSyncResult]   = useState(null)

  // async function handleSyncAll() {
  //   setSyncing(true)
  //   setSyncResult(null)
  //   try {
  //     const res  = await fetch('/api/customers/sync-all', { method: 'POST' })
  //     const data = await res.json()
  //     if (!res.ok) throw new Error(data.error || 'Sync failed')
  //     setSyncResult({ ok: true, synced: data.synced, total: data.total })
  //   } catch (err) {
  //     setSyncResult({ ok: false, error: err.message })
  //   } finally {
  //     setSyncing(false)
  //   }
  // }

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCreated(customer) {
    setModalOpen(false);
    setToast({ name: `${customer.firstName} ${customer.lastName}`.trim() });
    retry(); // clear cache + refetch
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
    const range = 3;
    const start = Math.max(1, currentPage - range);
    const end = Math.min(totalPages, currentPage + range);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const resetPage = () => setCurrentPage(1);

  return (
    <DashboardLayout>
      {/* Success toast */}
      {toast && (
        <div className="flex items-center gap-[10px] mb-[16px] px-[16px] py-[12px] bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          <p className="text-13 text-green-700 font-medium">
            Customer <span className="font-bold">{toast.name}</span> created
            successfully in Shopify.
          </p>
        </div>
      )}
      {/* syncResult toast commented — auto-sync runs silently in background
      {syncResult && (
        <div className={`flex items-center gap-[10px] mb-[16px] px-[16px] py-[12px] rounded-xl border ${syncResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <CheckCircle size={16} className={syncResult.ok ? 'text-green-600' : 'text-red-600'} />
          <p className={`text-13 font-medium ${syncResult.ok ? 'text-green-700' : 'text-red-700'}`}>
            {syncResult.ok
              ? `Synced ${syncResult.synced} of ${syncResult.total} customers to Shopify.`
              : `Sync failed: ${syncResult.error}`}
          </p>
          <button onClick={() => setSyncResult(null)} className="ml-auto text-text-muted hover:text-text-primary text-16 leading-none">×</button>
        </div>
      )}
      */}

      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="text-24 font-bold text-text-primary">Customers</h2>
          <p className="text-14 text-text-muted mt-[3px]">
            {loading
              ? "Fetching from Shopify…"
              : error
                ? "Could not load customers"
                : `${filtered.length} of ${customers.length} customer${customers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          {!loading && !error && (
            <button
              onClick={retry}
              className="btn-icon border border-border"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          )}
          {/* Sync All button commented — auto-sync now runs in DashboardLayout on load
          <button
            onClick={handleSyncAll}
            disabled={syncing || loading}
            className="btn-secondary gap-[8px] disabled:opacity-50"
            title="Sync all customer measurement profiles to Shopify"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync All Profiles'}
          </button>
          */}
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary gap-[8px]"
          >
            <UserPlus size={15} />
            Create Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card p-[16px] md:p-[20px] mb-[20px]">
        <div className="relative max-w-[360px]">
          {/* <Search size={15} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" /> */}
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Name, email or phone…"
            className="input pl-[38px] py-[9px] w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading && <LoadingState progress={progress} />}
        {error && <ErrorState message={error} onRetry={retry} />}

        {!loading && !error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Orders</th>
                    <th>Total Spent</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-[64px] text-text-muted text-15"
                      >
                        No customers match your search.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/customers/${c.numericId}`)}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td>
                          <div className="flex items-center gap-[10px]">
                            <div className="w-[32px] h-[32px] rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                              <span className="text-12 font-bold text-brand-600">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-text-primary">
                              {c.name}
                            </span>
                          </div>
                        </td>
                        <td className="text-text-secondary">
                          {c.email || "—"}
                        </td>
                        <td className="text-text-secondary">
                          {c.phone || "—"}
                        </td>
                        <td className="text-text-secondary">
                          {c.numberOfOrders}
                        </td>
                        <td className="font-semibold text-text-primary">
                          {c.totalSpent}
                        </td>
                        <td className="text-text-secondary whitespace-nowrap">
                          {c.registrationDate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
      <CreateCustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </DashboardLayout>
  );
}

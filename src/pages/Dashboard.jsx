import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, X, ArrowRight, BadgeCheck } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import StatusPill from "../components/ui/StatusPill";
import { useOrders } from "../hooks/useOrders";

const STAT_CONFIG = [
  { id: "pending", label: "Pending Orders", icon: Clock },
  { id: "failed", label: "Failed Orders", icon: X },
  { id: "verified", label: "Submitted Supplier", icon: BadgeCheck },
];

function ItemsBadge({ count }) {
  return <span className="items-badge">{count}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userName = localStorage.getItem("suit_admin_name") || "Admin";
  const search = searchParams.get("search") || "";
  const { orders, stats, loading, error, progress, retry } = useOrders();

  const recentOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? orders.filter(
          (o) =>
            o.id.toLowerCase().includes(q) ||
            o.customer.name.toLowerCase().includes(q) ||
            o.customer.email.toLowerCase().includes(q),
        )
      : orders;
    return base.slice(0, 10);
  }, [orders, search]);

  return (
    <DashboardLayout onRefresh={retry} isRefreshing={loading}>
      <div className="mb-[24px] sm:mb-[30px]">
        <h2 className="gc-page-title">Dashboard</h2>
        <p className="gc-page-subtitle">
          {loading
            ? "Fetching from Shopify…"
            : error
              ? "Could not load data"
              : `Welcome back, ${userName}. ${stats.total} total orders in your store.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-[16px] sm:gap-[24px] mb-[40px] md:mr-[-28px]">
        {STAT_CONFIG.map(({ id, label, icon: Icon }) => (
          <div key={id} className="gc-stat-card">
            <div className="gc-stat-icon">
              <Icon size={14} strokeWidth={4} />
            </div>
            <p className="gc-stat-value">
              {loading ? "—" : String(stats[id] ?? "0")}
            </p>
            <p className="gc-stat-label">{label}</p>
          </div>
        ))}
      </div>

      <div className="gc-table-container">
        <div className="border-b border-gc-topbar-divider/30 flex items-center justify-between px-[20px] py-[16px]">
          <div>
            <h3 className="font-hanken text-[16px] font-semibold text-gc-dark">
              Recent Orders
            </h3>
            <p className="font-hanken text-[13px] text-gc-text mt-[2px]">
              {loading
                ? "Loading…"
                : search
                  ? `${recentOrders.length} result${recentOrders.length !== 1 ? "s" : ""} for "${search}"`
                  : `Latest ${recentOrders.length} orders`}
            </p>
          </div>
          <button
            onClick={() => navigate("/orders")}
            className="font-hanken flex items-center gap-[5px] text-[14px] font-medium text-gc-id hover:text-gc-primary transition-colors cursor-pointer"
          >
            View all
            <ArrowRight size={14} />
          </button>
        </div>

        {loading && <LoadingState progress={progress} />}
        {error && <ErrorState message={error} onRetry={retry} />}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
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
                {recentOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="font-hanken text-center py-[48px] text-[14px] text-gc-text"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr
                      key={order.id}
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
        )}
      </div>
    </DashboardLayout>
  );
}

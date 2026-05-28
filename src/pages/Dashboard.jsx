import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useOrders } from "../hooks/useOrders";
import { STAT_CARDS } from "../constants/data";

export default function Dashboard() {
  const { orders, stats, loading, error, progress, retry } = useOrders();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search")?.toLowerCase().trim() || "";

  const dynamicCards = STAT_CARDS.map((card) => ({
    ...card,
    value: loading ? "—" : String(stats[card.id] ?? stats.total),
  }));

  const recentOrders = searchQuery
    ? orders.filter(
        (o) =>
          o.id.toLowerCase().includes(searchQuery) ||
          o.customer.name.toLowerCase().includes(searchQuery) ||
          o.customer.email.toLowerCase().includes(searchQuery),
      )
    : orders.slice(0, 8);

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="section-header">
        <div>
          <h2 className="text-24 font-bold text-text-primary">Dashboard</h2>
          <p className="text-14 text-text-muted mt-[3px]">
            Welcome back, Admin.{" "}
            {!loading && !error && (
              <span>{stats.total} total orders in your store.</span>
            )}
          </p>
        </div>
        {!loading && !error && (
          <span className="text-13 text-text-muted hidden sm:block">
            {orders.length} orders loaded
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[16px] mb-[28px]">
        {dynamicCards.map((card) => (
          <StatCard key={card.id} {...card} />
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between px-[20px] md:px-[24px] py-[16px] border-b border-border">
          <div>
            <h3 className="text-16 font-semibold text-text-primary">
              Recent Orders
            </h3>
            <p className="text-13 text-text-muted mt-[2px]">
              {loading
                ? "Loading…"
                : searchQuery
                  ? `${recentOrders.length} result${recentOrders.length !== 1 ? "s" : ""} for "${searchQuery}"`
                  : `Latest ${recentOrders.length} orders`}
            </p>
          </div>
          <Link
            to="/orders"
            className="flex items-center gap-[5px] text-14 text-brand-600 hover:text-brand-700 font-medium transition-colors"
          >
            View all
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading && <LoadingState progress={progress} />}
        {error && <ErrorState message={error} onRetry={retry} />}

        {!loading && !error && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-[40px] text-text-muted"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          to={`/orders/${order.numericId}`}
                          className="font-bold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                        >
                          {order.id}
                        </Link>
                      </td>
                      <td>
                        <p className="font-medium text-text-primary">
                          {order.customer.name}
                        </p>
                        <p className="text-12 text-text-muted">
                          {order.customer.email}
                        </p>
                      </td>
                      <td className="text-text-secondary">{order.orderDate}</td>
                      <td className="text-text-secondary">
                        {order.itemsDisplay}
                      </td>
                      <td className="font-semibold text-text-primary">
                        {order.total}
                      </td>
                      <td>
                        <Badge status={order.paymentStatus} />
                      </td>
                      <td>
                        <Badge status={order.status} />
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

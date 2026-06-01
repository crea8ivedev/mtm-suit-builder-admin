import { useState, useEffect, useMemo } from "react";
import {
  fetchAllOrders,
  transformOrder,
  clearOrdersCache,
} from "../lib/shopify";

export function useOrders() {
  const [rawOrders, setRawOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const load = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAllOrders((count) => {
      if (!cancelled) setProgress(count);
    })
      .then((orders) => {
        if (!cancelled) {
          setRawOrders(orders);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(load, []);

  const retry = () => {
    clearOrdersCache();
    load();
  };

  const orders = useMemo(() => rawOrders.map(transformOrder), [rawOrders]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === "processing").length,
      submitted: orders.filter((o) => o.status === "shipped").length,
      failed: orders.filter((o) => o.status === "failed").length,
    }),
    [orders],
  );

  return { orders, stats, loading, error, progress, retry };
}

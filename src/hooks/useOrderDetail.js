import { useState, useEffect, useCallback } from "react";
import { fetchOrderById, clearOrderDetailCache } from "../lib/shopify";

export function useOrderDetail(shopifyGid) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!shopifyGid) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setOrder(null);

    fetchOrderById(shopifyGid)
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
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
  }, [shopifyGid, tick]);

  const refetch = useCallback(() => {
    clearOrderDetailCache(shopifyGid);
    setTick((t) => t + 1);
  }, [shopifyGid]);

  return { order, loading, error, refetch };
}

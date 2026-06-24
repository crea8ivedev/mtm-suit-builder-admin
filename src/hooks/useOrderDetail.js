import { useState, useEffect, useCallback } from "react";
import { fetchOrderById, clearOrderDetailCache } from "../lib/shopify";
import { setOrderSupplierOverride } from "./useOrders";

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
          const meta = Object.fromEntries(
            (data?.metafields?.edges ?? []).map((e) => [
              e.node.key,
              e.node.value,
            ]),
          );
          if (meta.supplier_status) {
            setOrderSupplierOverride(shopifyGid, meta.supplier_status);
          }
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

import { useState, useEffect, useRef, useMemo } from "react";
import { fetchOrdersPage, transformOrder } from "../lib/shopify";

// Module-level cache so navigating away and back doesn't re-fetch
let _cache = null;

export function useOrders() {
  const [rawOrders, setRawOrders] = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(_cache?.length || 0);
  const cancelRef = useRef(false);

  function load() {
    if (_cache) {
      setRawOrders(_cache);
      setLoading(false);
      setProgress(_cache.length);
      return;
    }

    cancelRef.current = false;
    setLoading(true);
    setError(null);
    setRawOrders([]);
    setProgress(0);

    (async () => {
      const all = [];
      let cursor = null;
      let hasNextPage = true;
      let firstBatch = true;

      try {
        while (hasNextPage) {
          if (cancelRef.current) return;

          const result = await fetchOrdersPage({ first: 50, after: cursor });
          all.push(...result.orders);

          if (cancelRef.current) return;

          // Show first batch immediately — rest stream in behind the scenes
          setRawOrders([...all]);
          setProgress(all.length);
          if (firstBatch) {
            setLoading(false);
            firstBatch = false;
          }

          hasNextPage = result.hasNextPage;
          cursor = result.endCursor;
        }

        _cache = [...all];
      } catch (err) {
        if (!cancelRef.current) {
          setError(err.message);
          setLoading(false);
        }
      }
    })();
  }

  useEffect(() => {
    load();
    return () => {
      cancelRef.current = true;
    };
  }, []);

  function retry() {
    _cache = null;
    load();
  }

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

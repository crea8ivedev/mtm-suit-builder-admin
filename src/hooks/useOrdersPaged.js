import { useState, useEffect, useRef } from "react";
import { fetchOrdersPage, transformOrder } from "../lib/shopify";

export function useOrdersPaged({
  pageSize = 20,
  searchQuery = "",
  pageMode = true,
}) {
  const [pageOrders, setPageOrders] = useState([]);
  const [cursorStack, setCursorStack] = useState([null]);
  const [pageIdx, setPageIdx] = useState(0);
  const [endCursor, setEndCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  // ── infinite state ─────────────────────────────────────────────────────────
  const [infiniteOrders, setInfiniteOrders] = useState([]);
  const [infiniteCursor, setInfiniteCursor] = useState(null);
  const [infiniteHasMore, setInfiniteHasMore] = useState(false);

  // ── shared ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef(null);

  // ── initial / reset load ───────────────────────────────────────────────────
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setPageOrders([]);
    setInfiniteOrders([]);
    setCursorStack([null]);
    setPageIdx(0);
    setEndCursor(null);
    setInfiniteCursor(null);
    setInfiniteHasMore(false);
    setHasNextPage(false);

    fetchOrdersPage({ first: pageSize, after: null, searchQuery })
      .then((result) => {
        if (ctrl.signal.aborted) return;
        const rows = result.orders.map(transformOrder);
        setPageOrders(rows);
        setInfiniteOrders(rows);
        setHasNextPage(result.hasNextPage);
        setEndCursor(result.endCursor);
        setInfiniteCursor(result.endCursor);
        setInfiniteHasMore(result.hasNextPage);
        setLoading(false);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e.message);
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [pageSize, searchQuery, retryCount]);

  // ── paginate: next ─────────────────────────────────────────────────────────
  async function goNext() {
    if (!hasNextPage || !endCursor || loadingMore) return;
    const nextIdx = pageIdx + 1;
    const after = endCursor;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await fetchOrdersPage({
        first: pageSize,
        after,
        searchQuery,
      });
      const rows = result.orders.map(transformOrder);
      setPageOrders(rows);
      setHasNextPage(result.hasNextPage);
      setEndCursor(result.endCursor);
      setCursorStack((prev) => {
        const next = [...prev];
        next[nextIdx] = after;
        return next;
      });
      setPageIdx(nextIdx);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // ── paginate: prev ─────────────────────────────────────────────────────────
  async function goPrev() {
    if (pageIdx === 0 || loadingMore) return;
    const prevIdx = pageIdx - 1;
    const after = prevIdx === 0 ? null : cursorStack[prevIdx];
    setLoadingMore(true);
    setError(null);
    try {
      const result = await fetchOrdersPage({
        first: pageSize,
        after,
        searchQuery,
      });
      const rows = result.orders.map(transformOrder);
      setPageOrders(rows);
      setHasNextPage(result.hasNextPage);
      setEndCursor(result.endCursor);
      setPageIdx(prevIdx);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // ── infinite scroll: load more ─────────────────────────────────────────────
  async function loadMore() {
    if (!infiniteHasMore || !infiniteCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await fetchOrdersPage({
        first: 20,
        after: infiniteCursor,
        searchQuery,
      });
      const rows = result.orders.map(transformOrder);
      setInfiniteOrders((prev) => [...prev, ...rows]);
      setInfiniteCursor(result.endCursor);
      setInfiniteHasMore(result.hasNextPage);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    pageOrders,
    currentPage: pageIdx + 1,
    hasNextPage,
    canGoPrev: pageIdx > 0,
    goNext,
    goPrev,
    infiniteOrders,
    infiniteHasMore,
    loadMore,
    loading,
    loadingMore,
    error,
    retry: () => setRetryCount((c) => c + 1),
  };
}

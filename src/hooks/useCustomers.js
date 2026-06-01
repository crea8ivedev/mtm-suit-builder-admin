import { useState, useCallback, useRef } from "react";
import { fetchCustomersPage, transformCustomer } from "../lib/shopify";

const PAGE_SIZE = 20;

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // cursors[i] = the Shopify cursor needed to fetch page (i+1)
  // cursors[0] = null (first page has no cursor)
  const cursorStack = useRef([null]);
  const activeSearch = useRef("");

  const fetchPage = useCallback((pageNum, search) => {
    const cursor = cursorStack.current[pageNum - 1] ?? null;
    setLoading(true);
    setError(null);
    fetchCustomersPage({ cursor, pageSize: PAGE_SIZE, searchQuery: search })
      .then(({ customers: raw, pageInfo }) => {
        setCustomers(raw.map(transformCustomer));
        setHasNextPage(pageInfo.hasNextPage);
        if (pageInfo.hasNextPage) {
          cursorStack.current[pageNum] = pageInfo.endCursor;
        }
        setCurrentPage(pageNum);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Call this to (re)load from page 1 with a given search query
  const load = useCallback((search = "") => {
    activeSearch.current = search;
    cursorStack.current = [null];
    fetchPage(1, search);
  }, [fetchPage]);

  const nextPage = useCallback(() => {
    fetchPage(currentPage + 1, activeSearch.current);
  }, [fetchPage, currentPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) fetchPage(currentPage - 1, activeSearch.current);
  }, [fetchPage, currentPage]);

  const retry = useCallback(() => {
    fetchPage(currentPage, activeSearch.current);
  }, [fetchPage, currentPage]);

  return { customers, loading, error, currentPage, hasNextPage, load, nextPage, prevPage, retry };
}

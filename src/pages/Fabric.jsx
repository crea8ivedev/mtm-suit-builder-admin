import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, Upload } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { fetchFabricProductsV2 } from "../lib/shopify";

function formatPrice(amount, currencyCode) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${parseFloat(amount).toFixed(2)}`;
  }
}

export default function Fabric() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, search]);

  function load() {
    setLoading(true);
    setError(null);
    fetchFabricProductsV2()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-[12px] mb-[24px] sm:mb-[30px]">
        <div>
          <h2 className="gc-page-title">Fabric</h2>
          <p className="gc-page-subtitle">
            {loading
              ? "Loading products…"
              : error
                ? "Could not load products"
                : search
                  ? `${filteredProducts.length} of ${products.length} fabric product${products.length !== 1 ? "s" : ""}`
                  : `${products.length} fabric product${products.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-[10px]">
          <Link
            to="/fabric/bulk-import"
            className="font-hanken flex items-center gap-[6px] text-gc-primary border border-gc-border-input text-[13px] font-semibold px-[14px] py-[9px] rounded-lg hover:bg-gc-primary/[4%] transition-colors cursor-pointer"
          >
            <Upload size={14} />
            Bulk Import
          </Link>
          <Link
            to="/fabric/new"
            className="font-hanken flex items-center gap-[6px] bg-gc-primary text-white text-[13px] font-semibold px-[14px] py-[9px] rounded-lg hover:bg-gc-primary-dark transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Create Fabric
          </Link>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-[12px] border border-gc-divider">
          <LoadingState message="Loading fabric products…" />
        </div>
      )}

      {error && (
        <div className="bg-white rounded-[12px] border border-gc-divider">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-[12px] border border-gc-divider overflow-hidden">
          {products.length === 0 ? (
            <div className="text-center py-[48px]">
              <p className="font-hanken text-[14px] text-gc-text">
                No fabric products found.
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-[48px]">
              <p className="font-hanken text-[14px] text-gc-muted-warm">
                No products match "{search}".
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gc-divider">
              {/* Header row — desktop only */}
              <div className="hidden sm:grid sm:grid-cols-[100px_1fr_100px_130px] bg-gc-bg-warm px-[20px] py-[10px]">
                <span className="font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-widest">
                  Image
                </span>
                <span className="font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-widest pl-[12px]">
                  Product
                </span>
                <span className="font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-widest pl-[12px]">
                  Status
                </span>
                <span className="font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-widest pl-[12px]">
                  Price
                </span>
              </div>
              {filteredProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/fabric/${product.id.split("/").pop()}`}
                  className="flex sm:grid sm:grid-cols-[100px_1fr_100px_130px] items-center gap-[12px] sm:gap-0 px-[16px] sm:px-[20px] py-[12px] cursor-pointer hover:bg-gc-bg-warm transition-colors"
                >
                  <div className="w-[64px] h-[64px] sm:w-[78px] sm:h-[78px] rounded-[8px] overflow-hidden border border-gc-divider bg-gc-bg-warm flex-shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.imageAlt}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gc-bg-warm" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 sm:pl-[12px]">
                    <p className="font-hanken text-[14px] font-semibold text-gc-near-black2 leading-[1.4]">
                      {product.title}
                    </p>
                    <p className="font-hanken text-[13px] text-gc-primary font-medium mt-[2px] sm:hidden">
                      {formatPrice(product.price, product.currencyCode)}
                    </p>
                  </div>
                  <div className="hidden sm:block sm:pl-[12px]">
                    <span
                      className={`font-hanken text-[11px] font-semibold uppercase px-[8px] py-[3px] rounded-full ${
                        product.status === "ACTIVE"
                          ? "text-emerald-700 bg-emerald-50"
                          : "text-gc-muted bg-gc-bg-warm"
                      }`}
                    >
                      {product.status === "ACTIVE" ? "Active" : "Draft"}
                    </span>
                  </div>
                  <div className="hidden sm:block sm:pl-[12px]">
                    <p className="font-hanken text-[13px] text-gc-primary font-medium">
                      {formatPrice(product.price, product.currencyCode)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { fetchFabricProducts } from "../lib/shopify";

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

  function load() {
    setLoading(true);
    setError(null);
    fetchFabricProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-[24px] sm:mb-[30px]">
        <h2 className="gc-page-title">Fabric</h2>
        <p className="gc-page-subtitle">
          {loading
            ? "Loading products…"
            : error
              ? "Could not load products"
              : `${products.length} fabric product${products.length !== 1 ? "s" : ""}`}
        </p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[16px] sm:gap-[20px]">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-[12px] border border-gc-divider shadow-sm overflow-hidden flex flex-col"
            >
              <div className="w-full aspect-square bg-gc-bg-warm flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.imageAlt}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gc-bg-warm" />
                )}
              </div>
              <div className="p-[14px] flex flex-col gap-[4px]">
                <p className="font-hanken text-[13px] font-semibold text-gc-near-black2 leading-[1.4] line-clamp-2">
                  {product.title}
                </p>
                <p className="font-hanken text-[12px] text-gc-primary font-medium">
                  {formatPrice(product.price, product.currencyCode)}
                </p>
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="col-span-full text-center py-[48px]">
              <p className="font-hanken text-[14px] text-gc-text">
                No fabric products found.
              </p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

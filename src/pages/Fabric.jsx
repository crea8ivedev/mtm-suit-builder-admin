import { useState, useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import ColorPatternModal from "../components/ui/ColorPatternModal";
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
  const [selectedProduct, setSelectedProduct] = useState(null);

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
        <div className="bg-white rounded-[12px] border border-gc-divider overflow-hidden">
          {products.length === 0 ? (
            <div className="text-center py-[48px]">
              <p className="font-hanken text-[14px] text-gc-text">
                No fabric products found.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gc-divider bg-gc-bg-warm">
                  <th className="text-left font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-widest px-[20px] py-[12px] w-[64px]">
                    Image
                  </th>
                  <th className="text-left font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-widest px-[12px] py-[12px]">
                    Product
                  </th>
                  <th className="text-left font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-widest px-[12px] py-[12px] w-[120px]">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, i) => (
                  <tr
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={[
                      "cursor-pointer hover:bg-gc-bg-warm transition-colors",
                      i !== products.length - 1
                        ? "border-b border-gc-divider"
                        : "",
                    ].join(" ")}
                  >
                    <td className="px-[20px] py-[12px]">
                      <div className="w-[72px] h-[72px] rounded-[8px] overflow-hidden border border-gc-divider bg-gc-bg-warm flex-shrink-0">
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
                    </td>
                    <td className="px-[12px] py-[12px]">
                      <p className="font-hanken text-[14px] font-semibold text-gc-near-black2 leading-[1.4]">
                        {product.title}
                      </p>
                    </td>
                    <td className="px-[12px] py-[12px]">
                      <p className="font-hanken text-[13px] text-gc-primary font-medium">
                        {formatPrice(product.price, product.currencyCode)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedProduct && (
        <ColorPatternModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </DashboardLayout>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import FabricLibrarySection from "../components/fabric/FabricLibrarySection";
import StyleCategorySection from "../components/fabric/StyleCategorySection";
import {
  fetchFabricProducts,
  fetchShopifyColorPattern,
  clearShopifyColorPatternCache,
} from "../lib/shopify";

export default function Fabric() {
  const [fabrics, setFabrics] = useState([]);
  const [fabricsLoading, setFabricsLoading] = useState(true);
  const [fabricsError, setFabricsError] = useState(null);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, search]);

  function loadFabrics(clearCache = false) {
    if (clearCache) clearShopifyColorPatternCache();
    setFabricsLoading(true);
    setFabricsError(null);
    fetchShopifyColorPattern()
      .then(setFabrics)
      .catch((err) => setFabricsError(err.message))
      .finally(() => setFabricsLoading(false));
  }

  function loadProducts() {
    setProductsLoading(true);
    setProductsError(null);
    fetchFabricProducts()
      .then(setProducts)
      .catch((err) => setProductsError(err.message))
      .finally(() => setProductsLoading(false));
  }

  useEffect(() => {
    loadFabrics();
    loadProducts();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-[24px] sm:mb-[30px]">
        <h2 className="gc-page-title">Fabric</h2>
        <p className="gc-page-subtitle">
          Manage your fabric library and assign fabrics to style categories
        </p>
      </div>

      <FabricLibrarySection
        fabrics={fabrics}
        loading={fabricsLoading}
        error={fabricsError}
        onRefresh={() => loadFabrics(true)}
        onChanged={() => loadFabrics(true)}
        styleCategoryProducts={products}
      />

      <StyleCategorySection
        products={filteredProducts}
        loading={productsLoading}
        error={productsError}
        onRetry={loadProducts}
        fabrics={fabrics}
      />
    </DashboardLayout>
  );
}

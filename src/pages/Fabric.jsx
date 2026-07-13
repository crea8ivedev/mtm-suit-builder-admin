import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useClickOutside } from "../hooks/useClickOutside";
import { cn } from "../utils/cn";
import { fetchFabricProductsV2 } from "../lib/shopify";

const NO_BRAND = "No Brand";
const UNCATEGORIZED = "Uncategorized";

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

// Groups products into brand -> collection -> [products]. A product with no
// collections falls into "Uncategorized"; one with several collections is
// listed under each (mirrors the multi-select on the fabric form).
function groupProducts(products) {
  const brands = new Map();
  for (const p of products) {
    const brand = p.fabricHouse || NO_BRAND;
    const collectionTitles = p.collections.length
      ? p.collections.map((c) => c.title)
      : [UNCATEGORIZED];
    if (!brands.has(brand)) brands.set(brand, new Map());
    const collections = brands.get(brand);
    for (const title of collectionTitles) {
      if (!collections.has(title)) collections.set(title, []);
      collections.get(title).push(p);
    }
  }

  const brandEntries = [...brands.entries()].sort(([a], [b]) => {
    if (a === NO_BRAND) return 1;
    if (b === NO_BRAND) return -1;
    return a.localeCompare(b);
  });

  return brandEntries.map(([brand, collections]) => {
    const collectionEntries = [...collections.entries()].sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
    const fabricCount = new Set(
      collectionEntries.flatMap(([, items]) => items.map((i) => i.id)),
    ).size;
    return {
      brand,
      fabricCount,
      collections: collectionEntries.map(([title, items]) => ({
        title,
        items: [...items].sort((a, b) => a.title.localeCompare(b.title)),
      })),
    };
  });
}

// Dropdown button matching the app's existing filter pattern (see Orders
// page "Filter" button) instead of a plain native <select>.
function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "gc-btn",
          value && "border-gc-primary bg-[rgba(164,93,65,0.08)]",
        )}
      >
        <SlidersHorizontal size={14} />
        {label}
        {value && (
          <span className="text-[11px] font-semibold text-gc-id">
            · {value}
          </span>
        )}
        <ChevronDown size={13} className="text-gc-text" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] w-[220px] max-h-[280px] overflow-y-auto bg-white border border-gc-border rounded-[10px] shadow-lg z-[100] py-[6px]">
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="font-hanken w-full flex items-center justify-between px-[14px] py-[9px] text-[14px] font-medium text-gc-dark hover:bg-gc-bg transition-colors"
          >
            All {label}
            {!value && <Check size={14} className="text-gc-primary" />}
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="font-hanken w-full flex items-center justify-between gap-[8px] px-[14px] py-[9px] text-[14px] font-medium text-gc-dark hover:bg-gc-bg transition-colors text-left"
            >
              <span className="truncate">{opt}</span>
              {value === opt && (
                <Check size={14} className="text-gc-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FabricRow({ product }) {
  return (
    <Link
      to={`/fabric/${product.id.split("/").pop()}`}
      className="flex items-center gap-[12px] px-[16px] sm:px-[20px] py-[12px] cursor-pointer hover:bg-gc-bg-warm transition-colors"
    >
      <div className="w-[52px] h-[52px] rounded-[8px] overflow-hidden border border-gc-divider bg-gc-bg-warm flex-shrink-0">
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
      <div className="flex-1 min-w-0">
        <p className="font-hanken text-[14px] font-semibold text-gc-near-black2 leading-[1.4] truncate">
          {product.title}
        </p>
      </div>
      <span
        className={`font-hanken text-[11px] font-semibold uppercase px-[8px] py-[3px] rounded-full flex-shrink-0 ${
          product.status === "ACTIVE"
            ? "text-emerald-700 bg-emerald-50"
            : "text-gc-muted bg-gc-bg-warm"
        }`}
      >
        {product.status === "ACTIVE" ? "Active" : "Draft"}
      </span>
      <p className="font-hanken text-[13px] text-gc-primary font-medium flex-shrink-0 w-[90px] text-right">
        {formatPrice(product.price, product.currencyCode)}
      </p>
    </Link>
  );
}

function FabricListHeader() {
  return (
    <div className="hidden sm:flex items-center gap-[12px] px-[16px] sm:pl-[64px] sm:pr-[20px] py-[8px] bg-gc-bg-warm/60">
      <span className="font-hanken text-[10px] font-semibold text-gc-muted uppercase tracking-widest w-[52px] flex-shrink-0">
        Image
      </span>
      <span className="font-hanken text-[10px] font-semibold text-gc-muted uppercase tracking-widest flex-1">
        Product
      </span>
      <span className="font-hanken text-[10px] font-semibold text-gc-muted uppercase tracking-widest flex-shrink-0">
        Status
      </span>
      <span className="font-hanken text-[10px] font-semibold text-gc-muted uppercase tracking-widest flex-shrink-0 w-[90px] text-right">
        Price
      </span>
    </div>
  );
}

function CollectionGroup({ title, items, open, onToggle, highlightIds }) {
  return (
    <div className="border-t border-gc-divider bg-gc-bg-warm/25">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-[8px] pl-[36px] sm:pl-[48px] pr-[16px] sm:pr-[28px] py-[10px] cursor-pointer hover:bg-gc-bg-warm/60 transition-colors"
      >
        {open ? (
          <ChevronDown size={14} className="text-gc-muted flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-gc-muted flex-shrink-0" />
        )}
        <span className="font-hanken text-[13px] font-semibold text-gc-near-black2">
          {title}
        </span>
        <span className="font-hanken text-[11px] text-gc-muted">
          · {items.length} fabric{items.length !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div className="bg-white">
          <FabricListHeader />
          <div className="divide-y divide-gc-divider">
            {items.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "pl-[20px] sm:pl-[44px]",
                  highlightIds?.has(p.id) && "bg-gc-primary/[4%]",
                )}
              >
                <FabricRow product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BrandGroup({
  group,
  open,
  onToggleBrand,
  openCollections,
  onToggleCollection,
  highlightIds,
}) {
  return (
    <div className="bg-white rounded-[12px] border border-gc-divider overflow-hidden">
      <button
        onClick={onToggleBrand}
        className="w-full flex items-center gap-[10px] px-[16px] sm:px-[20px] py-[14px] cursor-pointer hover:bg-gc-bg-warm transition-colors"
      >
        {open ? (
          <ChevronDown size={16} className="text-gc-text flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gc-text flex-shrink-0" />
        )}
        <span className="font-hanken text-[15px] font-bold text-gc-near-black2">
          {group.brand}
        </span>
        <span className="font-hanken text-[12px] text-gc-muted">
          · {group.fabricCount} fabric{group.fabricCount !== 1 ? "s" : ""}
        </span>
      </button>
      {open &&
        group.collections.map((c) => (
          <CollectionGroup
            key={c.title}
            title={c.title}
            items={c.items}
            open={openCollections.has(`${group.brand} ${c.title}`)}
            onToggle={() => onToggleCollection(group.brand, c.title)}
            highlightIds={highlightIds}
          />
        ))}
    </div>
  );
}

export default function Fabric() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") || "";

  const [openBrands, setOpenBrands] = useState(new Set());
  const [openCollections, setOpenCollections] = useState(new Set());
  const [brandFilter, setBrandFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");

  function setSearch(value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("search", value);
      else next.delete("search");
      return next;
    });
  }

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

  const groups = useMemo(() => groupProducts(products), [products]);

  const brandOptions = useMemo(() => {
    const set = new Set(products.map((p) => p.fabricHouse || NO_BRAND));
    return [...set].sort((a, b) => {
      if (a === NO_BRAND) return 1;
      if (b === NO_BRAND) return -1;
      return a.localeCompare(b);
    });
  }, [products]);

  const collectionOptions = useMemo(() => {
    const set = new Set(
      products.flatMap((p) =>
        p.collections.length
          ? p.collections.map((c) => c.title)
          : [UNCATEGORIZED],
      ),
    );
    return [...set].sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [products]);

  const q = search.trim().toLowerCase();
  const isFiltering = !!(q || brandFilter || collectionFilter);
  const matchedIds = useMemo(() => {
    if (!isFiltering) return null;
    return new Set(
      products
        .filter((p) => !q || p.title.toLowerCase().includes(q))
        .filter(
          (p) => !brandFilter || (p.fabricHouse || NO_BRAND) === brandFilter,
        )
        .filter((p) => {
          if (!collectionFilter) return true;
          if (collectionFilter === UNCATEGORIZED) return !p.collections.length;
          return p.collections.some((c) => c.title === collectionFilter);
        })
        .map((p) => p.id),
    );
  }, [products, q, brandFilter, collectionFilter, isFiltering]);

  // While filtering, only show groups containing a match, auto-expanded.
  const visibleGroups = useMemo(() => {
    if (!matchedIds) return groups;
    return groups
      .map((g) => ({
        ...g,
        collections: g.collections
          .map((c) => ({
            ...c,
            items: c.items.filter((i) => matchedIds.has(i.id)),
          }))
          .filter((c) => c.items.length > 0),
      }))
      .filter((g) => g.collections.length > 0);
  }, [groups, matchedIds]);

  const isBrandOpen = (brand) => (isFiltering ? true : openBrands.has(brand));

  function toggleBrand(brand) {
    setOpenBrands((prev) => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  }

  function toggleCollection(brand, title) {
    const key = `${brand} ${title}`;
    setOpenCollections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <DashboardLayout>
      {/* Header + search/filters stay pinned below the fixed TopBar (h-64) so
          the fabric list scrolls underneath. Negative margins break out of the
          .page-content padding so the sticky background spans edge-to-edge. */}
      <div className="sticky top-[64px] z-20 bg-gc-bg -mx-[20px] px-[20px] md:-mx-[28px] md:px-[28px] -mt-[20px] md:-mt-[28px] pt-[20px] md:pt-[28px] pb-[16px] mb-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-[12px]">
          <div>
            <h2 className="gc-page-title">Fabric</h2>
            <p className="gc-page-subtitle">
              {loading
                ? "Loading products…"
                : error
                  ? "Could not load products"
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

        {!loading && !error && products.length > 0 && (
          <div className="flex flex-wrap items-center gap-[10px] mt-[16px]">
            <div className="relative max-w-[360px] flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-[12px] top-1/2 -translate-y-1/2 text-gc-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fabrics by name…"
                className="font-hanken w-full bg-white pl-[34px] pr-[12px] h-[40px] rounded-[8px] text-[13px] text-[#1c1c19] outline-none border border-gc-border-input placeholder:text-gc-muted"
              />
            </div>
            <FilterDropdown
              label="Brand"
              value={brandFilter}
              options={brandOptions}
              onChange={setBrandFilter}
            />
            <FilterDropdown
              label="Collection"
              value={collectionFilter}
              options={collectionOptions}
              onChange={setCollectionFilter}
            />
          </div>
        )}
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

      {!loading && !error && products.length === 0 && (
        <div className="bg-white rounded-[12px] border border-gc-divider">
          <div className="text-center py-[48px]">
            <p className="font-hanken text-[14px] text-gc-text">
              No fabric products found.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="flex flex-col gap-[12px]">
          {visibleGroups.length === 0 ? (
            <div className="bg-white rounded-[12px] border border-gc-divider">
              <div className="text-center py-[48px]">
                <p className="font-hanken text-[14px] text-gc-muted-warm">
                  No products match the current search/filters.
                </p>
              </div>
            </div>
          ) : (
            visibleGroups.map((g) => (
              <BrandGroup
                key={g.brand}
                group={g}
                open={isBrandOpen(g.brand)}
                onToggleBrand={() => toggleBrand(g.brand)}
                openCollections={
                  isFiltering
                    ? new Set(
                        g.collections.map((c) => `${g.brand} ${c.title}`),
                      )
                    : openCollections
                }
                onToggleCollection={toggleCollection}
                highlightIds={matchedIds}
              />
            ))
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

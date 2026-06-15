import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  Save,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from "lucide-react";
import { useClickOutside } from "../hooks/useClickOutside";
import StatusPill from "../components/ui/StatusPill";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import { useCustomerDetail } from "../hooks/useCustomerDetail";
import {
  formatCurrency,
  formatDate,
  formatMoney,
  fetchVestRanges,
  fetchShirtRanges,
  fetchTrouserRanges,
  fetchJacketRanges,
  fetchJacketMeasurementFields,
  fetchTrouserMeasurementFields,
  fetchVestMeasurementFields,
  fetchShirtMeasurementFields,
  fetchStyleOptions,
  fetchContrastOptions,
  setCustomerProductsMetafield,
  fetchCustomerGcMeasurements,
} from "../lib/shopify";

const INLINE_KEYS = new Set(["fabric", "size type"]);
const PRICE_SKIP_KEYS = new Set([
  "product price",
  "style upcharge",
  "order total",
]);

function derivedGarmentsFromMeasurements(
  measurements,
  styleOptions,
  contrastOptions,
) {
  const canonicalGarment = new Map(
    [...styleOptions, ...contrastOptions].map((o) => [
      o.garment.toLowerCase(),
      o.garment,
    ]),
  );
  const found = new Set();
  for (const k of Object.keys(measurements)) {
    if (k.startsWith("_")) continue;
    if (k.includes(" - ")) {
      const g = k.split(" - ")[0].trim().toLowerCase();
      if (canonicalGarment.has(g)) found.add(canonicalGarment.get(g));
    } else {
      for (const [glower, gcanon] of canonicalGarment) {
        if (k.toLowerCase().startsWith(glower + " ")) {
          found.add(gcanon);
          break;
        }
      }
    }
  }
  return [...found];
}

function normalizeEditingValues(source, styleOptions, contrastOptions) {
  const allOpts = [...styleOptions, ...contrastOptions];
  const normalized = {};
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith("_")) {
      normalized[k] = v;
      continue;
    }
    if (k.startsWith("Style: ")) {
      // New format — match by displayLabel, store as "garment - category" for edit dropdowns
      const displayLabel = k.slice("Style: ".length);
      const match = allOpts.find((o) => o.displayLabel === displayLabel);
      normalized[match ? `${match.garment} - ${match.category}` : k] = v;
    } else if (k.includes(" - ")) {
      // Old format — normalise garment/category casing
      const parts = k.split(" - ");
      const g = parts[0].trim();
      const c = parts.slice(1).join(" - ").trim();
      const match = allOpts.find(
        (o) =>
          o.garment.trim().toLowerCase() === g.toLowerCase() &&
          o.category.trim().toLowerCase() === c.toLowerCase(),
      );
      normalized[match ? `${match.garment} - ${match.category}` : k] = v;
    } else {
      normalized[k] = v;
    }
  }
  return normalized;
}

function buildStyleOptionsByGarment(styleOptions, contrastOptions, garments) {
  if (!garments.length) return {};
  const all = [
    ...styleOptions.filter((o) => o.visible && garments.includes(o.garment)),
    ...contrastOptions.filter((o) => o.visible && garments.includes(o.garment)),
  ];
  const byGarment = {};
  for (const opt of all) {
    const g = opt.garment || "General";
    if (!byGarment[g]) byGarment[g] = {};
    const cat = opt.category || "General";
    if (!byGarment[g][cat]) byGarment[g][cat] = [];
    byGarment[g][cat].push(opt);
  }
  for (const g in byGarment) {
    for (const cat in byGarment[g]) {
      byGarment[g][cat].sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }
  return byGarment;
}

function buildUnselectedStyleOptions(styleField, styleOpts, contrastOpts) {
  const selected = {};
  for (const [k, v] of Object.entries(styleField || {})) {
    const displayLabel = k.startsWith("Style: ") ? k.slice(7) : k;
    selected[displayLabel] = v;
  }
  const map = {};
  for (const o of [...styleOpts, ...contrastOpts]) {
    const key = o.displayLabel || o.category;
    if (!key || o.visible === false) continue;
    if (selected[key] === o.label) continue;
    if (!map[key]) map[key] = [];
    if (!map[key].includes(o.label)) map[key].push(o.label);
  }
  return Object.keys(map).length > 0 ? map : null;
}

function resolveLabel(rawKey, labelMap) {
  if (labelMap[rawKey]) return labelMap[rawKey];
  if (rawKey.startsWith("Style: ")) return rawKey.slice("Style: ".length);
  if (rawKey.includes(" - ")) {
    const cat = rawKey.split(" - ").slice(1).join(" - ");
    return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return rawKey;
}

function categorize(source = {}, labelMap = {}) {
  const measurementKeys = new Set(Object.keys(labelMap));
  const options = [];
  const measureList = [];
  for (const [rawKey, val] of Object.entries(source)) {
    if (rawKey.startsWith("_")) continue;
    if (PRICE_SKIP_KEYS.has(rawKey.toLowerCase())) continue;
    const key = resolveLabel(rawKey, labelMap);
    const value = val?.endsWith?.('"') ? val.slice(0, -1) : (val ?? "");
    if (INLINE_KEYS.has(key.toLowerCase())) continue;
    const entry = { rawKey, key, value };
    if (
      !measurementKeys.has(rawKey) &&
      (rawKey.startsWith("Style: ") || rawKey.includes(" - "))
    ) {
      options.push(entry);
    } else {
      measureList.push(entry);
    }
  }
  return { options, measurements: measureList };
}

function StyleOptionDropdown({ label, opts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div
      ref={ref}
      className="flex flex-col items-start px-[10px] py-[10px] sm:px-[16px] sm:py-[12px] min-w-0 overflow-visible border-r border-b border-gc-section-divider/40 h-[90px] sm:h-[100px]"
    >
      <span className="font-hanken text-[9px] sm:text-[10px] text-[#44474c] uppercase leading-[15px] truncate w-full">
        {label}
      </span>
      <div className="relative w-full mt-[4px]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-hanken w-full flex items-center justify-between gap-[4px] text-[12px] sm:text-[13px] font-medium text-gc-near-black2 bg-gc-bg-warm rounded-[6px] px-[8px] py-[8px] border border-gc-border-input cursor-pointer"
        >
          <span
            className={`truncate ${value ? "text-gc-near-black2" : "text-[#9ca3af]"}`}
          >
            {value || "— Select —"}
          </span>
          <ChevronDown
            size={12}
            className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 bg-white rounded-[8px] shadow-lg border border-gc-border-input min-w-[160px]">
            <ul className="max-h-[200px] overflow-y-auto py-[4px]">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="font-hanken w-full text-left px-[12px] py-[8px] text-[12px] text-[#9ca3af] hover:bg-gc-bg flex items-center justify-between cursor-pointer"
                >
                  — Select —
                  {!value && <Check size={11} className="text-gc-primary" />}
                </button>
              </li>
              {opts.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.label);
                      setOpen(false);
                    }}
                    className="font-hanken w-full text-left px-[12px] py-[8px] text-[12px] text-gc-near-black2 hover:bg-gc-bg flex items-center justify-between gap-[6px] cursor-pointer"
                  >
                    <span className="flex items-center gap-[6px] min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.upcharge > 0 && (
                        <span className="font-hanken text-[10px] font-semibold flex-shrink-0 px-[5px] py-[1px] rounded-[4px] bg-gc-primary/[8%] text-gc-primary">
                          +{opt.upcharge}
                        </span>
                      )}
                    </span>
                    {value === opt.label && (
                      <Check
                        size={11}
                        className="flex-shrink-0 text-gc-primary"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
import { cn } from "../utils/cn";

const PAYMENT_BADGE = {
  PAID: "paid",
  PENDING: "pending",
  AUTHORIZED: "pending",
  PARTIALLY_PAID: "pending",
  PARTIALLY_REFUNDED: "pending",
  REFUNDED: "failed",
  VOIDED: "failed",
};

function mapSupplierStatus(order) {
  const meta = Object.fromEntries(
    (order.metafields?.edges ?? []).map((e) => [e.node.key, e.node.value]),
  );
  return meta.supplier_status || "pending";
}

function mapFulfillmentStatus(order) {
  if (
    order.displayFinancialStatus === "REFUNDED" ||
    order.displayFinancialStatus === "VOIDED"
  )
    return "failed";
  if (order.displayFulfillmentStatus === "FULFILLED") return "shipped";
  return "processing";
}

function itemsLabel(order) {
  const edges = order.lineItems?.edges ?? [];
  const hasMore = order.lineItems?.pageInfo?.hasNextPage;
  return hasMore
    ? `${edges.length}+ items`
    : `${edges.length} ${edges.length === 1 ? "item" : "items"}`;
}

function buildMeasurementProfiles(
  orders,
  displayKeyMap = {},
  styleKeyMap = {},
) {
  const result = {};
  let counter = Math.floor(Date.now() / 1000);
  for (const order of orders) {
    const created = (order.createdAt ?? "").split("T")[0];
    for (const { node: item } of order.lineItems?.edges ?? []) {
      const gcBuilder = item.product?.metafield?.value;
      if (
        !gcBuilder ||
        gcBuilder === "false" ||
        gcBuilder === "0" ||
        gcBuilder === "no"
      )
        continue;
      const allAttrs = item.customAttributes ?? [];
      const measureAttrs = allAttrs.filter(
        (a) =>
          !a.key.startsWith("_") && !PRICE_SKIP_KEYS.has(a.key.toLowerCase()),
      );
      if (!measureAttrs.length) continue;
      const productName = item.title;
      if (productName.toLowerCase().includes("upcharge")) continue;
      if (!result[productName]) result[productName] = [];
      const profileName = allAttrs.find(
        (a) => a.key === "_profile_name",
      )?.value;
      const idx = result[productName].length + 1;
      const style = {};
      const measurements = {};
      for (const { key, value } of measureAttrs) {
        const clean = value?.endsWith('"') ? value.slice(0, -1) : value;
        if (key.startsWith("Style: ") || key.includes(" - ")) {
          const styleKey =
            styleKeyMap[key] ?? styleKeyMap[key.toLowerCase()] ?? key;
          style[styleKey] = clean;
        } else {
          measurements[displayKeyMap[key] ?? key] = clean;
        }
      }
      result[productName].push({
        id: `prof_${counter++}`,
        name: profileName || `Measurement ${idx}`,
        created,
        style,
        measurements,
      });
    }
  }
  return result;
}

function mergeProfilesWithSaved(fromOrders, saved) {
  if (!saved || !Object.keys(saved).length) return fromOrders;
  const merged = {};
  for (const [productName, orderProfiles] of Object.entries(fromOrders)) {
    const savedList = saved[productName];
    if (!savedList?.length) {
      merged[productName] = orderProfiles;
      continue;
    }
    const usedSavedIdx = new Set();
    const mergedList = orderProfiles.map((profile, idx) => {
      const byNameIdx = savedList.findIndex((s) => s.name === profile.name);
      const matchIdx = byNameIdx >= 0 ? byNameIdx : idx;
      const match = savedList[matchIdx];
      if (!match) return profile;
      usedSavedIdx.add(matchIdx);
      // Check if saved data has style keys mixed into measurements (corrupted format)
      const savedMeasurements = match.measurements ?? {};
      const hasStyleInMeasurements = Object.keys(savedMeasurements).some(
        (k) => k.startsWith("Style: ") || k.includes(" - "),
      );
      // If saved data is clean (style is defined and no style keys in measurements), use it
      if (match.style !== undefined && !hasStyleInMeasurements) {
        return {
          ...profile,
          style: match.style,
          measurements: savedMeasurements,
          ...(match.styleOptions ? { styleOptions: match.styleOptions } : {}),
        };
      }
      // Corrupted/old flat format — use order-derived profile (already has correct format)
      return profile;
    });
    // Append saved profiles that had no matching order profile
    // (e.g. orders where item.product is null, so buildMeasurementProfiles skipped them)
    const extra = savedList.filter((_, i) => !usedSavedIdx.has(i));
    merged[productName] = [...mergedList, ...extra];
  }
  // Include saved profiles for products not found in any order at all
  for (const [productName, savedList] of Object.entries(saved)) {
    if (!merged[productName] && savedList?.length) {
      merged[productName] = savedList;
    }
  }
  return merged;
}

function getRangeForKey(rangeMap, key) {
  if (!rangeMap) return null;
  if (rangeMap[key]) return rangeMap[key];
  const normalised = key.toLowerCase().trim();
  for (const [k, v] of Object.entries(rangeMap)) {
    if (k.toLowerCase().trim() === normalised) return v;
  }
  return null;
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const shopifyGid = `gid://shopify/Customer/${customerId}`;
  const { customer, orders, loading, error } = useCustomerDetail(shopifyGid);

  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(15);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const entriesRef = useRef(null);
  const [vestMap, setVestMap] = useState({});
  const [shirtMap, setShirtMap] = useState({});
  const [trouserMap, setTrouserMap] = useState({});
  const [jacketMap, setJacketMap] = useState({});
  const [labelMap, setLabelMap] = useState({});
  const [displayKeyMap, setDisplayKeyMap] = useState({});
  const [styleOptions, setStyleOptions] = useState([]);
  const [contrastOptions, setContrastOptions] = useState([]);
  const [gcMeasurements, setGcMeasurements] = useState({});

  useClickOutside(entriesRef, () => setEntriesOpen(false));

  useEffect(() => {
    fetchVestRanges()
      .then((d) => {
        if (d) setVestMap(d);
      })
      .catch(() => {});
    fetchShirtRanges()
      .then((d) => {
        if (d) setShirtMap(d);
      })
      .catch(() => {});
    fetchTrouserRanges()
      .then((d) => {
        if (d) setTrouserMap(d);
      })
      .catch(() => {});
    fetchJacketRanges()
      .then((d) => {
        if (d) setJacketMap(d);
      })
      .catch(() => {});
    Promise.all([
      fetchJacketMeasurementFields(),
      fetchTrouserMeasurementFields(),
      fetchVestMeasurementFields(),
      fetchShirtMeasurementFields(),
    ])
      .then(([jacket, trouser, vest, shirt]) => {
        const label = {};
        const display = {};
        const GARMENT = ["Jacket", "Trouser", "Vest", "Shirt"];
        [jacket, trouser, vest, shirt].forEach((fields, i) => {
          for (const f of fields) {
            if (f.key && f.label) {
              label[f.key] = f.label;
              display[f.key] = `${GARMENT[i]} ${f.label}`;
            }
          }
        });
        setLabelMap(label);
        setDisplayKeyMap(display);
      })
      .catch(() => {});
    fetchStyleOptions()
      .then(setStyleOptions)
      .catch(() => {});
    fetchContrastOptions()
      .then(setContrastOptions)
      .catch(() => {});
    fetchCustomerGcMeasurements(shopifyGid)
      .then((data) => {
        if (data && Object.keys(data).length) setGcMeasurements(data);
      })
      .catch(() => {});
  }, [shopifyGid]);

  const totalSpent = useMemo(() => {
    if (!orders.length) return customer?.totalSpent || "—";
    let sum = 0,
      currencyCode = "USD";
    for (const o of orders) {
      const money = o.totalPriceSet?.shopMoney;
      if (money) {
        sum += parseFloat(money.amount ?? 0);
        currencyCode = money.currencyCode || currencyCode;
      }
    }
    return formatMoney({ amount: sum.toFixed(2), currencyCode });
  }, [orders, customer]);

  const mergedRangeMap = useMemo(
    () => ({ ...jacketMap, ...trouserMap, ...vestMap, ...shirtMap }),
    [jacketMap, trouserMap, vestMap, shirtMap],
  );

  const [committedProfiles, setCommittedProfiles] = useState(null);
  const autoFixedRef = useRef(false);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [touchedFields, setTouchedFields] = useState(new Set());
  const [savingProfileId, setSavingProfileId] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});

  const styleKeyMap = useMemo(() => {
    const map = {};
    for (const opt of [...styleOptions, ...contrastOptions]) {
      if (opt.garment && opt.category && opt.displayLabel) {
        const oldKey = `${opt.garment} - ${opt.category}`;
        const newKey = `Style: ${opt.displayLabel}`;
        map[oldKey] = newKey;
        map[oldKey.toLowerCase()] = newKey;
      }
    }
    return map;
  }, [styleOptions, contrastOptions]);

  const profiles = useMemo(
    () => buildMeasurementProfiles(orders, displayKeyMap, styleKeyMap),
    [orders, displayKeyMap, styleKeyMap],
  );

  const translatedGcMeasurements = useMemo(() => {
    const out = {};
    for (const [product, list] of Object.entries(gcMeasurements)) {
      out[product] = list.map((p) => {
        const measurements = {};
        const style = {};
        // Carry over existing style entries (re-translate keys if needed)
        for (const [k, v] of Object.entries(p.style ?? {})) {
          if (PRICE_SKIP_KEYS.has(k.toLowerCase())) continue;
          style[styleKeyMap[k] ?? styleKeyMap[k.toLowerCase()] ?? k] = v;
        }
        // Process measurements: move any style keys out, translate raw measurement keys
        for (const [k, v] of Object.entries(p.measurements ?? {})) {
          if (PRICE_SKIP_KEYS.has(k.toLowerCase())) continue;
          if (k.startsWith("Style: ") || k.includes(" - ")) {
            style[styleKeyMap[k] ?? styleKeyMap[k.toLowerCase()] ?? k] = v;
          } else {
            measurements[displayKeyMap[k] ?? k] = v;
          }
        }
        return { ...p, style, measurements };
      });
    }
    return out;
  }, [gcMeasurements, displayKeyMap, styleKeyMap]);

  // Product names that have at least one order line item with gc_builder set
  const gcBuilderProductNames = useMemo(() => {
    const set = new Set();
    for (const order of orders) {
      for (const { node: item } of order.lineItems?.edges ?? []) {
        const gcBuilder = item.product?.metafield?.value;
        if (
          !gcBuilder ||
          gcBuilder === "false" ||
          gcBuilder === "0" ||
          gcBuilder === "no"
        )
          continue;
        const name = item.title;
        if (name && !name.toLowerCase().includes("upcharge")) set.add(name);
      }
    }
    return set;
  }, [orders]);

  const activeProfiles = useMemo(() => {
    const base =
      committedProfiles ??
      mergeProfilesWithSaved(profiles, translatedGcMeasurements);
    if (!gcBuilderProductNames.size) return base;
    const filtered = {};
    for (const [name, list] of Object.entries(base)) {
      if (gcBuilderProductNames.has(name)) filtered[name] = list;
    }
    return filtered;
  }, [
    committedProfiles,
    profiles,
    translatedGcMeasurements,
    gcBuilderProductNames,
  ]);

  // Auto-fix: once maps + orders + gc_measurements are all loaded, silently save
  // cleaned activeProfiles back to Shopify so the metafield stays correct.
  // Also enriches profiles with styleOptions (unselected style options).
  useEffect(() => {
    if (autoFixedRef.current) return;
    if (!orders.length) return;
    if (!Object.keys(displayKeyMap).length || !Object.keys(styleKeyMap).length)
      return;
    if (!Object.keys(gcMeasurements).length) return;
    if (!Object.keys(activeProfiles).length) return;
    autoFixedRef.current = true;
    const profilesToSave = styleOptions.length
      ? Object.fromEntries(
          Object.entries(activeProfiles).map(([product, list]) => [
            product,
            list.map((p) => {
              const soMap = buildUnselectedStyleOptions(
                p.style,
                styleOptions,
                contrastOptions,
              );
              return soMap ? { ...p, styleOptions: soMap } : p;
            }),
          ]),
        )
      : activeProfiles;
    setCustomerProductsMetafield(shopifyGid, profilesToSave).catch(() => {});
  }, [orders, displayKeyMap, styleKeyMap, gcMeasurements, activeProfiles]);

  const handleProfileEditStart = (entry) => {
    setEditingValues(
      normalizeEditingValues(
        { ...(entry.style ?? {}), ...entry.measurements },
        styleOptions,
        contrastOptions,
      ),
    );
    setEditingProfileId(entry.id);
    setTouchedFields(new Set());
    setProfileErrors((prev) => ({ ...prev, [entry.id]: null }));
  };
  const handleProfileCancel = () => {
    setEditingProfileId(null);
    setEditingValues({});
    setTouchedFields(new Set());
  };
  const handleProfileMeasurementChange = (key, val) => {
    setEditingValues((prev) => ({ ...prev, [key]: val }));
    setTouchedFields((prev) => new Set([...prev, key]));
  };

  const handleProfileSave = async (entry) => {
    if (Object.keys(mergedRangeMap).length) {
      const invalidKeys = Object.entries(editingValues)
        .filter(([key, val]) => {
          const range = getRangeForKey(mergedRangeMap, key);
          if (!range || !val) return false;
          const n = parseFloat(val);
          return !isNaN(n) && (n < range.min || n > range.max);
        })
        .map(([key]) => key);
      if (invalidKeys.length > 0) {
        setTouchedFields(new Set(Object.keys(editingValues)));
        setProfileErrors((prev) => ({
          ...prev,
          [entry.id]: `${invalidKeys.length} measurement(s) out of valid range`,
        }));
        return;
      }
    }

    setSavingProfileId(entry.id);
    setProfileErrors((prev) => ({ ...prev, [entry.id]: null }));
    const newStyle = {};
    const newMeasurements = {};
    for (const [k, v] of Object.entries(editingValues)) {
      if (k.startsWith("Style: ")) {
        newStyle[k] = v;
      } else if (k.includes(" - ")) {
        // editingValues uses "garment - category" format — translate to "Style: DisplayLabel"
        const translatedKey =
          styleKeyMap[k] ?? styleKeyMap[k.toLowerCase()] ?? k;
        newStyle[translatedKey] = v;
      } else {
        newMeasurements[k] = v;
      }
    }
    const updatedProfiles = JSON.parse(JSON.stringify(activeProfiles));
    updatedProfiles[entry.productName] = updatedProfiles[entry.productName].map(
      (p) => {
        if (p.id !== entry.id) return p;
        const soMap = buildUnselectedStyleOptions(
          newStyle,
          styleOptions,
          contrastOptions,
        );
        return {
          ...p,
          style: newStyle,
          measurements: newMeasurements,
          ...(soMap ? { styleOptions: soMap } : {}),
        };
      },
    );
    try {
      await setCustomerProductsMetafield(
        `gid://shopify/Customer/${customerId}`,
        updatedProfiles,
      );
      setCommittedProfiles(updatedProfiles);
      setGcMeasurements(updatedProfiles);
      setEditingProfileId(null);
      setEditingValues({});
      setTouchedFields(new Set());
    } catch (err) {
      setProfileErrors((prev) => ({ ...prev, [entry.id]: err.message }));
    } finally {
      setSavingProfileId(null);
    }
  };

  const allMeasurements = useMemo(
    () =>
      Object.entries(activeProfiles).flatMap(([productName, list]) =>
        list.map((p) => ({ productName, ...p })),
      ),
    [activeProfiles],
  );

  const profileTabNames = useMemo(() => {
    const seen = new Set();
    const names = [];
    for (const entry of allMeasurements) {
      if (!seen.has(entry.name)) {
        seen.add(entry.name);
        names.push(entry.name);
      }
    }
    return names;
  }, [allMeasurements]);

  const [activeProfileTab, setActiveProfileTab] = useState(null);

  useEffect(() => {
    if (profileTabNames.length > 0) {
      setActiveProfileTab((prev) =>
        profileTabNames.includes(prev) ? prev : profileTabNames[0],
      );
    }
  }, [profileTabNames]);

  const activeTabEntries = useMemo(
    () => allMeasurements.filter((e) => e.name === activeProfileTab),
    [allMeasurements, activeProfileTab],
  );

  const totalPages = Math.max(1, Math.ceil(orders.length / ordersPerPage));
  const paginated = orders.slice(
    (currentPage - 1) * ordersPerPage,
    currentPage * ordersPerPage,
  );
  const visiblePages = useMemo(() => {
    const range = 3,
      start = Math.max(1, currentPage - range),
      end = Math.min(totalPages, currentPage + range);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <DashboardLayout>
      {loading && (
        <div className="bg-white rounded-[12px] border border-[rgba(207,196,197,0.3)]">
          <LoadingState message="Loading customer…" />
        </div>
      )}
      {error && (
        <div className="bg-white rounded-[12px] border border-[rgba(207,196,197,0.3)]">
          <ErrorState message={error} />
        </div>
      )}

      {!loading && !error && customer && (
        <div className="flex flex-col gap-[40px]">
          <div className="bg-white rounded-[12px] p-[20px] sm:p-[33px] flex flex-col gap-[20px] sm:gap-[24px] border border-gc-section-divider/30">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-[7px]">
                <h1 className="font-garamond text-[28px] sm:text-[40px] font-bold text-[#3c3c3c] leading-tight">
                  {customer.name}
                </h1>
                <div className="flex flex-wrap items-center gap-[12px] sm:gap-[24px] pt-[9px]">
                  {customer.email && (
                    <div className="flex items-center gap-[8px]">
                      <Mail
                        size={13}
                        className="text-[#4c4546] flex-shrink-0"
                      />
                      <span className="font-hanken text-[13px] sm:text-[14px] text-[#4c4546] break-all">
                        {customer.email}
                      </span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-[8px]">
                      <Phone
                        size={10}
                        className="text-[#4c4546] flex-shrink-0"
                      />
                      <span className="font-hanken text-[13px] sm:text-[14px] text-[#4c4546]">
                        {customer.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[20px] sm:gap-[32px] pt-[20px] sm:pt-[25px] border-t border-gc-section-divider/40">
              {[
                { label: "TOTAL ORDERS", value: orders.length },
                { label: "TOTAL SPENT", value: totalSpent },
                { label: "CUSTOMER SINCE", value: customer.registrationDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-[4px]">
                  <span className="font-hanken text-[10px] font-medium uppercase text-[#7e7576]">
                    {label}
                  </span>
                  <span className="font-garamond text-[22px] sm:text-[28px] font-medium text-black leading-tight">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[24px]">
            <div className="flex flex-wrap items-center gap-[12px] pb-[17px] border-b border-black/10">
              <span className="font-garamond text-[20px] sm:text-[24px] font-medium text-gc-near-black2">
                Orders
              </span>
            </div>

            <div className="bg-white rounded-[12px] overflow-hidden border border-gc-section-divider/30">
              {orders.length === 0 ? (
                <div className="py-[48px] text-center font-hanken text-[14px] text-gc-text">
                  No orders yet.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gc-section-divider/40">
                          {[
                            "ORDER NUMBER",
                            "DATE",
                            "ITEMS",
                            "TOTAL",
                            "PAYMENT",
                            "STATUS",
                            "SUPPLIER",
                          ].map((h) => (
                            <th
                              key={h}
                              className="font-hanken text-[9px] font-semibold uppercase tracking-[0.9px] text-[#7e7576] px-[24px] py-[16px] text-left whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((order, i) => {
                          const numericId = order.id.split("/").pop();
                          return (
                            <tr
                              key={order.id}
                              onClick={() =>
                                navigate(`/orders/${numericId}`, {
                                  state: { fromCustomer: customerId },
                                })
                              }
                              className={`cursor-pointer hover:bg-gc-primary/[4%] transition-colors${i > 0 ? " border-t border-gc-section-divider/20" : ""}`}
                            >
                              <td className="font-hanken text-[14px] font-semibold text-black px-[24px] py-[20px] whitespace-nowrap">
                                {order.name}
                              </td>
                              <td className="font-hanken text-[14px] text-[#1c1c19] px-[24px] py-[20px] whitespace-nowrap">
                                {formatDate(order.createdAt)}
                              </td>
                              <td className="font-hanken text-[14px] text-[#1c1c19] px-[24px] py-[20px]">
                                {itemsLabel(order)}
                              </td>
                              <td className="font-hanken text-[14px] text-[#1c1c19] px-[24px] py-[20px] whitespace-nowrap">
                                {formatCurrency(order.totalPriceSet)}
                              </td>
                              <td className="px-[24px] py-[20px]">
                                <StatusPill
                                  status={
                                    PAYMENT_BADGE[
                                      order.displayFinancialStatus
                                    ] ?? "pending"
                                  }
                                />
                              </td>
                              <td className="px-[24px] py-[20px]">
                                <StatusPill
                                  status={mapFulfillmentStatus(order)}
                                />
                              </td>
                              <td className="px-[24px] py-[20px]">
                                <StatusPill status={mapSupplierStatus(order)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {orders.length > 0 && (
                    <div className="flex items-center justify-between px-[24px] py-[16px] gc-divider flex-wrap gap-[12px]">
                      <div
                        className="flex items-center gap-[8px]"
                        ref={entriesRef}
                      >
                        <span className="font-hanken text-[13px] text-gc-text">
                          Entries
                        </span>
                        <div className="relative">
                          <button
                            onClick={() => setEntriesOpen((v) => !v)}
                            className="font-hanken text-[13px] text-gc-dark flex items-center gap-[6px] px-[10px] py-[5px] rounded-[6px] cursor-pointer focus:outline-none border border-gc-border-warm bg-white"
                          >
                            {ordersPerPage}
                            <ChevronRight
                              size={13}
                              className={`text-gc-text transition-transform ${entriesOpen ? "-rotate-90" : "rotate-90"}`}
                            />
                          </button>
                          {entriesOpen && (
                            <div className="absolute left-0 bottom-full mb-[4px] z-20 rounded-[6px] overflow-hidden shadow-md border border-gc-border-warm bg-white min-w-full">
                              {[10, 20, 40, 100].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => {
                                    setOrdersPerPage(n);
                                    setCurrentPage(1);
                                    setEntriesOpen(false);
                                  }}
                                  className={`w-full text-left font-hanken text-[13px] px-[12px] py-[7px] cursor-pointer transition-colors ${n === ordersPerPage ? "text-gc-primary bg-gc-primary/[6%] font-semibold" : "text-gc-heading font-normal"}`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Page navigation */}
                      {totalPages > 1 && (
                        <div className="flex items-center gap-[4px]">
                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className="gc-pagination-btn"
                          >
                            <ChevronLeft size={15} />
                          </button>

                          {visiblePages[0] > 1 && (
                            <>
                              <button
                                onClick={() => setCurrentPage(1)}
                                className="gc-pagination-btn"
                              >
                                1
                              </button>
                              {visiblePages[0] > 2 && (
                                <span className="w-[28px] text-center text-gc-text text-[13px]">
                                  …
                                </span>
                              )}
                            </>
                          )}

                          {visiblePages.map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={cn(
                                "gc-pagination-btn",
                                currentPage === page && "active",
                              )}
                            >
                              {page}
                            </button>
                          ))}

                          {visiblePages[visiblePages.length - 1] <
                            totalPages && (
                            <>
                              {visiblePages[visiblePages.length - 1] <
                                totalPages - 1 && (
                                <span className="w-[28px] text-center text-gc-text text-[13px]">
                                  …
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPage(totalPages)}
                                className="gc-pagination-btn"
                              >
                                {totalPages}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={currentPage === totalPages}
                            className="gc-pagination-btn"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {allMeasurements.length > 0 && (
            <div className="flex flex-col gap-[0]">
              <div className="flex flex-wrap gap-[8px] pb-[20px]">
                {profileTabNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveProfileTab(name)}
                    className={`font-hanken text-[13px] font-semibold px-[16px] py-[8px] rounded-[20px] whitespace-nowrap transition-all cursor-pointer ${activeProfileTab === name ? "bg-gc-primary text-white border border-gc-primary" : "bg-gc-bg-warm text-gc-muted border border-gc-border-input"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-[24px] pt-[24px]">
                {activeTabEntries.map((entry) => {
                  const isEditing = editingProfileId === entry.id;
                  const isSaving = savingProfileId === entry.id;
                  const profileError = profileErrors[entry.id];
                  const sizeTypeKey = Object.keys(entry.measurements).find(
                    (k) => k.toLowerCase() === "size type",
                  );
                  const isStandard =
                    sizeTypeKey &&
                    entry.measurements[sizeTypeKey]?.toLowerCase() ===
                      "standard";

                  return (
                    <div key={entry.id} className="flex flex-col gap-[24px]">
                      <div className="flex flex-wrap items-start sm:items-end justify-between gap-[12px] pb-[17px] border-b border-black/10">
                        <div className="flex flex-col gap-[4px]">
                          <div className="flex items-center gap-[8px] flex-wrap">
                            <span className="font-garamond text-[20px] sm:text-[24px] font-medium text-gc-near-black2">
                              {entry.productName}
                            </span>
                            <span
                              className={`font-hanken text-[10px] font-semibold uppercase tracking-[0.8px] px-[8px] py-[2px] rounded-full ${isStandard ? "bg-[#e8f0e8] text-[#3a6b3a]" : "bg-[#f0e8e4] text-[#a45d41]"}`}
                            >
                              {isStandard ? "Standard" : "Custom"}
                            </span>
                          </div>
                          <span className="font-hanken text-[12px] sm:text-[14px] font-semibold text-[#6d6d6d]">
                            Last updated: {entry.created}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-[8px]">
                          {profileError && (
                            <span className="font-hanken text-[12px] text-red-500">
                              {profileError}
                            </span>
                          )}
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleProfileSave(entry)}
                                disabled={isSaving}
                                className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Save size={13} />
                                {isSaving ? "Saving…" : "SAVE"}
                              </button>
                              <button
                                onClick={handleProfileCancel}
                                disabled={isSaving}
                                className="gc-btn text-[13px] gap-[5px] cursor-pointer disabled:cursor-not-allowed"
                              >
                                <X size={12} />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleProfileEditStart(entry)}
                              disabled={!!editingProfileId}
                              className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Pencil size={13} />
                              EDIT
                            </button>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const combinedEntry = {
                          ...(entry.style ?? {}),
                          ...entry.measurements,
                        };
                        const source = isEditing
                          ? editingValues
                          : combinedEntry;
                        const { options, measurements: measureList } =
                          categorize(source, labelMap);

                        const productGarments = derivedGarmentsFromMeasurements(
                          combinedEntry,
                          styleOptions,
                          contrastOptions,
                        );
                        const byGarment = buildStyleOptionsByGarment(
                          styleOptions,
                          contrastOptions,
                          productGarments,
                        );
                        const garmentKeys = Object.keys(byGarment);

                        return (
                          <div className="flex flex-col gap-[20px]">
                            {/* Style Options */}
                            {isEditing ? (
                              garmentKeys.length > 0 ? (
                                <div className="flex flex-col gap-[16px]">
                                  <span className="font-hanken text-[10px] font-semibold uppercase tracking-[1.2px] text-[#929292]">
                                    Style Options
                                  </span>
                                  {garmentKeys.map((garment) => {
                                    const catMap = byGarment[garment];
                                    const cats = Object.keys(catMap);
                                    return (
                                      <div
                                        key={garment}
                                        className="flex flex-col gap-[8px]"
                                      >
                                        <div className="flex items-center justify-between gap-[8px]">
                                          <span className="font-hanken text-[11px] font-semibold text-[#a45d41] uppercase tracking-[0.8px]">
                                            {garment}
                                          </span>
                                          <span className="font-hanken text-[10px] font-medium text-[rgba(28,28,25,0.35)] tracking-[0.6px] uppercase">
                                            {cats.length} option
                                            {cats.length !== 1 ? "s" : ""}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 border-l border-t border-gc-section-divider/40">
                                          {cats.map((cat) => {
                                            const opts = catMap[cat];
                                            const rawKey = `${garment} - ${cat}`;
                                            const rawKeyLower =
                                              rawKey.toLowerCase();
                                            const currentVal =
                                              editingValues[rawKey] ??
                                              Object.entries(
                                                editingValues,
                                              ).find(
                                                ([k]) =>
                                                  k.toLowerCase() ===
                                                  rawKeyLower,
                                              )?.[1] ??
                                              "";
                                            return (
                                              <StyleOptionDropdown
                                                key={rawKey}
                                                label={
                                                  opts[0]?.displayLabel || cat
                                                }
                                                opts={opts}
                                                value={currentVal}
                                                onChange={(val) =>
                                                  handleProfileMeasurementChange(
                                                    rawKey,
                                                    val,
                                                  )
                                                }
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                options.length > 0 && (
                                  <div className="flex flex-col gap-[10px]">
                                    <span className="font-hanken text-[10px] font-semibold uppercase tracking-[1.2px] text-[#929292]">
                                      Style Options
                                    </span>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 border-l border-t border-gc-section-divider/40">
                                      {options.map(({ rawKey, key, value }) => {
                                        let displayKey = key;
                                        if (rawKey.includes(" - ")) {
                                          const g = rawKey
                                            .split(" - ")[0]
                                            .trim();
                                          const c = rawKey
                                            .split(" - ")
                                            .slice(1)
                                            .join(" - ")
                                            .trim();
                                          const match = [
                                            ...styleOptions,
                                            ...contrastOptions,
                                          ].find(
                                            (o) =>
                                              o.garment.toLowerCase() ===
                                                g.toLowerCase() &&
                                              o.category.toLowerCase() ===
                                                c.toLowerCase(),
                                          );
                                          if (match?.displayLabel)
                                            displayKey = match.displayLabel;
                                        }
                                        return (
                                          <div
                                            key={rawKey}
                                            className="flex flex-col items-start px-[10px] py-[10px] sm:px-[16px] sm:py-[14px] min-w-0 overflow-visible border-r border-b border-gc-section-divider/40"
                                          >
                                            <span className="font-hanken text-[9px] sm:text-[10px] text-[#44474c] uppercase leading-[15px] truncate w-full">
                                              {displayKey}
                                            </span>
                                            <input
                                              type="text"
                                              value={
                                                editingValues[rawKey] ?? value
                                              }
                                              onChange={(e) =>
                                                handleProfileMeasurementChange(
                                                  rawKey,
                                                  e.target.value,
                                                )
                                              }
                                              className="font-hanken mt-[4px] w-full text-[12px] sm:text-[14px] font-medium text-gc-near-black2 bg-gc-bg-warm rounded-[6px] px-[8px] py-[4px] border border-gc-border-input outline-none focus:border-gc-primary"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )
                              )
                            ) : garmentKeys.length > 0 ? (
                              <div className="flex flex-col gap-[16px]">
                                <span className="font-hanken text-[10px] font-semibold uppercase tracking-[1.2px] text-[#929292]">
                                  Style Options
                                </span>
                                {garmentKeys.map((garment) => {
                                  const catMap = byGarment[garment];
                                  const cats = Object.keys(catMap);
                                  return (
                                    <div
                                      key={garment}
                                      className="flex flex-col gap-[8px]"
                                    >
                                      <div className="flex items-center justify-between gap-[8px]">
                                        <span className="font-hanken text-[11px] font-semibold text-[#a45d41] uppercase tracking-[0.8px]">
                                          {garment}
                                        </span>
                                        <span className="font-hanken text-[10px] font-medium text-[rgba(28,28,25,0.35)] tracking-[0.6px] uppercase">
                                          {cats.length} option
                                          {cats.length !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 border-l border-t border-gc-section-divider/40">
                                        {cats.map((cat) => {
                                          const rawKey = `${garment} - ${cat}`;
                                          const rawKeyLower =
                                            rawKey.toLowerCase();
                                          const newStyleKey =
                                            styleKeyMap[rawKey] ??
                                            styleKeyMap[rawKeyLower];
                                          const savedOpt = options.find(
                                            (o) =>
                                              o.rawKey === rawKey ||
                                              o.rawKey.toLowerCase() ===
                                                rawKeyLower ||
                                              (newStyleKey &&
                                                o.rawKey === newStyleKey),
                                          );
                                          const savedValue =
                                            savedOpt?.value || "—";
                                          const label =
                                            catMap[cat][0]?.displayLabel ||
                                            cat
                                              .replace(/_/g, " ")
                                              .replace(/\b\w/g, (c) =>
                                                c.toUpperCase(),
                                              );
                                          return (
                                            <div
                                              key={rawKey}
                                              className="flex flex-col items-start px-[10px] py-[10px] sm:px-[16px] sm:py-[12px] min-w-0 overflow-hidden border-r border-b border-gc-section-divider/40 h-[90px] sm:h-[100px]"
                                            >
                                              <span className="font-hanken text-[9px] sm:text-[10px] text-[#44474c] uppercase leading-[15px] truncate w-full">
                                                {label}
                                              </span>
                                              <span className="font-hanken text-[12px] sm:text-[16px] font-medium text-gc-near-black2 leading-[20px] sm:leading-[26px] break-words w-full">
                                                {savedValue}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              options.length > 0 && (
                                <div className="flex flex-col gap-[10px]">
                                  <span className="font-hanken text-[10px] font-semibold uppercase tracking-[1.2px] text-[#929292]">
                                    Style Options
                                  </span>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 border-l border-t border-gc-section-divider/40">
                                    {options.map(({ rawKey, key, value }) => (
                                      <div
                                        key={rawKey}
                                        className="flex flex-col items-start px-[10px] py-[10px] sm:px-[16px] sm:py-[12px] min-w-0 overflow-hidden border-r border-b border-gc-section-divider/40 h-[90px] sm:h-[100px]"
                                      >
                                        <span className="font-hanken text-[9px] sm:text-[10px] text-[#44474c] uppercase leading-[15px] truncate w-full">
                                          {key}
                                        </span>
                                        <span className="font-hanken text-[12px] sm:text-[16px] font-medium text-gc-near-black2 leading-[20px] sm:leading-[26px] break-words w-full">
                                          {value || "—"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            )}

                            {/* Measurements */}
                            {measureList.length > 0 && (
                              <div className="flex flex-col gap-[10px]">
                                <span className="font-hanken text-[10px] font-semibold uppercase tracking-[1.2px] text-[#929292]">
                                  Measurements
                                </span>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 rounded-[12px] p-px gap-px border border-gc-section-divider/40">
                                  {measureList.map(
                                    (
                                      { rawKey, key, value: displayVal },
                                      idx,
                                    ) => {
                                      const val = isEditing
                                        ? (editingValues[rawKey] ?? displayVal)
                                        : displayVal;
                                      const range = getRangeForKey(
                                        mergedRangeMap,
                                        rawKey,
                                      );
                                      const isTouched =
                                        touchedFields.has(rawKey);
                                      const numVal = parseFloat(val);
                                      const hasRange = !!range;
                                      const isValid =
                                        isTouched &&
                                        hasRange &&
                                        !isNaN(numVal) &&
                                        numVal >= range.min &&
                                        numVal <= range.max;
                                      const isInvalid =
                                        isTouched &&
                                        hasRange &&
                                        !isNaN(numVal) &&
                                        (numVal < range.min ||
                                          numVal > range.max);

                                      return (
                                        <div
                                          key={rawKey}
                                          className={cn(
                                            "bg-white flex flex-col p-[10px] sm:p-[20px] h-[90px] sm:h-[120px] overflow-hidden",
                                            idx === 0 && "rounded-tl-[12px]",
                                          )}
                                        >
                                          <span className="font-hanken text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.5px] text-[#7e7576] leading-[10px] sm:leading-[12px] break-words">
                                            {key}
                                          </span>
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={val}
                                              onChange={(e) =>
                                                handleProfileMeasurementChange(
                                                  rawKey,
                                                  e.target.value,
                                                )
                                              }
                                              className={cn(
                                                "font-garamond mt-[3px] w-full text-[16px] sm:text-[20px] text-black bg-transparent outline-none border-b",
                                                isValid
                                                  ? "border-green-500 text-green-700"
                                                  : isInvalid
                                                    ? "border-red-400 text-red-600"
                                                    : "border-[#d1c7bd]",
                                              )}
                                            />
                                          ) : (
                                            <span className="font-garamond text-[14px] sm:text-[22px] text-black leading-[18px] sm:leading-[30px] mt-[3px]">
                                              {val}
                                            </span>
                                          )}
                                          {isEditing && range ? (
                                            <span
                                              className={cn(
                                                "font-hanken text-[9px] mt-auto",
                                                isValid
                                                  ? "text-green-600"
                                                  : isInvalid
                                                    ? "text-red-500"
                                                    : "text-[#7e7576]",
                                              )}
                                            >
                                              {range.min}–{range.max}
                                            </span>
                                          ) : (
                                            <span className="font-hanken text-[9px] text-[#7e7576] mt-auto leading-[13px]">
                                              Inches
                                            </span>
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

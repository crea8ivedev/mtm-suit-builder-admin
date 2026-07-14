import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { X, FileText, Plus, History, CheckCircle2 } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import AlertBanner from "../components/ui/AlertBanner";
import { CustomerSelector } from "../components/order/CustomerStep";
import { ProductSelector } from "../components/order/ProductStep";
import {
  AttributeEditor,
  StyleOptionsSection,
} from "../components/order/MeasurementsStep";
import { getRangeForKey, groupAttributes } from "../utils/measurementUtils";
import { invalidateOrdersCache } from "../hooks/useOrders";
import {
  fetchCustomSuitProducts,
  fetchFabricProductDetail,
  fetchCustomerWithOrders,
  clearOrdersCache,
  clearCustomerDetailCache,
  getProductFields,
  createDraftOrder,
  completeDraftOrder,
  setCustomerProductsMetafield,
  fetchVestRanges,
  fetchShirtRanges,
  fetchTrouserRanges,
  fetchJacketRanges,
  fetchVestMeasurementFields,
  fetchTrouserMeasurementFields,
  fetchShirtMeasurementFields,
  fetchJacketMeasurementFields,
  fetchStyleOptions,
  fetchContrastOptions,
  fetchContrastLocations,
  fetchLiningCodes,
  fetchButtonCodes,
  fetchFitSizeOptions,
  fetchJacketSizeTemplate,
  fetchTrouserSizeTemplate,
  fetchVestSizeTemplate,
  fetchShirtSizeTemplate,
  setOrderMetafields,
} from "../lib/shopify";
import { cn } from "../utils/cn";

const EXCLUDED_MEASUREMENT_KEYS = new Set([
  "Product Price",
  "Style Upcharge",
  "Order Total",
]);

function buildProfilesFromOrders(orders) {
  const result = {};
  let counter = Math.floor(Date.now() / 1000);
  for (const order of orders) {
    const created = (order.createdAt ?? "").split("T")[0];
    for (const { node: item } of order.lineItems?.edges ?? []) {
      const allAttrs = item.customAttributes ?? [];
      const measureAttrs = allAttrs.filter(
        (a) => !a.key.startsWith("_") && !EXCLUDED_MEASUREMENT_KEYS.has(a.key),
      );
      if (!measureAttrs.length) continue;
      const productName = item.title;
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
          style[key] = clean;
        } else {
          measurements[key] = clean;
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

function deduplicateByRange(attrs, rangeMap) {
  const seenRangeKeys = new Set();
  const seenNormKeys = new Set();
  return attrs.filter((a) => {
    const normKey = a.key.trim().toLowerCase();
    const entry = getRangeForKey(rangeMap, a.key);
    if (entry) {
      const rk = `${entry.label}|${entry.min}|${entry.max}`;
      if (seenRangeKeys.has(rk)) return false;
      seenRangeKeys.add(rk);
    } else {
      if (seenNormKeys.has(normKey)) return false;
    }
    seenNormKeys.add(normKey);
    return true;
  });
}

function isCustomSizeLineItem(node) {
  const sizeType = (node.customAttributes ?? [])
    .find((a) => a.key.toLowerCase() === "size type")
    ?.value?.toLowerCase();
  return sizeType !== "standard";
}

// Matches a measurement field's label (e.g. "Sleeve (R)") against a standard
// size template's value key (e.g. "sleeve_r") regardless of casing,
// separators, or word order — lowercase, strip non-alphanumeric, sort chars.
function normalizeMeasureKey(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .split("")
    .sort()
    .join("");
}

function findPastLineItem(customerOrders, selectedProductId, productTitle) {
  const numericId = selectedProductId.split("/").pop();
  const titleLower = (productTitle ?? "").toLowerCase();
  for (const order of customerOrders) {
    for (const { node } of order.lineItems?.edges ?? []) {
      const nodeNumericId = node.product?.id?.split("/").pop();
      const idMatch = nodeNumericId === numericId;
      const titleMatch =
        titleLower && (node.title ?? "").toLowerCase() === titleLower;
      if ((idMatch || titleMatch) && isCustomSizeLineItem(node)) {
        return node;
      }
    }
  }
  return null;
}

function attrsFromLineItem(node, emptyValues = false) {
  return (node.customAttributes ?? [])
    .filter(
      (a) =>
        !a.key.startsWith("_") && !a.key.toLowerCase().startsWith("standard"),
    )
    .map((a) =>
      a.key.toLowerCase() === "size type"
        ? { key: a.key, value: "Custom" }
        : { key: a.key, value: emptyValues ? "" : a.value },
    );
}

// Derives garment names (Jacket/Trouser/Vest/Shirt) from a fabric product's
// selected garment-type VARIANT title (e.g. "Two Piece Suit", "Pants Only") —
// NOT from the product's custom.fabric metafield, which now holds a
// metaobject reference GID rather than garment text.
function garmentsFromGcBuilderValue(value, allGarments) {
  if (!value) return [];
  const v = value.toLowerCase();
  if (allGarments?.length) {
    return allGarments.filter((g) => v.includes(g.toLowerCase()));
  }
  // fallback: derive from known garment keywords in value
  const found = [];
  if (v.includes("jacket")) found.push("Jacket");
  if (v.includes("trouser") || v.includes("pant")) found.push("Trouser");
  if (v.includes("vest")) found.push("Vest");
  if (v.includes("shirt")) found.push("Shirt");
  if (!found.length && v.includes("suit")) {
    found.push("Jacket");
    found.push("Trouser");
  }
  return found;
}

function buildStyleOptionsForJson(
  styleOptions,
  contrastOptions,
  contrastLocations,
  liningCodes,
  buttonCodes,
  productGarments,
) {
  const garmentSet = productGarments?.length ? new Set(productGarments) : null;
  const inScope = (g) => !garmentSet || garmentSet.has(g);

  const expandedLC = (liningCodes ?? []).flatMap((item) => {
    const targets =
      item.garments?.length > 0
        ? item.garments.filter(inScope)
        : (productGarments ?? []);
    return targets.map((g) => ({ ...item, garment: g }));
  });
  const expandedBC = (buttonCodes ?? []).flatMap((item) => {
    const targets =
      item.garments?.length > 0
        ? item.garments.filter(inScope)
        : (productGarments ?? []);
    return targets.map((g) => ({ ...item, garment: g }));
  });

  const allOpts = [
    ...styleOptions.filter((o) => o.visible && inScope(o.garment)),
    ...contrastOptions.filter((o) => o.visible && inScope(o.garment)),
    ...contrastLocations
      .filter((l) => l.visible && (!l.garment || inScope(l.garment)))
      .map((l) => ({
        ...l,
        category: "contrast_location",
        displayLabel: "Contrast Color Location",
      })),
    ...expandedLC.filter((o) => o.visible),
    ...expandedBC.filter((o) => o.visible),
  ];
  const map = {};
  for (const opt of allOpts) {
    const garment = opt.garment;
    const category = opt.displayLabel || opt.category;
    if (!garment || !category) continue;
    if (!map[garment]) map[garment] = {};
    if (!map[garment][category]) map[garment][category] = [];
    const entry = { label: opt.label };
    if (opt.upcharge > 0) entry.upcharge = opt.upcharge;
    map[garment][category].push(entry);
  }
  return map;
}

// ─── Step Indicator ─────────────────────────────────────────────────────────
function StepIndicator({ currentStep }) {
  const steps = [
    { num: "01", label: "SELECT CUSTOMER" },
    { num: "02", label: "SELECT PRODUCT" },
    { num: "03", label: "MEASUREMENTS & DETAILS" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-[24px] sm:gap-[48px] pb-[25px] border-b border-gc-section-divider/30">
      {steps.map((step, idx) => {
        const active = idx + 1 <= currentStep;
        return (
          <div
            key={step.num}
            className={cn(
              "flex items-center gap-[12px]",
              !active && "opacity-30",
            )}
          >
            {active ? (
              <div className="flex items-center justify-center rounded-full size-[32px] flex-shrink-0 bg-gc-primary">
                <span className="font-hanken text-[14px] font-medium text-white tracking-[0.6px]">
                  {step.num}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-full size-[32px] border border-black flex-shrink-0">
                <span className="font-hanken text-[14px] font-medium text-[#1c1c19] tracking-[0.6px]">
                  {step.num}
                </span>
              </div>
            )}
            <span
              className={cn(
                "font-hanken text-[13px] sm:text-[14px] tracking-[1.2px] uppercase whitespace-nowrap",
                active
                  ? "font-bold text-[#a45d41]"
                  : "font-medium text-[#1c1c19]",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ──────────────────────────────────────
export default function CreateOrder() {
  const navigate = useNavigate();
  const location = useLocation();

  const [gcProducts, setGcProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [customerOrders, setCustomerOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [attributes, setAttributes] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [price, setPrice] = useState("0.00");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [note, setNote] = useState("");
  const [measurementsValid, setMeasurementsValid] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [vestRanges, setVestRanges] = useState(null);
  const [shirtRanges, setShirtRanges] = useState(null);
  const [trouserRanges, setTrouserRanges] = useState(null);
  const [jacketRanges, setJacketRanges] = useState(null);

  const [styleOptions, setStyleOptions] = useState([]);
  const [contrastOptions, setContrastOptions] = useState([]);
  const [contrastLocations, setContrastLocations] = useState([]);
  const [styleSelections, setStyleSelections] = useState({});
  const [styleOptionsLoading, setStyleOptionsLoading] = useState(false);

  const [liningCodes, setLiningCodes] = useState([]);
  const [buttonCodes, setButtonCodes] = useState([]);

  const [fabricCode, setFabricCode] = useState("");

  const [fitSizeOptions, setFitSizeOptions] = useState([]);
  const [fitSizeSelections, setFitSizeSelections] = useState({});
  const [fitSizeLoading, setFitSizeLoading] = useState(false);

  const [measurementType, setMeasurementType] = useState("finished");

  const [sizeType, setSizeType] = useState("custom");
  const [standardSizesByGarment, setStandardSizesByGarment] = useState({});
  const [standardSizeSelections, setStandardSizeSelections] = useState({});

  useEffect(() => {
    Promise.all([
      fetchJacketSizeTemplate(),
      fetchTrouserSizeTemplate(),
      fetchVestSizeTemplate(),
      fetchShirtSizeTemplate(),
    ])
      .then(([jacket, trouser, vest, shirt]) => {
        setStandardSizesByGarment({
          Jacket: jacket,
          Trouser: trouser,
          Vest: vest,
          Shirt: shirt,
        });
      })
      .catch(() => {});
  }, []);

  function handleStandardSizeSelect(garment, opt) {
    setStandardSizeSelections((prev) => ({ ...prev, [garment]: opt?.id ?? "" }));
    if (!opt) return;
    setAttributes((prev) =>
      prev.map((a) => {
        if (!a.key.startsWith(`${garment} `)) return a;
        const label = a.key.slice(garment.length + 1);
        const normLabel = normalizeMeasureKey(label);
        const match = Object.entries(opt.values).find(
          ([k]) => normalizeMeasureKey(k) === normLabel,
        );
        return match && match[1] ? { ...a, value: match[1] } : a;
      }),
    );
  }

  useEffect(() => {
    fetchVestRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setVestRanges(data);
      })
      .catch(() => {});
    fetchShirtRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setShirtRanges(data);
      })
      .catch(() => {});
    fetchTrouserRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setTrouserRanges(data);
      })
      .catch(() => {});
    fetchJacketRanges()
      .then((data) => {
        if (data && Object.keys(data).length > 0) setJacketRanges(data);
      })
      .catch(() => {});
    fetchLiningCodes()
      .then((codes) => setLiningCodes(codes))
      .catch(() => {});
    fetchButtonCodes()
      .then((codes) => setButtonCodes(codes))
      .catch(() => {});

    setFitSizeLoading(true);
    fetchFitSizeOptions()
      .then((opts) => setFitSizeOptions(opts))
      .catch(() => {})
      .finally(() => setFitSizeLoading(false));
  }, []);

  const rangeGroups = useMemo(() => {
    if (!selectedVariant) return [];
    const garments = garmentsFromGcBuilderValue(selectedVariant.title);
    const groups = [];
    if (garments.includes("Jacket") && jacketRanges)
      groups.push({ label: "Jacket", ranges: jacketRanges });
    if (garments.includes("Trouser") && trouserRanges)
      groups.push({ label: "Trouser", ranges: trouserRanges });
    if (garments.includes("Vest") && vestRanges)
      groups.push({ label: "Vest", ranges: vestRanges });
    if (garments.includes("Shirt") && shirtRanges)
      groups.push({ label: "Shirt", ranges: shirtRanges });
    return groups;
  }, [selectedVariant, jacketRanges, trouserRanges, vestRanges, shirtRanges]);

  const allStyleGarments = useMemo(
    () => [
      ...new Set(
        [...styleOptions, ...contrastOptions]
          .map((o) => o.garment)
          .filter(Boolean),
      ),
    ],
    [styleOptions, contrastOptions],
  );

  const expandedLiningCodes = useMemo(() => {
    if (!selectedVariant || !liningCodes.length) return [];
    const garments = garmentsFromGcBuilderValue(selectedVariant.title);
    if (!garments.length) return [];
    const normalizeG = (g) =>
      garments.find((ag) => ag.toLowerCase() === g.toLowerCase()) ?? null;
    return liningCodes.flatMap((item) => {
      const targets =
        item.garments.length > 0
          ? item.garments.map(normalizeG).filter(Boolean)
          : garments;
      return targets.map((g) => ({ ...item, garment: g }));
    });
  }, [selectedVariant, liningCodes]);

  const expandedButtonCodes = useMemo(() => {
    if (!selectedVariant || !buttonCodes.length) return [];
    const garments = garmentsFromGcBuilderValue(selectedVariant.title);
    if (!garments.length) return [];
    const normalizeG = (g) =>
      garments.find((ag) => ag.toLowerCase() === g.toLowerCase()) ?? null;
    return buttonCodes.flatMap((item) => {
      const targets =
        item.garments.length > 0
          ? item.garments.map(normalizeG).filter(Boolean)
          : garments;
      return targets.map((g) => ({ ...item, garment: g }));
    });
  }, [selectedVariant, buttonCodes]);

  const pastOrdersForProduct = useMemo(() => {
    if (!selectedProduct || !customerOrders.length) return [];
    const numericId = selectedProduct.id.split("/").pop();
    const titleLower = selectedProduct.title.toLowerCase();
    const matchesProduct = (node) =>
      node.product?.id?.split("/").pop() === numericId ||
      (node.title ?? "").toLowerCase() === titleLower;
    return customerOrders
      .filter((o) =>
        o.lineItems?.edges?.some(({ node }) => matchesProduct(node)),
      )
      .map((o) => {
        const item = o.lineItems?.edges?.find(({ node }) =>
          matchesProduct(node),
        )?.node;
        return {
          orderId: o.name,
          date: (o.createdAt ?? "").split("T")[0],
          variantTitle: item?.variant?.title ?? null,
          attributes: (item?.customAttributes ?? []).filter(
            (a) => !a.key.startsWith("_"),
          ),
        };
      })
      .filter((o) => {
        if (!o.attributes.length) return false;
        const measType = o.attributes.find(
          (a) => a.key === "measuresType",
        )?.value;
        return measType === "10002";
      });
  }, [selectedProduct, customerOrders]);

  useEffect(() => {
    if (location.state?.newCustomer) {
      setSelectedCustomer(location.state.newCustomer);
      window.history.replaceState({}, "");
    }
  }, []);

  useEffect(() => {
    fetchCustomSuitProducts()
      .then((products) => {
        setGcProducts(products);
        setProductsLoading(false);
      })
      .catch(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([]);
      setSelectedProduct(null);
      setMeasurementType("finished");
      return;
    }
    setOrdersLoading(true);
    clearCustomerDetailCache(selectedCustomer.id);
    fetchCustomerWithOrders(selectedCustomer.id)
      .then((data) => {
        setCustomerOrders(data.allOrders);
        setOrdersLoading(false);
      })
      .catch(() => setOrdersLoading(false));
  }, [selectedCustomer]);

  function applyDefaultSizeType(attrs) {
    return attrs
      .filter((a) => !a.key.toLowerCase().startsWith("standard"))
      .map((a) =>
        a.key.toLowerCase() === "size type" && !a.value
          ? { ...a, value: "Custom" }
          : a,
      );
  }

  async function getCanonicalFieldsForGarments(garments) {
    const FETCHERS = {
      Jacket: fetchJacketMeasurementFields,
      Trouser: fetchTrouserMeasurementFields,
      Vest: fetchVestMeasurementFields,
      Shirt: fetchShirtMeasurementFields,
    };
    const results = await Promise.all(
      garments
        .filter((g) => FETCHERS[g])
        .map(async (g) => {
          const fields = await FETCHERS[g]();
          return fields.map((f) => ({ ...f, garment: g }));
        }),
    );
    return results.flat();
  }

  function prefillFromPastOrder(canonicalFields, pastAttrs, rangeMap) {
    const directMap = new Map(
      pastAttrs.map((a) => [a.key.trim().toLowerCase(), a.value]),
    );
    const fingerMap = new Map();
    for (const a of pastAttrs) {
      const e = getRangeForKey(rangeMap, a.key);
      if (e) {
        const fp = `${e.label}|${e.min}|${e.max}`;
        if (!fingerMap.has(fp)) fingerMap.set(fp, a.value);
      }
    }
    return canonicalFields.map((f) => {
      const displayKey = f.label;
      const legacyKey = f.garment ? `${f.garment} ${f.label}` : f.key;
      let value =
        directMap.get(displayKey.toLowerCase()) ??
        directMap.get(legacyKey.toLowerCase()) ??
        directMap.get(f.key.toLowerCase()) ??
        "";
      if (!value) {
        const e =
          getRangeForKey(rangeMap, f.label) ??
          getRangeForKey(rangeMap, f.key) ??
          getRangeForKey(rangeMap, legacyKey);
        if (e) value = fingerMap.get(`${e.label}|${e.min}|${e.max}`) ?? "";
      }
      return { key: legacyKey, value };
    });
  }

  async function getFieldsForProduct(product, variantTitle) {
    const garments = garmentsFromGcBuilderValue(variantTitle);
    if (garments.length) {
      const canonical = await getCanonicalFieldsForGarments(garments);
      if (canonical.length)
        return canonical.map((f) => ({
          key: f.garment ? `${f.garment} ${f.label}` : f.label,
          value: "",
        }));
    }
    const serverFields = await getProductFields(product.id);
    if (serverFields.length > 0)
      return serverFields.map((key) => ({ key, value: "" }));
    return [];
  }

  async function handleNewOrder() {
    setSelectedTemplate(null);
    setFitSizeSelections({});
    setStandardSizeSelections({});
    const defaults = {};
    [...styleOptions, ...contrastOptions]
      .filter((o) => o.isDefault && o.visible)
      .forEach((o) => {
        const key = `${o.garment}__${o.category}`;
        if (!defaults[key]) defaults[key] = o.label;
      });
    contrastLocations
      .filter((l) => l.isDefault && l.visible)
      .forEach((l) => {
        const key = `${l.garment || "General"}__contrast_location`;
        if (!defaults[key]) defaults[key] = l.label;
      });
    expandedLiningCodes
      .filter((o) => o.isDefault && o.visible)
      .forEach((o) => {
        const key = `${o.garment}__lining_code`;
        if (!defaults[key]) defaults[key] = o.label;
      });
    expandedButtonCodes
      .filter((o) => o.isDefault && o.visible)
      .forEach((o) => {
        const key = `${o.garment}__button_code`;
        if (!defaults[key]) defaults[key] = o.label;
      });
    setStyleSelections(defaults);
    if (!selectedProduct) return;
    const _variants = selectedProduct.variants?.edges?.map((e) => e.node) ?? [];
    const _defaultV = _variants.length === 1 ? _variants[0] : null;
    setSelectedVariant(_defaultV);
    setPrice(_defaultV?.price || "0.00");
    if (!_defaultV) return;

    const pastNode = findPastLineItem(
      customerOrders,
      selectedProduct.id,
      selectedProduct.title,
    );
    const combinedRanges = {
      ...vestRanges,
      ...trouserRanges,
      ...jacketRanges,
      ...shirtRanges,
    };
    const garments = garmentsFromGcBuilderValue(_defaultV.title);

    if (pastNode?.customAttributes?.length > 0 && garments.length) {
      setFieldsLoading(true);
      try {
        const canonical = await getCanonicalFieldsForGarments(garments);
        setAttributes(
          applyDefaultSizeType(
            canonical.map((f) => ({
              key: f.garment ? `${f.garment} ${f.label}` : f.label,
              value: "",
            })),
          ),
        );
      } catch {
        setAttributes([]);
      } finally {
        setFieldsLoading(false);
      }
      return;
    }

    if (pastNode?.customAttributes?.length > 0) {
      setAttributes(
        deduplicateByRange(attrsFromLineItem(pastNode, true), combinedRanges),
      );
      return;
    }

    setFieldsLoading(true);
    try {
      const fields = await getFieldsForProduct(
        selectedProduct,
        _defaultV.title,
      );
      setAttributes(applyDefaultSizeType(fields));
    } catch {
      setAttributes([]);
    } finally {
      setFieldsLoading(false);
    }
  }

  // Variant defaulting/reset lives in the pastOrdersForProduct effect below
  // (it always runs alongside this one and is the authoritative source).
  // This effect only auto-fills the Fabric Code from the product's linked
  // gc_fabrics metaobject entry.
  useEffect(() => {
    if (!selectedProduct) {
      setSelectedTemplate(null);
      setMeasurementType("finished");
      setFabricCode("");
      return;
    }
    setFabricCode("");
    if (!selectedProduct.metafield?.value) return;
    fetchFabricProductDetail(selectedProduct.id)
      .then((detail) => setFabricCode(detail?.gcFabric?.fabricCode || ""))
      .catch(() => {});
  }, [selectedProduct]);

  // Fetches/prefills measurement `attributes` for a specific chosen variant
  // (garment-type). Shared by the auto-load effect below and any manual
  // variant/template selection so both paths behave identically.
  async function loadAttributesForVariant(variant) {
    if (!selectedProduct || !variant) {
      setAttributes([]);
      return;
    }
    const pastNode = findPastLineItem(
      customerOrders,
      selectedProduct.id,
      selectedProduct.title,
    );
    const combinedRanges = {
      ...vestRanges,
      ...trouserRanges,
      ...jacketRanges,
      ...shirtRanges,
    };
    const garments = garmentsFromGcBuilderValue(variant.title);

    if (pastNode?.customAttributes?.length > 0 && garments.length) {
      setFieldsLoading(true);
      const pastAttrs = attrsFromLineItem(pastNode, false);
      try {
        const canonical = await getCanonicalFieldsForGarments(garments);
        setAttributes(
          applyDefaultSizeType(
            prefillFromPastOrder(canonical, pastAttrs, combinedRanges),
          ),
        );
      } catch {
        setAttributes(deduplicateByRange(pastAttrs, combinedRanges));
      } finally {
        setFieldsLoading(false);
      }
      return;
    }

    if (pastNode?.customAttributes?.length > 0) {
      setAttributes(
        deduplicateByRange(attrsFromLineItem(pastNode, false), combinedRanges),
      );
      return;
    }

    setFieldsLoading(true);
    try {
      const fields = await getFieldsForProduct(selectedProduct, variant.title);
      setAttributes(applyDefaultSizeType(fields));
    } catch {
      setAttributes([]);
    } finally {
      setFieldsLoading(false);
    }
  }

  useEffect(() => {
    setStyleOptions([]);
    setContrastOptions([]);
    setStyleSelections({});
    if (!selectedVariant) {
      setFitSizeSelections({});
      setStandardSizeSelections({});
      return;
    }
    const garments = garmentsFromGcBuilderValue(selectedVariant.title);
    if (!garments.length) {
      setFitSizeSelections({});
      setStandardSizeSelections({});
      return;
    }
    setStyleOptionsLoading(true);
    Promise.all([
      fetchStyleOptions(),
      fetchContrastOptions(),
      fetchContrastLocations(),
    ])
      .then(([allStyle, allContrast, allLocations]) => {
        const filtered = allStyle.filter((o) => garments.includes(o.garment));
        const filteredContrast = allContrast.filter((o) =>
          garments.includes(o.garment),
        );
        const filteredLocations = allLocations.filter(
          (l) =>
            !l.garment ||
            garments.some((g) => g.toLowerCase() === l.garment.toLowerCase()),
        );
        setStyleOptions(filtered);
        setContrastOptions(filteredContrast);
        setContrastLocations(filteredLocations);
        const defaults = {};
        [...filtered, ...filteredContrast]
          .filter((o) => o.isDefault && o.visible)
          .forEach((o) => {
            const key = `${o.garment}__${o.category}`;
            if (!defaults[key]) defaults[key] = o.label;
          });
        filteredLocations
          .filter((l) => l.isDefault && l.visible)
          .forEach((l) => {
            const key = `${l.garment || "General"}__contrast_location`;
            if (!defaults[key]) defaults[key] = l.label;
          });
        expandedLiningCodes
          .filter((o) => o.isDefault && o.visible)
          .forEach((o) => {
            const key = `${o.garment}__lining_code`;
            if (!defaults[key]) defaults[key] = o.label;
          });
        expandedButtonCodes
          .filter((o) => o.isDefault && o.visible)
          .forEach((o) => {
            const key = `${o.garment}__button_code`;
            if (!defaults[key]) defaults[key] = o.label;
          });
        setStyleSelections(defaults);
      })
      .catch(() => {})
      .finally(() => setStyleOptionsLoading(false));

    setFitSizeSelections({});
    setStandardSizeSelections({});
  }, [selectedVariant, fitSizeOptions]);

  useEffect(() => {
    if (selectedTemplate) return;
    if (!expandedLiningCodes.length && !expandedButtonCodes.length) return;
    setStyleSelections((prev) => {
      const next = { ...prev };
      expandedLiningCodes
        .filter((o) => o.isDefault && o.visible)
        .forEach((o) => {
          const key = `${o.garment}__lining_code`;
          if (!next[key]) next[key] = o.label;
        });
      expandedButtonCodes
        .filter((o) => o.isDefault && o.visible)
        .forEach((o) => {
          const key = `${o.garment}__button_code`;
          if (!next[key]) next[key] = o.label;
        });
      return next;
    });
  }, [expandedLiningCodes, expandedButtonCodes, selectedTemplate]);

  // Resolves the default/matching variant for the selected product and loads
  // its measurement fields — the single authoritative place this happens on
  // product selection (manual variant/template picks handle their own reload
  // via loadAttributesForVariant so they don't race with this effect).
  useEffect(() => {
    const allVariants =
      selectedProduct?.variants?.edges?.map((e) => e.node) ?? [];
    const onlyVariant = allVariants.length === 1 ? allVariants[0] : null;
    let resolvedVariant = onlyVariant;

    if (pastOrdersForProduct.length > 0) {
      const first = pastOrdersForProduct[0];
      setSelectedTemplate(first.orderId);
      const match = first.variantTitle
        ? allVariants.find(
            (v) => v.title.toLowerCase() === first.variantTitle.toLowerCase(),
          )
        : null;
      resolvedVariant = match || onlyVariant;
      setSelectedVariant(resolvedVariant);
      setPrice(resolvedVariant?.price || "0.00");

      const fitPrefill = {};
      for (const attr of first.attributes) {
        for (const o of fitSizeOptions) {
          if (
            attr.key === `${o.garment} ${o.sizeType}` ||
            attr.key === `${o.garment} - ${o.sizeType}`
          ) {
            fitPrefill[`${o.garment}__${o.sizeType}`] = attr.value;
            break;
          }
        }
      }
      if (Object.keys(fitPrefill).length) setFitSizeSelections(fitPrefill);
    } else {
      setSelectedTemplate(null);
      setSelectedVariant(resolvedVariant);
      setPrice(resolvedVariant?.price || "0.00");
    }

    loadAttributesForVariant(resolvedVariant);
  }, [selectedProduct, customerOrders, pastOrdersForProduct, fitSizeOptions]);

  useEffect(() => {
    if (styleOptionsLoading) return;
    if (!selectedTemplate) return;
    const pastOrder = pastOrdersForProduct.find(
      (o) => o.orderId === selectedTemplate,
    );
    if (!pastOrder) return;
    const allStyleOpts = [
      ...styleOptions,
      ...contrastOptions,
      ...contrastLocations.map((l) => ({
        ...l,
        category: "contrast_location",
        displayLabel: "Contrast Color Location",
      })),
      ...expandedLiningCodes,
      ...expandedButtonCodes,
    ];
    const stylePrefill = {};
    const usedSlots = new Set();
    for (const attr of pastOrder.attributes) {
      let displayLabel = null;
      let garmentHint = null;
      if (attr.key.startsWith("Style: ")) {
        displayLabel = attr.key.slice(7);
      } else if (attr.key.includes(" - ")) {
        const dashIdx = attr.key.indexOf(" - ");
        garmentHint = attr.key.slice(0, dashIdx);
        displayLabel = attr.key.slice(dashIdx + 3);
      }
      if (!displayLabel) continue;
      const matchedOpt = allStyleOpts.find((opt) => {
        const slot = `${opt.garment}__${opt.category}`;
        return (
          !usedSlots.has(slot) &&
          (!garmentHint || opt.garment === garmentHint) &&
          (opt.displayLabel || opt.category) === displayLabel &&
          opt.label === attr.value
        );
      });
      if (matchedOpt) {
        const slot = `${matchedOpt.garment}__${matchedOpt.category}`;
        usedSlots.add(slot);
        stylePrefill[slot] = attr.value;
      }
    }
    if (Object.keys(stylePrefill).length > 0) {
      setStyleSelections((prev) => ({ ...prev, ...stylePrefill }));
    }
  }, [selectedTemplate, styleOptionsLoading]);

  async function handleSubmit() {
    if (!selectedCustomer || !selectedProduct || !selectedVariant) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const allStyleOpts = [
        ...styleOptions,
        ...contrastOptions,
        ...contrastLocations.map((l) => ({
          ...l,
          category: "contrast_location",
          displayLabel: "Contrast Color Location",
          sortOrder: 0,
        })),
        ...expandedLiningCodes,
        ...expandedButtonCodes,
      ];
      const styleAttrs = Object.entries(styleSelections)
        .filter(([, v]) => v)
        .map(([compKey, value]) => {
          const [garment, category] = compKey.split("__");
          const opt = allStyleOpts.find(
            (o) => o.garment === garment && o.category === category,
          );
          const displayLabel = opt?.displayLabel || category;
          return {
            key: `${garment} - ${displayLabel}`,
            value,
          };
        });

      const upchargeAttrs = Object.entries(styleSelections)
        .filter(([compKey, label]) => {
          const [garment, category] = compKey.split("__");
          const opt = styleOptions.find(
            (o) =>
              o.garment === garment &&
              o.category === category &&
              o.label === label,
          );
          return opt?.upcharge > 0;
        })
        .map(([compKey, label]) => {
          const [garment, category] = compKey.split("__");
          const opt = styleOptions.find(
            (o) =>
              o.garment === garment &&
              o.category === category &&
              o.label === label,
          );
          return {
            key: `_upcharge_${garment}_${category}`,
            value: String(opt.upcharge),
          };
        });

      const fitSizeAttrs = Object.entries(fitSizeSelections)
        .filter(([, v]) => v)
        .map(([key, value]) => ({
          // Use " - " separator to avoid key collision with same-named measurement fields (e.g. "Trouser Length")
          key: key.replace("__", " - "),
          value,
        }));

      const garments = garmentsFromGcBuilderValue(selectedVariant?.title);

      // Pre-scan: which garments already have an explicit button or lining selection
      // (across ANY category — button_code type OR regular style option with craftPrefix).
      // Used to block fan-out from contaminating garments that have their own selection.
      const garmentsWithExplicitButton = new Set();
      const garmentsWithExplicitLining = new Set();
      for (const [compKey, value] of Object.entries(styleSelections)) {
        if (!value) continue;
        const [g, cat] = compKey.split("__");
        const opt = allStyleOpts.find(
          (o) => o.garment === g && o.category === cat && o.label === value,
        );
        if (!opt?.kutetailerCode) continue;
        if (opt.isButtonCode || opt.craftPrefix === "button")
          garmentsWithExplicitButton.add(g);
        if (opt.isLiningCode || opt.craftPrefix === "0714")
          garmentsWithExplicitLining.add(g);
      }

      // Per-garment KT craft codes derived from selected style options (stored as metafields, not line item attrs)
      const craftsByGarment = {};
      for (const [compKey, value] of Object.entries(styleSelections)) {
        if (!value) continue;
        const [selGarment, category] = compKey.split("__");
        const selectedOpt = allStyleOpts.find(
          (o) =>
            o.garment === selGarment &&
            o.category === category &&
            o.label === value,
        );
        if (!selectedOpt?.kutetailerCode) continue;

        // Contrast color has no craft code of its own — its label is sent as
        // the ":content" suffix on the contrast LOCATION's code, not as a
        // standalone craft. (Its kutetailor_code is an embroidery thread
        // colorCode for orderEmbs, unrelated to the crafts field.)
        if (selectedOpt.isContrastOption) continue;

        const isButton =
          selectedOpt.isButtonCode || selectedOpt.craftPrefix === "button";
        const isLining =
          selectedOpt.isLiningCode || selectedOpt.craftPrefix === "0714";
        const isContrastLocation = selectedOpt.isContrastLocation;

        // For button/lining codes: apply to all garments listed in the metaobject's garment field
        // (filtered to garments that exist in this order). Empty garments array means all order garments.
        let targetGarments;
        if ((isButton || isLining) && Array.isArray(selectedOpt.garments)) {
          const pool =
            selectedOpt.garments.length > 0
              ? selectedOpt.garments.filter((g) => garments.includes(g))
              : garments;
          // Block fan-out to any garment that has its own explicit button/lining selection,
          // regardless of which category it came from — prevents duplicate PIDs.
          const applicableGarments = pool.filter((g) => {
            if (g === selGarment) return true;
            if (isButton && garmentsWithExplicitButton.has(g)) return false;
            if (isLining && garmentsWithExplicitLining.has(g)) return false;
            return true;
          });
          targetGarments =
            applicableGarments.length > 0 ? applicableGarments : [selGarment];
        } else {
          targetGarments = [selGarment];
        }

        for (const garment of targetGarments) {
          let craftCode = selectedOpt.kutetailerCode;
          if (isButton) {
            const pid = garment === "Trouser" ? "3454" : "0638";
            craftCode = `${pid}:${craftCode}`;
          } else if (isLining) {
            craftCode = `0714:${craftCode}`;
          } else if (isContrastLocation) {
            // Parent code requires ":content" — send the chosen color's
            // readable label, not its (embroidery-only) kutetailor_code.
            const colorLabel = (
              styleSelections[`${garment}__contrast_option`] || ""
            ).trim();
            if (!colorLabel) continue;
            craftCode = `${craftCode}:${colorLabel}`;
          }
          if (!craftsByGarment[garment]) craftsByGarment[garment] = [];
          if (!craftsByGarment[garment].includes(craftCode)) {
            craftsByGarment[garment].push(craftCode);
          }
        }
      }

      // Process manually typed lining/button codes (text inputs — no matching Shopify option required)
      const liningKeySet = new Set(
        expandedLiningCodes.map((o) => `${o.garment}__${o.category}`),
      );
      const buttonKeySet = new Set(
        expandedButtonCodes.map((o) => `${o.garment}__${o.category}`),
      );
      for (const [compKey, value] of Object.entries(styleSelections)) {
        if (!value?.trim()) continue;
        const [selGarment, category] = compKey.split("__");
        // Skip if already handled by the option-matched loop above
        const alreadyHandled = allStyleOpts.some(
          (o) =>
            o.garment === selGarment &&
            o.category === category &&
            o.label === value &&
            o.kutetailerCode,
        );
        if (alreadyHandled) continue;
        const code = value.trim();
        if (liningKeySet.has(compKey)) {
          if (!craftsByGarment[selGarment]) craftsByGarment[selGarment] = [];
          const craftCode = `0714:${code}`;
          if (!craftsByGarment[selGarment].includes(craftCode))
            craftsByGarment[selGarment].push(craftCode);
        } else if (buttonKeySet.has(compKey)) {
          if (!craftsByGarment[selGarment]) craftsByGarment[selGarment] = [];
          const pid = selGarment === "Trouser" ? "3454" : "0638";
          const craftCode = `${pid}:${code}`;
          if (!craftsByGarment[selGarment].includes(craftCode))
            craftsByGarment[selGarment].push(craftCode);
        }
      }

      const finalPrice = parseFloat(price || "0.00").toFixed(2);

      const lineItemBase = selectedVariant?.id
        ? { variantId: selectedVariant.id }
        : { title: selectedProduct.title };

      const resolvedFabric = fabricCode.trim();

      const draft = await createDraftOrder({
        customerId: selectedCustomer.id,
        customAttributes: [
          ...(resolvedFabric
            ? [{ key: "_kute_fabric", value: resolvedFabric }]
            : []),
          ...(garments.length
            ? [{ key: "_kute_garments", value: garments.join(",") }]
            : []),
          { key: "_kute_measuresType", value: "10002" },
        ],
        lineItems: [
          {
            ...lineItemBase,
            quantity: 1,
            originalUnitPrice: finalPrice,
            requiresShipping: true,
            customAttributes: [
              ...attributes
                .filter((a) => a.key && a.key.toLowerCase() !== "size type")
                .map(({ key, value }) => ({ key, value: String(value) })),
              ...styleAttrs,
              ...upchargeAttrs,
              ...fitSizeAttrs,
              ...(fabricCode.trim()
                ? [{ key: "Fabric", value: fabricCode.trim() }]
                : []),
              { key: "measuresType", value: "10002" },
              {
                key: "Size Type",
                value: sizeType === "standard" ? "Standard" : "Custom",
              },
            ],
          },
        ],
        note: note || "",
        tags: ["admin-created"],
      });
      const order = await completeDraftOrder(draft.id, true);
      const numericId = order.id.split("/").pop();

      // Store craft codes as order metafields (suit_admin namespace) — avoids cluttering line item attributes
      if (Object.keys(craftsByGarment).length) {
        await setOrderMetafields(
          order.id,
          Object.entries(craftsByGarment).map(([garment, codes]) => ({
            key: `crafts_${garment.toLowerCase()}`,
            value: codes.join(","),
          })),
        ).catch((err) =>
          console.warn("[CreateOrder] craft metafield set failed:", err),
        );
      }

      const measureAttrs = attributes.filter(
        (a) =>
          a.key &&
          !a.key.startsWith("_") &&
          !EXCLUDED_MEASUREMENT_KEYS.has(a.key),
      );
      if (measureAttrs.length > 0) {
        try {
          const allProfiles = buildProfilesFromOrders(customerOrders);
          const productName = selectedProduct.title;
          const existingList = allProfiles[productName] ?? [];
          const today = new Date().toISOString().split("T")[0];
          const newProfile = {
            id: `prof_${Date.now()}`,
            name: `Measurement ${existingList.length + 1}`,
            created: today,
            style: Object.fromEntries([
              ...styleAttrs.map(({ key, value }) => [key, String(value)]),
              ...fitSizeAttrs.map(({ key, value }) => [key, String(value)]),
            ]),
            measurements: Object.fromEntries(
              measureAttrs.map(({ key, value }) => {
                const v = String(value);
                return [key, v.endsWith('"') ? v.slice(0, -1) : v];
              }),
            ),
            styleOptions: buildStyleOptionsForJson(
              styleOptions,
              contrastOptions,
              contrastLocations,
              liningCodes,
              buttonCodes,
              garmentsFromGcBuilderValue(
                selectedVariant?.title,
                allStyleGarments,
              ),
            ),
          };
          const fullProfiles = {
            ...allProfiles,
            [productName]: [...existingList, newProfile],
          };
          await setCustomerProductsMetafield(selectedCustomer.id, fullProfiles);
        } catch (e) {
          console.error("[CreateOrder] profile metafield save failed:", e);
        }
      }

      clearOrdersCache();
      invalidateOrdersCache();
      clearCustomerDetailCache(selectedCustomer.id);
      navigate(`/orders/${numericId}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  const totalUpcharge = useMemo(() => {
    if (!styleOptions.length) return 0;
    return Object.entries(styleSelections)
      .filter(([, label]) => label)
      .reduce((sum, [compKey, label]) => {
        const [garment, category] = compKey.split("__");
        const opt = styleOptions.find(
          (o) =>
            o.garment === garment &&
            o.category === category &&
            o.label === label,
        );
        return sum + (opt?.upcharge > 0 ? opt.upcharge : 0);
      }, 0);
  }, [styleSelections, styleOptions]);

  const hasMissingMeasurements = useMemo(() => {
    if (!attributes.length) return false;
    const { sections } = groupAttributes(attributes, rangeGroups);
    if (!sections.length) return false;
    return sections.some((sec) =>
      sec.items.some(({ originalKey }) => {
        const val = attributes.find((a) => a.key === originalKey)?.value ?? "";
        return !val.trim();
      }),
    );
  }, [attributes, rangeGroups]);

  const hasInvalidLiningOrButton = useMemo(() => {
    const liningKeys = new Map();
    for (const o of expandedLiningCodes) {
      const key = `${o.garment}__${o.category}`;
      if (!liningKeys.has(key)) liningKeys.set(key, []);
      liningKeys.get(key).push(o.label);
    }
    const buttonKeys = new Map();
    for (const o of expandedButtonCodes) {
      const key = `${o.garment}__${o.category}`;
      if (!buttonKeys.has(key)) buttonKeys.set(key, []);
      buttonKeys.get(key).push(o.label);
    }
    for (const [compKey, value] of Object.entries(styleSelections)) {
      if (!value?.trim()) continue;
      if (
        liningKeys.has(compKey) &&
        !liningKeys.get(compKey).includes(value.trim())
      )
        return true;
      if (
        buttonKeys.has(compKey) &&
        !buttonKeys.get(compKey).includes(value.trim())
      )
        return true;
    }
    return false;
  }, [styleSelections, expandedLiningCodes, expandedButtonCodes]);

  const canSubmit =
    !!selectedCustomer &&
    !!selectedProduct &&
    !!selectedVariant &&
    !!fabricCode.trim() &&
    !submitting &&
    measurementsValid &&
    !hasMissingMeasurements &&
    !hasInvalidLiningOrButton;

  const currentStep = selectedProduct ? 3 : selectedCustomer ? 2 : 1;

  return (
    <DashboardLayout bgColor="#f4f1ed">
      <img
        src="/watermark-tailor.png"
        alt=""
        className="fixed pointer-events-none select-none bottom-[-110px] right-0 w-[360px] h-[360px] opacity-[0.06] rotate-12 origin-bottom-right z-[1]"
      />

      <div className="relative flex flex-col gap-[40px] pb-[80px] z-[2]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="font-garamond text-[28px] sm:text-[40px] font-bold text-[#3c3c3c] leading-tight">
            Create New Order
          </h1>
          <p className="font-hanken text-[14px] text-black">
            Select customer, pick a product, fill measurements and create
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />

        {/* ── Step 1: Select Customer ── */}
        <CustomerSelector
          value={selectedCustomer}
          onChange={(c) => {
            setSelectedCustomer(c);
            setSelectedProduct(null);
          }}
        />

        {/* ── Step 2: Select Product ── */}
        {selectedCustomer && (
          <div className="flex flex-col gap-[23px]">
            <div className="flex flex-wrap items-center justify-between gap-[8px]">
              <span className="font-garamond text-[28px] font-semibold text-[#a45d41]">
                Select Product
              </span>
            </div>
            <ProductSelector
              products={gcProducts}
              loading={productsLoading}
              selectedProduct={selectedProduct}
              onSelect={setSelectedProduct}
              customerOrders={customerOrders}
            />
          </div>
        )}

        {/* ── Variant (garment type) ── */}
        {selectedCustomer &&
          selectedProduct &&
          (selectedProduct.variants?.edges?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-[16px]">
              <div className="flex flex-wrap items-center gap-[8px] pb-[17px] border-b border-gc-section-divider/30">
                <span className="font-garamond text-[14px] font-medium uppercase text-[#A45D41]">
                  Variant
                </span>
              </div>
              <div className="flex flex-wrap gap-[10px]">
                {selectedProduct.variants.edges.map(({ node: v }) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVariant(v);
                      setPrice(v.price || "0.00");
                      setSelectedTemplate(null);
                      loadAttributesForVariant(v);
                    }}
                    className={cn(
                      "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                      selectedVariant?.id === v.id
                        ? "text-white border border-gc-primary bg-gc-primary"
                        : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                    )}
                  >
                    {v.title}
                    <span className="text-[11px] opacity-70">{v.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {selectedCustomer && selectedProduct && selectedVariant && (
          <div className="flex flex-col gap-[16px]">
            <div className="flex flex-wrap items-center gap-[8px] pb-[17px] border-b border-gc-section-divider/30">
              <span className="font-garamond text-[14px] font-medium uppercase text-[#A45D41]">
                Measurement Type
              </span>
            </div>
            <div className="flex flex-wrap gap-[10px]">
              <button
                onClick={() => {
                  setMeasurementType("finished");
                  setSelectedTemplate(null);
                }}
                className={cn(
                  "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                  measurementType === "finished"
                    ? "text-white border border-gc-primary bg-gc-primary"
                    : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                )}
              >
                Finished Measurements
              </button>
            </div>
          </div>
        )}

        {selectedCustomer && selectedProduct && selectedVariant && (
          <div className="flex flex-col gap-[16px]">
            <div className="flex flex-wrap items-center gap-[8px] pb-[17px] border-b border-gc-section-divider/30">
              <span className="font-garamond text-[14px] font-medium uppercase text-[#A45D41]">
                Size Type
              </span>
            </div>
            <div className="flex flex-wrap gap-[10px]">
              <button
                type="button"
                onClick={() => setSizeType("custom")}
                className={cn(
                  "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                  sizeType === "custom"
                    ? "text-white border border-gc-primary bg-gc-primary"
                    : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                )}
              >
                Custom
              </button>
              <button
                type="button"
                onClick={() => setSizeType("standard")}
                className={cn(
                  "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                  sizeType === "standard"
                    ? "text-white border border-gc-primary bg-gc-primary"
                    : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                )}
              >
                Standard
              </button>
            </div>
          </div>
        )}

        {selectedCustomer &&
          selectedProduct &&
          measurementType === "finished" &&
          pastOrdersForProduct.length > 0 && (
            <div className="flex flex-col gap-[16px]">
              <div className="flex flex-wrap items-center gap-[8px] pb-[17px] border-b border-gc-section-divider/30">
                <History size={16} className="text-gc-primary" />
                <span className="font-garamond text-[14px] font-medium uppercase text-[#A45D41]">
                  Use Past Order as Template
                </span>
                <span className="font-hanken text-[12px] text-[#6b7280] ml-auto">
                  {pastOrdersForProduct.length} past order
                  {pastOrdersForProduct.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-[10px]">
                <button
                  onClick={handleNewOrder}
                  className={cn(
                    "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                    !selectedTemplate
                      ? "text-white border border-gc-primary bg-gc-primary"
                      : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                  )}
                >
                  <Plus size={13} />
                  New
                </button>
                {pastOrdersForProduct.map((o) => (
                  <button
                    key={o.orderId}
                    onClick={async () => {
                      setSelectedTemplate(o.orderId);

                      let chosenVariant;
                      {
                        const variants =
                          selectedProduct.variants?.edges?.map((e) => e.node) ??
                          [];
                        const onlyVariant =
                          variants.length === 1 ? variants[0] : null;
                        const match = o.variantTitle
                          ? variants.find(
                              (v) =>
                                v.title.toLowerCase() ===
                                o.variantTitle.toLowerCase(),
                            )
                          : null;
                        chosenVariant = match || onlyVariant;
                        setSelectedVariant(chosenVariant);
                        setPrice(chosenVariant?.price || "0.00");
                      }

                      const garments = garmentsFromGcBuilderValue(
                        chosenVariant?.title,
                      );
                      const combinedRanges = {
                        ...vestRanges,
                        ...trouserRanges,
                        ...jacketRanges,
                        ...shirtRanges,
                      };
                      if (garments.length) {
                        setFieldsLoading(true);
                        try {
                          const canonical =
                            await getCanonicalFieldsForGarments(garments);
                          setAttributes(
                            applyDefaultSizeType(
                              prefillFromPastOrder(
                                canonical,
                                o.attributes,
                                combinedRanges,
                              ),
                            ),
                          );
                        } catch {
                          setAttributes(
                            deduplicateByRange(o.attributes, combinedRanges),
                          );
                        } finally {
                          setFieldsLoading(false);
                        }
                      } else {
                        setAttributes(
                          deduplicateByRange(o.attributes, combinedRanges),
                        );
                      }

                      const fitPrefill = {};
                      for (const attr of o.attributes) {
                        for (const f of fitSizeOptions) {
                          if (
                            attr.key === `${f.garment} ${f.sizeType}` ||
                            attr.key === `${f.garment} - ${f.sizeType}`
                          ) {
                            fitPrefill[`${f.garment}__${f.sizeType}`] =
                              attr.value;
                            break;
                          }
                        }
                      }
                      setFitSizeSelections(fitPrefill);

                      const allStyleOpts = [
                        ...styleOptions,
                        ...contrastOptions,
                        ...contrastLocations.map((l) => ({
                          ...l,
                          category: "contrast_location",
                          displayLabel: "Contrast Color Location",
                        })),
                        ...expandedLiningCodes,
                        ...expandedButtonCodes,
                      ];
                      const stylePrefill = {};
                      const usedSlots = new Set();
                      for (const attr of o.attributes) {
                        let displayLabel = null;
                        let garmentHint = null;
                        if (attr.key.startsWith("Style: ")) {
                          displayLabel = attr.key.slice(7);
                        } else if (attr.key.includes(" - ")) {
                          const dashIdx = attr.key.indexOf(" - ");
                          garmentHint = attr.key.slice(0, dashIdx);
                          displayLabel = attr.key.slice(dashIdx + 3);
                        }
                        if (!displayLabel) continue;
                        const matchedOpt = allStyleOpts.find((opt) => {
                          const slot = `${opt.garment}__${opt.category}`;
                          return (
                            !usedSlots.has(slot) &&
                            (!garmentHint || opt.garment === garmentHint) &&
                            (opt.displayLabel || opt.category) ===
                              displayLabel &&
                            opt.label === attr.value
                          );
                        });
                        if (matchedOpt) {
                          const slot = `${matchedOpt.garment}__${matchedOpt.category}`;
                          usedSlots.add(slot);
                          stylePrefill[slot] = attr.value;
                        }
                      }
                      setStyleSelections(stylePrefill);
                    }}
                    className={cn(
                      "font-hanken flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer",
                      selectedTemplate === o.orderId
                        ? "text-gc-primary border border-gc-primary bg-gc-primary/[6%]"
                        : "text-[#44474c] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                    )}
                  >
                    {selectedTemplate === o.orderId && (
                      <CheckCircle2 size={13} className="text-gc-primary" />
                    )}
                    {o.orderId}
                    <span className="text-[11px] text-[#9ca3af]">{o.date}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* ── Step 3: Measurements + Details ── */}
        {selectedCustomer && selectedProduct && (
          <>
            <div className="bg-white/40 rounded-[12px] p-[31px] border border-gc-border-input">
              <h2 className="font-garamond text-[28px] font-semibold text-gc-primary mb-[20px]">
                Price (store currency)
              </h2>
              <div className="w-full border-t border-gc-section-divider/30">
                <div className="max-w-[200px] mt-[20px]">
                  <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mb-[7px]">
                    Price
                  </label>
                  <div className="bg-white rounded-[4px] h-[48px] flex items-center px-[8px] overflow-hidden border border-gc-scrollbar-thumb/60">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="font-garamond flex-1 text-[20px] text-[#1c1c19] outline-none bg-transparent"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/40 rounded-[12px] p-[31px] border border-gc-border-input">
              <h2 className="font-garamond text-[28px] font-semibold text-gc-primary mb-[20px]">
                Fabric
              </h2>
              <div className="w-full border-t border-gc-section-divider/30">
                <div className="max-w-[320px] mt-[20px]">
                  <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mb-[7px]">
                    Fabric Code
                  </label>
                  <input
                    type="text"
                    value={fabricCode}
                    onChange={(e) => setFabricCode(e.target.value)}
                    className="font-hanken w-full bg-white px-[14px] h-[48px] rounded-[4px] text-[14px] text-[#1c1c19] outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
                    placeholder="Enter fabric code…"
                  />
                  <p className="font-hanken text-[11px] text-[#9ca3af] mt-[6px]">
                    Auto-filled from the selected fabric — edit if needed.
                  </p>
                </div>
              </div>
            </div>

            {selectedProduct?.metafield?.value && selectedVariant && (
              <StyleOptionsSection
                styleOptions={styleOptions}
                contrastOptions={contrastOptions}
                contrastLocations={contrastLocations}
                liningCodes={expandedLiningCodes}
                buttonCodes={expandedButtonCodes}
                selections={styleSelections}
                onChange={setStyleSelections}
                loading={styleOptionsLoading}
              />
            )}

            {!selectedVariant ? (
              <div className="bg-white rounded-[12px] px-[31px] py-[24px] border border-gc-divider">
                <p className="font-hanken text-[14px] text-[#6b7280]">
                  Select a variant to continue.
                </p>
              </div>
            ) : fieldsLoading ? (
              <div className="bg-white rounded-[12px] p-[31px] border border-gc-divider">
                <LoadingState message="Loading product fields…" />
              </div>
            ) : attributes.length === 0 ? (
              <div className="bg-white rounded-[12px] px-[31px] py-[24px] border border-gc-divider">
                <p className="font-hanken text-[14px] text-[#6b7280]">
                  No fields loaded for this product.
                </p>
              </div>
            ) : (
              <AttributeEditor
                attributes={attributes}
                onChange={setAttributes}
                rangeGroups={rangeGroups}
                onValidChange={setMeasurementsValid}
                fitSizeOptions={fitSizeOptions}
                fitSizeSelections={fitSizeSelections}
                onFitSizeChange={setFitSizeSelections}
                standardSizeOptions={standardSizesByGarment}
                standardSizeSelections={standardSizeSelections}
                onStandardSizeSelect={handleStandardSizeSelect}
                showStandardSizePicker={sizeType === "standard"}
              />
            )}

            {/* Note */}
            <div className="p-[31px]">
              <div className="flex items-center gap-[8px] mb-[20px]">
                <FileText size={18} className="text-gc-primary" />
                <h2 className="font-garamond text-[28px] font-semibold text-[#a45d41]">
                  Order Note
                </h2>
              </div>
              <div className="border-t border-gc-primary-dark/20">
                <label className="font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mt-[16px] mb-[8px]">
                  Notes
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Add a note for this order..."
                  className="font-hanken w-full bg-white px-[14px] py-[12px] rounded-[10px] text-[14px] text-gc-near-black2 placeholder:text-gc-muted outline-none resize-none transition-colors border border-gc-border-input"
                />
              </div>
            </div>

            {!fabricCode.trim() && (
              <AlertBanner
                variant="error"
                message="Fabric code is required before creating the order."
              />
            )}

            {hasMissingMeasurements && (
              <AlertBanner
                variant="error"
                message="Please fill in all measurement fields before creating the order."
              />
            )}

            {!measurementsValid && (
              <AlertBanner
                variant="warning"
                message="Some measurements are outside the valid range. Fix the red fields before creating the order."
              />
            )}

            {submitError && (
              <AlertBanner
                variant="error"
                title="Failed to create order"
                message={submitError}
              />
            )}

            <div className="flex flex-wrap items-center justify-end gap-[12px] pb-[8px]">
              <Link
                to="/orders"
                className="font-hanken flex items-center gap-[6px] text-[14px] font-medium text-black uppercase px-[20px] py-[11px] rounded-[8px] hover:opacity-70 transition-opacity border border-gray-300"
              >
                <X size={14} />
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="font-hanken flex items-center gap-[8px] h-[44px] px-[20px] rounded-[8px] text-white text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-gc-primary"
              >
                {submitting ? (
                  <>
                    <Plus size={14} className="animate-pulse" />
                    Creating Order…
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

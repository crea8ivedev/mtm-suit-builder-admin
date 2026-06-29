class LinkedSet {
  constructor() {
    this._map = new Map();
  }
  add(k) {
    if (!this._map.has(k)) this._map.set(k, true);
  }
  toArray() {
    return Array.from(this._map.keys());
  }
}

const esc = (v) => {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

const EXCLUDED_ATTR_KEYS = /date|time|gift/i;

function formatDateForCSV(order) {
  const iso = order.orderDateRaw
    ? order.orderDateRaw.split("T")[0]
    : (order.orderDate ?? "");
  return `="${iso}"`;
}

function formatMoneyRaw(amount, currencyCode) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(parseFloat(amount));
  } catch {
    return `${currencyCode} ${parseFloat(amount).toFixed(2)}`;
  }
}

const GARMENT_PREFIXES = ["Jacket ", "Trouser ", "Vest ", "Shirt "];

const ATTR_ALIASES = {
  "R/Outseam": "Outseam R",
  "Outseam (R)": "Outseam R",
  "L/Outseam": "Outseam L",
  "Outseam (L)": "Outseam L",
  "Side Pocket": "Side Pockets",
};

function normalizeAttrKey(key) {
  let k = key;
  // Strip garment prefix ("Jacket Canvas", "Trouser Waist", etc.)
  for (const p of GARMENT_PREFIXES) {
    if (k.startsWith(p)) {
      k = k.slice(p.length);
      break;
    }
  }
  // Strip leading "- " left after garment prefix removal ("Jacket - Canvas" → "- Canvas" → "Canvas")
  if (k.startsWith("- ")) k = k.slice(2);
  // Strip "Style: " prefix ("Style: Vents" → "Vents")
  if (k.startsWith("Style: ")) k = k.slice("Style: ".length);
  // Handle " - " separator ("Something - Label" → "Label")
  if (k.includes(" - ")) k = k.split(" - ").slice(1).join(" - ");
  // Apply explicit aliases
  return ATTR_ALIASES[k] ?? k;
}

function attrDisplayLabel(key, labelMap = {}) {
  if (labelMap[key]) return labelMap[key];
  const normalized = normalizeAttrKey(key);
  return labelMap[normalized] ?? normalized;
}

export function generateSingleOrderCSV(order, labelMap = {}) {
  if (!order) return;

  const lineItems = order.lineItems?.edges?.map((e) => e.node) ?? [];
  const currencyCode = order.totalPriceSet?.shopMoney?.currencyCode || "USD";

  const upchargeAmt = lineItems.reduce((sum, item) => {
    return (
      sum +
      (item.customAttributes ?? [])
        .filter((a) => a.key.startsWith("_upcharge_"))
        .reduce((s, a) => s + parseFloat(a.value || 0), 0)
    );
  }, 0);
  const subtotalAmt = parseFloat(
    order.subtotalPriceSet?.shopMoney?.amount || 0,
  );
  const productsTotal = subtotalAmt - upchargeAmt;

  const attrKeySet = new LinkedSet();
  lineItems.forEach((item) => {
    (item.customAttributes ?? []).forEach((a) => {
      if (!EXCLUDED_ATTR_KEYS.test(a.key) && !a.key.startsWith("_"))
        attrKeySet.add(a.key);
    });
  });
  const attrKeys = attrKeySet.toArray();

  const ORDER_COLS = [
    "Order ID",
    "Date",
    "Customer",
    "Email",
    "Supplier",
    "Products Total",
    "Upcharge Amount",
    "Grand Total",
  ];
  const ITEM_COLS = [
    "Item #",
    "Product",
    "Quantity",
    ...attrKeys.map((k) => attrDisplayLabel(k, labelMap)),
  ];
  const headers = [...ORDER_COLS, ...ITEM_COLS];
  const BLANK_ORDER = new Array(ORDER_COLS.length).fill("");

  const dateIso = order.createdAt ? order.createdAt.split("T")[0] : "";
  const customerName = [order.customer?.firstName, order.customer?.lastName]
    .filter(Boolean)
    .join(" ");
  const metaMap = Object.fromEntries(
    (order.metafields?.edges ?? []).map((e) => [e.node.key, e.node.value]),
  );
  const supplierName = metaMap.supplier_name ?? "";
  const orderBase = [
    order.name ?? "",
    `="${dateIso}"`,
    customerName,
    order.customer?.email ?? "",
    supplierName,
    formatMoneyRaw(productsTotal, currencyCode),
    formatMoneyRaw(upchargeAmt, currencyCode),
    formatMoneyRaw(subtotalAmt, currencyCode),
  ];

  const rows = [headers];
  if (lineItems.length === 0) {
    rows.push([...orderBase, "", "", ...attrKeys.map(() => "")]);
  } else {
    lineItems.forEach((item, idx) => {
      const attrMap = Object.fromEntries(
        (item.customAttributes ?? [])
          .filter(
            (a) => !EXCLUDED_ATTR_KEYS.test(a.key) && !a.key.startsWith("_"),
          )
          .map((a) => [a.key, a.value]),
      );
      const itemCols = [
        idx + 1,
        item.title,
        item.quantity,
        ...attrKeys.map((k) => attrMap[k] ?? ""),
      ];
      rows.push([...(idx === 0 ? orderBase : BLANK_ORDER), ...itemCols]);
    });
  }

  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const orderSlug = (order.name ?? "order").replace(/[^a-zA-Z0-9-]/g, "");
  a.download = `${orderSlug}-${dateIso}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateCSV(orders, labelMap = {}) {
  if (!orders.length) return;

  const attrKeySet = new LinkedSet();
  orders.forEach((order) => {
    order.lineItemDetails?.forEach((item) => {
      item.customAttributes?.forEach((a) => {
        if (!EXCLUDED_ATTR_KEYS.test(a.key) && !a.key.startsWith("_"))
          attrKeySet.add(a.key);
      });
    });
  });
  // Deduplicate by normalised display label (case-insensitive).
  // Different raw keys that strip to the same label ("Jacket - Canvas" vs "Canvas",
  // "U-rise" vs "U-Rise") produce one column each.
  const seenLabels = new Set();
  const attrKeys = attrKeySet.toArray().filter((k) => {
    const label = attrDisplayLabel(k, labelMap).toLowerCase();
    if (seenLabels.has(label)) return false;
    seenLabels.add(label);
    return true;
  });

  const ORDER_COLS = [
    "Order ID",
    "Date",
    "Customer",
    "Email",
    "Supplier",
    "Products Total",
    "Upcharge Amount",
    "Grand Total",
  ];
  const ITEM_COLS = [
    "Item #",
    "Product",
    "Quantity",
    ...attrKeys.map((k) => attrDisplayLabel(k, labelMap)),
  ];
  const headers = [...ORDER_COLS, ...ITEM_COLS];
  const BLANK_ORDER = new Array(ORDER_COLS.length).fill("");
  const BLANK_ROW = new Array(headers.length).fill("");

  const rows = [headers];

  orders.forEach((order, oi) => {
    const items = order.lineItemDetails ?? [];
    const curr = order.currencyCode || "USD";
    const upchargeAmt = order.upchargeRaw || 0;
    const subtotal = order.subtotalRaw || 0;
    const productsTotal = subtotal - upchargeAmt;
    const orderBase = [
      order.id,
      formatDateForCSV(order),
      order.customer.name,
      order.customer.email,
      order.supplierName ?? "",
      formatMoneyRaw(productsTotal, curr),
      formatMoneyRaw(upchargeAmt, curr),
      formatMoneyRaw(subtotal, curr),
    ];

    if (items.length === 0) {
      rows.push([...orderBase, "", "", ...attrKeys.map(() => "")]);
    } else {
      items.forEach((item, idx) => {
        // Build label-keyed map (lowercase keys) so dedup matches regardless of prefix/case
        const attrMap = {};
        (item.customAttributes ?? [])
          .filter(
            (a) => !EXCLUDED_ATTR_KEYS.test(a.key) && !a.key.startsWith("_"),
          )
          .forEach((a) => {
            const label = attrDisplayLabel(a.key, labelMap).toLowerCase();
            if (!(label in attrMap)) attrMap[label] = a.value;
          });
        const itemCols = [
          idx + 1,
          item.title,
          item.quantity,
          ...attrKeys.map(
            (k) => attrMap[attrDisplayLabel(k, labelMap).toLowerCase()] ?? "",
          ),
        ];
        rows.push([...(idx === 0 ? orderBase : BLANK_ORDER), ...itemCols]);
      });
    }

    if (oi < orders.length - 1) rows.push(BLANK_ROW);
  });

  // Drop columns (beyond ORDER_COLS) that are entirely empty across all data rows
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c !== ""));
  const colCount = headers.length;
  const keepCol = Array.from({ length: colCount }, (_, ci) => {
    if (ci < ORDER_COLS.length) return true;
    return dataRows.some((r) => (r[ci] ?? "") !== "");
  });
  const filteredRows = rows.map((r) => r.filter((_, ci) => keepCol[ci]));

  const csv = filteredRows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

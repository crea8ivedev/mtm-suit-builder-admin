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

export function generateSingleOrderCSV(order) {
  if (!order) return;

  const lineItems = order.lineItems?.edges?.map((e) => e.node) ?? [];

  const attrKeySet = new LinkedSet();
  lineItems.forEach((item) => {
    (item.customAttributes ?? []).forEach((a) => {
      if (!EXCLUDED_ATTR_KEYS.test(a.key) && !a.key.startsWith("_"))
        attrKeySet.add(a.key);
    });
  });
  const attrKeys = attrKeySet.toArray();

  const ORDER_COLS = ["Order ID", "Date", "Customer", "Email"];
  const ITEM_COLS = ["Item #", "Product", "Quantity", ...attrKeys];
  const headers = [...ORDER_COLS, ...ITEM_COLS];
  const BLANK_ORDER = new Array(ORDER_COLS.length).fill("");

  const dateIso = order.createdAt ? order.createdAt.split("T")[0] : "";
  const customerName = [order.customer?.firstName, order.customer?.lastName]
    .filter(Boolean)
    .join(" ");
  const orderBase = [
    order.name ?? "",
    `="${dateIso}"`,
    customerName,
    order.customer?.email ?? "",
  ];

  const rows = [headers];
  if (lineItems.length === 0) {
    rows.push([...orderBase, "", "", "", ...attrKeys.map(() => "")]);
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

export function generateCSV(orders) {
  if (!orders.length) return;

  const attrKeySet = new LinkedSet();
  orders.forEach((order) => {
    order.lineItemDetails?.forEach((item) => {
      item.customAttributes?.forEach((a) => {
        if (!EXCLUDED_ATTR_KEYS.test(a.key)) attrKeySet.add(a.key);
      });
    });
  });
  const attrKeys = attrKeySet.toArray();

  const ORDER_COLS = ["Order ID", "Date", "Customer", "Email"];
  const ITEM_COLS = ["Item #", "Product", "Quantity", ...attrKeys];
  const headers = [...ORDER_COLS, ...ITEM_COLS];
  const BLANK_ORDER = new Array(ORDER_COLS.length).fill("");
  const BLANK_ROW = new Array(headers.length).fill("");

  const rows = [headers];

  orders.forEach((order, oi) => {
    const items = order.lineItemDetails ?? [];
    const orderBase = [
      order.id,
      formatDateForCSV(order),
      order.customer.name,
      order.customer.email,
    ];

    if (items.length === 0) {
      rows.push([...orderBase, "", "", "", ...attrKeys.map(() => "")]);
    } else {
      items.forEach((item, idx) => {
        const attrMap = Object.fromEntries(
          item.customAttributes
            .filter((a) => !EXCLUDED_ATTR_KEYS.test(a.key))
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

    if (oi < orders.length - 1) rows.push(BLANK_ROW);
  });

  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

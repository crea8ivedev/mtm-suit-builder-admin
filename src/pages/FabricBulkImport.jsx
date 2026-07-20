import { useState, Fragment } from "react";
// CSV import is temporarily disabled — only .xlsx is supported for now.
// Kept commented (not removed) so it can be switched back on later.
// import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Link, useNavigate } from "react-router-dom";
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  fetchCollections,
  resolveCollectionIdsByName,
  createFabricProductComplete,
  clearFabricProductsV2Cache,
  clearGcFabricsCache,
  createImageFromUrl,
  fetchGcFabrics,
  fetchDesignOptions,
  fetchActiveProductsForSeparates,
  createDesignOption,
  GARMENT_TYPES,
} from "../lib/shopify";
import { fetchKtFabricDetails } from "../lib/kutetailor";
import { xlsxCellHtmlToShopifyRichText } from "../lib/richText";

// Columns whose CSV/xlsx cell holds rich text (bold/italic/bullets), not a
// plain value.
const RICH_TEXT_COLUMNS = ["description", "shipping_returns"];

// These three are core garment types every fabric is assumed to offer —
// they always get a variant even when left blank in the CSV. The rest
// (Vest Only, Shirt Only) are optional add-ons, only created when filled in.
const ALWAYS_INCLUDED_GARMENT_TYPES = ["Two Piece Suit", "Jacket Only", "Pants Only"];

const FIXED_COLUMNS = [
  "title",
  "fabric_code",
  "fabric_house",
  "color",
  "material",
  "weight",
  "status",
  "collections",
  "description",
  "design_options",
  "fabric_care",
  "separates",
  "shipping_returns",
];

const TEMPLATE_CSV_ROW = [
  "Dormeuil - DAQ1865 Blue",
  "DAQ1865",
  "Dormeuil",
  "Blue",
  "55% Wool 45% Silk",
  "240g/m",
  "ACTIVE",
  "Custom Suits,Zegna",
  "A timeless suit crafted from premium wool.",
  "Jacket:Style:4 Inch Two Button Notch Lapel;Trouser:Style:Dress Trouser",
  "Jacket:Rear Vent Style:Side Vents;Jacket:Tuxedo Contrast:None",
  "REPLACE-WITH-REAL-SKU-1;REPLACE-WITH-REAL-SKU-2",
  "Free 60-day returns.",
  "1500",
  "10",
  "900",
  "5",
  "",
  "",
  "",
  "",
  "",
  "",
];

// CSV template generation — disabled along with CSV upload, kept commented.
// const TEMPLATE_CSV = Papa.unparse({
//   fields: [
//     ...FIXED_COLUMNS,
//     ...GARMENT_TYPES.flatMap((t) => [`${t} Price`, `${t} Qty`]),
//   ],
//   data: [TEMPLATE_CSV_ROW],
// });
//
// function downloadTemplate() {
//   const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = "fabric_bulk_import_template.csv";
//   a.click();
//   URL.revokeObjectURL(url);
// }

const TEMPLATE_XLSX_ROWS = [
  [...FIXED_COLUMNS, ...GARMENT_TYPES.flatMap((t) => [`${t} Price`, `${t} Qty`])],
  TEMPLATE_CSV_ROW,
];

function downloadXlsxTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_XLSX_ROWS);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Fabrics");
  XLSX.writeFile(workbook, "fabric_bulk_import_template.xlsx");
}

function parseRows(rows) {
  return rows
    .filter((row) => (row.fabric_code || "").trim())
    .map((row) => {
      // Two Piece Suit / Jacket Only / Pants Only are always offered per
      // fabric — they get a variant even if left blank in the CSV (blank
      // price/qty defaults to "0"). Vest Only / Shirt Only are optional
      // add-ons: only included when at least one of price/qty is filled in.
      const garments = GARMENT_TYPES.map((type) => ({
        type,
        price: (row[`${type} Price`] || "").trim(),
        qty: (row[`${type} Qty`] || "").trim(),
      }))
        .filter(
          (g) =>
            ALWAYS_INCLUDED_GARMENT_TYPES.includes(g.type) ||
            g.price !== "" ||
            g.qty !== "",
        )
        .map((g) => ({
          ...g,
          price: g.price || "0",
          qty: g.qty || "0",
        }));
      return {
        title: (row.title || "").trim(),
        fabricCode: (row.fabric_code || "").trim(),
        fabricHouse: (row.fabric_house || "").trim(),
        color: (row.color || "").trim(),
        material: (row.material || "").trim(),
        weight: (row.weight || "").trim(),
        status: (row.status || "DRAFT").trim().toUpperCase(),
        collectionNames: (row.collections || "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        description: (row.description || "").trim(),
        shippingReturns: (row.shipping_returns || "").trim(),
        descriptionHtml: row.__descriptionHtml || null,
        shippingReturnsHtml: row.__shipping_returnsHtml || null,
        designOptionTitles: (row.design_options || "")
          .split(";")
          .map((t) => t.trim())
          .filter(Boolean),
        fabricCareTitles: (row.fabric_care || "")
          .split(";")
          .map((t) => t.trim())
          .filter(Boolean),
        separatesSkus: (row.separates || "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
        garments,
      };
    });
}

function splitTitleLabelValue(cell) {
  const first = cell.indexOf(":");
  if (first === -1) return [cell.trim(), undefined, undefined];
  const second = cell.indexOf(":", first + 1);
  if (second === -1) {
    return [cell.slice(0, first).trim(), cell.slice(first + 1).trim(), undefined];
  }
  return [
    cell.slice(0, first).trim(),
    cell.slice(first + 1, second).trim(),
    cell.slice(second + 1).trim(),
  ];
}

async function resolveDesignOptionIds(cells, pool) {
  if (!cells.length) return [];
  const ids = [];
  for (const cell of cells) {
    const [titlePart, labelPart, valuePart] = splitTitleLabelValue(cell);
    if (!titlePart) continue;
    const title = titlePart.toLowerCase();
    const label = labelPart?.toLowerCase();
    const value = valuePart?.toLowerCase();
    let match = pool.find(
      (o) =>
        o.title.toLowerCase() === title &&
        (!label || o.label.toLowerCase() === label) &&
        (!value || o.value.toLowerCase() === value),
    );
    if (!match) {
      const created = await createDesignOption({
        title: titlePart,
        label: labelPart || "",
        value: valuePart || "",
      });
      match = {
        id: created.id,
        title: titlePart,
        label: labelPart || "",
        value: valuePart || "",
      };
      pool.push(match);
    }
    ids.push(match.id);
  }
  return ids;
}

function resolveSeparatesIds(skus, products) {
  if (!skus.length) return [];
  const bySku = new Map();
  for (const p of products) {
    for (const v of p.variants ?? []) {
      if (v.sku) bySku.set(v.sku.toLowerCase(), v.id);
    }
  }
  return skus.map((s) => bySku.get(s.toLowerCase())).filter(Boolean);
}

// Spreadsheet apps auto-format codes like "DKK0114" as a currency amount
// (DKK is a real ISO code) and drop the leading zero — "DKK 114.00" ends up
// in the CSV instead of the real code. Catch that shape before it's imported.
const CURRENCY_MANGLED_CODE = /^[A-Za-z]{3}\s?\d+\.\d{2}$/;

function validateFabric(fabric, index, firstOccurrence, existingCodes) {
  const errors = [];
  if (!fabric.fabricHouse) errors.push("missing fabric_house");
  if (CURRENCY_MANGLED_CODE.test(fabric.fabricCode)) {
    errors.push(
      `fabric_code "${fabric.fabricCode}" looks auto-formatted as currency by the spreadsheet (leading zero likely dropped) — set that column to Plain Text and re-enter the code`,
    );
  }
  // Each fabric_code must be unique — every row creates its own gc_fabrics
  // metaobject, so a repeated code makes the second row fail at import time.
  // Only rows AFTER the first occurrence are flagged, so the first copy of
  // an accidentally-repeated row can still import.
  if (firstOccurrence?.get(fabric.fabricCode.toLowerCase()) !== index) {
    errors.push(
      `duplicate fabric_code "${fabric.fabricCode}" — already appears earlier in this file; only the first occurrence will be imported`,
    );
  }
  // Also block re-importing a fabric that already exists in Shopify —
  // otherwise the same fabric_code silently creates a second product.
  if (existingCodes?.has(fabric.fabricCode.toLowerCase())) {
    errors.push(
      `fabric_code "${fabric.fabricCode}" already exists — this fabric was already added`,
    );
  }
  if (!["ACTIVE", "DRAFT"].includes(fabric.status)) {
    errors.push(`status must be ACTIVE or DRAFT (got "${fabric.status}")`);
  }
  // Price can be decimal, but inventory quantity must be a whole number —
  // Shopify's InventorySetQuantitiesInput rejects non-integer quantities.
  for (const g of fabric.garments) {
    const priceNum = Number(g.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      errors.push(`${g.type}: price "${g.price}" must be a valid amount`);
    }
    const qtyNum = Number(g.qty);
    if (!Number.isInteger(qtyNum) || qtyNum < 0) {
      errors.push(
        `${g.type}: quantity "${g.qty}" must be a whole number (no decimals)`,
      );
    }
  }
  return errors;
}

// fabric_code (lowercased) -> index of its first occurrence in the CSV.
function firstOccurrenceIndex(fabrics) {
  const map = new Map();
  fabrics.forEach((f, idx) => {
    const key = f.fabricCode.toLowerCase();
    if (!map.has(key)) map.set(key, idx);
  });
  return map;
}

// Collection names in the CSV that don't yet exist in Shopify — these are
// created automatically at import time, so they're surfaced as info, not errors.
function newCollectionNames(fabric, collections) {
  return fabric.collectionNames.filter(
    (name) =>
      !collections.some((c) => c.title.toLowerCase() === name.toLowerCase()),
  );
}

export default function FabricBulkImport() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [fabrics, setFabrics] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collapsedErrors, setCollapsedErrors] = useState(() => new Set());

  function toggleErrors(idx) {
    setCollapsedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function ensureCollections() {
    if (collectionsLoaded) return collections;
    const list = await fetchCollections();
    setCollections(list);
    setCollectionsLoaded(true);
    return list;
  }

  async function parseXlsxRows(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellHTML: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet?.["!ref"]) return [];
    const range = XLSX.utils.decode_range(sheet["!ref"]);

    const headers = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
      headers.push((cell?.w ?? cell?.v ?? "").toString().trim());
    }

    const rows = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const row = {};
      let hasValue = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const header = headers[c];
        if (!header) continue;
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const text = (cell?.w ?? cell?.v ?? "").toString();
        if (text) hasValue = true;
        row[header] = text;
        if (RICH_TEXT_COLUMNS.includes(header) && cell?.h) {
          row[`__${header}Html`] = cell.h;
        }
      }
      if (hasValue) rows.push(row);
    }
    return rows;
  }

  function finishParsedRows(rows, cols, existingCodes) {
    const parsed = parseRows(rows);
    const firstOccurrence = firstOccurrenceIndex(parsed);
    const withValidation = parsed.map((f, idx) => ({
      ...f,
      errors: validateFabric(f, idx, firstOccurrence, existingCodes),
      newCollections: newCollectionNames(f, cols),
      ktStatus: "unverified", // unverified | checking | registered | not_found
      importStatus: "pending", // pending | creating | done | failed
      importError: null,
    }));
    setFabrics(withValidation);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParseError(null);
    setFabrics([]);

    const [cols, existingFabrics] = await Promise.all([
      ensureCollections(),
      fetchGcFabrics(),
    ]);
    const existingCodes = new Set(
      existingFabrics.map((f) => f.fabricCode.toLowerCase()),
    );

    try {
      const rows = await parseXlsxRows(file);
      finishParsedRows(rows, cols, existingCodes);
    } catch (err) {
      setParseError(err.message);
    }

    // CSV parsing — disabled along with CSV upload/template, kept commented.
    // Papa.parse(file, {
    //   header: true,
    //   skipEmptyLines: true,
    //   complete: (results) => {
    //     if (results.errors?.length) {
    //       setParseError(results.errors[0].message);
    //       return;
    //     }
    //     finishParsedRows(results.data, cols, existingCodes);
    //   },
    //   error: (err) => setParseError(err.message),
    // });
  }

  async function verifyAllWithKt() {
    setVerifying(true);
    for (let i = 0; i < fabrics.length; i++) {
      setFabrics((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, ktStatus: "checking" } : f)),
      );
      let details = null;
      try {
        details = await fetchKtFabricDetails(fabrics[i].fabricCode);
      } catch {
        details = null;
      }
      setFabrics((prev) =>
        prev.map((f, idx) => {
          if (idx !== i) return f;
          const filled = details
            ? {
              fabricHouse: f.fabricHouse || details.fabricHouse || "",
              color: f.color || details.color || "",
              material: f.material || details.material || "",
              weight: f.weight || details.weight || "",
              ktImageUrl: f.ktImageUrl || details.imageUrl || null,
            }
            : {};
          return {
            ...f,
            ...filled,
            ktStatus: details ? "registered" : "not_found",
          };
        }),
      );
    }
    setVerifying(false);
  }

  async function importAll() {
    setImporting(true);
    let failedCount = 0;
    for (let i = 0; i < fabrics.length; i++) {
      const fabric = fabrics[i];
      if (fabric.errors.length || fabric.importStatus === "done") continue;

      // Fabrics not confirmed in KuteTailor can't go ACTIVE — same rule as
      // the single-fabric form's save-time gate.
      const status =
        fabric.ktStatus === "not_found" ? "DRAFT" : fabric.status;

      setFabrics((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, importStatus: "creating" } : f,
        ),
      );

      try {
        // Resolves names to IDs, creating any collection that doesn't yet
        // exist in Shopify (deduped across rows via the collections cache).
        const collectionIds = await resolveCollectionIdsByName(
          fabric.collectionNames,
        );

        const garmentSelections = {};
        for (const g of fabric.garments) {
          garmentSelections[g.type] = { price: g.price, quantity: g.qty };
        }
        const selectedTypes = fabric.garments.map((g) => g.type);

        const title =
          fabric.title ||
          [fabric.fabricHouse, fabric.fabricCode, fabric.color]
            .filter(Boolean)
            .join(" - ");

        // KT catalog matches carry a swatch image — same as the
        // single-fabric form, this becomes the gc_fabrics image field.
        const imageGid = fabric.ktImageUrl
          ? await createImageFromUrl(fabric.ktImageUrl)
          : null;

        const [designOptionsPool, separatesProducts] = await Promise.all([
          fetchDesignOptions(),
          fetchActiveProductsForSeparates(),
        ]);
        // fabric.descriptionHtml/shippingReturnsHtml only exist when Excel's
        // own per-character formatting produced rich runs. Cells without
        // that (including ones where someone typed literal <i>/<b> tags by
        // hand) fall back to the raw cell text — xlsxCellHtmlToShopifyRichText
        // still recognizes literal tags in plain text, unlike the HTML-escaped
        // version SheetJS reports as `.h` for those cells.
        const description = xlsxCellHtmlToShopifyRichText(
          fabric.descriptionHtml || fabric.description,
        );
        const shippingReturns = xlsxCellHtmlToShopifyRichText(
          fabric.shippingReturnsHtml || fabric.shippingReturns,
        );
        const designOptionIds = await resolveDesignOptionIds(
          fabric.designOptionTitles,
          designOptionsPool,
        );
        const fabricCareIds = await resolveDesignOptionIds(
          fabric.fabricCareTitles,
          designOptionsPool,
        );
        const separatesIds = resolveSeparatesIds(
          fabric.separatesSkus,
          separatesProducts,
        );

        await createFabricProductComplete({
          fabricId: null,
          fabricFields: {
            fabricCode: fabric.fabricCode,
            fabricHouse: fabric.fabricHouse,
            color: fabric.color,
            material: fabric.material,
            weight: fabric.weight,
            imageGid,
          },
          title,
          status,
          collectionIds,
          media: [],
          selectedTypes,
          garmentSelections,
          sku: fabric.fabricCode,
          description,
          designOptionIds,
          fabricCareIds,
          separatesIds,
          shippingReturns,
        });

        setFabrics((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, importStatus: "done", status } : f,
          ),
        );
      } catch (e) {
        setFabrics((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, importStatus: "failed", importError: e.message }
              : f,
          ),
        );
      }
    }
    clearFabricProductsV2Cache();
    clearGcFabricsCache();
    setImporting(false);
  }

  const validCount = fabrics.filter((f) => f.errors.length === 0).length;
  const doneCount = fabrics.filter((f) => f.importStatus === "done").length;
  const failedCount = fabrics.filter(
    (f) => f.importStatus === "failed",
  ).length;

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-[12px] mb-[24px] sm:mb-[30px]">
        <div>
          <h2 className="gc-page-title">Bulk Import Fabrics</h2>
          <p className="gc-page-subtitle">
            Upload a CSV to create many fabric products at once
          </p>
        </div>
        <Link
          to="/fabric"
          className="font-hanken text-[13px] font-medium text-gc-primary hover:text-gc-primary-dark"
        >
          Back to Fabric
        </Link>
      </div>

      <div className="bg-white rounded-[12px] border border-gc-divider p-[24px] flex flex-col gap-[20px]">
        <div className="flex flex-wrap items-center gap-[12px]">
          {/* CSV template button — disabled along with CSV upload, kept commented.
          <button
            type="button"
            onClick={downloadTemplate}
            className="font-hanken flex items-center gap-[6px] text-[13px] font-medium text-gc-primary hover:text-gc-primary-dark cursor-pointer"
          >
            <Download size={14} />
            Download CSV template
          </button>
          */}

          <button
            type="button"
            onClick={downloadXlsxTemplate}
            className="font-hanken flex items-center gap-[6px] text-[13px] font-medium text-gc-primary hover:text-gc-primary-dark cursor-pointer"
          >
            <Download size={14} />
            Download XLSX template
          </button>

          <label className="font-hanken flex items-center gap-[6px] bg-gc-primary text-white text-[13px] font-semibold px-[14px] py-[9px] rounded-lg hover:bg-gc-primary-dark transition-colors cursor-pointer">
            <Upload size={14} />
            Upload XLSX
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFile}
            />
          </label>

          {fabrics.length > 0 && (
            <button
              type="button"
              onClick={verifyAllWithKt}
              disabled={verifying || importing}
              className="font-hanken flex items-center gap-[6px] text-[13px] font-medium text-gc-primary hover:text-gc-primary-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {verifying && <Loader2 size={14} className="animate-spin" />}
              Verify all with KuteTailor
            </button>
          )}
        </div>

        {parseError && (
          <p className="font-hanken text-[13px] text-red-600">
            Failed to parse CSV: {parseError}
          </p>
        )}

        {fabrics.length > 0 && (
          <>
            <p className="font-hanken text-[13px] text-gc-muted">
              {fabrics.length} fabric{fabrics.length !== 1 ? "s" : ""} parsed
              &middot; {validCount} ready to import
              {doneCount > 0 && ` · ${doneCount} created`}
              {failedCount > 0 && ` · ${failedCount} failed`}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gc-bg-warm">
                    {[
                      "Title",
                      "Code",
                      "House",
                      "Color",
                      "Garments",
                      "Collections",
                      "Description",
                      "Design Options",
                      "Fabric & Care",
                      "Separates",
                      "Shipping & Returns",
                      "Status",
                      "KuteTailor",
                      "Import",
                    ].map((h) => (
                      <th
                        key={h}
                        className="font-hanken text-[11px] font-semibold text-gc-text uppercase tracking-wide px-[10px] py-[8px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fabrics.map((f, idx) => (
                    <Fragment key={idx}>
                      <tr className="border-t border-gc-divider">
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.title || (
                            <span className="text-gc-muted italic">
                              auto-generated
                            </span>
                          )}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.fabricCode}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.fabricHouse}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.color}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.garments.map((g) => g.type).join(", ")}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.collectionNames.length === 0
                            ? "—"
                            : f.collectionNames.map((name, i) => {
                              const isNew = f.newCollections?.some(
                                (n) => n.toLowerCase() === name.toLowerCase(),
                              );
                              return (
                                <Fragment key={name}>
                                  {i > 0 && ", "}
                                  <span
                                    className={
                                      isNew ? "text-gc-primary" : undefined
                                    }
                                    title={
                                      isNew
                                        ? "Will be created in Shopify on import"
                                        : undefined
                                    }
                                  >
                                    {name}
                                    {isNew && " (new)"}
                                  </span>
                                </Fragment>
                              );
                            })}
                        </td>
                        <td
                          className="font-hanken text-[13px] px-[10px] py-[8px] max-w-[200px] truncate"
                          title={f.description}
                        >
                          {f.description || "—"}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.designOptionTitles.length
                            ? f.designOptionTitles.join(", ")
                            : "—"}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.fabricCareTitles.length
                            ? f.fabricCareTitles.join(", ")
                            : "—"}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.separatesSkus.length
                            ? f.separatesSkus.join(", ")
                            : "—"}
                        </td>
                        <td
                          className="font-hanken text-[13px] px-[10px] py-[8px] max-w-[200px] truncate"
                          title={f.shippingReturns}
                        >
                          {f.shippingReturns || "—"}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.ktStatus === "not_found"
                            ? "DRAFT (forced)"
                            : f.status}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.ktStatus === "unverified" && "—"}
                          {f.ktStatus === "checking" && (
                            <Loader2 size={14} className="animate-spin" />
                          )}
                          {f.ktStatus === "registered" && (
                            <CheckCircle2
                              size={14}
                              className="text-emerald-600"
                            />
                          )}
                          {f.ktStatus === "not_found" && (
                            <span
                              className="flex items-center gap-[4px] text-amber-600"
                              title="Not in KuteTailor — will import as Draft"
                            >
                              <AlertTriangle size={14} />
                            </span>
                          )}
                        </td>
                        <td className="font-hanken text-[13px] px-[10px] py-[8px]">
                          {f.errors.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleErrors(idx)}
                              className="flex items-center gap-[4px] text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              <XCircle size={14} />
                              {f.errors.length} error
                              {f.errors.length !== 1 ? "s" : ""}
                              {collapsedErrors.has(idx) ? (
                                <ChevronRight size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </button>
                          ) : f.importStatus === "creating" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : f.importStatus === "done" ? (
                            <span className="flex items-center gap-[4px] text-emerald-600">
                              <CheckCircle2 size={14} />
                              Created
                            </span>
                          ) : f.importStatus === "failed" ? (
                            <span
                              className="flex items-center gap-[4px] text-red-600"
                              title={f.importError}
                            >
                              <XCircle size={14} />
                              Failed
                            </span>
                          ) : (
                            "Pending"
                          )}
                        </td>
                      </tr>
                      {((f.errors.length > 0 && !collapsedErrors.has(idx)) ||
                        f.ktStatus === "not_found" ||
                        f.importStatus === "failed") && (
                          <tr className="bg-red-50/60">
                            <td
                              colSpan={14}
                              className="px-[10px] pb-[10px] pt-0 space-y-[6px]"
                            >
                              {f.importStatus === "failed" && f.importError && (
                                <p className="font-hanken text-[12px] text-red-700 flex items-start gap-[6px] pl-[6px]">
                                  <XCircle size={13} className="mt-[1px] shrink-0" />
                                  <span>Import failed: {f.importError}</span>
                                </p>
                              )}
                              {f.ktStatus === "not_found" && (
                                <p className="font-hanken text-[12px] text-amber-700 flex items-start gap-[6px] pl-[6px]">
                                  <AlertTriangle
                                    size={13}
                                    className="mt-[1px] shrink-0"
                                  />
                                  <span>
                                    fabric_code &ldquo;{f.fabricCode}&rdquo; not
                                    found in KuteTailor — it will be imported as
                                    DRAFT (only KuteTailor-registered fabrics can go
                                    ACTIVE).
                                  </span>
                                </p>
                              )}
                              {f.errors.length > 0 &&
                                !collapsedErrors.has(idx) && (
                                  <ul className="font-hanken text-[12px] text-red-700 list-disc pl-[28px] space-y-[2px]">
                                    {f.errors.map((err, i) => (
                                      <li key={i}>{err}</li>
                                    ))}
                                  </ul>
                                )}
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <button
                type="button"
                onClick={importAll}
                disabled={importing || verifying || validCount === 0}
                className="font-hanken flex items-center gap-[8px] h-[44px] px-[20px] rounded-[8px] text-white text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-gc-primary"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                Import {validCount} Fabric{validCount !== 1 ? "s" : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

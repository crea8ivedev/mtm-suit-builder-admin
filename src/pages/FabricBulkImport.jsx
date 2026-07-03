import { useState, Fragment } from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
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
  createFabricProductComplete,
  clearFabricProductsV2Cache,
  clearGcFabricsCache,
  GARMENT_TYPES,
} from "../lib/shopify";
import { fetchKtFabricDetails } from "../lib/kutetailor";

const FIXED_COLUMNS = [
  "title",
  "fabric_code",
  "fabric_house",
  "color",
  "material",
  "weight",
  "status",
  "collections",
];

const TEMPLATE_CSV = Papa.unparse({
  fields: [
    ...FIXED_COLUMNS,
    ...GARMENT_TYPES.flatMap((t) => [`${t} Price`, `${t} Qty`]),
  ],
  data: [
    [
      "Dormeuil - DAQ1865 Blue",
      "DAQ1865",
      "Dormeuil",
      "Blue",
      "55% Wool 45% Silk",
      "240g/m",
      "ACTIVE",
      "Custom Suits,Zegna",
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
    ],
  ],
});

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fabric_bulk_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseRows(rows) {
  return rows
    .filter((row) => (row.fabric_code || "").trim())
    .map((row) => {
      const garments = GARMENT_TYPES.map((type) => ({
        type,
        price: (row[`${type} Price`] || "").trim(),
        qty: (row[`${type} Qty`] || "").trim(),
      })).filter((g) => g.price !== "" || g.qty !== "");
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
        garments,
      };
    });
}

// Spreadsheet apps auto-format codes like "DKK0114" as a currency amount
// (DKK is a real ISO code) and drop the leading zero — "DKK 114.00" ends up
// in the CSV instead of the real code. Catch that shape before it's imported.
const CURRENCY_MANGLED_CODE = /^[A-Za-z]{3}\s?\d+\.\d{2}$/;

function validateFabric(fabric, collections) {
  const errors = [];
  if (!fabric.fabricHouse) errors.push("missing fabric_house");
  if (CURRENCY_MANGLED_CODE.test(fabric.fabricCode)) {
    errors.push(
      `fabric_code "${fabric.fabricCode}" looks auto-formatted as currency by the spreadsheet (leading zero likely dropped) — set that column to Plain Text and re-enter the code`,
    );
  }
  if (!["ACTIVE", "DRAFT"].includes(fabric.status)) {
    errors.push(`status must be ACTIVE or DRAFT (got "${fabric.status}")`);
  }
  if (fabric.garments.length === 0) {
    errors.push("no valid garment_type rows");
  } else {
    for (const g of fabric.garments) {
      if (g.price === "" || g.qty === "") {
        errors.push(`${g.type}: price/qty required`);
      }
    }
  }
  const unmatchedCollections = fabric.collectionNames.filter(
    (name) =>
      !collections.some((c) => c.title.toLowerCase() === name.toLowerCase()),
  );
  if (unmatchedCollections.length) {
    errors.push(`unknown collection(s): ${unmatchedCollections.join(", ")}`);
  }
  return errors;
}

export default function FabricBulkImport() {
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

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParseError(null);
    setFabrics([]);

    const cols = await ensureCollections();

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors?.length) {
          setParseError(results.errors[0].message);
          return;
        }
        const parsed = parseRows(results.data);
        const withValidation = parsed.map((f) => ({
          ...f,
          errors: validateFabric(f, cols),
          ktStatus: "unverified", // unverified | checking | registered | not_found
          importStatus: "pending", // pending | creating | done | failed
          importError: null,
        }));
        setFabrics(withValidation);
      },
      error: (err) => setParseError(err.message),
    });
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
        const collectionIds = fabric.collectionNames
          .map(
            (name) =>
              collections.find(
                (c) => c.title.toLowerCase() === name.toLowerCase(),
              )?.id,
          )
          .filter(Boolean);

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

        await createFabricProductComplete({
          fabricId: null,
          fabricFields: {
            fabricCode: fabric.fabricCode,
            fabricHouse: fabric.fabricHouse,
            color: fabric.color,
            material: fabric.material,
            weight: fabric.weight,
            imageGid: null,
          },
          title,
          status,
          collectionIds,
          media: [],
          selectedTypes,
          garmentSelections,
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
          <button
            type="button"
            onClick={downloadTemplate}
            className="font-hanken flex items-center gap-[6px] text-[13px] font-medium text-gc-primary hover:text-gc-primary-dark cursor-pointer"
          >
            <Download size={14} />
            Download CSV template
          </button>

          <label className="font-hanken flex items-center gap-[6px] bg-gc-primary text-white text-[13px] font-semibold px-[14px] py-[9px] rounded-lg hover:bg-gc-primary-dark transition-colors cursor-pointer">
            <Upload size={14} />
            Upload CSV
            <input
              type="file"
              accept=".csv"
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
                        {f.collectionNames.join(", ") || "—"}
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
                      f.ktStatus === "not_found") && (
                      <tr className="bg-red-50/60">
                        <td
                          colSpan={9}
                          className="px-[10px] pb-[10px] pt-0 space-y-[6px]"
                        >
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

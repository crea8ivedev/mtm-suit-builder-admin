import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  ChevronRight,
  Save,
  ChevronDown,
  Plus,
  X,
  Pencil,
  Trash2,
  Eye,
  ExternalLink,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  fetchStyleOptions,
  updateStyleOptionVisible,
  clearStyleOptionsCache,
  syncStyleOptionImageUrls,
  createStyleOption,
  updateStyleOption,
  deleteStyleOption,
  fetchShopAdminDomain,
  uploadImageToShopify,
  GARMENT_TO_STYLE_TYPE,
  fetchStyleOptionFieldDefs,
} from "../lib/shopify";
import LoadingState from "../components/ui/LoadingState";

// Known hardcoded field keys — never rendered as "extra"
const KNOWN_KEYS = new Set([
  "label",
  "category",
  "display_label",
  "is_default",
  "upcharge",
  "visible",
  "sort_order",
  "conditional_hide",
  "kutetailer_code",
  "image",
  "image_url",
]);

function normalizeCategory(val) {
  return val.trim().toLowerCase().replace(/\s+/g, "_");
}

// Convert a field key like "my_field" → "My Field" for display
function keyToLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Infer Shopify type name from a stored value (used when defs haven't loaded yet)
function inferTypeName(value) {
  if (value == null || value === "") return null;
  const s = String(value);
  if (
    /^gid:\/\/shopify\/(MediaImage|GenericFile|Video|ExternalVideo|Model3d|File)\//.test(
      s,
    )
  )
    return "file_reference";
  if (s === "true" || s === "false") return "boolean";
  if (/^\d+$/.test(s)) return "number_integer";
  if (/^\d+\.\d+$/.test(s)) return "number_decimal";
  return null;
}

// Returns a Map<key, bestValue> of extra fields across all options (picks first non-null value)
function extraKVFromOptions(options) {
  const map = new Map();
  for (const opt of options) {
    for (const [k, v] of Object.entries(opt.rawFields ?? {})) {
      if (KNOWN_KEYS.has(k)) continue;
      if (!map.has(k)) map.set(k, v ?? null);
      else if (
        v != null &&
        v !== "" &&
        (map.get(k) == null || map.get(k) === "")
      )
        map.set(k, v);
    }
  }
  return map;
}

// Build a field def. Uses exact Shopify type string when available,
// falls back to value inference, then defaults to text.
function stubDef(key, value, shopifyTypeName) {
  const typeName =
    shopifyTypeName || inferTypeName(value) || "single_line_text_field";
  return { key, name: keyToLabel(key), type: { name: typeName } };
}

function inputTypeFor(rawTypeName) {
  if (!rawTypeName) return "text";
  const t = rawTypeName.toLowerCase().trim();

  // Numbers
  if (t === "number_integer" || t === "integer" || t === "int") return "number";
  if (
    t === "number_decimal" ||
    t === "decimal" ||
    t === "float" ||
    t === "double"
  )
    return "number";
  // rating / money / dimension / weight / volume — numeric-ish stored as JSON
  if (["rating", "money", "dimension", "weight", "volume"].includes(t))
    return "textarea";

  // Boolean
  if (t === "boolean" || t === "bool") return "checkbox";

  // File / image — all Shopify variants
  if (
    t === "file_reference" ||
    t === "file" ||
    t === "media_image" ||
    t === "image" ||
    t === "list.file_reference" ||
    (t.includes("file") && t.includes("reference"))
  )
    return "file";

  // Multi-line text / JSON / rich text
  if (
    t === "multi_line_text_field" ||
    t === "multi_line_text" ||
    t === "json" ||
    t === "rich_text_field" ||
    t === "rich_text"
  )
    return "textarea";

  // URL
  if (t === "url" || t === "link") return "url";

  // Color
  if (t === "color" || t === "colour") return "color";

  // Date
  if (t === "date") return "date";

  // Date + time
  if (t === "date_time" || t === "datetime" || t === "date_and_time")
    return "datetime-local";

  // References (product, page, metaobject, etc.) — show GID as read-only text
  if (t.endsWith("_reference") || t === "mixed_reference") return "text";

  // List of text — textarea for comma-separated
  if (t.startsWith("list.")) return "textarea";

  // Default — single_line_text_field and anything else
  return "text";
}

// ─── Image Picker ──────────────────────────────────────────────────────────
function ImagePicker({ currentUrl, gid, onUploaded, onUploadChange }) {
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const inputRef = useRef(null);

  const displayUrl = localPreview || currentUrl;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploadError(null);
    setUploading(true);
    onUploadChange?.(true);
    try {
      const { gid: newGid, cdnUrl } = await uploadImageToShopify(file);
      onUploaded(newGid, cdnUrl || objectUrl);
      setLocalPreview(cdnUrl || objectUrl);
    } catch (err) {
      setUploadError(err.message);
      setLocalPreview(null);
    } finally {
      setUploading(false);
      onUploadChange?.(false);
    }
  }

  return (
    <div className="flex items-center gap-[12px]">
      <div
        className="flex-shrink-0 rounded-[6px] overflow-hidden flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          border: "1px solid #dac1ba",
          background: "#f7f3ee",
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              background: "#dac1ba",
              borderRadius: 4,
            }}
          />
        )}
      </div>
      <div className="flex flex-col gap-[4px]">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="font-hanken font-semibold text-[12px] h-[32px] px-[12px] rounded-[6px] cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ border: "1px solid #dac1ba", color: "#7c3820" }}
        >
          {uploading ? "Uploading…" : gid ? "Change Image" : "Select Image"}
        </button>
        {gid && !uploading && (
          <span
            className="font-hanken text-[10px] truncate"
            style={{ color: "#9a8f89", maxWidth: 200 }}
          >
            {gid.split("/").pop()}
          </span>
        )}
        {uploadError && (
          <span
            className="font-hanken text-[11px]"
            style={{ color: "#dc2626" }}
          >
            {uploadError}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ─── Add Style Option Modal ────────────────────────────────────────────────
function AddStyleOptionModal({ garment, garmentOptions, onClose, onCreated }) {
  // Detect extra fields immediately from existing options — no async wait
  const [extraFields, setExtraFields] = useState(() => {
    const kv = extraKVFromOptions(garmentOptions);
    return [...kv.entries()].map(([k, v]) => {
      // fieldTypes comes directly from Shopify's data query — most reliable source
      const shopifyType = garmentOptions
        .map((o) => o.fieldTypes?.[k])
        .find((t) => t != null);
      return stubDef(k, v, shopifyType);
    });
  });
  const [form, setForm] = useState(() => {
    const extraDefaults = Object.fromEntries(
      [...extraKVFromOptions(garmentOptions).keys()].map((k) => [k, ""]),
    );
    return {
      label: "",
      category: "",
      display_label: "",
      is_default: "false",
      upcharge: "",
      sort_order: "",
      conditional_hide: "",
      kutetailer_code: "",
      image: "",
      image_url: "",
      ...extraDefaults,
    };
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const garmentType = GARMENT_TO_STYLE_TYPE[garment];

  // Fallback: re-fetch defs to catch any field added since page load
  useEffect(() => {
    if (!garmentType) return;
    fetchStyleOptionFieldDefs(garmentType)
      .then((defs) => {
        const extras = defs.filter((d) => !KNOWN_KEYS.has(d.key));
        const defsMap = new Map(
          extras.map((d) => [
            d.key,
            { ...d, type: { name: (d.type?.name ?? "").toLowerCase().trim() } },
          ]),
        );
        setExtraFields((prev) => {
          const prevKeys = new Set(prev.map((d) => d.key));
          const merged = prev.map((d) => defsMap.get(d.key) ?? d);
          for (const d of extras) {
            if (!prevKeys.has(d.key)) merged.push(defsMap.get(d.key));
          }
          return merged;
        });
        setForm((prev) => {
          const patch = {};
          for (const d of extras) {
            if (!(d.key in prev))
              patch[d.key] =
                inputTypeFor(d.type?.name) === "checkbox" ? "false" : "";
          }
          return Object.keys(patch).length ? { ...prev, ...patch } : prev;
        });
      })
      .catch((err) => console.warn("[StyleOptions] defs fetch failed:", err));
  }, [garmentType]);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.label.trim()) {
      setError("Label is required.");
      return;
    }
    if (!form.category.trim()) {
      setError("Category is required.");
      return;
    }
    if (!form.display_label.trim()) {
      setError("Display Label is required.");
      return;
    }
    if (!garmentType) {
      setError("Unknown garment type.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const cat = normalizeCategory(form.category);
      const existingCatOpt = garmentOptions.find((o) => o.category === cat);
      const computedSortOrder = existingCatOpt
        ? existingCatOpt.sortOrder
        : garmentOptions.reduce((max, o) => Math.max(max, o.sortOrder), 0) + 1;
      const payload = {
        ...form,
        visible: "true",
        sort_order: String(form.sort_order || computedSortOrder),
      };
      const node = await createStyleOption(garmentType, payload);
      onCreated(node, garment, {
        ...form,
        sort_order: String(computedSortOrder),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full h-[38px] rounded-[6px] px-[10px] font-hanken text-[13px] outline-none focus:border-[#a45d41]";
  const inputStyle = { border: "1px solid #dac1ba", color: "#1c1c19" };
  const labelCls =
    "font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[4px] block";
  const labelStyle = { color: "#7c3820" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-white rounded-[12px] w-full mx-[16px] overflow-y-auto"
        style={{
          maxWidth: 520,
          maxHeight: "90vh",
          border: "1px solid #dac1ba",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-[20px] py-[16px] flex-shrink-0"
          style={{ borderBottom: "1px solid #dac1ba" }}
        >
          <h2
            className="font-garamond font-bold text-[22px]"
            style={{ color: "#3c3c3c" }}
          >
            Add {garment} Option
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80"
            style={{ width: 30, height: 30, background: "#f1ede8" }}
          >
            <X size={14} style={{ color: "#7c3820" }} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-[20px] py-[16px] flex flex-col gap-[12px]"
        >
          {/* Label */}
          <div>
            <label className={labelCls} style={labelStyle}>
              Label <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              className={inputCls}
              style={inputStyle}
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="e.g. Half Canvas"
            />
          </div>

          {/* Category + Display Label */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls} style={labelStyle}>
                Category <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                onBlur={(e) =>
                  set("category", normalizeCategory(e.target.value))
                }
                placeholder="e.g. canvas or lining style"
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                Display Label <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.display_label}
                onChange={(e) => set("display_label", e.target.value)}
                placeholder="e.g. Canvas"
              />
            </div>
          </div>

          {/* Upcharge + Sort Order */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls} style={labelStyle}>
                Upcharge ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                style={inputStyle}
                value={form.upcharge}
                onChange={(e) => set("upcharge", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                Sort Order
              </label>
              <input
                type="number"
                min="0"
                className={inputCls}
                style={inputStyle}
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
            </div>
          </div>

          {/* Kutetailor Code + Conditional Hide */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls} style={labelStyle}>
                Kutetailor Code
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.kutetailer_code}
                onChange={(e) => set("kutetailer_code", e.target.value)}
                placeholder="e.g. 000B"
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                Conditional Hide
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.conditional_hide}
                onChange={(e) => set("conditional_hide", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className={labelCls} style={labelStyle}>
              Image
            </label>
            <ImagePicker
              currentUrl={form.image_url || null}
              gid={form.image}
              onUploaded={(gid, cdnUrl) => {
                set("image", gid);
                set("image_url", cdnUrl);
              }}
              onUploadChange={setImageUploading}
            />
          </div>

          {/* Extra inline fields (text / number / url / color / date) — 2-col grid */}
          {extraFields
            .filter((d) => {
              const t = inputTypeFor(d.type?.name);
              return t !== "checkbox" && t !== "file" && t !== "textarea";
            })
            .reduce((rows, d, i) => {
              if (i % 2 === 0) rows.push([d]);
              else rows[rows.length - 1].push(d);
              return rows;
            }, [])
            .map((row, ri) => (
              <div
                key={ri}
                className={
                  row.length === 2 ? "grid grid-cols-2 gap-[10px]" : ""
                }
              >
                {row.map((def) => {
                  const t = inputTypeFor(def.type?.name);
                  return (
                    <div key={def.key}>
                      <label className={labelCls} style={labelStyle}>
                        {def.name}
                      </label>
                      <input
                        type={t}
                        step={
                          def.type?.name === "number_decimal"
                            ? "0.01"
                            : undefined
                        }
                        className={inputCls}
                        style={inputStyle}
                        value={form[def.key] ?? ""}
                        onChange={(e) => set(def.key, e.target.value)}
                        placeholder={def.name}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

          {/* Extra textarea fields (multi_line_text_field / json) — full-width */}
          {extraFields
            .filter((d) => inputTypeFor(d.type?.name) === "textarea")
            .map((def) => (
              <div key={def.key}>
                <label className={labelCls} style={labelStyle}>
                  {def.name}
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-[6px] px-[10px] py-[8px] font-hanken text-[13px] outline-none focus:border-[#a45d41] resize-y"
                  style={{ border: "1px solid #dac1ba", color: "#1c1c19" }}
                  value={form[def.key] ?? ""}
                  onChange={(e) => set(def.key, e.target.value)}
                  placeholder={def.name}
                />
              </div>
            ))}

          {/* Extra file_reference fields */}
          {extraFields
            .filter((d) => inputTypeFor(d.type?.name) === "file")
            .map((def) => (
              <div key={def.key}>
                <label className={labelCls} style={labelStyle}>
                  {def.name}
                </label>
                <ImagePicker
                  currentUrl={form[`${def.key}_url`] || null}
                  gid={form[def.key] ?? ""}
                  onUploaded={(gid, cdnUrl) => {
                    set(def.key, gid);
                    set(`${def.key}_url`, cdnUrl);
                  }}
                  onUploadChange={setImageUploading}
                />
              </div>
            ))}

          {/* Visible (locked) + Is Default + extra boolean fields */}
          <div className="flex flex-wrap items-center gap-x-[24px] gap-y-[8px] pt-[4px]">
            <label className="flex items-center gap-[8px]">
              <input
                type="checkbox"
                checked
                disabled
                readOnly
                className="w-[15px] h-[15px]"
                style={{ accentColor: "#a45d41", opacity: 1 }}
              />
              <span
                className="font-hanken font-semibold text-[12px]"
                style={{ color: "#3c3c3c" }}
              >
                Visible
              </span>
            </label>
            <label className="flex items-center gap-[8px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default === "true"}
                onChange={(e) =>
                  set("is_default", e.target.checked ? "true" : "false")
                }
                className="w-[15px] h-[15px] cursor-pointer"
                style={{ accentColor: "#a45d41" }}
              />
              <span
                className="font-hanken font-semibold text-[12px]"
                style={{ color: "#3c3c3c" }}
              >
                Is Default
              </span>
            </label>
            {extraFields
              .filter((d) => inputTypeFor(d.type?.name) === "checkbox")
              .map((def) => (
                <label
                  key={def.key}
                  className="flex items-center gap-[8px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form[def.key] === "true"}
                    onChange={(e) =>
                      set(def.key, e.target.checked ? "true" : "false")
                    }
                    className="w-[15px] h-[15px] cursor-pointer"
                    style={{ accentColor: "#a45d41" }}
                  />
                  <span
                    className="font-hanken font-semibold text-[12px]"
                    style={{ color: "#3c3c3c" }}
                  >
                    {def.name}
                  </span>
                </label>
              ))}
          </div>

          <p
            className="font-hanken text-[12px] h-[16px]"
            style={{ color: "#dc2626" }}
          >
            {error || ""}
          </p>

          {/* Actions */}
          <div
            className="flex items-center justify-end gap-[8px] pt-[8px]"
            style={{ borderTop: "1px solid #dac1ba" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="font-hanken font-semibold text-[13px] h-[38px] px-[16px] rounded-[8px] cursor-pointer hover:opacity-80"
              style={{ border: "1px solid #dac1ba", color: "#7c3820" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || imageUploading}
              className="font-hanken font-semibold text-[13px] text-white h-[38px] px-[20px] rounded-[8px] cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#a45d41" }}
            >
              {saving
                ? "Creating…"
                : imageUploading
                  ? "Uploading image…"
                  : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── View Style Option Modal ───────────────────────────────────────────────
function ViewStyleOptionModal({ option, garment, onClose, onEdit }) {
  const rows = [
    { label: "Label", value: option.label },
    { label: "Category", value: option.category },
    { label: "Display Label", value: option.displayLabel },
    {
      label: "Upcharge",
      value: option.upcharge != null ? `$${option.upcharge}` : "—",
    },
    { label: "Sort Order", value: option.sortOrder ?? "—" },
    { label: "Kutetailor Code", value: option.kutetailerCode || "—" },
    { label: "Conditional Hide", value: option.conditionalHide || "—" },
  ];

  // Extra raw fields not in the known set
  const extraRows = Object.entries(option.rawFields ?? {})
    .filter(([k]) => !KNOWN_KEYS.has(k))
    .map(([k, v]) => ({
      label: keyToLabel(k),
      value: v != null && v !== "" ? String(v) : "—",
    }));

  const labelCls = "font-hanken font-semibold text-[11px] tracking-[0.4px]";
  const valCls = "font-hanken text-[13px]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-white rounded-[12px] w-full mx-[16px] overflow-y-auto"
        style={{
          maxWidth: 480,
          maxHeight: "90vh",
          border: "1px solid #dac1ba",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-[20px] py-[16px] flex-shrink-0"
          style={{ borderBottom: "1px solid #dac1ba" }}
        >
          <div>
            <p
              className="font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[2px]"
              style={{ color: "#a45d41" }}
            >
              {garment} · {option.category}
            </p>
            <h2
              className="font-garamond font-bold text-[22px]"
              style={{ color: "#3c3c3c" }}
            >
              {option.label}
            </h2>
          </div>
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(option);
              }}
              className="flex items-center gap-[5px] font-hanken font-semibold text-[12px] h-[30px] px-[10px] rounded-[6px] cursor-pointer hover:opacity-80"
              style={{ border: "1px solid #dac1ba", color: "#7c3820" }}
            >
              <Pencil size={11} />
              Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80"
              style={{ width: 30, height: 30, background: "#f1ede8" }}
            >
              <X size={14} style={{ color: "#7c3820" }} />
            </button>
          </div>
        </div>

        <div className="px-[20px] py-[16px] flex flex-col gap-[12px]">
          {/* Image */}
          {option.imageUrl && (
            <div className="flex justify-center pb-[4px]">
              <img
                src={option.imageUrl}
                alt={option.label}
                className="rounded-[8px] object-cover"
                style={{ width: 80, height: 80, border: "1px solid #dac1ba" }}
              />
            </div>
          )}

          {/* Status badges */}
          <div className="flex flex-wrap gap-[8px]">
            <span
              className="font-hanken font-semibold text-[11px] px-[10px] py-[4px] rounded-full"
              style={{
                background: option.visible ? "#dcfce7" : "#f1ede8",
                color: option.visible ? "#166534" : "#7c3820",
              }}
            >
              {option.visible ? "Visible" : "Hidden"}
            </span>
            {option.isDefault && (
              <span
                className="font-hanken font-semibold text-[11px] px-[10px] py-[4px] rounded-full"
                style={{ background: "#fef9c3", color: "#854d0e" }}
              >
                Default
              </span>
            )}
          </div>

          {/* Fields grid */}
          <div
            className="rounded-[8px] overflow-hidden"
            style={{ border: "1px solid #dac1ba" }}
          >
            {[...rows, ...extraRows].map(({ label, value }, i) => (
              <div
                key={label}
                className="grid grid-cols-2 gap-[12px] px-[14px] py-[10px]"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid #f1ede8",
                  background: i % 2 === 0 ? "#fff" : "#fdf9f6",
                }}
              >
                <span className={labelCls} style={{ color: "#7c3820" }}>
                  {label}
                </span>
                <span className={valCls} style={{ color: "#1c1c19" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Style Option Modal ───────────────────────────────────────────────
function EditStyleOptionModal({ option, garment, onClose, onUpdated }) {
  // Derive extra keys from rawFields immediately — visible before any async call
  const rawExtra = Object.keys(option.rawFields ?? {}).filter(
    (k) => !KNOWN_KEYS.has(k),
  );

  const [extraFields, setExtraFields] = useState(() =>
    rawExtra.map((k) =>
      stubDef(k, option.rawFields[k], option.fieldTypes?.[k]),
    ),
  );
  const [form, setForm] = useState(() => {
    const extraValues = Object.fromEntries(
      rawExtra.map((k) => [
        k,
        option.rawFields[k] != null && option.rawFields[k] !== ""
          ? String(option.rawFields[k])
          : "",
      ]),
    );
    return {
      label: option.label || "",
      category: option.category || "",
      display_label: option.displayLabel || "",
      is_default: option.isDefault ? "true" : "false",
      upcharge: option.upcharge ? String(option.upcharge) : "",
      sort_order: option.sortOrder ? String(option.sortOrder) : "",
      conditional_hide: option.conditionalHide || "",
      kutetailer_code: option.kutetailerCode || "",
      visible: option.visible ? "true" : "false",
      image: option.imageGid || "",
      image_url: option.imageUrlStored || "",
      ...extraValues,
    };
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [shopifyUrl, setShopifyUrl] = useState(null);
  const garmentType = GARMENT_TO_STYLE_TYPE[garment];

  // Fallback: re-fetch defs to catch any field added since page load
  useEffect(() => {
    if (!garmentType) return;
    fetchStyleOptionFieldDefs(garmentType)
      .then((defs) => {
        const extras = defs.filter((d) => !KNOWN_KEYS.has(d.key));
        const defsMap = new Map(
          extras.map((d) => [
            d.key,
            { ...d, type: { name: (d.type?.name ?? "").toLowerCase().trim() } },
          ]),
        );
        setExtraFields((prev) => {
          const prevKeys = new Set(prev.map((d) => d.key));
          const merged = prev.map((d) => defsMap.get(d.key) ?? d);
          for (const d of extras) {
            if (!prevKeys.has(d.key)) merged.push(defsMap.get(d.key));
          }
          return merged;
        });
        setForm((prev) => {
          const patch = {};
          for (const d of extras) {
            if (d.key in prev) continue;
            patch[d.key] =
              inputTypeFor(d.type?.name) === "checkbox" ? "false" : "";
          }
          return Object.keys(patch).length ? { ...prev, ...patch } : prev;
        });
      })
      .catch((err) => console.warn("[StyleOptions] defs fetch failed:", err));
  }, [garmentType]);

  useEffect(() => {
    fetchShopAdminDomain()
      .then((domain) => {
        const storeHandle = domain.replace(".myshopify.com", "");
        const numericId = option.id.split("/").pop();
        setShopifyUrl(
          `https://admin.shopify.com/store/${storeHandle}/content/metaobjects/entries/${garmentType}/${numericId}`,
        );
      })
      .catch(() => {});
  }, [option.id, garmentType]);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.label.trim()) {
      setError("Label is required.");
      return;
    }
    if (!form.category.trim()) {
      setError("Category is required.");
      return;
    }
    if (!form.display_label.trim()) {
      setError("Display Label is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateStyleOption(option.id, form);
      const resolvedImageUrl =
        form.image_url ||
        (form.kutetailer_code
          ? `https://aws-static-webp.kutetailor.com/comm/process/craft/${form.kutetailer_code}.jpeg`
          : null);
      onUpdated(option.id, {
        label: form.label.trim(),
        category: normalizeCategory(form.category),
        displayLabel: form.display_label.trim(),
        isDefault: form.is_default === "true",
        upcharge: parseFloat(form.upcharge || 0),
        sortOrder: parseInt(form.sort_order || "0", 10),
        conditionalHide: form.conditional_hide,
        kutetailerCode: form.kutetailer_code || null,
        visible: form.visible === "true",
        imageGid: form.image || null,
        imageUrlStored: form.image_url || null,
        imageUrl: resolvedImageUrl,
      });
      clearStyleOptionsCache();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full h-[38px] rounded-[6px] px-[10px] font-hanken text-[13px] outline-none focus:border-[#a45d41]";
  const inputStyle = { border: "1px solid #dac1ba", color: "#1c1c19" };
  const labelCls =
    "font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[4px] block";
  const labelStyle = { color: "#7c3820" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-white rounded-[12px] w-full mx-[16px] overflow-y-auto"
        style={{
          maxWidth: 520,
          maxHeight: "90vh",
          border: "1px solid #dac1ba",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-[20px] py-[16px] flex-shrink-0"
          style={{ borderBottom: "1px solid #dac1ba" }}
        >
          <h2
            className="font-garamond font-bold text-[22px]"
            style={{ color: "#3c3c3c" }}
          >
            Edit {garment} Option
          </h2>
          <div className="flex items-center gap-[8px]">
            {shopifyUrl && (
              <a
                href={shopifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-[5px] font-hanken font-semibold text-[12px] h-[30px] px-[10px] rounded-[6px] cursor-pointer hover:opacity-80"
                style={{ border: "1px solid #dac1ba", color: "#7c3820" }}
              >
                <ExternalLink size={11} />
                Open in Shopify
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80"
              style={{ width: 30, height: 30, background: "#f1ede8" }}
            >
              <X size={14} style={{ color: "#7c3820" }} />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-[20px] py-[16px] flex flex-col gap-[12px]"
        >
          {/* Label */}
          <div>
            <label className={labelCls} style={labelStyle}>
              Label <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              className={inputCls}
              style={inputStyle}
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
            />
          </div>

          {/* Category + Display Label */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls} style={labelStyle}>
                Category <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                onBlur={(e) =>
                  set("category", normalizeCategory(e.target.value))
                }
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                Display Label <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.display_label}
                onChange={(e) => set("display_label", e.target.value)}
              />
            </div>
          </div>

          {/* Upcharge + Sort Order */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls} style={labelStyle}>
                Upcharge ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                style={inputStyle}
                value={form.upcharge}
                onChange={(e) => set("upcharge", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                Sort Order
              </label>
              <input
                type="number"
                min="0"
                className={inputCls}
                style={inputStyle}
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
            </div>
          </div>

          {/* Kutetailor Code + Conditional Hide */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls} style={labelStyle}>
                Kutetailor Code
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.kutetailer_code}
                onChange={(e) => set("kutetailer_code", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                Conditional Hide
              </label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.conditional_hide}
                onChange={(e) => set("conditional_hide", e.target.value)}
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className={labelCls} style={labelStyle}>
              Image
            </label>
            <ImagePicker
              currentUrl={form.image_url || option.imageUrl || null}
              gid={form.image}
              onUploaded={(gid, cdnUrl) => {
                set("image", gid);
                set("image_url", cdnUrl);
              }}
              onUploadChange={setImageUploading}
            />
          </div>

          {/* Extra inline fields (text / number / url / color / date) — 2-col grid */}
          {extraFields
            .filter((d) => {
              const t = inputTypeFor(d.type?.name);
              return t !== "checkbox" && t !== "file" && t !== "textarea";
            })
            .reduce((rows, d, i) => {
              if (i % 2 === 0) rows.push([d]);
              else rows[rows.length - 1].push(d);
              return rows;
            }, [])
            .map((row, ri) => (
              <div
                key={ri}
                className={
                  row.length === 2 ? "grid grid-cols-2 gap-[10px]" : ""
                }
              >
                {row.map((def) => {
                  const t = inputTypeFor(def.type?.name);
                  return (
                    <div key={def.key}>
                      <label className={labelCls} style={labelStyle}>
                        {def.name}
                      </label>
                      <input
                        type={t}
                        step={
                          def.type?.name === "number_decimal"
                            ? "0.01"
                            : undefined
                        }
                        className={inputCls}
                        style={inputStyle}
                        value={form[def.key] ?? ""}
                        onChange={(e) => set(def.key, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

          {/* Extra textarea fields (multi_line_text_field / json) — full-width */}
          {extraFields
            .filter((d) => inputTypeFor(d.type?.name) === "textarea")
            .map((def) => (
              <div key={def.key}>
                <label className={labelCls} style={labelStyle}>
                  {def.name}
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-[6px] px-[10px] py-[8px] font-hanken text-[13px] outline-none focus:border-[#a45d41] resize-y"
                  style={{ border: "1px solid #dac1ba", color: "#1c1c19" }}
                  value={form[def.key] ?? ""}
                  onChange={(e) => set(def.key, e.target.value)}
                />
              </div>
            ))}

          {/* Extra file_reference fields */}
          {extraFields
            .filter((d) => inputTypeFor(d.type?.name) === "file")
            .map((def) => (
              <div key={def.key}>
                <label className={labelCls} style={labelStyle}>
                  {def.name}
                </label>
                <ImagePicker
                  currentUrl={form[`${def.key}_url`] || null}
                  gid={form[def.key] ?? ""}
                  onUploaded={(gid, cdnUrl) => {
                    set(def.key, gid);
                    set(`${def.key}_url`, cdnUrl);
                  }}
                  onUploadChange={setImageUploading}
                />
              </div>
            ))}

          {/* Checkboxes */}
          <div className="flex flex-wrap items-center gap-x-[24px] gap-y-[8px] pt-[4px]">
            <label className="flex items-center gap-[8px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.visible === "true"}
                onChange={(e) =>
                  set("visible", e.target.checked ? "true" : "false")
                }
                className="w-[15px] h-[15px] cursor-pointer"
                style={{ accentColor: "#a45d41" }}
              />
              <span
                className="font-hanken font-semibold text-[12px]"
                style={{ color: "#3c3c3c" }}
              >
                Visible
              </span>
            </label>
            <label className="flex items-center gap-[8px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default === "true"}
                onChange={(e) =>
                  set("is_default", e.target.checked ? "true" : "false")
                }
                className="w-[15px] h-[15px] cursor-pointer"
                style={{ accentColor: "#a45d41" }}
              />
              <span
                className="font-hanken font-semibold text-[12px]"
                style={{ color: "#3c3c3c" }}
              >
                Is Default
              </span>
            </label>
            {extraFields
              .filter((d) => inputTypeFor(d.type?.name) === "checkbox")
              .map((def) => (
                <label
                  key={def.key}
                  className="flex items-center gap-[8px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form[def.key] === "true"}
                    onChange={(e) =>
                      set(def.key, e.target.checked ? "true" : "false")
                    }
                    className="w-[15px] h-[15px] cursor-pointer"
                    style={{ accentColor: "#a45d41" }}
                  />
                  <span
                    className="font-hanken font-semibold text-[12px]"
                    style={{ color: "#3c3c3c" }}
                  >
                    {def.name}
                  </span>
                </label>
              ))}
          </div>

          <p
            className="font-hanken text-[12px] h-[16px]"
            style={{ color: "#dc2626" }}
          >
            {error || ""}
          </p>

          {/* Actions */}
          <div
            className="flex items-center justify-end gap-[8px] pt-[8px]"
            style={{ borderTop: "1px solid #dac1ba" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="font-hanken font-semibold text-[13px] h-[38px] px-[16px] rounded-[8px] cursor-pointer hover:opacity-80"
              style={{ border: "1px solid #dac1ba", color: "#7c3820" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || imageUploading}
              className="font-hanken font-semibold text-[13px] text-white h-[38px] px-[20px] rounded-[8px] cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#a45d41" }}
            >
              {saving
                ? "Saving…"
                : imageUploading
                  ? "Uploading image…"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────
function DeleteConfirmModal({ option, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteStyleOption(option.id);
      onDeleted(option.id);
      onClose();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-white rounded-[12px] w-full mx-[16px] p-[24px] flex flex-col gap-[16px]"
        style={{ maxWidth: 420, border: "1px solid #dac1ba" }}
      >
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h2
              className="font-garamond font-bold text-[20px] leading-tight"
              style={{ color: "#3c3c3c" }}
            >
              Delete Option
            </h2>
            <p
              className="font-hanken text-[13px] mt-[6px] leading-[1.5]"
              style={{ color: "#7c3820" }}
            >
              Are you sure you want to delete{" "}
              <strong>&ldquo;{option.label}&rdquo;</strong>? This will
              permanently remove it from Shopify and cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80"
            style={{ width: 30, height: 30, background: "#f1ede8" }}
          >
            <X size={14} style={{ color: "#7c3820" }} />
          </button>
        </div>

        {error && (
          <p className="font-hanken text-[12px]" style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}

        <div
          className="flex items-center justify-end gap-[8px]"
          style={{ borderTop: "1px solid #dac1ba", paddingTop: 12 }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="font-hanken font-semibold text-[13px] h-[38px] px-[16px] rounded-[8px] cursor-pointer hover:opacity-80 disabled:opacity-50"
            style={{ border: "1px solid #dac1ba", color: "#7c3820" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="font-hanken font-semibold text-[13px] text-white h-[38px] px-[20px] rounded-[8px] cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#c0392b" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Garment Dropdown ──────────────────────────────────────────────────────
function GarmentDropdown({ garments, selected, onSelect, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger — styled exactly like Figma filter input */}
      <button
        type="button"
        onClick={() => !loading && garments.length > 0 && setOpen((v) => !v)}
        className="flex items-center w-full h-[40px] rounded-[8px] pl-[13px] pr-[9px] py-[7px] bg-white cursor-pointer"
        style={{ border: "1px solid #dac1ba" }}
      >
        <Filter
          size={12}
          className="flex-shrink-0 mr-[8px]"
          style={{ color: "#9b9b9b" }}
        />
        <span
          className="flex-1 text-left text-[14px] font-hanken truncate"
          style={{ color: selected ? "#1c1c19" : "#9b9b9b" }}
        >
          {loading ? "Loading…" : selected || "Filter garments..."}
        </span>
        <ChevronDown
          size={12}
          className="flex-shrink-0 transition-transform"
          style={{
            color: "#9b9b9b",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-[4px] bg-white rounded-[8px] overflow-hidden"
          style={{
            border: "1px solid #dac1ba",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {garments.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                onSelect(g);
                setOpen(false);
              }}
              className="w-full text-left px-[13px] py-[10px] font-hanken text-[14px] transition-colors cursor-pointer"
              style={{
                color: selected === g ? "#a45d41" : "#1c1c19",
                backgroundColor: selected === g ? "#fdf5f0" : "transparent",
                fontWeight: selected === g ? 600 : 400,
              }}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative flex-shrink-0 focus:outline-none cursor-pointer"
      style={{ width: 40, height: 20, borderRadius: 12 }}
      aria-checked={on}
      role="switch"
    >
      <span
        className="absolute inset-0 rounded-[12px] transition-colors"
        style={{ backgroundColor: on ? "#7c3820" : "#dac1ba" }}
      />
      <span
        className="absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform"
        style={{
          left: 2,
          transform: on ? "translateX(20px)" : "translateX(0)",
          boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
        }}
      />
    </button>
  );
}

// ─── Option Card ───────────────────────────────────────────────────────────
function OptionCard({ option, visible, onChange, onView, onEdit, onDelete }) {
  return (
    <div
      className="bg-white flex items-center h-[64px] rounded-[8px] px-[11px] py-[12px]"
      style={{ border: "1px solid #dac1ba" }}
    >
      {/* Sort order badge — before image */}
      <span
        className="flex-shrink-0 flex items-center justify-center font-hanken font-bold text-[11px] rounded-[4px] mr-[8px]"
        style={{
          width: 24,
          height: 24,
          background: "#f1ede8",
          color: "#a45d41",
        }}
      >
        {option.sortOrder ?? "—"}
      </span>

      {/* Image thumbnail */}
      <div
        className="flex-shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          border: "1px solid #dac1ba",
          background: "#fff",
        }}
      >
        {option.imageUrl ? (
          <img
            src={option.imageUrl}
            alt={option.label}
            className="object-cover pointer-events-none"
            style={{ width: 30, height: 30 }}
          />
        ) : (
          <div className="w-[30px] h-[30px] bg-[#f0ebe6] rounded-sm" />
        )}
      </div>

      {/* Name */}
      <div className="flex items-center flex-1 min-w-0 ml-[12px]">
        <span className="font-hanken font-medium text-[16px] text-black leading-[24px] block truncate">
          {option.label}
        </span>
      </div>

      {/* Edit + Delete + ON/OFF + Toggle */}
      <div
        className="flex items-center gap-[8px] pl-[12px] ml-[8px] flex-shrink-0"
        style={{ borderLeft: "1px solid rgba(218,193,186,0.4)" }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView(option);
          }}
          className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 flex-shrink-0"
          style={{ width: 28, height: 28, background: "#f1ede8" }}
          title="View option"
        >
          <Eye size={12} style={{ color: "#7c3820" }} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(option);
          }}
          className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 flex-shrink-0"
          style={{ width: 28, height: 28, background: "#f1ede8" }}
          title="Edit option"
        >
          <Pencil size={12} style={{ color: "#7c3820" }} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(option);
          }}
          className="flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 flex-shrink-0"
          style={{ width: 28, height: 28, background: "#fef2f2" }}
          title="Delete option"
        >
          <Trash2 size={12} style={{ color: "#c0392b" }} />
        </button>
        <span
          className="font-hanken font-semibold text-[12px] tracking-[0.6px] w-[24px] text-right"
          style={{ color: "#7c3820" }}
        >
          {visible ? "ON" : "OFF"}
        </span>
        <Toggle on={visible} onChange={onChange} />
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function StyleAdjustments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overrides, setOverrides] = useState(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [optionFilter, setOptionFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewingOption, setViewingOption] = useState(null);
  const [editingOption, setEditingOption] = useState(null);
  const [deletingOption, setDeletingOption] = useState(null);
  const mainRef = useRef(null);

  const selectedGarment = searchParams.get("garment") || null;
  const selectedCategory = searchParams.get("category") || null;

  function setSelectedGarment(val) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set("garment", val);
      else next.delete("garment");
      next.delete("category");
      return next;
    });
  }

  function setSelectedCategory(val) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set("category", val);
      else next.delete("category");
      return next;
    });
  }

  useEffect(() => {
    fetchStyleOptions()
      .then((data) => {
        setOptions(data);
        if (data.length > 0) {
          const garments = [
            ...new Set(data.map((o) => o.garment).filter(Boolean)),
          ].sort();
          const urlGarment = searchParams.get("garment");
          const first =
            urlGarment && garments.includes(urlGarment)
              ? urlGarment
              : (garments.find((g) => g.toLowerCase() === "jacket") ??
                garments[0]);
          const urlCategory = searchParams.get("category");
          const cats = [
            ...new Set(
              data.filter((o) => o.garment === first).map((o) => o.category),
            ),
          ];
          const firstCat =
            urlCategory && cats.includes(urlCategory)
              ? urlCategory
              : (cats[0] ?? null);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (first) next.set("garment", first);
              else next.delete("garment");
              if (firstCat) next.set("category", firstCat);
              else next.delete("category");
              return next;
            },
            { replace: true },
          );
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-sync CDN image URLs to Shopify 3s after options load
  useEffect(() => {
    if (!options.length) return;
    const timer = setTimeout(() => {
      syncStyleOptionImageUrls(options).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [options]);

  const garments = useMemo(
    () => [...new Set(options.map((o) => o.garment).filter(Boolean))].sort(),
    [options],
  );

  const getVisible = (opt) =>
    overrides.has(opt.id) ? overrides.get(opt.id) : opt.visible;

  const categoriesForGarment = useMemo(() => {
    if (!selectedGarment) return [];
    const map = new Map();
    for (const opt of options) {
      if (opt.garment !== selectedGarment) continue;
      if (!map.has(opt.category))
        map.set(opt.category, {
          displayLabel: opt.displayLabel,
          sortOrder: opt.sortOrder,
          total: 0,
          visible: 0,
        });
      const e = map.get(opt.category);
      e.total++;
      if (getVisible(opt)) e.visible++;
    }
    return [...map.entries()]
      .map(([slug, info]) => ({ slug, ...info }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, selectedGarment, overrides]);

  const categoryOptions = useMemo(
    () =>
      options
        .filter(
          (o) =>
            o.garment === selectedGarment && o.category === selectedCategory,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [options, selectedGarment, selectedCategory],
  );

  const filteredOptions = useMemo(() => {
    const q = optionFilter.trim().toLowerCase();
    if (!q) return categoryOptions;
    return categoryOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.handle.toLowerCase().includes(q),
    );
  }, [categoryOptions, optionFilter]);

  const categoryInfo = categoriesForGarment.find(
    (c) => c.slug === selectedCategory,
  );
  const catVisible = categoryOptions.filter((o) => getVisible(o)).length;
  const totalHidden = options.filter((o) => !getVisible(o)).length;
  const pendingCount = overrides.size;

  function toggleOption(opt) {
    setOverrides((prev) => {
      const next = new Map(prev);
      const cur = prev.has(opt.id) ? prev.get(opt.id) : opt.visible;
      if (cur === opt.visible) next.set(opt.id, !cur);
      else next.delete(opt.id);
      return next;
    });
  }

  function showAll() {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const opt of filteredOptions) {
        if (opt.visible) next.delete(opt.id);
        else next.set(opt.id, true);
      }
      return next;
    });
  }

  function hideAll() {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const opt of filteredOptions) {
        if (!opt.visible) next.delete(opt.id);
        else next.set(opt.id, false);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!pendingCount) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(
        [...overrides.entries()].map(([id, vis]) =>
          updateStyleOptionVisible(id, vis),
        ),
      );
      setOptions((prev) =>
        prev.map((o) =>
          overrides.has(o.id) ? { ...o, visible: overrides.get(o.id) } : o,
        ),
      );
      setOverrides(new Map());
      clearStyleOptionsCache();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCreated(node, garment, formFields) {
    const cat = (formFields.category ?? "").trim();
    const sortOrder = parseInt(formFields.sort_order || "0", 10);
    const kuteCode = formFields.kutetailer_code || null;
    const uploadedImageUrl = formFields.image_url || null;
    const newOpt = {
      id: node.id,
      handle: node.handle,
      label: formFields.label ?? "",
      category: cat,
      garment,
      displayLabel: formFields.display_label || cat,
      upcharge: parseFloat(formFields.upcharge || 0),
      visible: true,
      isDefault: formFields.is_default === "true",
      sortOrder,
      kutetailerCode: kuteCode,
      conditionalHide: formFields.conditional_hide || "",
      imageGid: formFields.image || null,
      imageUrlStored: uploadedImageUrl,
      imageUrl:
        uploadedImageUrl ||
        (kuteCode
          ? `https://aws-static-webp.kutetailor.com/comm/process/craft/${kuteCode}.jpeg`
          : null),
      rawFields: formFields,
      fieldTypes: {},
    };
    setOptions((prev) => [...prev, newOpt]);
    clearStyleOptionsCache();
    // Navigate to the new option's category so it's visible immediately
    setSelectedCategory(cat);
  }

  function handleUpdated(id, updatedFields) {
    setOptions((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updatedFields } : o)),
    );
    // Remove any pending visibility override for this option since visible was updated directly
    setOverrides((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function handleDeleted(id) {
    setOptions((prev) => prev.filter((o) => o.id !== id));
    setOverrides((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function selectGarment(g) {
    setOptionFilter("");
    const cats = [
      ...new Set(options.filter((o) => o.garment === g).map((o) => o.category)),
    ];
    const firstCat = cats[0] ?? null;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (g) next.set("garment", g);
      else next.delete("garment");
      if (firstCat) next.set("category", firstCat);
      else next.delete("category");
      return next;
    });
  }

  return (
    <DashboardLayout bgColor="#f4f1ed">
      {/* Break out of page-content padding to make aside flush */}
      <div
        className="-mx-[20px] md:-mx-[28px] -mt-[20px] md:-mt-[28px] -mb-[20px] md:-mb-[28px] flex overflow-hidden relative"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* ── Mobile sidebar overlay backdrop ─────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 md:hidden"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Left aside ──────────────────────────────────────────────────── */}
        <aside
          className={`flex-shrink-0 transition-transform duration-300
            fixed z-40 top-[64px] md:relative md:z-auto md:top-auto md:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{
            width: 280,
            height: "calc(100vh - 64px)",
            background: "#f7f3ee",
            borderRight: "1px solid #dac1ba",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Garment filter — exactly 64px tall (pt16 + h40 + pb8) */}
          <div
            className="px-[8px] pt-[16px] pb-[8px] relative"
            style={{ zIndex: 2 }}
            id="aside-dropdown"
          >
            <GarmentDropdown
              garments={garments}
              selected={selectedGarment}
              onSelect={selectGarment}
              loading={loading}
            />
          </div>

          {/* Category list — scrollable */}
          <div
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              flex: 1,
              minHeight: 0,
              paddingBottom: 96,
            }}
          >
            {loading ? (
              <p className="px-[16px] text-[12px]" style={{ color: "#9a8f89" }}>
                Loading…
              </p>
            ) : (
              <div className="flex flex-col gap-px px-[8px]">
                {categoriesForGarment.map((cat) => {
                  const active = selectedCategory === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => {
                        setSelectedCategory(cat.slug);
                        setOptionFilter("");
                        setSidebarOpen(false);
                      }}
                      className="flex items-center justify-between w-full text-left transition-colors cursor-pointer"
                      style={
                        active
                          ? {
                              background: "#fff",
                              borderTop: "1px solid #dac1ba",
                              borderBottom: "1px solid #dac1ba",
                              borderLeft: "4px solid #a45d41",
                              paddingLeft: 20,
                              paddingRight: 16,
                              paddingTop: 13,
                              paddingBottom: 13,
                            }
                          : {
                              paddingLeft: 16,
                              paddingRight: 16,
                              paddingTop: 12,
                              paddingBottom: 12,
                            }
                      }
                    >
                      <span
                        className="font-hanken font-semibold text-[12px] leading-[16px] truncate mr-[8px]"
                        style={{ color: active ? "#1c1c19" : "#a45d41" }}
                      >
                        {cat.displayLabel}
                      </span>
                      <div className="flex items-center gap-[8px] flex-shrink-0">
                        {active && (
                          <div
                            className="rounded-[12px] flex-shrink-0"
                            style={{
                              width: 6,
                              height: 6,
                              background: "#a45d41",
                            }}
                          />
                        )}
                        <div
                          className="flex items-center justify-center font-hanken font-medium text-[12px]"
                          style={{
                            background: "#f1ede8",
                            color: "#a45d41",
                            borderRadius: active ? 2 : "0px 2px 2px 2px",
                            width: 40,
                            height: 20,
                          }}
                        >
                          {cat.visible}/{cat.total}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div
          ref={mainRef}
          className="flex-1 min-w-0 flex flex-col overflow-y-auto pb-[100px] scroll-hidden"
        >
          {loading && (
            <div className="flex justify-center pt-[80px]">
              <LoadingState message="Loading style options…" />
            </div>
          )}

          {error && (
            <div
              className="p-[20px] md:p-[40px] text-[14px]"
              style={{ color: "#dc2626" }}
            >
              {error}
            </div>
          )}

          {!loading && !error && selectedCategory && (
            <>
              {/* Header */}
              <div className="px-[16px] md:px-[40px] pt-[16px] md:pt-[40px] pb-[16px] md:pb-[24px]">
                {/* Mobile: sidebar toggle + breadcrumb row */}
                <div className="flex items-center gap-[8px] mb-[8px]">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden flex-shrink-0 flex items-center justify-center rounded-[6px] cursor-pointer"
                    style={{
                      width: 32,
                      height: 32,
                      background: "#f1ede8",
                      border: "1px solid #dac1ba",
                    }}
                    aria-label="Open categories"
                  >
                    <Filter size={14} style={{ color: "#a45d41" }} />
                  </button>
                  <div className="flex items-center gap-[4px]">
                    <span
                      className="font-hanken font-medium text-[11px] leading-[14px]"
                      style={{ color: "#a45d41" }}
                    >
                      {selectedGarment}
                    </span>
                    <ChevronRight size={10} style={{ color: "#a45d41" }} />
                    <span
                      className="font-hanken font-medium text-[11px] leading-[14px]"
                      style={{ color: "#1c1c19" }}
                    >
                      {categoryInfo?.displayLabel}
                    </span>
                  </div>
                </div>
                {/* Title + Add button */}
                <div className="flex items-center justify-between gap-[12px]">
                  <h1
                    className="font-garamond font-bold text-[28px] md:text-[40px] leading-tight"
                    style={{ color: "#3c3c3c" }}
                  >
                    {categoryInfo?.displayLabel}
                  </h1>
                  {selectedGarment &&
                    GARMENT_TO_STYLE_TYPE[selectedGarment] && (
                      <button
                        onClick={() => setAddModalOpen(true)}
                        className="flex items-center gap-[6px] font-hanken font-semibold text-[13px] md:text-[14px] uppercase text-white h-[40px] md:h-[44px] px-[12px] md:px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90 flex-shrink-0"
                        style={{ background: "#a45d41" }}
                      >
                        <Plus size={14} />
                        {selectedGarment}
                      </button>
                    )}
                </div>
                <p
                  className="font-hanken font-semibold text-[13px] md:text-[14px] leading-[16px] mt-[2px]"
                  style={{ color: "#a45d41" }}
                >
                  Total: {categoryOptions.length} options | Visible:{" "}
                  {catVisible}
                </p>
              </div>

              {/* Sticky filter bar */}
              <div
                className="sticky top-0 z-10 px-[16px] md:px-[24px] py-[12px] md:py-[20px] flex flex-col sm:flex-row sm:items-center gap-[8px] sm:gap-[12px]"
                style={{
                  background: "rgba(253,249,244,0.9)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <div
                  className="flex items-center gap-[14px] h-[44px] md:h-[48px] rounded-[8px] overflow-hidden flex-1 pl-[14px] md:pl-[21px] pr-[12px] md:pr-[19px]"
                  style={{
                    background: "rgba(255,255,255,0.5)",
                    border: "1px solid #d1c7bd",
                  }}
                >
                  <Search
                    size={16}
                    className="flex-shrink-0"
                    style={{ color: "#6b7280" }}
                  />
                  <input
                    type="text"
                    placeholder="Filter options..."
                    value={optionFilter}
                    onChange={(e) => setOptionFilter(e.target.value)}
                    className="flex-1 text-[14px] font-hanken font-medium outline-none bg-transparent"
                    style={{ color: "#1c1c19" }}
                  />
                </div>
                <div className="flex items-center gap-[4px] flex-shrink-0 justify-end">
                  <button
                    onClick={showAll}
                    className="font-hanken font-semibold text-[13px] md:text-[14px] text-white uppercase h-[40px] md:h-[44px] px-[12px] md:px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90 flex-1 sm:flex-none"
                    style={{ background: "#a45d41" }}
                  >
                    Show All
                  </button>
                  <button
                    onClick={hideAll}
                    className="font-hanken font-semibold text-[13px] md:text-[14px] text-white uppercase h-[40px] md:h-[44px] px-[12px] md:px-[16px] rounded-[8px] cursor-pointer transition-opacity hover:opacity-90 flex-1 sm:flex-none"
                    style={{ background: "#a45d41" }}
                  >
                    Hide All
                  </button>
                </div>
              </div>

              {/* Options grid — 1 col mobile, 2 col sm+ */}
              <div className="px-[16px] md:px-[24px] pt-[16px] md:pt-[20px]">
                {filteredOptions.length === 0 ? (
                  <p
                    className="font-hanken text-[13px] py-[40px] text-center"
                    style={{ color: "#9a8f89" }}
                  >
                    No options match your filter.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px] md:gap-[13px]">
                    {filteredOptions.map((opt) => (
                      <OptionCard
                        key={opt.handle}
                        option={opt}
                        visible={getVisible(opt)}
                        onChange={() => toggleOption(opt)}
                        onView={setViewingOption}
                        onEdit={setEditingOption}
                        onDelete={setDeletingOption}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !error && !selectedCategory && (
            <div className="flex flex-col items-center justify-center py-[60px] md:py-[100px] gap-[16px]">
              {/* Mobile: show sidebar toggle when no category selected */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="md:hidden flex items-center gap-[8px] font-hanken font-semibold text-[14px] text-white uppercase h-[44px] px-[20px] rounded-[8px] cursor-pointer"
                style={{ background: "#a45d41" }}
              >
                <Filter size={14} />
                Browse Categories
              </button>
              <p
                className="font-hanken text-[14px]"
                style={{ color: "#a89f99" }}
              >
                Select a category to view its options
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed footer ─────────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 right-0 lg:left-[260px] left-0 z-40"
        style={{
          background: "#fff",
          borderTop: "1px solid #dac1ba",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[6px] sm:gap-[8px] px-[16px] md:px-[40px] py-[8px] md:py-[10px]">
          {/* Hidden count */}
          <div className="flex items-center gap-[8px]">
            <div
              className="flex items-center justify-center font-hanken font-medium text-[12px] rounded-full flex-shrink-0"
              style={{
                width: 26,
                height: 26,
                background: "#f1ede8",
                color: "#a45d41",
              }}
            >
              {String(totalHidden).padStart(2, "0")}
            </div>
            <span
              className="font-hanken font-semibold text-[13px] md:text-[16px]"
              style={{ color: "#a45d41" }}
            >
              options hidden across the catalog.
            </span>
          </div>

          {/* Unsaved changes + save */}
          <div className="flex items-center gap-[10px] sm:justify-end">
            {saveError && (
              <span
                className="font-hanken text-[12px]"
                style={{ color: "#dc2626" }}
              >
                {saveError}
              </span>
            )}
            {pendingCount > 0 && !saving && (
              <span
                className="font-hanken font-medium text-[12px] text-center leading-[16px]"
                style={{ color: "#a45d41" }}
              >
                {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || pendingCount === 0}
              className="flex items-center gap-[8px] font-hanken font-semibold text-[12px] text-white text-center tracking-[0.6px] uppercase rounded-[8px] cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "#a45d41",
                height: 42,
                minWidth: 140,
                width: 175,
                justifyContent: "center",
              }}
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
      {addModalOpen && selectedGarment && (
        <AddStyleOptionModal
          garment={selectedGarment}
          garmentOptions={options.filter((o) => o.garment === selectedGarment)}
          onClose={() => setAddModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
      {viewingOption && selectedGarment && (
        <ViewStyleOptionModal
          option={viewingOption}
          garment={selectedGarment}
          onClose={() => setViewingOption(null)}
          onEdit={(opt) => {
            setViewingOption(null);
            setEditingOption(opt);
          }}
        />
      )}
      {editingOption && selectedGarment && (
        <EditStyleOptionModal
          option={editingOption}
          garment={selectedGarment}
          onClose={() => setEditingOption(null)}
          onUpdated={handleUpdated}
        />
      )}
      {deletingOption && (
        <DeleteConfirmModal
          option={deletingOption}
          onClose={() => setDeletingOption(null)}
          onDeleted={handleDeleted}
        />
      )}
    </DashboardLayout>
  );
}

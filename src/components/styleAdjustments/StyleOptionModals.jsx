import { useState, useEffect, useRef } from "react";
import { ExternalLink, Pencil, X } from "lucide-react";
import ModalBase, { ModalHeader, ModalFooter } from "../ui/ModalBase";
import {
  createStyleOption,
  updateStyleOption,
  deleteStyleOption,
  fetchShopAdminDomain,
  uploadImageToShopify,
  GARMENT_TO_STYLE_TYPE,
  fetchStyleOptionFieldDefs,
  clearStyleOptionsCache,
} from "../../lib/shopify";

export const KNOWN_KEYS = new Set([
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
  "garment",
  "color_name",
  "color_hex",
  "color_image",
  "code",
]);

export function normalizeCategory(val) {
  return val.trim().toLowerCase().replace(/\s+/g, "_");
}

function keyToLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

function stubDef(key, value, shopifyTypeName) {
  const typeName =
    shopifyTypeName || inferTypeName(value) || "single_line_text_field";
  return { key, name: keyToLabel(key), type: { name: typeName } };
}

export function inputTypeFor(rawTypeName) {
  if (!rawTypeName) return "text";
  const t = rawTypeName.toLowerCase().trim();

  if (t === "number_integer" || t === "integer" || t === "int") return "number";
  if (
    t === "number_decimal" ||
    t === "decimal" ||
    t === "float" ||
    t === "double"
  )
    return "number";
  if (["rating", "money", "dimension", "weight", "volume"].includes(t))
    return "textarea";

  if (t === "boolean" || t === "bool") return "checkbox";
  if (
    t === "file_reference" ||
    t === "file" ||
    t === "media_image" ||
    t === "image" ||
    t === "list.file_reference" ||
    (t.includes("file") && t.includes("reference"))
  )
    return "file";

  if (
    t === "multi_line_text_field" ||
    t === "multi_line_text" ||
    t === "json" ||
    t === "rich_text_field" ||
    t === "rich_text"
  )
    return "textarea";

  if (t === "url" || t === "link") return "url";
  if (t === "color" || t === "colour") return "color";
  if (t === "date") return "date";
  if (t === "date_time" || t === "datetime" || t === "date_and_time")
    return "datetime-local";
  if (t.endsWith("_reference") || t === "mixed_reference") return "text";
  if (t.startsWith("list.")) return "textarea";

  return "text";
}

export function ImagePicker({
  currentUrl,
  gid,
  onUploaded,
  onUploadChange,
  onCleared,
}) {
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

  function handleClear() {
    setLocalPreview(null);
    setUploadError(null);
    onCleared?.();
  }

  return (
    <div className="flex items-center gap-[12px]">
      <div className="flex-shrink-0 rounded-[6px] overflow-hidden flex items-center justify-center w-40 h-40 border border-gc-border-warm bg-gc-bg-image">
        {displayUrl ? (
          <img src={displayUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-32 h-32 bg-gc-border-warm rounded" />
        )}
      </div>
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="font-hanken font-semibold text-[12px] h-[32px] px-[12px] rounded-[6px] cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed border border-gc-border-warm text-gc-primary-deep"
          >
            {uploading ? "Uploading…" : gid ? "Change Image" : "Select Image"}
          </button>
          <button
            type="button"
            disabled={!gid || uploading}
            onClick={handleClear}
            className="font-hanken font-semibold text-[12px] h-[32px] px-[12px] rounded-[6px] border border-gc-border-warm text-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-80"
          >
            Clear
          </button>
        </div>
        {gid && !uploading && (
          <span className="font-hanken text-[10px] truncate text-gc-muted-warm max-w-[200px]">
            {gid.split("/").pop()}
          </span>
        )}
        {uploadError && (
          <span className="font-hanken text-[11px] text-failed">
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

export function AddStyleOptionModal({
  garment,
  garmentOptions,
  onClose,
  onCreated,
}) {
  const [extraFields, setExtraFields] = useState(() => {
    const kv = extraKVFromOptions(garmentOptions);
    return [...kv.entries()].map(([k, v]) => {
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
      .catch(() => {});
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
        sort_order: String(form.sort_order || computedSortOrder),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full h-[38px] rounded-[6px] px-[10px] font-hanken text-[13px] outline-none focus:border-gc-primary border border-gc-border-warm text-gc-near-black";
  const labelCls =
    "font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[4px] block text-gc-primary-deep";

  return (
    <ModalBase onClose={onClose}>
      <ModalHeader title={`Add ${garment} Option`} onClose={onClose} />
      <form
        onSubmit={handleSubmit}
        className="px-[20px] py-[16px] flex flex-col gap-[12px]"
      >
        <div>
          <label className={labelCls}>
            Label <span className="text-failed">*</span>
          </label>
          <input
            className={inputCls}
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. Half Canvas"
          />
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelCls}>
              Category <span className="text-failed">*</span>
            </label>
            <input
              className={inputCls}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              onBlur={(e) => set("category", normalizeCategory(e.target.value))}
              placeholder="e.g. canvas or lining style"
            />
          </div>
          <div>
            <label className={labelCls}>
              Display Label <span className="text-failed">*</span>
            </label>
            <input
              className={inputCls}
              value={form.display_label}
              onChange={(e) => set("display_label", e.target.value)}
              placeholder="e.g. Canvas"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelCls}>Upcharge ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={form.upcharge}
              onChange={(e) => set("upcharge", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Sort Order</label>
            <input
              type="number"
              min="0"
              className={inputCls}
              value={form.sort_order}
              onChange={(e) => set("sort_order", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelCls}>Kutetailor Code</label>
            <input
              className={inputCls}
              value={form.kutetailer_code}
              onChange={(e) => set("kutetailer_code", e.target.value)}
              placeholder="e.g. 000B"
            />
          </div>
          <div>
            <label className={labelCls}>Conditional Hide</label>
            <input
              className={inputCls}
              value={form.conditional_hide}
              onChange={(e) => set("conditional_hide", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Image</label>
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

        {extraFields
          .filter((d) => {
            const t = inputTypeFor(d.type?.name);
            return (
              t !== "checkbox" &&
              t !== "file" &&
              t !== "textarea" &&
              t !== "color"
            );
          })
          .reduce((rows, d, i) => {
            if (i % 2 === 0) rows.push([d]);
            else rows[rows.length - 1].push(d);
            return rows;
          }, [])
          .map((row, ri) => (
            <div
              key={ri}
              className={row.length === 2 ? "grid grid-cols-2 gap-[10px]" : ""}
            >
              {row.map((def) => {
                const t = inputTypeFor(def.type?.name);
                return (
                  <div key={def.key}>
                    <label className={labelCls}>{def.name}</label>
                    <input
                      type={t}
                      step={
                        def.type?.name === "number_decimal" ? "0.01" : undefined
                      }
                      className={inputCls}
                      value={form[def.key] ?? ""}
                      onChange={(e) => set(def.key, e.target.value)}
                      placeholder={def.name}
                    />
                  </div>
                );
              })}
            </div>
          ))}

        {extraFields
          .filter((d) => inputTypeFor(d.type?.name) === "textarea")
          .map((def) => (
            <div key={def.key}>
              <label className={labelCls}>{def.name}</label>
              <textarea
                rows={3}
                className="w-full rounded-[6px] px-[10px] py-[8px] font-hanken text-[13px] outline-none focus:border-gc-primary border border-gc-border-warm text-gc-near-black resize-y"
                value={form[def.key] ?? ""}
                onChange={(e) => set(def.key, e.target.value)}
                placeholder={def.name}
              />
            </div>
          ))}

        {extraFields
          .filter((d) => inputTypeFor(d.type?.name) === "file")
          .map((def) => (
            <div key={def.key}>
              <label className={labelCls}>{def.name}</label>
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

        <div className="flex flex-wrap items-center gap-x-[24px] gap-y-[8px] pt-[4px]">
          <label className="flex items-center gap-[8px]">
            <input
              type="checkbox"
              checked
              disabled
              readOnly
              className="w-[15px] h-[15px] gc-accent-primary"
            />
            <span className="font-hanken font-semibold text-[12px] text-gc-heading">
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
              className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
            />
            <span className="font-hanken font-semibold text-[12px] text-gc-heading">
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
                  className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
                />
                <span className="font-hanken font-semibold text-[12px] text-gc-heading">
                  {def.name}
                </span>
              </label>
            ))}
        </div>

        <p className="font-hanken text-[12px] h-[16px] text-failed">
          {error || ""}
        </p>

        <ModalFooter
          onClose={onClose}
          submitLabel="Create"
          disabled={saving || imageUploading}
          loading={saving}
          loadingLabel={imageUploading ? "Uploading image…" : "Creating…"}
        />
      </form>
    </ModalBase>
  );
}

export function ViewStyleOptionModal({ option, garment, onClose, onEdit }) {
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

  const extraRows = Object.entries(option.rawFields ?? {})
    .filter(([k]) => !KNOWN_KEYS.has(k))
    .map(([k, v]) => ({
      label: keyToLabel(k),
      value: v != null && v !== "" ? String(v) : "—",
    }));

  const labelCls =
    "font-hanken font-semibold text-[11px] tracking-[0.4px] text-gc-primary-deep";
  const valCls = "font-hanken text-[13px] text-gc-near-black";

  return (
    <ModalBase onClose={onClose} maxWidth="max-w-[480px]">
      <ModalHeader
        onClose={onClose}
        actions={
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(option);
            }}
            className="flex items-center gap-[5px] font-hanken font-semibold text-[12px] h-[30px] px-[10px] rounded-[6px] cursor-pointer hover:opacity-80 border border-gc-border-warm text-gc-primary-deep"
          >
            <Pencil size={11} />
            Edit
          </button>
        }
      >
        <div>
          <p className="font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[2px] text-gc-primary">
            {garment} · {option.category}
          </p>
          <h2 className="font-garamond font-bold text-[22px] text-gc-heading">
            {option.label}
          </h2>
        </div>
      </ModalHeader>

      <div className="px-[20px] py-[16px] flex flex-col gap-[12px]">
        {option.imageUrl && (
          <div className="flex justify-center pb-[4px]">
            <img
              src={option.imageUrl}
              alt={option.label}
              className="rounded-[8px] object-cover w-[80px] h-[80px] border border-gc-border-warm"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-[8px]">
          <span
            className={`font-hanken font-semibold text-[11px] px-[10px] py-[4px] rounded-full ${option.visible ? "bg-green-100 text-green-800" : "bg-gc-bg-warm text-gc-primary-deep"}`}
          >
            {option.visible ? "Visible" : "Hidden"}
          </span>
          {option.isDefault && (
            <span className="font-hanken font-semibold text-[11px] px-[10px] py-[4px] rounded-full bg-gc-warn-bg text-gc-warn-text">
              Default
            </span>
          )}
        </div>

        <div className="rounded-[8px] overflow-hidden border border-gc-border-warm">
          {[...rows, ...extraRows].map(({ label, value }, i) => (
            <div
              key={label}
              className={`grid grid-cols-2 gap-[12px] px-[14px] py-[10px] ${i > 0 ? "border-t border-gc-bg-warm" : ""} ${i % 2 !== 0 ? "bg-gc-row-alt" : "bg-white"}`}
            >
              <span className={labelCls}>{label}</span>
              <span className={valCls}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </ModalBase>
  );
}

export function EditStyleOptionModal({
  option,
  garment,
  garmentOptions = [],
  onClose,
  onUpdated,
}) {
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
      .catch(() => {});
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

  const isDirty =
    form.label !== (option.label || "") ||
    form.category !== (option.category || "") ||
    form.display_label !== (option.displayLabel || "") ||
    form.is_default !== (option.isDefault ? "true" : "false") ||
    form.upcharge !== (option.upcharge ? String(option.upcharge) : "") ||
    form.sort_order !== (option.sortOrder ? String(option.sortOrder) : "") ||
    form.conditional_hide !== (option.conditionalHide || "") ||
    form.kutetailer_code !== (option.kutetailerCode || "") ||
    form.visible !== (option.visible ? "true" : "false") ||
    form.image !== (option.imageGid || "") ||
    form.image_url !== (option.imageUrlStored || "") ||
    rawExtra.some(
      (k) =>
        form[k] !==
        (option.rawFields[k] != null && option.rawFields[k] !== ""
          ? String(option.rawFields[k])
          : ""),
    );

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
      if (form.is_default === "true") {
        const cat = normalizeCategory(form.category);
        const prevDefault = garmentOptions.find(
          (o) => o.id !== option.id && o.category === cat && o.isDefault,
        );
        if (prevDefault) {
          await updateStyleOption(prevDefault.id, { is_default: "false" });
          onUpdated(prevDefault.id, { isDefault: false });
        }
      }
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
    "w-full h-[38px] rounded-[6px] px-[10px] font-hanken text-[13px] outline-none focus:border-gc-primary border border-gc-border-warm text-gc-near-black";
  const labelCls =
    "font-hanken font-semibold text-[11px] tracking-[0.4px] mb-[4px] block text-gc-primary-deep";

  return (
    <ModalBase onClose={onClose}>
      <ModalHeader
        onClose={onClose}
        actions={
          shopifyUrl && (
            <a
              href={shopifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-[4px] font-hanken font-semibold text-[10px] sm:text-[12px] h-[26px] sm:h-[30px] px-[8px] sm:px-[10px] rounded-[6px] cursor-pointer hover:opacity-80 border border-gc-border-warm text-gc-primary-deep"
            >
              <ExternalLink size={10} />
              Open in Shopify
            </a>
          )
        }
      >
        <h2 className="font-garamond font-bold text-[18px] sm:text-[22px] text-gc-heading">
          Edit {garment} Option
        </h2>
      </ModalHeader>

      <form
        onSubmit={handleSubmit}
        className="px-[20px] py-[16px] flex flex-col gap-[12px]"
      >
        <div>
          <label className={labelCls}>
            Label <span className="text-failed">*</span>
          </label>
          <input
            className={inputCls}
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelCls}>
              Category <span className="text-failed">*</span>
            </label>
            <input
              className={inputCls}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              onBlur={(e) => set("category", normalizeCategory(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>
              Display Label <span className="text-failed">*</span>
            </label>
            <input
              className={inputCls}
              value={form.display_label}
              onChange={(e) => set("display_label", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelCls}>Upcharge ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={form.upcharge}
              onChange={(e) => set("upcharge", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Sort Order</label>
            <input
              type="number"
              min="0"
              className={inputCls}
              value={form.sort_order}
              onChange={(e) => set("sort_order", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelCls}>Kutetailor Code</label>
            <input
              className={inputCls}
              value={form.kutetailer_code}
              onChange={(e) => set("kutetailer_code", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Conditional Hide</label>
            <input
              className={inputCls}
              value={form.conditional_hide}
              onChange={(e) => set("conditional_hide", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Image</label>
          <ImagePicker
            currentUrl={form.image_url || option.imageUrl || null}
            gid={form.image}
            onUploaded={(gid, cdnUrl) => {
              set("image", gid);
              set("image_url", cdnUrl);
            }}
            onUploadChange={setImageUploading}
            onCleared={
              form.image
                ? () => {
                    set("image", "");
                    set("image_url", "");
                  }
                : undefined
            }
          />
        </div>

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
              className={row.length === 2 ? "grid grid-cols-2 gap-[10px]" : ""}
            >
              {row.map((def) => {
                const t = inputTypeFor(def.type?.name);
                return (
                  <div key={def.key}>
                    <label className={labelCls}>{def.name}</label>
                    <input
                      type={t}
                      step={
                        def.type?.name === "number_decimal" ? "0.01" : undefined
                      }
                      className={inputCls}
                      value={form[def.key] ?? ""}
                      onChange={(e) => set(def.key, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          ))}

        {extraFields
          .filter((d) => inputTypeFor(d.type?.name) === "textarea")
          .map((def) => (
            <div key={def.key}>
              <label className={labelCls}>{def.name}</label>
              <textarea
                rows={3}
                className="w-full rounded-[6px] px-[10px] py-[8px] font-hanken text-[13px] outline-none focus:border-gc-primary border border-gc-border-warm text-gc-near-black resize-y"
                value={form[def.key] ?? ""}
                onChange={(e) => set(def.key, e.target.value)}
              />
            </div>
          ))}

        {extraFields
          .filter((d) => inputTypeFor(d.type?.name) === "file")
          .map((def) => (
            <div key={def.key}>
              <label className={labelCls}>{def.name}</label>
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

        <div className="flex flex-wrap items-center gap-x-[24px] gap-y-[8px] pt-[4px]">
          <label className="flex items-center gap-[8px] cursor-pointer">
            <input
              type="checkbox"
              checked={form.visible === "true"}
              onChange={(e) =>
                set("visible", e.target.checked ? "true" : "false")
              }
              className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
            />
            <span className="font-hanken font-semibold text-[12px] text-gc-heading">
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
              className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
            />
            <span className="font-hanken font-semibold text-[12px] text-gc-heading">
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
                  className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
                />
                <span className="font-hanken font-semibold text-[12px] text-gc-heading">
                  {def.name}
                </span>
              </label>
            ))}
        </div>

        <p className="font-hanken text-[12px] h-[16px] text-failed">
          {error || ""}
        </p>

        <ModalFooter
          onClose={onClose}
          submitLabel="Save Changes"
          disabled={saving || imageUploading || !isDirty}
          loading={saving}
          loadingLabel={imageUploading ? "Uploading image…" : "Saving…"}
        />
      </form>
    </ModalBase>
  );
}

export function DeleteConfirmModal({ option, onClose, onDeleted }) {
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
    <ModalBase onClose={onClose} maxWidth="max-w-[420px]">
      <div className="p-[24px] flex flex-col gap-[16px]">
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h2 className="font-garamond font-bold text-[20px] leading-tight text-gc-heading">
              Delete Option
            </h2>
            <p className="font-hanken text-[13px] mt-[6px] leading-[1.5] text-gc-primary-deep">
              Are you sure you want to delete{" "}
              <strong>&ldquo;{option.label}&rdquo;</strong>? This will
              permanently remove it from Shopify and cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 w-[30px] h-[30px] bg-gc-bg-warm"
          >
            <X size={14} className="text-gc-primary-deep" />
          </button>
        </div>

        {error && (
          <p className="font-hanken text-[12px] text-failed">{error}</p>
        )}

        <div className="flex items-center justify-end gap-[8px] border-t border-gc-border-warm pt-[12px]">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="font-hanken font-semibold text-[13px] h-[38px] px-[16px] rounded-[8px] cursor-pointer hover:opacity-80 disabled:opacity-50 border border-gc-border-warm text-gc-primary-deep"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="font-hanken font-semibold text-[13px] text-white h-[38px] px-[20px] rounded-[8px] cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

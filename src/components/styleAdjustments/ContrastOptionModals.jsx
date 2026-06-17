import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import ModalBase, { ModalHeader, ModalFooter } from "../ui/ModalBase";
import {
  updateContrastOption,
  clearStyleOptionsCache,
  createContrastOption,
  createContrastLocation,
  updateContrastLocation,
  deleteContrastLocation,
  clearContrastLocationsCache,
} from "../../lib/shopify";
import { ImagePicker } from "./StyleOptionModals.jsx";

export function ViewContrastOptionModal({ option, onClose, onEdit }) {
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
            {option.garment} · Contrast Option
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
        </div>

        <div className="rounded-[8px] overflow-hidden border border-gc-border-warm">
          {[
            { label: "Color Name", value: option.label || "—" },
            {
              label: "Color Hex",
              value: option.colorHex || "—",
              hex: option.colorHex,
            },
            { label: "Garment", value: option.garment || "—" },
          ].map(({ label, value, hex }, i) => (
            <div
              key={label}
              className={`grid grid-cols-2 gap-[12px] px-[14px] py-[10px] ${i > 0 ? "border-t border-gc-bg-warm" : ""} ${i % 2 !== 0 ? "bg-gc-row-alt" : "bg-white"}`}
            >
              <span className="font-hanken font-semibold text-[11px] tracking-[0.4px] text-gc-primary-deep">
                {label}
              </span>
              <span className="font-hanken text-[13px] flex items-center gap-[8px] text-gc-near-black">
                {hex && (
                  <span
                    className="inline-block flex-shrink-0 rounded-[3px] w-[16px] h-[16px] border border-gc-border-warm"
                    style={{ backgroundColor: hex }}
                  />
                )}
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ModalBase>
  );
}

export function EditContrastOptionModal({ option, onClose, onUpdated }) {
  const [form, setForm] = useState({
    color_name: option.label || "",
    color_hex: option.colorHex || "",
    color_image: option.imageGid || "",
    color_image_url: option.imageUrlStored || option.imageUrl || "",
    visible: option.visible ? "true" : "false",
    is_default: option.isDefault ? "true" : "false",
    garment: option.garment || "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const isDirty =
    form.color_name !== (option.label || "") ||
    form.color_hex !== (option.colorHex || "") ||
    form.color_image !== (option.imageGid || "") ||
    form.color_image_url !== (option.imageUrlStored || option.imageUrl || "") ||
    form.visible !== (option.visible ? "true" : "false") ||
    form.is_default !== (option.isDefault ? "true" : "false") ||
    form.garment !== (option.garment || "");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.color_name.trim()) {
      setError("Color name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const extraFields = Object.fromEntries(
        Object.entries(option.rawFields ?? {}).filter(
          ([k]) =>
            ![
              "color_name",
              "color_hex",
              "color_image",
              "visible",
              "is_default",
              "garment",
            ].includes(k),
        ),
      );
      await updateContrastOption(option.id, {
        ...extraFields,
        color_name: form.color_name.trim(),
        color_hex: form.color_hex || null,
        color_image: form.color_image || null,
        visible: form.visible,
        is_default: form.is_default,
        garment: form.garment,
      });
      onUpdated(option.id, {
        label: form.color_name.trim(),
        visible: form.visible === "true",
        isDefault: form.is_default === "true",
        colorHex: form.color_hex || null,
        imageGid: form.color_image || null,
        imageUrlStored: form.color_image_url || null,
        imageUrl: form.color_image_url || null,
        garment: form.garment,
        rawFields: {
          ...option.rawFields,
          color_name: form.color_name.trim(),
          color_hex: form.color_hex || null,
          color_image: form.color_image || null,
          visible: form.visible,
          is_default: form.is_default,
          garment: form.garment,
        },
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
      <ModalHeader title="Edit Contrast Option" onClose={onClose} />
      <form
        onSubmit={handleSubmit}
        className="px-[20px] py-[16px] flex flex-col gap-[12px]"
      >
        <div>
          <label className={labelCls}>Color Image</label>
          <ImagePicker
            currentUrl={form.color_image_url || null}
            gid={form.color_image}
            onUploaded={(gid, cdnUrl) => {
              set("color_image", gid);
              set("color_image_url", cdnUrl);
            }}
            onUploadChange={setImageUploading}
          />
        </div>

        <div>
          <label className={labelCls}>
            Color Name <span className="text-failed">*</span>
          </label>
          <input
            className={inputCls}
            value={form.color_name}
            onChange={(e) => set("color_name", e.target.value)}
            placeholder="e.g. Blue"
          />
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelCls}>Color Hex</label>
            <div className="flex items-center gap-[6px]">
              <input
                type="color"
                className="rounded-[6px] cursor-pointer flex-shrink-0 w-[38px] h-[38px] p-[2px] border border-gc-border-warm"
                value={form.color_hex || "#ffffff"}
                onChange={(e) => set("color_hex", e.target.value)}
              />
              <input
                className={inputCls}
                value={form.color_hex}
                onChange={(e) => set("color_hex", e.target.value)}
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Garment</label>
            <input
              className={inputCls}
              value={form.garment}
              onChange={(e) => set("garment", e.target.value)}
              placeholder="e.g. Jacket"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-[16px] pt-[4px]">
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

function formatFieldLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isBooleanField(key, fieldTypes) {
  const t = (fieldTypes?.[key] || "").toLowerCase();
  return (
    t === "boolean" ||
    t === "true_false" ||
    key === "visible" ||
    key === "is_default"
  );
}

export function ViewContrastLocationModal({ option, onClose, onEdit }) {
  const rawFields = option.rawFields ?? {};
  const fieldTypes = option.fieldTypes ?? {};
  const rows = Object.entries(rawFields).filter(([k]) => k !== "visible");

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
            {option.garment} · Contrast Location
          </p>
          <h2 className="font-garamond font-bold text-[22px] text-gc-heading">
            {option.label}
          </h2>
        </div>
      </ModalHeader>
      <div className="px-[20px] py-[16px] flex flex-col gap-[12px]">
        <div className="flex flex-wrap gap-[8px]">
          <span
            className={`font-hanken font-semibold text-[11px] px-[10px] py-[4px] rounded-full ${option.visible ? "bg-green-100 text-green-800" : "bg-gc-bg-warm text-gc-primary-deep"}`}
          >
            {option.visible ? "Visible" : "Hidden"}
          </span>
        </div>
        <div className="rounded-[8px] overflow-hidden border border-gc-border-warm">
          {rows.map(([key, value], i) => {
            const displayValue = isBooleanField(key, fieldTypes)
              ? value === "true"
                ? "Yes"
                : "No"
              : value || "—";
            return (
              <div
                key={key}
                className={`grid grid-cols-2 gap-[12px] px-[14px] py-[10px] ${i > 0 ? "border-t border-gc-bg-warm" : ""} ${i % 2 !== 0 ? "bg-gc-row-alt" : "bg-white"}`}
              >
                <span className="font-hanken font-semibold text-[11px] tracking-[0.4px] text-gc-primary-deep">
                  {formatFieldLabel(key)}
                </span>
                <span className="font-hanken text-[13px] text-gc-near-black">
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ModalBase>
  );
}

export function EditContrastLocationModal({ option, onClose, onUpdated }) {
  const rawFields = option.rawFields ?? {};
  const fieldTypes = option.fieldTypes ?? {};

  const [form, setForm] = useState(() =>
    Object.fromEntries(Object.entries(rawFields).map(([k, v]) => [k, v ?? ""])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const isDirty = Object.keys(rawFields).some(
    (k) => form[k] !== (rawFields[k] ?? ""),
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.label?.trim()) {
      setError("Label is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" ? null : v]),
      );
      payload.label = form.label.trim();
      await updateContrastLocation(option.id, payload);
      onUpdated(option.id, {
        ...payload,
        label: payload.label,
        garment: payload.garment || "",
        visible: payload.visible === "true",
        isDefault: payload.is_default === "true",
        rawFields: { ...rawFields, ...payload },
      });
      clearContrastLocationsCache();
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

  const booleanKeys = Object.keys(rawFields).filter((k) =>
    isBooleanField(k, fieldTypes),
  );
  const textKeys = Object.keys(rawFields).filter(
    (k) => !isBooleanField(k, fieldTypes),
  );

  return (
    <ModalBase onClose={onClose}>
      <ModalHeader title="Edit Contrast Location" onClose={onClose} />
      <form
        onSubmit={handleSubmit}
        className="px-[20px] py-[16px] flex flex-col gap-[12px]"
      >
        {textKeys.map((key) => (
          <div key={key}>
            <label className={labelCls}>
              {formatFieldLabel(key)}
              {key === "label" && <span className="text-failed"> *</span>}
            </label>
            <input
              className={inputCls}
              value={form[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
              placeholder={
                key === "label"
                  ? "e.g. Lapel"
                  : key === "garment"
                    ? "e.g. Jacket"
                    : ""
              }
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-[16px] pt-[4px]">
          {booleanKeys.map((key) => (
            <label
              key={key}
              className="flex items-center gap-[8px] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={form[key] === "true"}
                onChange={(e) => set(key, e.target.checked ? "true" : "false")}
                className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
              />
              <span className="font-hanken font-semibold text-[12px] text-gc-heading">
                {formatFieldLabel(key)}
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
          disabled={saving || !isDirty}
          loading={saving}
          loadingLabel="Saving…"
        />
      </form>
    </ModalBase>
  );
}

export function DeleteContrastLocationModal({ option, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteContrastLocation(option.id);
      clearContrastLocationsCache();
      onDeleted(option.id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ModalBase onClose={onClose} maxWidth="max-w-[420px]">
      <ModalHeader title="Delete Location?" onClose={onClose} />
      <div className="px-[20px] py-[16px] flex flex-col gap-[12px]">
        <p className="font-hanken text-[14px] text-gc-text">
          Delete{" "}
          <span className="font-semibold text-gc-heading">
            "{option.label}"
          </span>
          ? This cannot be undone.
        </p>
        {error && (
          <p className="font-hanken text-[12px] text-failed">{error}</p>
        )}
        <div className="flex gap-[10px] justify-end pt-[4px]">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-[16px] py-[8px] text-[13px] font-hanken font-semibold text-gc-text rounded-lg hover:bg-gc-bg-warm transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-[6px] px-[16px] py-[8px] text-[13px] font-hanken font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {deleting && <Loader2 size={13} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

export function AddContrastModal({
  garment,
  onClose,
  onCreatedColor,
  onCreatedLocation,
}) {
  const [tab, setTab] = useState("color");
  const [form, setForm] = useState({
    // color fields
    color_name: "",
    color_hex: "",
    color_image: "",
    color_image_url: "",
    color_visible: "true",
    color_is_default: "false",
    // location fields
    label: "",
    location_visible: "true",
    location_is_default: "false",
    // shared
    garment: garment || "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function switchTab(newTab) {
    if (newTab === "color") {
      setForm((prev) => ({
        ...prev,
        label: "",
        location_visible: "true",
        location_is_default: "false",
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        color_name: "",
        color_hex: "",
        color_image: "",
        color_image_url: "",
        color_visible: "true",
        color_is_default: "false",
      }));
    }
    setError(null);
    setTab(newTab);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (tab === "color" && !form.color_name.trim()) {
      setError("Color name is required.");
      return;
    }
    if (tab === "location" && !form.label.trim()) {
      setError("Location label is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (tab === "color") {
        const colorNode = await createContrastOption({
          color_name: form.color_name.trim(),
          color_hex: form.color_hex || null,
          color_image: form.color_image || null,
          garment: form.garment,
          visible: form.color_visible,
          is_default: form.color_is_default,
        });
        clearStyleOptionsCache();
        onCreatedColor({
          id: colorNode.id,
          handle: colorNode.handle,
          label: form.color_name.trim(),
          category: "contrast_option",
          garment: form.garment,
          displayLabel: "Contrast Color & Locations",
          upcharge: 0,
          visible: form.color_visible === "true",
          isDefault: form.color_is_default === "true",
          sortOrder: 9999,
          colorHex: form.color_hex || null,
          imageGid: form.color_image || null,
          imageUrlStored: form.color_image_url || null,
          imageUrl: form.color_image_url || null,
          rawFields: {
            color_name: form.color_name.trim(),
            color_hex: form.color_hex || "",
            color_image: form.color_image || "",
            garment: form.garment,
            visible: form.color_visible,
            is_default: form.color_is_default,
          },
          fieldTypes: {},
          isContrastOption: true,
        });
      } else {
        const locationNode = await createContrastLocation({
          label: form.label.trim(),
          garment: form.garment,
          visible: form.location_visible,
          is_default: form.location_is_default,
        });
        clearContrastLocationsCache();
        onCreatedLocation({
          id: locationNode.id,
          handle: locationNode.handle,
          label: form.label.trim(),
          garment: form.garment,
          visible: form.location_visible === "true",
          isDefault: form.location_is_default === "true",
          rawFields: {
            label: form.label.trim(),
            garment: form.garment,
            visible: form.location_visible,
            is_default: form.location_is_default,
          },
          fieldTypes: {},
          isContrastLocation: true,
        });
      }
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
  const sectionLabelCls =
    "font-hanken font-semibold text-[10px] uppercase tracking-[0.6px] text-gc-primary pb-[4px] border-b border-gc-border-warm";

  return (
    <ModalBase onClose={onClose}>
      <ModalHeader title="Add Contrast Color & Location" onClose={onClose} />
      <form
        onSubmit={handleSubmit}
        className="px-[20px] py-[16px] flex flex-col gap-[12px]"
      >
        {/* ── Tab toggle ── */}
        <div className="flex rounded-[8px] overflow-hidden border border-gc-border-warm">
          {["color", "location"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 py-[8px] font-hanken font-semibold text-[12px] uppercase tracking-[0.5px] transition-colors cursor-pointer ${
                tab === t
                  ? "bg-gc-primary text-white"
                  : "bg-white text-gc-primary hover:bg-gc-bg-warm"
              }`}
            >
              {t === "color" ? "Color" : "Location"}
            </button>
          ))}
        </div>

        {/* ── Color fields ── */}
        {tab === "color" && (
          <>
            <div>
              <label className={labelCls}>Color Image</label>
              <ImagePicker
                currentUrl={form.color_image_url || null}
                gid={form.color_image}
                onUploaded={(gid, cdnUrl) => {
                  set("color_image", gid);
                  set("color_image_url", cdnUrl);
                }}
                onUploadChange={setImageUploading}
                onCleared={
                  form.color_image
                    ? () => {
                        set("color_image", "");
                        set("color_image_url", "");
                      }
                    : undefined
                }
              />
            </div>
            <div>
              <label className={labelCls}>
                Color Name <span className="text-failed">*</span>
              </label>
              <input
                className={inputCls}
                value={form.color_name}
                onChange={(e) => set("color_name", e.target.value)}
                placeholder="e.g. Navy Blue"
              />
            </div>
            <div>
              <label className={labelCls}>Color Hex</label>
              <div className="flex items-center gap-[6px]">
                <input
                  type="color"
                  className="rounded-[6px] cursor-pointer flex-shrink-0 w-[38px] h-[38px] p-[2px] border border-gc-border-warm"
                  value={form.color_hex || "#ffffff"}
                  onChange={(e) => set("color_hex", e.target.value)}
                />
                <input
                  className={inputCls}
                  value={form.color_hex}
                  onChange={(e) => set("color_hex", e.target.value)}
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </>
        )}

        {/* ── Location fields ── */}
        {tab === "location" && (
          <div>
            <label className={labelCls}>
              Label <span className="text-failed">*</span>
            </label>
            <input
              className={inputCls}
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="e.g. Lapel"
            />
          </div>
        )}

        {/* ── Garment (shared) ── */}
        <div>
          <label className={labelCls}>Garment</label>
          <input
            className={inputCls}
            value={form.garment}
            onChange={(e) => set("garment", e.target.value)}
            placeholder="e.g. Jacket"
          />
        </div>

        {/* ── Visible & Is Default (per tab) ── */}
        {tab === "color" && (
          <div className="flex flex-wrap gap-[16px] pt-[4px]">
            <label className="flex items-center gap-[8px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.color_visible === "true"}
                onChange={(e) =>
                  set("color_visible", e.target.checked ? "true" : "false")
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
                checked={form.color_is_default === "true"}
                onChange={(e) =>
                  set("color_is_default", e.target.checked ? "true" : "false")
                }
                className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
              />
              <span className="font-hanken font-semibold text-[12px] text-gc-heading">
                Is Default
              </span>
            </label>
          </div>
        )}
        {tab === "location" && (
          <div className="flex flex-wrap gap-[16px] pt-[4px]">
            <label className="flex items-center gap-[8px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.location_visible === "true"}
                onChange={(e) =>
                  set("location_visible", e.target.checked ? "true" : "false")
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
                checked={form.location_is_default === "true"}
                onChange={(e) =>
                  set(
                    "location_is_default",
                    e.target.checked ? "true" : "false",
                  )
                }
                className="w-[15px] h-[15px] cursor-pointer gc-accent-primary"
              />
              <span className="font-hanken font-semibold text-[12px] text-gc-heading">
                Is Default
              </span>
            </label>
          </div>
        )}

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

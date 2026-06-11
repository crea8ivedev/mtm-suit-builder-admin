import { useState } from "react";
import { Pencil } from "lucide-react";
import ModalBase, { ModalHeader, ModalFooter } from "../ui/ModalBase";
import {
  updateContrastOption,
  clearStyleOptionsCache,
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
    garment: option.garment || "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

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
        garment: form.garment,
      });
      onUpdated(option.id, {
        label: form.color_name.trim(),
        visible: form.visible === "true",
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

        <div className="flex items-center gap-[8px] pt-[4px]">
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
        </div>

        <p className="font-hanken text-[12px] h-[16px] text-failed">
          {error || ""}
        </p>

        <ModalFooter
          onClose={onClose}
          submitLabel="Save Changes"
          disabled={saving || imageUploading}
          loading={saving}
          loadingLabel={imageUploading ? "Uploading image…" : "Saving…"}
        />
      </form>
    </ModalBase>
  );
}

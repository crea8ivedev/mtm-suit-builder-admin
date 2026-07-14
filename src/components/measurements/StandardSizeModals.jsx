import { useState } from "react";
import ModalBase, { ModalHeader, ModalFooter } from "../ui/ModalBase";
import {
  createSizeTemplateEntry,
  updateSizeTemplateEntry,
  deleteSizeTemplateEntry,
  clearSizeTemplateCache,
} from "../../lib/shopify";

// Field keys differ per garment in the underlying *_size_template metaobjects
// (real data, not invented) — hardcoded per garment like every other
// garment-specific list in this app (FETCHERS in CreateOrder.jsx, etc.)
export const SIZE_TEMPLATE_FIELDS = {
  Jacket: [
    { key: "size", label: "Size (e.g. 40R)" },
    { key: "chest", label: "Chest" },
    { key: "stomach", label: "Stomach" },
    { key: "shoulder", label: "Shoulder" },
    { key: "back_length", label: "Back Length" },
    { key: "sleeve_r", label: "Sleeve (R)" },
    { key: "sleeve_l", label: "Sleeve (L)" },
    { key: "seat", label: "Seat" },
    { key: "bicep", label: "Bicep" },
  ],
  Trouser: [
    { key: "size", label: "Size (numeric)" },
    { key: "size_label", label: "Size Label (e.g. XS/S/M)" },
    { key: "waist", label: "Waist" },
    { key: "seat_hips", label: "Seat / Hips" },
    { key: "l_outseam", label: "Outseam (L)" },
    { key: "r_outseam", label: "Outseam (R)" },
    { key: "thigh", label: "Thigh" },
    { key: "knee", label: "Knee" },
    { key: "urise", label: "U-Rise" },
    { key: "bottom", label: "Bottom" },
  ],
  Vest: [
    { key: "size", label: "Size Label" },
    { key: "size_label", label: "Size (numeric)" },
    { key: "chest", label: "Chest" },
    { key: "waist", label: "Waist" },
    { key: "bottom", label: "Bottom" },
    { key: "shoulder", label: "Shoulder" },
    { key: "back_length", label: "Back Length" },
  ],
  Shirt: [
    { key: "size", label: "Size (e.g. S/M/L)" },
    { key: "chest", label: "Chest" },
    { key: "neck", label: "Neck" },
    { key: "stomach", label: "Stomach" },
    { key: "seat", label: "Seat" },
    { key: "shoulder", label: "Shoulder" },
    { key: "sleeve_r", label: "Sleeve (R)" },
    { key: "sleeve_l", label: "Sleeve (L)" },
    { key: "bicep", label: "Bicep" },
    { key: "cuff_l", label: "Cuff (L)" },
    { key: "cuff_r", label: "Cuff (R)" },
    { key: "back_length", label: "Back Length" },
  ],
};

const INPUT_CLASS =
  "w-full h-[38px] px-[12px] rounded-[8px] font-hanken text-[13px] text-gc-near-black2 bg-white outline-none border border-gc-border-input focus:border-gc-primary transition-colors";
const LABEL_CLASS =
  "font-hanken text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide";

function SizeTemplateForm({ garment, fields, onFieldsChange }) {
  const fieldDefs = SIZE_TEMPLATE_FIELDS[garment] ?? [];
  return (
    <div className="grid grid-cols-2 gap-[16px]">
      {fieldDefs.map((def) => (
        <div key={def.key} className="flex flex-col gap-[6px]">
          <label className={LABEL_CLASS}>{def.label}</label>
          <input
            type="text"
            value={fields[def.key] ?? ""}
            onChange={(e) =>
              onFieldsChange({ ...fields, [def.key]: e.target.value })
            }
            className={INPUT_CLASS}
          />
        </div>
      ))}
    </div>
  );
}

function emptyFields(garment) {
  return Object.fromEntries(
    (SIZE_TEMPLATE_FIELDS[garment] ?? []).map((def) => [def.key, ""]),
  );
}

export function AddStandardSizeModal({ garment, garmentType, onClose, onSaved }) {
  const [fields, setFields] = useState(() => emptyFields(garment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = (fields.size ?? "").trim() !== "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createSizeTemplateEntry(garmentType, fields);
      clearSizeTemplateCache(garment);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalBase onClose={onClose} maxWidth="max-w-[640px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-[16px] p-[20px]">
        <ModalHeader title="Add Standard Size" subtitle={garment} onClose={onClose} />
        <SizeTemplateForm garment={garment} fields={fields} onFieldsChange={setFields} />
        {error && <p className="font-hanken text-[12px] text-red-600">{error}</p>}
        <ModalFooter
          onClose={onClose}
          submitLabel="Add Size"
          disabled={!canSubmit}
          loading={saving}
        />
      </form>
    </ModalBase>
  );
}

export function EditStandardSizeModal({ garment, entry, onClose, onSaved }) {
  const [fields, setFields] = useState(() => ({
    ...emptyFields(garment),
    ...entry.values,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = (fields.size ?? "").trim() !== "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await updateSizeTemplateEntry(entry.id, fields);
      clearSizeTemplateCache(garment);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalBase onClose={onClose} maxWidth="max-w-[640px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-[16px] p-[20px]">
        <ModalHeader title="Edit Standard Size" subtitle={garment} onClose={onClose} />
        <SizeTemplateForm garment={garment} fields={fields} onFieldsChange={setFields} />
        {error && <p className="font-hanken text-[12px] text-red-600">{error}</p>}
        <ModalFooter
          onClose={onClose}
          submitLabel="Save Changes"
          disabled={!canSubmit}
          loading={saving}
        />
      </form>
    </ModalBase>
  );
}

export function DeleteStandardSizeModal({ garment, entry, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete(e) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    try {
      await deleteSizeTemplateEntry(entry.id);
      clearSizeTemplateCache(garment);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <ModalBase onClose={onClose} maxWidth="max-w-[420px]">
      <form onSubmit={handleDelete} className="flex flex-col gap-[16px] p-[20px]">
        <ModalHeader title="Delete Standard Size" onClose={onClose} />
        <p className="font-hanken text-[14px] text-gc-near-black2">
          Delete <span className="font-semibold">{entry.label}</span> from{" "}
          {garment}'s standard size chart? Orders already created from this
          size keep their filled-in measurements.
        </p>
        {error && <p className="font-hanken text-[12px] text-red-600">{error}</p>}
        <ModalFooter
          onClose={onClose}
          submitLabel="Delete"
          loading={deleting}
          destructive
        />
      </form>
    </ModalBase>
  );
}

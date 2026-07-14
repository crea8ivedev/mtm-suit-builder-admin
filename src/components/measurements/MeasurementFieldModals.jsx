import { useState } from "react";
import ModalBase, { ModalHeader, ModalFooter } from "../ui/ModalBase";
import {
  createMeasurementField,
  updateMeasurementField,
  deleteMeasurementField,
  clearMeasurementFieldsCache,
} from "../../lib/shopify";

const INPUT_CLASS =
  "w-full h-[38px] px-[12px] rounded-[8px] font-hanken text-[13px] text-gc-near-black2 bg-white outline-none border border-gc-border-input focus:border-gc-primary transition-colors";
const LABEL_CLASS =
  "font-hanken text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide";

function MeasurementFieldForm({ fields, onFieldsChange }) {
  return (
    <div className="grid grid-cols-2 gap-[16px]">
      <div className="flex flex-col gap-[6px]">
        <label className={LABEL_CLASS}>Key</label>
        <input
          type="text"
          value={fields.key}
          onChange={(e) => onFieldsChange({ ...fields, key: e.target.value })}
          placeholder="e.g. chest"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className={LABEL_CLASS}>Label</label>
        <input
          type="text"
          value={fields.label}
          onChange={(e) =>
            onFieldsChange({ ...fields, label: e.target.value })
          }
          placeholder="e.g. Chest"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className={LABEL_CLASS}>Min</label>
        <input
          type="number"
          step="any"
          value={fields.min}
          onChange={(e) => onFieldsChange({ ...fields, min: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className={LABEL_CLASS}>Max</label>
        <input
          type="number"
          step="any"
          value={fields.max}
          onChange={(e) => onFieldsChange({ ...fields, max: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}

export function AddMeasurementFieldModal({ garment, garmentType, onClose, onSaved }) {
  const [fields, setFields] = useState({ key: "", label: "", min: "", max: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit =
    fields.key.trim() && fields.label.trim() && fields.min !== "" && fields.max !== "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createMeasurementField(garmentType, {
        key: fields.key.trim(),
        label: fields.label.trim(),
        min: fields.min,
        max: fields.max,
      });
      clearMeasurementFieldsCache(garment);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalBase onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-[16px] p-[20px]">
        <ModalHeader
          title="Add Measurement Field"
          subtitle={garment}
          onClose={onClose}
        />
        <MeasurementFieldForm fields={fields} onFieldsChange={setFields} />
        {error && <p className="font-hanken text-[12px] text-red-600">{error}</p>}
        <ModalFooter
          onClose={onClose}
          submitLabel="Add Field"
          disabled={!canSubmit}
          loading={saving}
        />
      </form>
    </ModalBase>
  );
}

export function EditMeasurementFieldModal({ garment, field, onClose, onSaved }) {
  const [fields, setFields] = useState({
    key: field.key,
    label: field.label,
    min: String(field.min),
    max: String(field.max),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit =
    fields.key.trim() && fields.label.trim() && fields.min !== "" && fields.max !== "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await updateMeasurementField(field.id, {
        key: fields.key.trim(),
        label: fields.label.trim(),
        min: fields.min,
        max: fields.max,
      });
      clearMeasurementFieldsCache(garment);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalBase onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-[16px] p-[20px]">
        <ModalHeader
          title="Edit Measurement Field"
          subtitle={garment}
          onClose={onClose}
        />
        <MeasurementFieldForm fields={fields} onFieldsChange={setFields} />
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

export function DeleteMeasurementFieldModal({ garment, field, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete(e) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    try {
      await deleteMeasurementField(field.id);
      clearMeasurementFieldsCache(garment);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <ModalBase onClose={onClose} maxWidth="max-w-[420px]">
      <form
        onSubmit={handleDelete}
        className="flex flex-col gap-[16px] p-[20px]"
      >
        <ModalHeader title="Delete Measurement Field" onClose={onClose} />
        <p className="font-hanken text-[14px] text-gc-near-black2">
          Delete <span className="font-semibold">{field.label}</span> from{" "}
          {garment}? Orders already using this field keep their stored value —
          only new entry/validation for it disappears.
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

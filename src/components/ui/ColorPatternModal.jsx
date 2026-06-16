import { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Pencil,
  Check,
  Loader2,
  AlertCircle,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import {
  fetchShopifyColorPattern,
  clearShopifyColorPatternCache,
  createColorPattern,
  updateColorPattern,
  deleteColorPattern,
  uploadImageToShopify,
  fetchProductVariantsDetail,
  createProductOptionValue,
  addVariantToProduct,
  removeVariantsFromProduct,
} from "../../lib/shopify";

const EMPTY_FORM = {
  label: "",
  color: "#000000",
  code: "",
  imageGid: null,
  imageUrl: null,
};

// ── Confirm dialog for removing a variant ──────────────────────────────────
function ConfirmRemoveDialog({ label, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-[16px]">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-[420px] p-[20px] sm:p-[24px] border border-gc-border">
        <h3 className="text-[16px] font-semibold text-gc-heading mb-[8px]">
          Remove from Variants?
        </h3>
        <p className="text-[14px] text-gc-text mb-[20px]">
          This will remove{" "}
          <span className="font-semibold text-gc-heading">"{label}"</span> from
          this product's variant options.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-[8px] sm:gap-[10px] sm:justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto px-[16px] py-[10px] sm:py-[8px] text-[13px] text-gc-text rounded-lg hover:bg-gc-bg-warm transition-colors disabled:opacity-50 cursor-pointer border border-gc-border sm:border-0"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-[6px] px-[16px] py-[10px] sm:py-[8px] text-[13px] bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Remove Variant
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PatternForm ─────────────────────────────────
function PatternForm({
  form,
  setForm,
  fileRef,
  onImageUpload,
  imageUploading,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Label <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="w-full border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
          placeholder="e.g. Navy Blue"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Color Hex
        </label>
        <div className="flex gap-[6px]">
          <input
            type="color"
            value={form.color || "#000000"}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="w-[40px] h-[36px] sm:w-[36px] sm:h-[34px] border border-gc-border-input rounded-md cursor-pointer p-[2px] flex-shrink-0"
          />
          <input
            type="text"
            value={form.color || ""}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="flex-1 border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-gc-primary"
            placeholder="#000000"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Code
        </label>
        <input
          type="text"
          value={form.code || ""}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          className="w-full border border-gc-border-input rounded-md px-[10px] py-[8px] sm:py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
          placeholder="Optional code"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gc-muted mb-[4px]">
          Image
        </label>
        <div className="flex items-center gap-[8px]">
          <div className="w-[36px] h-[36px] sm:w-[34px] sm:h-[34px] rounded-md overflow-hidden border border-gc-border bg-gc-bg-warm flex-shrink-0 flex items-center justify-center">
            {form.imageUrl ? (
              <img
                src={form.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Upload size={12} className="text-gc-muted" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={imageUploading}
            className="text-[13px] sm:text-[12px] text-gc-primary hover:text-gc-primary-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {imageUploading
              ? "Uploading…"
              : form.imageUrl
                ? "Change"
                : "Upload"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── PatternCard ──────────
function PatternCard({ pattern, isVariant, onAdd, adding }) {
  return (
    <button
      onClick={!isVariant ? onAdd : undefined}
      disabled={isVariant || adding}
      className={[
        "w-full border rounded-xl overflow-hidden transition-all text-left flex flex-col sm:flex-row sm:items-center sm:gap-[12px] sm:p-[12px]",
        isVariant
          ? "border-gc-border-warm bg-gc-bg-warm cursor-default"
          : adding
            ? "border-gc-border bg-white opacity-60 cursor-wait"
            : "border-gc-border bg-white hover:border-gc-primary hover:shadow-sm cursor-pointer",
      ].join(" ")}
      title={
        isVariant
          ? "Already added as variant"
          : "Click to add as product variant"
      }
    >
      {/* Image — full-width square on mobile, fixed thumb on desktop */}
      <div className="w-full aspect-square sm:w-[48px] sm:h-[48px] sm:aspect-auto sm:rounded-lg sm:flex-shrink-0 border-b sm:border border-gc-border overflow-hidden">
        {pattern.imageUrl ? (
          <img
            src={pattern.imageUrl}
            alt={pattern.label}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: pattern.color ?? "#e5e7eb" }}
          />
        )}
      </div>

      {/* Info row */}
      <div className="flex items-center gap-[6px] px-[10px] py-[8px] sm:p-0 sm:flex-1 sm:min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] sm:text-[14px] font-medium text-gc-heading line-clamp-2 sm:truncate leading-tight">
            {pattern.label}
          </p>
          <div className="hidden sm:flex items-center gap-[6px] mt-[2px]">
            {pattern.color && (
              <span className="text-[11px] font-mono text-gc-muted">
                {pattern.color}
              </span>
            )}
            {pattern.code && (
              <span className="text-[11px] text-gc-muted">
                · {pattern.code}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-center">
          {adding ? (
            <Loader2 size={14} className="animate-spin text-gc-muted" />
          ) : isVariant ? (
            <CheckCircle2 size={16} className="text-gc-primary" />
          ) : (
            <Plus size={15} className="text-gc-primary" />
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────
export default function ColorPatternModal({ product, onClose }) {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [imageUploading, setImageUploading] = useState(false);
  const [variantDetail, setVariantDetail] = useState({
    options: [],
    variants: [],
  });
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [addingIds, setAddingIds] = useState(new Set());
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const editFileRef = useRef(null);
  const addFileRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // ── Loaders ──────────────────────────────────────────────────────────────
  function loadPatterns(clearCache = false) {
    if (clearCache) clearShopifyColorPatternCache();
    setLoading(true);
    setError(null);
    fetchShopifyColorPattern()
      .then(setPatterns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function loadVariants() {
    setVariantsLoading(true);
    fetchProductVariantsDetail(product.id)
      .then(setVariantDetail)
      .catch(() => setVariantDetail({ options: [], variants: [] }))
      .finally(() => setVariantsLoading(false));
  }

  useEffect(() => {
    loadPatterns();
    loadVariants();
  }, [product.id]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getFabricOptionName() {
    const opts = variantDetail.options;
    const fabric = opts.find((o) => o.name.toLowerCase() === "fabric");
    return fabric?.name ?? opts[0]?.name ?? "Fabric";
  }

  function getVariantValues() {
    const optName = getFabricOptionName();
    const seen = new Set();
    return variantDetail.variants.flatMap((v) => {
      const opt = v.selectedOptions.find((o) => o.name === optName);
      if (!opt || seen.has(opt.value)) return [];
      seen.add(opt.value);
      return [{ value: opt.value, variantId: v.id }];
    });
  }

  function isAlreadyVariant(label) {
    return getVariantValues().some(
      (v) => v.value.toLowerCase() === label.toLowerCase(),
    );
  }

  // ── Add pattern as variant ─────────────────────────────────────────────
  async function handleAddToVariants(pattern) {
    const opts = variantDetail.options;
    const opt = opts.find((o) => o.name.toLowerCase() === "fabric") ?? opts[0];
    if (!opt) {
      alert("No product option found to add the variant to.");
      return;
    }
    if (!opt.id) {
      alert(
        `Option "${opt.name}" is missing its Shopify ID. Try closing and reopening this modal.`,
      );
      return;
    }

    const key = pattern.id ?? pattern.handle;
    setAddingIds((prev) => new Set([...prev, key]));
    try {
      const isConnected = !!opt.linkedMetafield;

      if (isConnected) {
        let optionValue = (opt.optionValues ?? []).find(
          (ov) => ov.name.toLowerCase() === pattern.label.toLowerCase(),
        );
        if (!optionValue) {
          if (!pattern.id) {
            throw new Error(
              `Cannot add "${pattern.label}" — color pattern is missing its Shopify metaobject ID. Try refreshing.`,
            );
          }
          optionValue = await createProductOptionValue(
            product.id,
            opt.id,
            pattern.id,
          );
        }

        if (!optionValue?.id) {
          throw new Error(
            `Could not create option value for "${pattern.label}".`,
          );
        }

        await addVariantToProduct(
          product.id,
          optionValue.id,
          opt.name,
          variantDetail.variants,
          null,
          pattern.imageUrl,
        );
      } else {
        await addVariantToProduct(
          product.id,
          null,
          opt.name,
          variantDetail.variants,
          pattern.label,
          pattern.imageUrl,
        );
      }
      loadVariants();
    } catch (e) {
      alert(e.message);
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  // ── Remove variant (show confirm first) ──────────────────────────────────
  function requestRemoveVariant(label) {
    const variantIds = variantDetail.variants
      .filter((v) =>
        v.selectedOptions.some(
          (o) =>
            o.name === getFabricOptionName() &&
            o.value.toLowerCase() === label.toLowerCase(),
        ),
      )
      .map((v) => v.id);
    setConfirmRemove({ label, variantIds });
  }

  async function confirmDoRemove() {
    if (!confirmRemove) return;
    setRemoving(true);
    try {
      await removeVariantsFromProduct(product.id, confirmRemove.variantIds);
      setConfirmRemove(null);
      loadVariants();
    } catch (e) {
      alert(e.message);
    } finally {
      setRemoving(false);
    }
  }

  // ── Edit color pattern ────────────────────────
  function startEdit(pattern) {
    setShowAdd(false);
    setEditingId(pattern.id);
    setEditForm({
      label: pattern.label ?? "",
      color: pattern.color ?? "#000000",
      code: pattern.code ?? "",
      imageGid: pattern.imageGid ?? null,
      imageUrl: pattern.imageUrl ?? null,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ ...EMPTY_FORM });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateColorPattern(editingId, {
        label: editForm.label,
        color: editForm.color || null,
        imageGid: editForm.imageGid || null,
        code: editForm.code || null,
      });
      setEditingId(null);
      loadPatterns(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Create new color pattern ──────────────────────────────────────────────
  async function handleCreate() {
    if (!addForm.label.trim()) return;
    setSaving(true);
    try {
      await createColorPattern({
        label: addForm.label,
        color: addForm.color || null,
        imageGid: addForm.imageGid || null,
        code: addForm.code || null,
      });
      setShowAdd(false);
      setAddForm({ ...EMPTY_FORM });
      loadPatterns(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────────
  async function handleImageUpload(file, isAdd) {
    setImageUploading(true);
    try {
      const { gid, cdnUrl } = await uploadImageToShopify(file);
      if (isAdd) {
        setAddForm((f) => ({ ...f, imageGid: gid, imageUrl: cdnUrl }));
      } else {
        setEditForm((f) => ({ ...f, imageGid: gid, imageUrl: cdnUrl }));
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setImageUploading(false);
    }
  }

  // ── Derived: variant value list ───────────────────────────────────────────
  const variantValues = getVariantValues();

  return (
    <>
      {confirmRemove && (
        <ConfirmRemoveDialog
          label={confirmRemove.label}
          onConfirm={confirmDoRemove}
          onCancel={() => setConfirmRemove(null)}
          loading={removing}
        />
      )}

      <div
        className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-[16px]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-[900px] max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-gc-border-warm">
          {/* Header */}
          <div className="flex items-center justify-between px-[16px] sm:px-[24px] py-[14px] sm:py-[16px] border-b border-gc-border flex-shrink-0">
            <div className="flex items-center gap-[10px] sm:gap-[12px] min-w-0">
              {product.imageUrl && (
                <div className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] rounded-md overflow-hidden border border-gc-border flex-shrink-0 bg-gc-bg-warm">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-[14px] sm:text-[16px] font-semibold text-gc-heading font-garamond truncate">
                  {product.title}
                </h2>
                <p className="text-[11px] sm:text-[12px] text-gc-muted">
                  Color Patterns · {loading ? "…" : `${patterns.length} total`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[6px] sm:gap-[8px] flex-shrink-0">
              <button
                onClick={() => {
                  loadPatterns(true);
                  loadVariants();
                }}
                disabled={loading || variantsLoading}
                className="w-[32px] h-[32px] flex items-center justify-center rounded-lg text-gc-muted hover:text-gc-heading hover:bg-gc-bg-warm disabled:opacity-50 transition-colors cursor-pointer"
                title="Refresh from Shopify"
              >
                <RefreshCw
                  size={15}
                  className={loading || variantsLoading ? "animate-spin" : ""}
                />
              </button>
              <button
                onClick={() => {
                  setShowAdd(true);
                  setEditingId(null);
                }}
                className="flex items-center gap-[5px] bg-gc-primary text-white text-[12px] sm:text-[13px] font-medium px-[10px] sm:px-[12px] py-[7px] rounded-lg hover:bg-gc-primary-dark transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span className="hidden xs:inline sm:inline">Add Pattern</span>
                <span className="inline xs:hidden sm:hidden">Add</span>
              </button>
              <button
                onClick={onClose}
                className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-gc-muted hover:text-gc-heading hover:bg-gc-bg-warm transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-[16px] sm:p-[24px]">
            {/* ── Product Variants ── */}
            <div className="mb-[20px]">
              <p className="text-[11px] font-semibold text-gc-muted uppercase tracking-widest mb-[12px]">
                Product Variants
              </p>

              {variantsLoading ? (
                <div className="flex items-center gap-[8px] text-gc-muted">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[12px]">Loading variants…</span>
                </div>
              ) : variantDetail.options.length === 0 ? (
                <p className="text-[13px] text-gc-muted">No variants found.</p>
              ) : (
                <div className="flex flex-col gap-[14px]">
                  {variantDetail.options.map((opt) => {
                    const optValues = [
                      ...new Set(
                        variantDetail.variants.flatMap((v) =>
                          v.selectedOptions
                            .filter((o) => o.name === opt.name)
                            .map((o) => o.value),
                        ),
                      ),
                    ];

                    const editingInThisOpt =
                      editingId &&
                      optValues.some((val) => {
                        const m = patterns.find(
                          (p) => p.label.toLowerCase() === val.toLowerCase(),
                        );
                        return m?.id === editingId;
                      });

                    return (
                      <div key={opt.name}>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-[6px] sm:gap-[10px]">
                          <span className="text-[11px] sm:text-[12px] font-semibold sm:font-medium text-gc-muted sm:w-[64px] flex-shrink-0 sm:pt-[6px] uppercase sm:normal-case tracking-wide sm:tracking-normal">
                            {opt.name}
                          </span>
                          <div className="flex flex-wrap gap-[6px] sm:gap-[8px]">
                            {optValues.map((val) => {
                              const matched = patterns.find(
                                (p) =>
                                  p.label.toLowerCase() === val.toLowerCase(),
                              );
                              const isThisEditing = matched?.id === editingId;

                              return (
                                <div
                                  key={val}
                                  className={[
                                    "flex items-center gap-[5px] sm:gap-[6px] border rounded-full pl-[4px] py-[3px] transition-colors group",
                                    isThisEditing
                                      ? "bg-gc-bg-warm border-gc-primary pr-[6px]"
                                      : "bg-gc-bg-warm border-gc-border pr-[6px]",
                                  ].join(" ")}
                                >
                                  {/* Swatch */}
                                  <div className="w-[20px] h-[20px] rounded-full overflow-hidden flex-shrink-0 border border-gc-border-warm">
                                    {matched?.imageUrl ? (
                                      <img
                                        src={matched.imageUrl}
                                        alt={val}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div
                                        className="w-full h-full"
                                        style={{
                                          backgroundColor:
                                            matched?.color ?? "#e5e7eb",
                                        }}
                                      />
                                    )}
                                  </div>
                                  {/* Label */}
                                  <span className="text-[12px] text-gc-heading font-medium">
                                    {val}
                                  </span>
                                  {/* Actions */}
                                  <div className="flex gap-[2px] ml-[2px]">
                                    {matched && (
                                      <button
                                        onClick={() =>
                                          isThisEditing
                                            ? cancelEdit()
                                            : startEdit(matched)
                                        }
                                        className={[
                                          "w-[22px] h-[22px] sm:w-[20px] sm:h-[20px] flex items-center justify-center rounded-full transition-colors cursor-pointer",
                                          isThisEditing
                                            ? "text-gc-primary bg-gc-bg-warm"
                                            : "text-gc-muted hover:text-gc-heading hover:bg-gc-bg",
                                        ].join(" ")}
                                        title={
                                          isThisEditing
                                            ? "Cancel edit"
                                            : "Edit color pattern"
                                        }
                                      >
                                        <Pencil size={10} />
                                      </button>
                                    )}
                                    {/* Remove from variants — NOT delete metaobject */}
                                    <button
                                      onClick={() => requestRemoveVariant(val)}
                                      className="w-[22px] h-[22px] sm:w-[20px] sm:h-[20px] flex items-center justify-center rounded-full text-gc-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                      title="Remove from variants (color pattern stays)"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {editingInThisOpt && (
                          <div className="mt-[10px] ml-0 sm:ml-[74px] border border-gc-border-warm bg-gc-bg-warm rounded-xl p-[14px]">
                            <p className="text-[12px] font-semibold text-gc-primary mb-[10px]">
                              Editing:{" "}
                              {optValues.find((val) => {
                                const m = patterns.find(
                                  (p) =>
                                    p.label.toLowerCase() === val.toLowerCase(),
                                );
                                return m?.id === editingId;
                              })}
                            </p>
                            <PatternForm
                              form={editForm}
                              setForm={setEditForm}
                              fileRef={editFileRef}
                              onImageUpload={(f) => handleImageUpload(f, false)}
                              imageUploading={imageUploading}
                            />
                            <div className="flex gap-[8px] mt-[12px]">
                              <button
                                onClick={handleSave}
                                disabled={saving || !editForm.label?.trim()}
                                className="flex items-center gap-[6px] bg-gc-primary-deep text-white text-[12px] px-[12px] py-[8px] sm:py-[6px] rounded-lg disabled:opacity-50 hover:bg-gc-primary-dark transition-colors cursor-pointer"
                              >
                                {saving ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-[12px] text-gc-text px-[12px] py-[8px] sm:py-[6px] rounded-lg hover:bg-gc-bg transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gc-border mb-[20px]" />

            {/* ── All Color Patterns ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[4px] mb-[16px]">
              <p className="text-[11px] font-semibold text-gc-muted uppercase tracking-widest">
                All Color Patterns
              </p>
              <p className="text-[11px] text-gc-muted">
                Tap a pattern to add it as a product variant
              </p>
            </div>

            {/* Add Form */}
            {showAdd && (
              <div className="mb-[20px] border border-gc-border-warm bg-gc-bg-warm rounded-xl p-[14px] sm:p-[16px]">
                <p className="text-[13px] font-semibold text-gc-primary-deep mb-[12px]">
                  New Color Pattern
                </p>
                <PatternForm
                  form={addForm}
                  setForm={setAddForm}
                  fileRef={addFileRef}
                  onImageUpload={(f) => handleImageUpload(f, true)}
                  imageUploading={imageUploading}
                />
                <div className="flex gap-[8px] mt-[12px]">
                  <button
                    onClick={handleCreate}
                    disabled={saving || !addForm.label.trim()}
                    className="flex items-center gap-[6px] bg-gc-primary-deep text-white text-[13px] px-[14px] py-[9px] sm:py-[7px] rounded-lg disabled:opacity-50 hover:bg-gc-primary-dark transition-colors cursor-pointer"
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowAdd(false);
                      setAddForm({ ...EMPTY_FORM });
                    }}
                    className="text-[13px] text-gc-text px-[14px] py-[9px] sm:py-[7px] rounded-lg hover:bg-gc-bg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-[48px] gap-[10px] text-gc-muted">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-[13px]">Loading color patterns…</span>
              </div>
            )}

            {!loading && error && (
              <div className="flex items-start gap-[10px] p-[16px] bg-red-50 rounded-lg border border-red-200">
                <AlertCircle
                  size={16}
                  className="text-red-500 flex-shrink-0 mt-[1px]"
                />
                <div className="flex-1">
                  <p className="text-[13px] text-red-600">{error}</p>
                  <button
                    onClick={() => loadPatterns(true)}
                    className="text-[12px] text-red-500 underline mt-[4px] cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && patterns.length === 0 && !showAdd && (
              <div className="text-center py-[48px]">
                <p className="text-[14px] text-gc-muted">
                  No color patterns found in Shopify.
                </p>
                <p className="text-[12px] text-gc-muted-warm mt-[4px]">
                  Use "Add Pattern" to create one.
                </p>
              </div>
            )}

            {!loading && !error && patterns.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-[10px]">
                {patterns.map((p) => (
                  <PatternCard
                    key={p.id ?? p.handle}
                    pattern={p}
                    isVariant={isAlreadyVariant(p.label)}
                    onAdd={() => handleAddToVariants(p)}
                    adding={addingIds.has(p.id ?? p.handle)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

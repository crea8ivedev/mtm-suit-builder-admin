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
  Minus,
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
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-[16px]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] p-[24px]">
        <h3 className="text-[16px] font-semibold text-gray-800 mb-[8px]">
          Remove from Variants?
        </h3>
        <p className="text-[14px] text-gray-600 mb-[6px]">
          This will remove{" "}
          <span className="font-semibold text-gray-800">"{label}"</span> from
          this product's variant options.
        </p>
        <p className="text-[13px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-[12px] py-[8px] mb-[20px]">
          The color pattern itself will <strong>not</strong> be deleted — it
          stays in Shopify. Only the product variant is removed.
        </p>
        <div className="flex gap-[10px] justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-[16px] py-[8px] text-[13px] text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-[6px] px-[16px] py-[8px] text-[13px] bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Remove Variant
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PatternForm (shared for create / edit) ─────────────────────────────────
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
        <label className="block text-[11px] font-medium text-gray-500 mb-[4px]">
          Label <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-[10px] py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400"
          placeholder="e.g. Navy Blue"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gray-500 mb-[4px]">
          Color Hex
        </label>
        <div className="flex gap-[6px]">
          <input
            type="color"
            value={form.color || "#000000"}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="w-[36px] h-[34px] border border-gray-300 rounded-md cursor-pointer p-[2px] flex-shrink-0"
          />
          <input
            type="text"
            value={form.color || ""}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="flex-1 border border-gray-300 rounded-md px-[10px] py-[6px] text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="#000000"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gray-500 mb-[4px]">
          Code
        </label>
        <input
          type="text"
          value={form.code || ""}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-[10px] py-[6px] text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400"
          placeholder="Optional code"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gray-500 mb-[4px]">
          Image
        </label>
        <div className="flex items-center gap-[8px]">
          <div className="w-[34px] h-[34px] rounded-md overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0 flex items-center justify-center">
            {form.imageUrl ? (
              <img
                src={form.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Upload size={12} className="text-gray-400" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={imageUploading}
            className="text-[12px] text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
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

// ── PatternCard — clickable, shows checkmark if already a variant ──────────
function PatternCard({ pattern, isVariant, onAdd, adding }) {
  return (
    <button
      onClick={!isVariant ? onAdd : undefined}
      disabled={isVariant || adding}
      className={[
        "w-full border rounded-xl p-[12px] flex items-center gap-[12px] transition-all text-left",
        isVariant
          ? "border-green-300 bg-green-50 cursor-default"
          : adding
            ? "border-gray-200 bg-white opacity-60 cursor-wait"
            : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer",
      ].join(" ")}
      title={
        isVariant
          ? "Already added as variant"
          : "Click to add as product variant"
      }
    >
      <div className="w-[48px] h-[48px] rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
        {pattern.imageUrl ? (
          <img
            src={pattern.imageUrl}
            alt={pattern.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: pattern.color ?? "#e5e7eb" }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-gray-800 truncate">
          {pattern.label}
        </p>
        <div className="flex items-center gap-[6px] mt-[2px]">
          {pattern.color && (
            <span className="text-[11px] font-mono text-gray-400">
              {pattern.color}
            </span>
          )}
          {pattern.code && (
            <span className="text-[11px] text-gray-400">· {pattern.code}</span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 w-[28px] flex items-center justify-center">
        {adding ? (
          <Loader2 size={15} className="animate-spin text-gray-400" />
        ) : isVariant ? (
          <CheckCircle2 size={18} className="text-green-500" />
        ) : (
          <Plus size={16} className="text-blue-400" />
        )}
      </div>
    </button>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────
export default function ColorPatternModal({ product, onClose }) {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit state (triggered from variant chip pencil)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Create state
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [imageUploading, setImageUploading] = useState(false);

  // Variant management
  const [variantDetail, setVariantDetail] = useState({
    options: [],
    variants: [],
  });
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [addingIds, setAddingIds] = useState(new Set()); // pattern IDs being added to variants
  const [confirmRemove, setConfirmRemove] = useState(null); // { label, variantIds }
  const [removing, setRemoving] = useState(false);

  const editFileRef = useRef(null);
  const addFileRef = useRef(null);

  // Keyboard / scroll lock
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
  // Detect which option to use (prefer "Fabric" option, else first option)
  function getFabricOptionName() {
    const opts = variantDetail.options;
    const fabric = opts.find((o) => o.name.toLowerCase() === "fabric");
    return fabric?.name ?? opts[0]?.name ?? "Fabric";
  }

  // Get current variant values for the fabric option
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

  // Check if a pattern label is already a variant
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
        // Connected option (values linked to metaobjects via shopify-color-pattern)
        // Step 1 — find existing ProductOptionValue for this label
        let optionValue = (opt.optionValues ?? []).find(
          (ov) => ov.name.toLowerCase() === pattern.label.toLowerCase(),
        );

        // Step 2 — ProductOptionValue not on this product yet; create it
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

        // Step 3 — create variant referencing the ProductOptionValue GID
        await addVariantToProduct(
          product.id,
          optionValue.id,
          opt.name,
          variantDetail.variants,
          null,
          pattern.imageUrl,
        );
      } else {
        // Plain-text option — add variant by label name directly
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

  // ── Edit color pattern (from variant chip pencil) ────────────────────────
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
      {/* Confirm remove dialog */}
      {confirmRemove && (
        <ConfirmRemoveDialog
          label={confirmRemove.label}
          onConfirm={confirmDoRemove}
          onCancel={() => setConfirmRemove(null)}
          loading={removing}
        />
      )}

      <div
        className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-[8px] sm:p-[16px]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-[14px] sm:px-[24px] py-[12px] sm:py-[16px] border-b border-gray-200 flex-shrink-0 gap-[8px]">
            <div className="flex items-center gap-[10px] sm:gap-[12px] min-w-0">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] rounded-md object-contain border border-gray-200 flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <h2 className="text-[14px] sm:text-[16px] font-semibold text-gray-800 truncate">
                  {product.title}
                </h2>
                <p className="text-[11px] sm:text-[12px] text-gray-400">
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
                className="w-[30px] h-[30px] sm:w-[32px] sm:h-[32px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                title="Refresh from Shopify"
              >
                <RefreshCw
                  size={14}
                  className={loading || variantsLoading ? "animate-spin" : ""}
                />
              </button>
              <button
                onClick={() => {
                  setShowAdd(true);
                  setEditingId(null);
                }}
                className="flex items-center gap-[4px] sm:gap-[6px] bg-gc-primary text-white text-[12px] sm:text-[13px] font-medium px-[8px] sm:px-[12px] py-[6px] sm:py-[7px] rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Add Pattern</span>
              </button>
              <button
                onClick={onClose}
                className="w-[30px] h-[30px] sm:w-[32px] sm:h-[32px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-[16px] sm:p-[24px]">
            {/* ── Product Variants ── */}
            <div className="mb-[20px]">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-[12px]">
                Product Variants
              </p>

              {variantsLoading ? (
                <div className="flex items-center gap-[8px] text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[12px]">Loading variants…</span>
                </div>
              ) : variantDetail.options.length === 0 ? (
                <p className="text-[13px] text-gray-400">No variants found.</p>
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
                          <span className="text-[12px] font-medium text-gray-500 sm:w-[64px] flex-shrink-0 sm:pt-[6px]">
                            {opt.name}
                          </span>
                          <div className="flex flex-wrap gap-[8px]">
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
                                    "flex items-center gap-[6px] border rounded-full pl-[4px] py-[3px] transition-colors group",
                                    isThisEditing
                                      ? "bg-blue-50 border-blue-300 pr-[6px]"
                                      : "bg-gray-100 border-gray-200 pr-[6px]",
                                  ].join(" ")}
                                >
                                  {/* Swatch */}
                                  <div className="w-[20px] h-[20px] rounded-full overflow-hidden flex-shrink-0 border border-gray-300">
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
                                  <span className="text-[12px] text-gray-700 font-medium">
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
                                          "w-[20px] h-[20px] flex items-center justify-center rounded-full transition-colors",
                                          isThisEditing
                                            ? "text-blue-600 bg-blue-100"
                                            : "text-gray-400 hover:text-gray-700 hover:bg-gray-200",
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
                                      className="w-[20px] h-[20px] flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                      title="Remove from variants (color pattern stays)"
                                    >
                                      <Minus size={10} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {editingInThisOpt && (
                          <div className="mt-[10px] ml-0 sm:ml-[74px] border border-blue-200 bg-blue-50 rounded-xl p-[14px]">
                            <p className="text-[12px] font-semibold text-blue-700 mb-[10px]">
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
                                className="flex items-center gap-[6px] bg-gray-800 text-white text-[12px] px-[12px] py-[6px] rounded-lg disabled:opacity-50 hover:bg-gray-700 transition-colors"
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
                                className="text-[12px] text-gray-600 px-[12px] py-[6px] rounded-lg hover:bg-blue-100 transition-colors"
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

            <div className="border-t border-gray-100 mb-[20px]" />

            {/* ── All Color Patterns ── */}
            <div className="flex items-center justify-between mb-[16px]">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                All Color Patterns
              </p>
              <p className="text-[11px] text-gray-400">
                Click a pattern to add it as a product variant
              </p>
            </div>

            {/* Add Form */}
            {showAdd && (
              <div className="mb-[20px] border border-green-200 bg-green-50 rounded-xl p-[16px]">
                <p className="text-[13px] font-semibold text-green-800 mb-[12px]">
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
                    className="flex items-center gap-[6px] bg-gray-800 text-white text-[13px] px-[14px] py-[7px] rounded-lg disabled:opacity-50 hover:bg-gray-700 transition-colors"
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
                    className="text-[13px] text-gray-600 px-[14px] py-[7px] rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-[48px] gap-[10px] text-gray-400">
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
                    className="text-[12px] text-red-500 underline mt-[4px]"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && patterns.length === 0 && !showAdd && (
              <div className="text-center py-[48px]">
                <p className="text-[14px] text-gray-400">
                  No color patterns found in Shopify.
                </p>
                <p className="text-[12px] text-gray-300 mt-[4px]">
                  Use "Add Pattern" to create one.
                </p>
              </div>
            )}

            {!loading && !error && patterns.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[10px]">
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

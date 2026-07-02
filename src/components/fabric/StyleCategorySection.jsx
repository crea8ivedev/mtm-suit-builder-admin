import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Check,
  X,
  Loader2,
  AlertCircle,
  Trash2,
  CheckCircle2,
  ImagePlus,
} from "lucide-react";
import {
  fetchProductVariantsDetail,
  createProductOptionValue,
  addVariantToProduct,
  removeVariantsFromProduct,
  setVariantInventoryQuantity,
  updateVariantPrice,
  attachImageToVariant,
} from "../../lib/shopify";
import ConfirmDialog from "./ConfirmDialog";

function AssignFabricCard({
  fabric,
  adding,
  isPendingAdd,
  pendingQty,
  pendingPrice,
  onInitAdd,
  onQtyChange,
  onPriceChange,
  onConfirmAdd,
  onCancelAdd,
}) {
  return (
    <div
      className={[
        "w-full border rounded-xl overflow-hidden transition-all flex flex-col",
        isPendingAdd
          ? "border-gc-primary shadow-sm bg-white"
          : adding
            ? "border-gc-border bg-white opacity-60"
            : "border-gc-border bg-white hover:border-gc-primary hover:shadow-sm",
      ].join(" ")}
    >
      <button
        onClick={!isPendingAdd && !adding ? onInitAdd : undefined}
        disabled={adding}
        className={[
          "w-full text-left flex items-center gap-[10px] p-[10px]",
          isPendingAdd ? "cursor-default" : adding ? "cursor-wait" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="w-[40px] h-[40px] rounded-lg overflow-hidden border border-gc-border flex-shrink-0">
          {fabric.imageUrl ? (
            <img
              src={fabric.imageUrl}
              alt={fabric.label}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundColor: fabric.color ?? "#e5e7eb" }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gc-heading truncate leading-tight">
            {fabric.label}
          </p>
          {fabric.code && (
            <span className="text-[10px] text-gc-muted">{fabric.code}</span>
          )}
        </div>
        {adding ? (
          <Loader2 size={14} className="animate-spin text-gc-muted flex-shrink-0" />
        ) : (
          <Plus size={15} className="text-gc-primary flex-shrink-0" />
        )}
      </button>

      {isPendingAdd && (
        <div className="px-[10px] pb-[10px] flex items-center gap-[6px]">
          <input
            type="number"
            min="0"
            autoFocus
            value={pendingQty}
            onChange={(e) => onQtyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pendingQty !== "") onConfirmAdd();
              if (e.key === "Escape") onCancelAdd();
            }}
            className="w-[70px] border border-gc-border-input rounded-md px-[8px] py-[5px] text-[12px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
            placeholder="Qty"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={pendingPrice}
            onChange={(e) => onPriceChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pendingQty !== "") onConfirmAdd();
              if (e.key === "Escape") onCancelAdd();
            }}
            className="flex-1 border border-gc-border-input rounded-md px-[8px] py-[5px] text-[12px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
            placeholder="Price"
          />
          <button
            onClick={onConfirmAdd}
            disabled={pendingQty === ""}
            className="flex-shrink-0 w-[28px] h-[28px] flex items-center justify-center bg-gc-primary text-white rounded-md hover:bg-gc-primary-dark disabled:opacity-50 cursor-pointer"
            title="Confirm"
          >
            <Check size={13} />
          </button>
          <button
            onClick={onCancelAdd}
            className="flex-shrink-0 w-[28px] h-[28px] flex items-center justify-center text-gc-muted hover:text-gc-heading hover:bg-gc-bg-warm rounded-md cursor-pointer"
            title="Cancel"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function StyleCategorySection({
  products,
  loading,
  error,
  onRetry,
  fabrics,
}) {
  const [activeProductId, setActiveProductId] = useState(null);
  const [variantDetail, setVariantDetail] = useState({ options: [], variants: [] });
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState(null);

  const [addingIds, setAddingIds] = useState(new Set());
  const [pendingAdd, setPendingAdd] = useState(null);

  const [editingLabel, setEditingLabel] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const [syncingImageIds, setSyncingImageIds] = useState(new Set());

  useEffect(() => {
    if (!activeProductId && products.length > 0) {
      setActiveProductId(products[0].id);
    }
    if (
      activeProductId &&
      !products.some((p) => p.id === activeProductId) &&
      products.length > 0
    ) {
      setActiveProductId(products[0].id);
    }
  }, [products, activeProductId]);

  function loadVariants(productId) {
    if (!productId) return;
    setVariantsLoading(true);
    setVariantsError(null);
    fetchProductVariantsDetail(productId)
      .then(setVariantDetail)
      .catch((e) => setVariantsError(e.message))
      .finally(() => setVariantsLoading(false));
  }

  useEffect(() => {
    loadVariants(activeProductId);
    setEditingLabel(null);
    setPendingAdd(null);
  }, [activeProductId]);

  const activeProduct = products.find((p) => p.id === activeProductId) ?? null;

  function getFabricOptionName() {
    const opts = variantDetail.options;
    const fabricOpt = opts.find((o) => o.name.toLowerCase() === "fabric");
    return fabricOpt?.name ?? opts[0]?.name ?? "Fabric";
  }

  function getAssignedValues() {
    const optName = getFabricOptionName();
    const seen = new Set();
    return variantDetail.variants.flatMap((v) => {
      const opt = v.selectedOptions.find((o) => o.name === optName);
      if (!opt || seen.has(opt.value)) return [];
      seen.add(opt.value);
      return [{ value: opt.value, variant: v }];
    });
  }

  const assignedValues = getAssignedValues();

  function isAssigned(label) {
    return assignedValues.some((v) => v.value.toLowerCase() === label.toLowerCase());
  }

  const unassignedFabrics = fabrics.filter((f) => !isAssigned(f.label));

  async function handleAdd(fabric, quantity, price) {
    const opts = variantDetail.options;
    const opt = opts.find((o) => o.name.toLowerCase() === "fabric") ?? opts[0];
    if (!opt) {
      alert("No product option found to add the variant to.");
      return;
    }
    if (!opt.id) {
      alert(`Option "${opt.name}" is missing its Shopify ID. Try refreshing.`);
      return;
    }

    const key = fabric.id ?? fabric.handle;
    setAddingIds((prev) => new Set([...prev, key]));
    try {
      const isConnected = !!opt.linkedMetafield;
      let createdVariants;

      if (isConnected) {
        let optionValue = (opt.optionValues ?? []).find(
          (ov) => ov.name.toLowerCase() === fabric.label.toLowerCase(),
        );
        if (!optionValue) {
          if (!fabric.id) {
            throw new Error(
              `Cannot add "${fabric.label}" — fabric is missing its Shopify metaobject ID.`,
            );
          }
          optionValue = await createProductOptionValue(
            activeProduct.id,
            opt.id,
            fabric.id,
          );
        }
        if (!optionValue?.id) {
          throw new Error(`Could not create option value for "${fabric.label}".`);
        }
        createdVariants = await addVariantToProduct(
          activeProduct.id,
          optionValue.id,
          opt.name,
          variantDetail.variants,
          null,
          fabric.imageUrl,
          price ?? null,
        );
      } else {
        createdVariants = await addVariantToProduct(
          activeProduct.id,
          null,
          opt.name,
          variantDetail.variants,
          fabric.label,
          fabric.imageUrl,
          price ?? null,
        );
      }

      if (
        quantity != null &&
        quantity !== "" &&
        createdVariants?.[0]?.inventoryItem?.id
      ) {
        await setVariantInventoryQuantity(
          createdVariants[0].inventoryItem.id,
          quantity,
        );
      }
      loadVariants(activeProduct.id);
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

  function requestRemove(label) {
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
      await removeVariantsFromProduct(activeProduct.id, confirmRemove.variantIds);
      setConfirmRemove(null);
      loadVariants(activeProduct.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setRemoving(false);
    }
  }

  function startEditQty(value, variant) {
    setEditingLabel(value);
    setEditQty(variant.inventoryQuantity ?? "");
    setEditPrice(variant.price ?? "");
  }

  async function saveEditQty(value, variant) {
    setSavingEdit(true);
    try {
      if (editQty !== "" && variant.inventoryItem?.id) {
        await setVariantInventoryQuantity(variant.inventoryItem.id, editQty);
      }
      if (editPrice !== "" && editPrice !== variant.price) {
        await updateVariantPrice(activeProduct.id, variant.id, editPrice);
      }
      setEditingLabel(null);
      loadVariants(activeProduct.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function syncVariantImage(variant, fabric) {
    if (!fabric?.imageUrl) return;
    setSyncingImageIds((prev) => new Set([...prev, variant.id]));
    try {
      await attachImageToVariant(activeProduct.id, variant.id, fabric.imageUrl);
      loadVariants(activeProduct.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setSyncingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(variant.id);
        return next;
      });
    }
  }

  return (
    <div className="bg-white rounded-[12px] border border-gc-divider overflow-hidden">
      {confirmRemove && (
        <ConfirmDialog
          title="Remove from Variants?"
          confirmLabel="Remove Variant"
          loading={removing}
          onConfirm={confirmDoRemove}
          onCancel={() => setConfirmRemove(null)}
          message={
            <>
              This will remove{" "}
              <span className="font-semibold text-gc-heading">
                "{confirmRemove.label}"
              </span>{" "}
              from this product's variant options.
            </>
          }
        />
      )}

      <div className="px-[16px] sm:px-[20px] py-[14px] sm:py-[16px] border-b border-gc-divider">
        <h3 className="font-garamond font-bold text-[18px] text-gc-heading">
          Style Categories
        </h3>
        <p className="font-hanken text-[12px] text-gc-muted">
          Assign fabrics and manage inventory per product
        </p>
      </div>

      {loading && (
        <div className="p-[16px] sm:p-[20px]">
          <div className="flex items-center justify-center py-[24px] gap-[10px] text-gc-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-[13px]">Loading style categories…</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="p-[16px] sm:p-[20px]">
          <div className="flex items-start gap-[10px] p-[16px] bg-red-50 rounded-lg border border-red-200">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-[1px]" />
            <div className="flex-1">
              <p className="text-[13px] text-red-600">{error}</p>
              <button
                onClick={onRetry}
                className="text-[12px] text-red-500 underline mt-[4px] cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="text-center py-[48px]">
          <p className="text-[14px] text-gc-muted">
            No style category products found.
          </p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <>
          <div className="flex flex-wrap gap-[8px] px-[16px] sm:px-[20px] py-[14px] border-b border-gc-divider">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => setActiveProductId(product.id)}
                className={[
                  "font-hanken text-[13px] font-semibold px-[16px] py-[8px] rounded-[20px] whitespace-nowrap transition-all cursor-pointer",
                  activeProductId === product.id
                    ? "bg-gc-primary text-white border border-gc-primary"
                    : "bg-gc-bg-warm text-gc-muted border border-gc-border-input",
                ].join(" ")}
              >
                {product.title}
              </button>
            ))}
          </div>

          <div className="p-[16px] sm:p-[20px]">
            {/* Assigned variants */}
            <div className="mb-[20px]">
              <p className="text-[11px] font-semibold text-gc-muted uppercase tracking-widest mb-[12px]">
                Assigned Fabrics
              </p>

              {variantsLoading ? (
                <div className="flex items-center gap-[8px] text-gc-muted">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[12px]">Loading variants…</span>
                </div>
              ) : variantsError ? (
                <p className="text-[13px] text-red-600">{variantsError}</p>
              ) : assignedValues.length === 0 ? (
                <p className="text-[13px] text-gc-muted">
                  No fabrics assigned to this product yet.
                </p>
              ) : (
                <div className="flex flex-wrap items-start gap-[10px]">
                  {assignedValues.map(({ value, variant }) => {
                    const matched = fabrics.find(
                      (f) => f.label.toLowerCase() === value.toLowerCase(),
                    );
                    const isEditing = editingLabel === value;
                    return (
                      <div key={value}>
                        <div
                          className={[
                            "flex items-center gap-[10px] border rounded-full pl-[4px] pr-[10px] py-[4px] transition-colors w-fit",
                            isEditing
                              ? "bg-gc-bg-warm border-gc-primary"
                              : "bg-gc-bg-warm border-gc-border",
                          ].join(" ")}
                        >
                          <div className="w-[24px] h-[24px] rounded-full overflow-hidden flex-shrink-0 border border-gc-border-warm">
                            {matched?.imageUrl ? (
                              <img
                                src={matched.imageUrl}
                                alt={value}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-full"
                                style={{ backgroundColor: matched?.color ?? "#e5e7eb" }}
                              />
                            )}
                          </div>
                          <span className="text-[13px] text-gc-heading font-medium">
                            {value}
                          </span>
                          <span className="text-[11px] text-gc-muted flex items-center gap-[4px]">
                            <CheckCircle2 size={12} className="text-gc-primary" />
                            {variant.inventoryQuantity ?? 0} qty
                            {variant.price ? ` · $${variant.price}` : ""}
                          </span>
                          <div className="flex gap-[2px]">
                            {!variant.image?.url && matched?.imageUrl && (
                              <button
                                onClick={() => syncVariantImage(variant, matched)}
                                disabled={syncingImageIds.has(variant.id)}
                                className="w-[22px] h-[22px] flex items-center justify-center rounded-full text-gc-muted hover:text-gc-primary hover:bg-gc-bg-warm disabled:opacity-50 transition-colors cursor-pointer"
                                title="Attach fabric image to this variant"
                              >
                                {syncingImageIds.has(variant.id) ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <ImagePlus size={10} />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() =>
                                isEditing
                                  ? setEditingLabel(null)
                                  : startEditQty(value, variant)
                              }
                              className={[
                                "w-[22px] h-[22px] flex items-center justify-center rounded-full transition-colors cursor-pointer",
                                isEditing
                                  ? "text-gc-primary bg-gc-bg-warm"
                                  : "text-gc-muted hover:text-gc-heading hover:bg-gc-bg",
                              ].join(" ")}
                              title={isEditing ? "Cancel" : "Edit inventory / price"}
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={() => requestRemove(value)}
                              className="w-[22px] h-[22px] flex items-center justify-center rounded-full text-gc-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove from variants"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div className="mt-[8px] ml-[8px] flex items-center gap-[8px]">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="w-[90px] border border-gc-border-input rounded-md px-[8px] py-[5px] text-[12px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
                              placeholder="Quantity"
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-[100px] border border-gc-border-input rounded-md px-[8px] py-[5px] text-[12px] focus:outline-none focus:ring-1 focus:ring-gc-primary"
                              placeholder="Price"
                            />
                            <button
                              onClick={() => saveEditQty(value, variant)}
                              disabled={savingEdit}
                              className="flex items-center gap-[6px] bg-gc-primary-deep text-white text-[12px] px-[12px] py-[6px] rounded-lg disabled:opacity-50 hover:bg-gc-primary-dark transition-colors cursor-pointer"
                            >
                              {savingEdit ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() => setEditingLabel(null)}
                              className="text-[12px] text-gc-text px-[10px] py-[6px] rounded-lg hover:bg-gc-bg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gc-border mb-[20px]" />

            {/* Assign fabric */}
            <div className="flex items-center justify-between mb-[16px]">
              <p className="text-[11px] font-semibold text-gc-muted uppercase tracking-widest">
                Assign a Fabric
              </p>
              <p className="text-[11px] text-gc-muted">
                Tap a fabric to add it as a product variant
              </p>
            </div>

            {unassignedFabrics.length === 0 ? (
              <p className="text-[13px] text-gc-muted">
                All fabrics in the library are already assigned to this product.
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-[10px]">
                {unassignedFabrics.map((fabric) => {
                  const key = fabric.id ?? fabric.handle;
                  const isPendingAdd = pendingAdd?.key === key;
                  return (
                    <AssignFabricCard
                      key={key}
                      fabric={fabric}
                      adding={addingIds.has(key)}
                      isPendingAdd={isPendingAdd}
                      pendingQty={isPendingAdd ? pendingAdd.qty : ""}
                      pendingPrice={isPendingAdd ? pendingAdd.price : ""}
                      onInitAdd={() => setPendingAdd({ key, qty: "", price: "" })}
                      onQtyChange={(qty) =>
                        setPendingAdd((prev) => (prev ? { ...prev, qty } : null))
                      }
                      onPriceChange={(price) =>
                        setPendingAdd((prev) => (prev ? { ...prev, price } : null))
                      }
                      onConfirmAdd={() => {
                        if (!pendingAdd || pendingAdd.qty === "") return;
                        handleAdd(fabric, pendingAdd.qty, pendingAdd.price || null);
                        setPendingAdd(null);
                      }}
                      onCancelAdd={() => setPendingAdd(null)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

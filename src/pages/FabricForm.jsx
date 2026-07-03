import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Save, X } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import AlertBanner from "../components/ui/AlertBanner";
import GcFabricFieldsForm from "../components/fabric/GcFabricFieldsForm";
import ProductMediaUploader from "../components/fabric/ProductMediaUploader";
import GarmentTypeVariantManager from "../components/fabric/GarmentTypeVariantManager";
import CollectionMultiSelect from "../components/fabric/CollectionMultiSelect";
import { cn } from "../utils/cn";
import {
  fetchGcFabrics,
  clearGcFabricsCache,
  updateGcFabric,
  uploadImageToShopify,
  createImageFromUrl,
  createFabricProductComplete,
  updateFabricProduct,
  fetchFabricProductDetail,
  createGarmentVariants,
  updateVariantPrices,
  removeVariantsFromProduct,
  removeProductImage,
  setVariantInventoryQuantity,
  clearFabricProductsV2Cache,
  fetchCollections,
  GARMENT_TYPES,
} from "../lib/shopify";
import { fetchKtFabricDetails, isKtFabricRegistered } from "../lib/kutetailor";

const EMPTY_FIELDS = {
  fabricHouse: "",
  fabricCode: "",
  color: "",
  material: "",
  weight: "",
};

const SECTION_CLASS =
  "bg-white/40 rounded-[12px] p-[31px] border border-gc-border-input";
const SECTION_TITLE_CLASS =
  "font-garamond text-[28px] font-semibold text-gc-primary mb-[20px]";
const INPUT_LABEL_CLASS =
  "font-hanken text-[11px] font-semibold text-[rgba(28,28,25,0.7)] uppercase tracking-wide block mb-[7px]";
const INPUT_CLASS =
  "font-hanken w-full bg-white px-[14px] h-[48px] rounded-[4px] text-[14px] text-[#1c1c19] outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted";

function suggestTitle(fields) {
  const parts = [fields.fabricHouse, fields.fabricCode, fields.color].filter(
    Boolean,
  );
  if (!fields.fabricHouse) return parts.join(" ");
  const rest = [fields.fabricCode, fields.color].filter(Boolean).join(" ");
  return rest ? `${fields.fabricHouse} - ${rest}` : fields.fabricHouse;
}

export default function FabricForm({ mode, productId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = mode === "edit";
  const [justCreated, setJustCreated] = useState(!!location.state?.created);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);

  const [gcFabrics, setGcFabrics] = useState([]);
  const [gcFabricsLoading, setGcFabricsLoading] = useState(true);
  const [useExisting, setUseExisting] = useState(false);
  const [selectedFabricId, setSelectedFabricId] = useState(null);
  const [gcFabricId, setGcFabricId] = useState(null);

  const [fields, setFields] = useState({ ...EMPTY_FIELDS });
  const [fabricImageGid, setFabricImageGid] = useState(null);
  const [fabricImageUrl, setFabricImageUrl] = useState(null);
  const [fabricImageSourceUrl, setFabricImageSourceUrl] = useState(null);
  const [fabricImageUploading, setFabricImageUploading] = useState(false);
  const [ktFetching, setKtFetching] = useState(false);
  const [ktFetchError, setKtFetchError] = useState(null);
  const [ktNotFound, setKtNotFound] = useState(false);
  const [ktFetched, setKtFetched] = useState(false);

  const [garmentOptionName, setGarmentOptionName] = useState("Type");

  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [status, setStatus] = useState("ACTIVE");

  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionIds, setCollectionIds] = useState([]);
  const [originalCollectionIds, setOriginalCollectionIds] = useState([]);

  const [images, setImages] = useState([]);
  const [garmentSelections, setGarmentSelections] = useState({});
  const [originalVariants, setOriginalVariants] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitKtNotFound, setSubmitKtNotFound] = useState(false);
  const [ktVerifying, setKtVerifying] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchGcFabrics()
      .then(setGcFabrics)
      .catch(() => {})
      .finally(() => setGcFabricsLoading(false));
  }, []);

  useEffect(() => {
    fetchCollections()
      .then(setCollections)
      .catch(() => {})
      .finally(() => setCollectionsLoading(false));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const gid = `gid://shopify/Product/${productId}`;
    fetchFabricProductDetail(gid)
      .then((detail) => {
        if (!detail) {
          setLoadError("Fabric product not found.");
          return;
        }
        setTitle(detail.title);
        setTitleTouched(true);
        setStatus(detail.status);
        setCollectionIds(detail.collectionIds);
        setOriginalCollectionIds(detail.collectionIds);
        setGcFabricId(detail.gcFabricId);
        if (detail.gcFabric) {
          setFields({
            fabricHouse: detail.gcFabric.fabricHouse,
            fabricCode: detail.gcFabric.fabricCode,
            color: detail.gcFabric.color,
            material: detail.gcFabric.material,
            weight: detail.gcFabric.weight,
          });
          setFabricImageGid(detail.gcFabric.imageGid);
          setFabricImageUrl(detail.gcFabric.imageUrl);
        }
        setImages(
          detail.images.map((img) => ({
            key: img.id,
            url: img.url,
            isExisting: true,
            mediaId: img.id,
          })),
        );

        setGarmentOptionName(detail.garmentOptionName);
        const selections = {};
        const orig = {};
        for (const v of detail.variants) {
          const opt = v.selectedOptions.find(
            (o) => o.name === detail.garmentOptionName,
          );
          if (!opt) continue;
          const type = GARMENT_TYPES.find(
            (t) => t.toLowerCase() === opt.value.toLowerCase(),
          );
          if (!type) continue;
          selections[type] = {
            price: v.price,
            quantity: String(v.inventoryQuantity ?? 0),
          };
          orig[type] = {
            variantId: v.id,
            inventoryItemId: v.inventoryItem?.id ?? null,
          };
        }
        setGarmentSelections(selections);
        setOriginalVariants(orig);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [isEdit, productId]);

  useEffect(() => {
    if (isEdit || titleTouched) return;
    setTitle(suggestTitle(fields));
  }, [fields, isEdit, titleTouched]);

  const galleryReady = images.every((img) => !img.uploading);

  async function handleFabricImageUpload(file) {
    setFabricImageUploading(true);
    try {
      const { gid, cdnUrl } = await uploadImageToShopify(file);
      setFabricImageGid(gid);
      setFabricImageUrl(cdnUrl);
      setFabricImageSourceUrl(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setFabricImageUploading(false);
    }
  }

  function handleSelectExistingFabric(fabric) {
    setSelectedFabricId(fabric.id);
    setFields({
      fabricHouse: fabric.fabricHouse,
      fabricCode: fabric.fabricCode,
      color: fabric.color,
      material: fabric.material,
      weight: fabric.weight,
    });
    setFabricImageGid(fabric.imageGid);
    setFabricImageUrl(fabric.imageUrl);
    setFabricImageSourceUrl(null);
  }

  async function handleFetchFromKuteTailor() {
    if (!fields.fabricCode.trim()) return;
    setKtFetching(true);
    setKtFetchError(null);
    setKtNotFound(false);
    try {
      const details = await fetchKtFabricDetails(fields.fabricCode.trim());
      if (!details) {
        setKtFetchError(
          `No fabric found in KuteTailor for code "${fields.fabricCode}".`,
        );
        setKtNotFound(true);
        return;
      }
      setFields((f) => ({
        ...f,
        fabricHouse: details.fabricHouse || f.fabricHouse,
        color: details.color || f.color,
        material: details.material || f.material,
        weight: details.weight || f.weight,
      }));
      if (details.imageUrl) {
        setFabricImageGid(null);
        setFabricImageUrl(details.imageUrl);
        setFabricImageSourceUrl(details.imageUrl);
      }
      setKtFetched(true);
    } catch (e) {
      setKtFetchError(e.message);
    } finally {
      setKtFetching(false);
    }
  }

  function handleCreateInKuteTailor() {
    navigator.clipboard?.writeText(fields.fabricCode.trim()).catch(() => {});
    window.open(
      "https://platform.kutetailor.com/system/materialLibrary",
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleFieldsChange(next) {
    if (!isEdit && next.fabricCode !== fields.fabricCode) {
      setKtFetched(false);
      setKtNotFound(false);
      setKtFetchError(null);
    }
    setFields(next);
  }

  async function handleAddGalleryFiles(files) {
    const pending = files.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      url: URL.createObjectURL(file),
      uploading: true,
    }));
    setImages((prev) => [...prev, ...pending]);
    for (const p of pending) {
      try {
        const { cdnUrl } = await uploadImageToShopify(
          files.find((f) => `${f.name}-${f.size}-${f.lastModified}` === p.key),
        );
        setImages((prev) =>
          prev.map((img) =>
            img.key === p.key
              ? { ...img, url: cdnUrl, cdnUrl, uploading: false }
              : img,
          ),
        );
      } catch (e) {
        setImages((prev) => prev.filter((img) => img.key !== p.key));
        alert(e.message);
      }
    }
  }

  async function handleRemoveImage(key) {
    const img = images.find((i) => i.key === key);
    if (!img) return;
    if (img.isExisting) {
      if (!confirm("Remove this image from the product?")) return;
      try {
        await removeProductImage(img.mediaId);
      } catch (e) {
        alert(e.message);
        return;
      }
    }
    setImages((prev) => prev.filter((i) => i.key !== key));
  }

  const selectedTypes = GARMENT_TYPES.filter((t) => garmentSelections[t]);
  const canSubmit =
    title.trim() &&
    galleryReady &&
    (isEdit || selectedTypes.length > 0) &&
    selectedTypes.every(
      (t) =>
        garmentSelections[t].price !== "" &&
        garmentSelections[t].quantity !== "",
    ) &&
    (useExisting
      ? !!selectedFabricId
      : fields.fabricHouse.trim() && fields.fabricCode.trim());

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitKtNotFound(false);
    setSaved(false);

    if (status === "ACTIVE") {
      setKtVerifying(true);
      let registered;
      try {
        registered = await isKtFabricRegistered(fields.fabricCode.trim());
      } catch (e) {
        setKtVerifying(false);
        setSubmitError(`Couldn't verify with KuteTailor: ${e.message}`);
        return;
      }
      setKtVerifying(false);
      if (!registered) {
        setSubmitError(
          `Fabric code "${fields.fabricCode}" isn't in KuteTailor yet. Create it there before activating this fabric - it can still be saved as Draft.`,
        );
        setSubmitKtNotFound(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await submitEdit();
        setSaved(true);
        setJustCreated(false);
      } else {
        await submitCreate();
      }
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resolveFabricImageGid() {
    if (fabricImageGid) return fabricImageGid;
    if (fabricImageSourceUrl) {
      const gid = await createImageFromUrl(fabricImageSourceUrl);
      setFabricImageGid(gid);
      setFabricImageSourceUrl(null);
      return gid;
    }
    return null;
  }

  async function submitCreate() {
    let fabricId = gcFabricId;
    if (!fabricId && useExisting) {
      fabricId = selectedFabricId;
    }

    const media = images
      .filter((img) => img.cdnUrl)
      .map((img) => ({ cdnUrl: img.cdnUrl, alt: title }));

    const { product, fabricId: usedFabricId } =
      await createFabricProductComplete({
        fabricId,
        fabricFields: fabricId
          ? undefined
          : { ...fields, imageGid: await resolveFabricImageGid() },
        title,
        status,
        collectionIds,
        media,
        selectedTypes,
        garmentSelections,
      });
    setGcFabricId(usedFabricId);

    clearFabricProductsV2Cache();
    clearGcFabricsCache();
    navigate(`/fabric/${product.id.split("/").pop()}`, {
      state: { created: true },
      replace: true,
    });
  }

  async function submitEdit() {
    const gid = `gid://shopify/Product/${productId}`;

    if (gcFabricId) {
      await updateGcFabric(gcFabricId, {
        ...fields,
        imageGid: await resolveFabricImageGid(),
      });
    }

    const newMedia = images
      .filter((img) => !img.isExisting && img.cdnUrl)
      .map((img) => ({ cdnUrl: img.cdnUrl, alt: title }));
    const collectionsToJoin = collectionIds.filter(
      (id) => !originalCollectionIds.includes(id),
    );
    const collectionsToLeave = originalCollectionIds.filter(
      (id) => !collectionIds.includes(id),
    );
    await updateFabricProduct(gid, {
      title,
      status,
      media: newMedia,
      collectionsToJoin,
      collectionsToLeave,
    });

    const origTypes = Object.keys(originalVariants);
    const toRemove = origTypes.filter((t) => !garmentSelections[t]);
    const toAdd = selectedTypes.filter((t) => !originalVariants[t]);
    const toUpdate = selectedTypes.filter((t) => originalVariants[t]);

    if (toRemove.length) {
      await removeVariantsFromProduct(
        gid,
        toRemove.map((t) => originalVariants[t].variantId),
      );
    }

    let addedVariants = [];
    if (toAdd.length) {
      addedVariants = await createGarmentVariants(
        gid,
        garmentOptionName,
        toAdd.map((t) => ({ name: t, price: garmentSelections[t].price })),
      );
    }

    const priceUpdates = toUpdate.map((t) => ({
      id: originalVariants[t].variantId,
      price: garmentSelections[t].price,
    }));
    if (priceUpdates.length) {
      await updateVariantPrices(gid, priceUpdates);
    }

    await Promise.all([
      ...toUpdate.map((t) =>
        setVariantInventoryQuantity(
          originalVariants[t].inventoryItemId,
          garmentSelections[t].quantity,
        ),
      ),
      ...addedVariants.map((v) => {
        const typeName = v.selectedOptions.find(
          (o) => o.name === garmentOptionName,
        )?.value;
        return setVariantInventoryQuantity(
          v.inventoryItem.id,
          garmentSelections[typeName].quantity,
        );
      }),
    ]);

    clearFabricProductsV2Cache();
    clearGcFabricsCache();
  }

  if (loading) {
    return (
      <DashboardLayout bgColor="#f4f1ed">
        <div className="bg-white rounded-[12px] border border-gc-divider">
          <LoadingState message="Loading fabric product…" />
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout bgColor="#f4f1ed">
        <div className="bg-white rounded-[12px] border border-gc-divider">
          <ErrorState message={loadError} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout bgColor="#f4f1ed">
      <div className="flex flex-col gap-[40px] pb-[80px]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="font-garamond text-[28px] sm:text-[40px] font-bold text-[#3c3c3c] leading-tight">
            {isEdit ? "Edit Fabric" : "Create Fabric"}
          </h1>
          <p className="font-hanken text-[14px] text-black">
            {isEdit
              ? "Update fabric details, images, and garment variants"
              : "Create a fabric product with garment-type variants"}
          </p>
        </div>

        <div className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Fabric Details</h2>
          <div className="border-t border-gc-section-divider/30 pt-[20px]">
            <GcFabricFieldsForm
              showPicker={!isEdit}
              fabrics={gcFabrics}
              fabricsLoading={gcFabricsLoading}
              useExisting={useExisting}
              onToggleUseExisting={(v) => {
                setUseExisting(v);
                if (!v) setSelectedFabricId(null);
              }}
              selectedFabricId={selectedFabricId}
              onSelectFabric={handleSelectExistingFabric}
              fields={fields}
              onFieldsChange={handleFieldsChange}
              imageUrl={fabricImageUrl}
              imageUploading={fabricImageUploading}
              onImageUpload={handleFabricImageUpload}
              onFetchFromKuteTailor={handleFetchFromKuteTailor}
              fetchingFromKuteTailor={ktFetching}
              kuteTailorFetchError={ktFetchError}
              kuteTailorNotFound={ktNotFound}
              onCreateInKuteTailor={handleCreateInKuteTailor}
              fieldsLocked={!isEdit && !useExisting && !ktFetched}
            />
          </div>
        </div>

        <div className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Product</h2>
          <div className="border-t border-gc-section-divider/30 pt-[20px] flex flex-col gap-[16px]">
            <div className="max-w-[480px]">
              <label className={INPUT_LABEL_CLASS}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                className={INPUT_CLASS}
                placeholder="Product title"
              />
            </div>
            <div>
              <label className={INPUT_LABEL_CLASS}>Status</label>
              <div className="flex gap-[10px]">
                {["ACTIVE", "DRAFT"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "font-hanken px-[14px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all cursor-pointer capitalize",
                      status === s
                        ? "text-white border border-gc-primary bg-gc-primary"
                        : "text-[#6b7280] bg-white hover:bg-gc-primary/[4%] border border-gc-border-input",
                    )}
                  >
                    {s.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={INPUT_LABEL_CLASS}>Collections</label>
              <CollectionMultiSelect
                collections={collections}
                selectedIds={collectionIds}
                onChange={setCollectionIds}
                loading={collectionsLoading}
              />
            </div>
          </div>
        </div>

        <div className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Gallery Images</h2>
          <div className="border-t border-gc-section-divider/30 pt-[20px]">
            <ProductMediaUploader
              images={images}
              onAddFiles={handleAddGalleryFiles}
              onRemove={handleRemoveImage}
            />
          </div>
        </div>

        <div className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Variants</h2>
          <div className="border-t border-gc-section-divider/30 pt-[20px]">
            <GarmentTypeVariantManager
              selections={garmentSelections}
              onChange={setGarmentSelections}
            />
          </div>
        </div>

        {justCreated && (
          <AlertBanner
            variant="success"
            message="Fabric created successfully."
          />
        )}
        {saved && (
          <AlertBanner variant="success" message="Fabric saved successfully." />
        )}
        {submitError && (
          <AlertBanner
            variant="error"
            title="Failed to save fabric"
            message={submitError}
            action={
              submitKtNotFound && (
                <button
                  type="button"
                  onClick={handleCreateInKuteTailor}
                  className="font-hanken text-[12px] font-medium text-red-700 underline mt-[4px] cursor-pointer"
                >
                  Create "{fields.fabricCode}" in KuteTailor
                </button>
              )
            }
          />
        )}

        <div className="flex flex-wrap items-center justify-end gap-[12px] pb-[8px]">
          <Link
            to="/fabric"
            className="font-hanken flex items-center gap-[6px] text-[14px] font-medium text-black uppercase px-[20px] py-[11px] rounded-[8px] hover:opacity-70 transition-opacity border border-gray-300"
          >
            <X size={14} />
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || ktVerifying}
            className="font-hanken flex items-center gap-[8px] h-[44px] px-[20px] rounded-[8px] text-white text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-gc-primary"
          >
            {submitting || ktVerifying ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {ktVerifying
              ? "Verifying with KuteTailor…"
              : isEdit
                ? "Save Changes"
                : "Create Fabric"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

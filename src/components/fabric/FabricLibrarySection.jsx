import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import {
  createColorPattern,
  updateColorPattern,
  deleteColorPattern,
  uploadImageToShopify,
  importImageFromUrl,
  findFabricUsage,
} from "../../lib/shopify";
import { queryKtFabric } from "../../lib/kutetailor";
import FabricModal from "./FabricModal";
import ConfirmDialog from "./ConfirmDialog";

const EMPTY_FORM = {
  label: "",
  color: "#000000",
  code: "",
  brand: "",
  imageGid: null,
  imageUrl: null,
};

export default function FabricLibrarySection({
  fabrics,
  loading,
  error,
  onRefresh,
  onChanged,
  styleCategoryProducts,
}) {
  const [modalMode, setModalMode] = useState(null); // "add" | "edit" | null
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [kutetailorFetching, setKutetailorFetching] = useState(false);
  const fileRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteBlockedBy, setDeleteBlockedBy] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalMode("add");
  }

  function startEdit(fabric) {
    setEditingId(fabric.id);
    setForm({
      label: fabric.label ?? "",
      color: fabric.color ?? "#000000",
      code: fabric.code ?? "",
      brand: fabric.brand ?? "",
      imageGid: fabric.imageGid ?? null,
      imageUrl: fabric.imageUrl ?? null,
    });
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function handleImageUpload(file) {
    setImageUploading(true);
    try {
      const { gid, cdnUrl } = await uploadImageToShopify(file);
      setForm((f) => ({ ...f, imageGid: gid, imageUrl: cdnUrl }));
    } catch (e) {
      alert(e.message);
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSave() {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      const payload = {
        label: form.label,
        color: form.color || null,
        imageGid: form.imageGid || null,
        code: form.code || null,
        brand: form.brand || null,
      };
      if (modalMode === "edit") {
        await updateColorPattern(editingId, payload);
      } else {
        await createColorPattern(payload);
      }
      closeModal();
      onChanged();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchKutetailor() {
    const code = form.code?.trim();
    if (!code) return;
    setKutetailorFetching(true);
    try {
      const data = await queryKtFabric(code);
      if (!data) {
        alert(`No fabric found in KuteTailor for code "${code}".`);
        return;
      }
      let imageGid = form.imageGid;
      let imageUrl = form.imageUrl;
      if (data.imageUrl) {
        const imported = await importImageFromUrl(data.imageUrl);
        imageGid = imported.gid;
        imageUrl = imported.cdnUrl;
      }
      setForm((f) => ({
        ...f,
        label: f.label.trim() ? f.label : (data.colorName ?? f.label),
        color: data.colorName || f.color,
        brand: data.factoryCode || f.brand,
        imageGid,
        imageUrl,
      }));
    } catch (e) {
      alert(e.message);
    } finally {
      setKutetailorFetching(false);
    }
  }

  async function requestDelete(fabric) {
    setDeleteTarget(fabric);
    setDeleteBlockedBy(null);
    setDeleteChecking(true);
    try {
      const usedBy = await findFabricUsage(fabric.label, styleCategoryProducts);
      setDeleteBlockedBy(usedBy.length ? usedBy : null);
    } catch (e) {
      alert(e.message);
      setDeleteTarget(null);
    } finally {
      setDeleteChecking(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteColorPattern(deleteTarget.id);
      setDeleteTarget(null);
      onChanged();
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-[12px] border border-gc-divider overflow-hidden mb-[24px] sm:mb-[30px]">
      {modalMode && (
        <FabricModal
          title={modalMode === "edit" ? "Edit Fabric" : "New Fabric"}
          form={form}
          setForm={setForm}
          fileRef={fileRef}
          onImageUpload={handleImageUpload}
          imageUploading={imageUploading}
          onSave={handleSave}
          onCancel={closeModal}
          saving={saving}
          onFetchKutetailor={handleFetchKutetailor}
          kutetailorFetching={kutetailorFetching}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Fabric?"
          confirmLabel="Delete Fabric"
          loading={deleting}
          disabled={deleteChecking || !!deleteBlockedBy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          message={
            deleteChecking ? (
              <span className="flex items-center gap-[8px] text-gc-muted">
                <Loader2 size={14} className="animate-spin" />
                Checking usage across style categories…
              </span>
            ) : deleteBlockedBy ? (
              <span>
                <span className="font-semibold text-gc-heading">
                  "{deleteTarget.label}"
                </span>{" "}
                is used as a variant on{" "}
                {deleteBlockedBy.length === 1
                  ? "this product"
                  : `${deleteBlockedBy.length} products`}
                :
                <span className="block mt-[6px] text-[13px] text-gc-muted-warm">
                  {deleteBlockedBy.map((p) => p.title).join(", ")}
                </span>
                <span className="block mt-[10px]">
                  Remove it from those products first before deleting.
                </span>
              </span>
            ) : (
              <span>
                This will permanently delete{" "}
                <span className="font-semibold text-gc-heading">
                  "{deleteTarget.label}"
                </span>{" "}
                from the fabric library.
              </span>
            )
          }
        />
      )}

      <div className="flex items-center justify-between px-[16px] sm:px-[20px] py-[14px] sm:py-[16px] border-b border-gc-divider">
        <div>
          <h3 className="font-garamond font-bold text-[18px] text-gc-heading">
            All Fabrics
          </h3>
          <p className="font-hanken text-[12px] text-gc-muted">
            {loading ? "Loading…" : `${fabrics.length} fabric${fabrics.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-[32px] h-[32px] flex items-center justify-center rounded-lg text-gc-muted hover:text-gc-heading hover:bg-gc-bg-warm disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={startAdd}
            className="flex items-center gap-[5px] bg-gc-primary text-white text-[12px] sm:text-[13px] font-medium px-[10px] sm:px-[12px] py-[7px] rounded-lg hover:bg-gc-primary-dark transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add Fabric
          </button>
        </div>
      </div>

      <div className="p-[16px] sm:p-[20px]">
        {loading && (
          <div className="flex items-center justify-center py-[48px] gap-[10px] text-gc-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-[13px]">Loading fabrics…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-[10px] p-[16px] bg-red-50 rounded-lg border border-red-200">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-[1px]" />
            <div className="flex-1">
              <p className="text-[13px] text-red-600">{error}</p>
              <button
                onClick={onRefresh}
                className="text-[12px] text-red-500 underline mt-[4px] cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && fabrics.length === 0 && (
          <div className="text-center py-[48px]">
            <p className="text-[14px] text-gc-muted">No fabrics found.</p>
            <p className="text-[12px] text-gc-muted-warm mt-[4px]">
              Use "Add Fabric" to create one.
            </p>
          </div>
        )}

        {!loading && !error && fabrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[10px]">
            {fabrics.map((fabric) => (
              <div
                key={fabric.id}
                className="border border-gc-border bg-white rounded-xl overflow-hidden flex items-center gap-[10px] p-[10px] sm:p-[12px]"
              >
                <div className="w-[44px] h-[44px] rounded-lg overflow-hidden border border-gc-border flex-shrink-0">
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
                  <div className="flex items-center gap-[6px] mt-[2px]">
                    {fabric.color && (
                      <span className="text-[10px] font-mono text-gc-muted">
                        {fabric.color}
                      </span>
                    )}
                    {fabric.code && (
                      <span className="text-[10px] text-gc-muted">· {fabric.code}</span>
                    )}
                  </div>
                  {fabric.brand && (
                    <p className="text-[10px] text-gc-muted-warm truncate mt-[1px]">
                      {fabric.brand}
                    </p>
                  )}
                </div>
                <div className="flex gap-[2px] flex-shrink-0">
                  <button
                    onClick={() => startEdit(fabric)}
                    className="w-[26px] h-[26px] flex items-center justify-center rounded-full text-gc-muted hover:text-gc-heading hover:bg-gc-bg-warm transition-colors cursor-pointer"
                    title="Edit fabric"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => requestDelete(fabric)}
                    className="w-[26px] h-[26px] flex items-center justify-center rounded-full text-gc-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete fabric"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

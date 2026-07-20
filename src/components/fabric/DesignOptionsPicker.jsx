import { useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import ModalBase from "../ui/ModalBase";

// Custom-styled single-select dropdown for the "Title" field, matching
// this app's own dropdown look instead of the browser's native <select>.
function TitleChoiceDropdown({ choices, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-hanken flex items-center w-full h-[36px] px-[10px] rounded-[6px] text-[13px] bg-white cursor-pointer border border-gc-scrollbar-thumb/60"
      >
        <span
          className={`flex-1 text-left truncate ${value ? "text-gc-near-black" : "text-gc-muted"}`}
        >
          {value || "Title…"}
        </span>
        <ChevronDown
          size={13}
          className={`flex-shrink-0 transition-transform text-gc-muted ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] max-h-[220px] overflow-y-auto bg-white rounded-[6px] border border-gc-border-warm shadow-md">
          {choices.map((c) => {
            const active = c === value;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between text-left px-[10px] py-[8px] font-hanken text-[13px] transition-colors cursor-pointer ${active
                    ? "text-gc-primary bg-gc-primary/[6%] font-semibold"
                    : "text-gc-near-black font-normal hover:bg-gc-bg-warm"
                  }`}
              >
                {c}
                {active && <Check size={13} className="flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DesignOptionsPicker({
  options,
  selectedIds,
  onChange,
  loading,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
  titleChoices,
  fixedTitle,
}) {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(fixedTitle || "");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const selected = options.filter((o) => selectedIds.includes(o.id));
  const canSave = newTitle.trim() && newLabel.trim() && newValue.trim();

  function toggle(id) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  }

  function resetForm() {
    setEditingId(null);
    setNewTitle(fixedTitle || "");
    setNewLabel("");
    setNewValue("");
  }

  function startEdit(option) {
    setEditingId(option.id);
    setNewTitle(option.title || fixedTitle || "");
    setNewLabel(option.label || "");
    setNewValue(option.value || "");
    setCreateError(null);
  }

  async function handleSave() {
    if (!canSave || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const fields = {
        title: newTitle.trim(),
        label: newLabel.trim(),
        value: newValue.trim(),
      };
      if (editingId) {
        await onUpdateOption(editingId, fields);
      } else {
        const created = await onCreateOption(fields);
        onChange([...selectedIds, created.id]);
      }
      resetForm();
    } catch (e) {
      setCreateError(e.message || "Failed to save design option");
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteOption(deleteTarget.id);
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e.message || "Failed to delete design option");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={ref} className="relative w-full max-w-[480px]">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-[8px] mb-[8px]">
          {selected.map((o) => (
            <span
              key={o.id}
              className="font-hanken flex items-center gap-[6px] pl-[12px] pr-[8px] py-[6px] rounded-[6px] text-[12px] font-medium text-white bg-gc-primary"
            >
              {o.title}
              {o.label || o.value ? (
                <span className="opacity-80">
                  {o.label ? `${o.label}: ` : ""}
                  {o.value}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="cursor-pointer hover:opacity-70"
                title="Remove"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => !loading && setOpen((v) => !v)}
        className="font-hanken flex items-center w-full h-[48px] rounded-[4px] px-[14px] bg-white cursor-pointer border border-gc-scrollbar-thumb/60"
      >
        <span className="flex-1 text-left text-[14px] text-gc-muted truncate">
          {loading
            ? "Loading design options…"
            : options.length === 0
              ? "Select or create a design option…"
              : "Select design options…"}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform text-gc-muted ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] max-h-[360px] overflow-y-auto bg-white rounded-[8px] border border-gc-border-warm shadow-md">
          <div className="sticky top-0 z-10 flex flex-col gap-[6px] bg-white border-b border-gc-divider p-[8px]">
            <div className="grid grid-cols-3 gap-[6px]">
              {fixedTitle ? (
                <div className="font-hanken flex items-center h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black bg-gc-bg-warm border border-gc-scrollbar-thumb/60">
                  {fixedTitle}
                </div>
              ) : titleChoices?.length ? (
                <TitleChoiceDropdown
                  choices={titleChoices}
                  value={newTitle}
                  onChange={setNewTitle}
                />
              ) : (
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title *"
                  className="font-hanken h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
                />
              )}
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label *"
                className="font-hanken h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="Value *"
                className="font-hanken h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
              />
            </div>
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || creating}
                className="font-hanken self-start flex items-center gap-[4px] h-[32px] px-[10px] rounded-[6px] text-[12px] font-semibold text-white bg-gc-primary hover:bg-gc-primary-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {creating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {editingId ? "Save design option" : "Create design option"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="font-hanken text-[12px] font-medium text-gc-muted hover:text-gc-near-black cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            {createError && (
              <p className="font-hanken text-[12px] text-red-600 px-[2px]">
                {createError}
              </p>
            )}
          </div>
          {options.map((o) => {
            const active = selectedIds.includes(o.id);
            return (
              <div
                key={o.id}
                className={`w-full flex items-center gap-[8px] px-[14px] py-[10px] font-hanken text-[13px] transition-colors ${active
                    ? "text-gc-primary bg-gc-primary/[6%] font-semibold"
                    : "text-gc-near-black font-normal hover:bg-gc-bg-warm"
                  }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  className="flex-1 flex items-center justify-between text-left cursor-pointer min-w-0"
                >
                  <span className="truncate">
                    {o.title}
                    {o.label || o.value ? (
                      <span className="ml-[6px] text-gc-muted font-normal">
                        {o.label ? `${o.label}: ` : ""}
                        {o.value}
                      </span>
                    ) : null}
                  </span>
                  {active && <Check size={14} className="flex-shrink-0 ml-[6px]" />}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(o)}
                  title="Edit"
                  className="flex-shrink-0 flex items-center justify-center w-[26px] h-[26px] rounded-[4px] cursor-pointer text-gc-muted hover:text-gc-near-black hover:bg-gc-bg-warm"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(o)}
                  title="Delete"
                  className="flex-shrink-0 flex items-center justify-center w-[26px] h-[26px] rounded-[4px] cursor-pointer text-gc-muted hover:text-red-600 hover:bg-gc-bg-warm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ModalBase
          onClose={() => !deleting && setDeleteTarget(null)}
          maxWidth="max-w-[420px]"
        >
          <div className="p-[24px] flex flex-col gap-[16px]">
            <div className="flex items-start justify-between gap-[12px]">
              <div>
                <h2 className="font-garamond font-bold text-[20px] leading-tight text-gc-heading">
                  Delete Design Option
                </h2>
                <p className="font-hanken text-[13px] mt-[6px] leading-[1.5] text-gc-primary-deep">
                  Are you sure you want to delete{" "}
                  <strong>
                    {deleteTarget.title}
                    {deleteTarget.label ? ` ${deleteTarget.label}` : ""}
                    {deleteTarget.value ? `: ${deleteTarget.value}` : ""}
                  </strong>
                  ? This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                className="flex-shrink-0 flex items-center justify-center rounded-[6px] cursor-pointer hover:opacity-80 w-[30px] h-[30px] bg-gc-bg-warm"
              >
                <X size={14} className="text-gc-primary-deep" />
              </button>
            </div>

            {deleteError && (
              <p className="font-hanken text-[12px] text-red-600">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-[8px] border-t border-gc-border-warm pt-[12px]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="font-hanken font-semibold text-[13px] h-[38px] px-[16px] rounded-[8px] cursor-pointer hover:opacity-80 disabled:opacity-50 border border-gc-border-warm text-gc-primary-deep"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="font-hanken font-semibold text-[13px] text-white h-[38px] px-[20px] rounded-[8px] cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalBase>
      )}
    </div>
  );
}

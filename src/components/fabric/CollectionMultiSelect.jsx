import { useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

export default function CollectionMultiSelect({
  collections,
  selectedIds,
  onChange,
  loading,
  onCreateCollection,
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const selected = collections.filter((c) => selectedIds.includes(c.id));

  function toggle(id) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || creating) return;
    // Reuse an existing collection if the typed name already matches one.
    const existing = collections.find(
      (c) => c.title.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      if (!selectedIds.includes(existing.id)) toggle(existing.id);
      setNewName("");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const col = await onCreateCollection(name);
      onChange([...selectedIds, col.id]);
      setNewName("");
    } catch (e) {
      setCreateError(e.message || "Failed to create collection");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={ref} className="relative w-full max-w-[480px]">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-[8px] mb-[8px]">
          {selected.map((c) => (
            <span
              key={c.id}
              className="font-hanken flex items-center gap-[6px] pl-[12px] pr-[8px] py-[6px] rounded-[6px] text-[12px] font-medium text-white bg-gc-primary"
            >
              {c.title}
              <button
                type="button"
                onClick={() => toggle(c.id)}
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
            ? "Loading collections…"
            : collections.length === 0
              ? onCreateCollection
                ? "Select or create a collection…"
                : "No collections found"
              : "Select collections…"}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform text-gc-muted ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      {open && (collections.length > 0 || onCreateCollection) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] max-h-[300px] overflow-y-auto bg-white rounded-[8px] border border-gc-border-warm shadow-md">
          {onCreateCollection && (
            <div className="sticky top-0 z-10 flex flex-col gap-[4px] bg-white border-b border-gc-divider p-[8px]">
              <div className="flex items-center gap-[6px]">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder="New collection name…"
                  className="font-hanken flex-1 h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="font-hanken flex items-center gap-[4px] h-[36px] px-[10px] rounded-[6px] text-[12px] font-semibold text-white bg-gc-primary hover:bg-gc-primary-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Create
                </button>
              </div>
              {createError && (
                <p className="font-hanken text-[12px] text-red-600 px-[2px]">
                  {createError}
                </p>
              )}
            </div>
          )}
          {collections.map((c) => {
            const active = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center justify-between text-left px-[14px] py-[10px] font-hanken text-[13px] transition-colors cursor-pointer ${
                  active
                    ? "text-gc-primary bg-gc-primary/[6%] font-semibold"
                    : "text-gc-near-black font-normal hover:bg-gc-bg-warm"
                }`}
              >
                {c.title}
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

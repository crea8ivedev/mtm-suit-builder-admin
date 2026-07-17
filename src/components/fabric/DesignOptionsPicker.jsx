import { useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

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
                className={`w-full flex items-center justify-between text-left px-[10px] py-[8px] font-hanken text-[13px] transition-colors cursor-pointer ${
                  active
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
  titleChoices,
}) {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const selected = options.filter((o) => selectedIds.includes(o.id));

  function toggle(id) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  }

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await onCreateOption({
        title,
        label: newLabel.trim(),
        value: newValue.trim(),
      });
      onChange([...selectedIds, created.id]);
      setNewTitle("");
      setNewLabel("");
      setNewValue("");
    } catch (e) {
      setCreateError(e.message || "Failed to create design option");
    } finally {
      setCreating(false);
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
              {titleChoices?.length ? (
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
                  placeholder="Title"
                  className="font-hanken h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
                />
              )}
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label"
                className="font-hanken h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="Value"
                className="font-hanken h-[36px] px-[10px] rounded-[6px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              className="font-hanken self-start flex items-center gap-[4px] h-[32px] px-[10px] rounded-[6px] text-[12px] font-semibold text-white bg-gc-primary hover:bg-gc-primary-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Create design option
            </button>
            {createError && (
              <p className="font-hanken text-[12px] text-red-600 px-[2px]">
                {createError}
              </p>
            )}
          </div>
          {options.map((o) => {
            const active = selectedIds.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className={`w-full flex items-center justify-between text-left px-[14px] py-[10px] font-hanken text-[13px] transition-colors cursor-pointer ${
                  active
                    ? "text-gc-primary bg-gc-primary/[6%] font-semibold"
                    : "text-gc-near-black font-normal hover:bg-gc-bg-warm"
                }`}
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
                {active && <Check size={14} className="flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

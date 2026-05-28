import { useState, useEffect, useRef } from "react";
import { X, UserPlus, Loader } from "lucide-react";
import { cn } from "../../utils/cn";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL = { firstName: "", lastName: "", email: "", phone: "" };

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-12 font-semibold text-text-secondary uppercase tracking-wider mb-[6px]">
        {label}
      </label>
      {children}
      {error && <p className="mt-[4px] text-12 text-red-500">{error}</p>}
    </div>
  );
}

export default function CreateCustomerModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  // Focus first field on open
  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setErrors({});
      setApiError(null);
      setTimeout(() => firstRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  if (!open) return null;

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
    setApiError(null);
  };

  function validate() {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    else if (!EMAIL_RE.test(form.email.trim()))
      errs.email = "Invalid email format";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    setApiError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field)
          setErrors((er) => ({ ...er, [data.field]: data.error }));
        else setApiError(data.error ?? "Failed to create customer");
        return;
      }
      onCreated(data.customer);
    } catch {
      setApiError("Network error — check the server is running");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !saving && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[480px] bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-[10px] px-[24px] py-[18px] border-b border-border bg-gray-50">
          <div className="w-[32px] h-[32px] rounded-lg bg-brand-50 flex items-center justify-center">
            <UserPlus size={15} className="text-brand-600" />
          </div>
          <h2 className="text-16 font-bold text-text-primary">
            Create Customer
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="ml-auto p-[6px] rounded-lg text-text-muted hover:bg-gray-200 hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-[24px] py-[20px] space-y-[16px]">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-[12px]">
              <Field label="First Name *" error={errors.firstName}>
                <input
                  ref={firstRef}
                  type="text"
                  value={form.firstName}
                  onChange={set("firstName")}
                  placeholder="John"
                  className={cn(
                    "input w-full py-[9px]",
                    errors.firstName && "border-red-400 focus:border-red-500",
                  )}
                />
              </Field>
              <Field label="Last Name *" error={errors.lastName}>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={set("lastName")}
                  placeholder="Doe"
                  className={cn(
                    "input w-full py-[9px]",
                    errors.lastName && "border-red-400 focus:border-red-500",
                  )}
                />
              </Field>
            </div>

            <Field label="Email Address *" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="john@example.com"
                className={cn(
                  "input w-full py-[9px]",
                  errors.email && "border-red-400 focus:border-red-500",
                )}
              />
            </Field>

            <Field label="Phone Number" error={errors.phone}>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+1 234 567 8900"
                className="input w-full py-[9px]"
              />
            </Field>

            {/* API error */}
            {apiError && (
              <div className="px-[12px] py-[10px] bg-red-50 border border-red-200 rounded-lg">
                <p className="text-13 text-red-600">{apiError}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-[10px] px-[24px] py-[16px] border-t border-border bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary gap-[8px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <UserPlus size={14} />
              )}
              {saving ? "Creating…" : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { X, Plus, Loader } from "lucide-react";
import { cn } from "../../utils/cn";
import { createCustomer } from "../../lib/shopify";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  apt: "",
  city: "",
  province: "",
  zip: "",
};

const WATERMARK = "/watermark-scissors.png";

function GCInput({
  placeholder,
  value,
  onChange,
  type = "text",
  error,
  inputRef,
}) {
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn(
        "font-hanken w-full h-[38px] px-[17px] py-[9px] bg-white rounded-[8px] text-[14px] text-[#1a1c1b] placeholder:text-[#6b7280] outline-none transition-colors",
        error
          ? "border border-red-400 focus:border-red-500"
          : "border border-[#d1c7bd] focus:border-[#a45d41]",
      )}
    />
  );
}

function FieldLabel({ children }) {
  return (
    <p className="font-hanken text-[12px] font-medium text-[#ababab] uppercase mb-[4px] tracking-wide">
      {children}
    </p>
  );
}

function SectionHeading({ num, title }) {
  return (
    <div className="flex items-center gap-[16px]">
      <span className="font-hanken text-[9px] font-semibold text-black uppercase leading-[9px]">
        {num}
      </span>
      <span className="font-garamond text-[18px] text-black leading-[27px]">
        {title}
      </span>
      <div
        className="w-[250px] h-px"
        style={{ backgroundColor: "rgba(207,196,197,0.3)" }}
      />
    </div>
  );
}

export default function CreateCustomerModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setErrors({});
      setApiError(null);
      setTimeout(() => firstRef.current?.focus(), 50);
    }
  }, [open]);

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
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = "Invalid email";
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
      const customer = await createCustomer({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
      });
      onCreated(customer);
    } catch (err) {
      if (err.field) setErrors((er) => ({ ...er, [err.field]: err.message }));
      else setApiError(err.message ?? "Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(10,10,10,0.6)",
          backdropFilter: "blur(2px)",
        }}
        onClick={() => !saving && onClose()}
      />

      {/* Modal */}
      <div
        className="relative w-[672px] rounded-[12px] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "#fcf9f4",
          boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Watermark top-right corner */}
        <div
          className="absolute top-0 right-0 w-[128px] h-[129px] pointer-events-none z-10 overflow-hidden"
          style={{ opacity: 0.03, mixBlendMode: "multiply" }}
        >
          <img
            src={WATERMARK}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>

        {/* Header */}
        <div
          className="flex items-start justify-between pb-[21px] pt-[30px] px-[40px] relative z-20"
          style={{ borderBottom: "1px solid rgba(207,196,197,0.3)" }}
        >
          <div className="flex flex-col gap-[8px]">
            <span className="font-hanken text-[12px] font-semibold uppercase text-gc-primary tracking-wide">
              NEW ENTRY
            </span>
            <h2 className="font-garamond text-[24px] font-medium text-black leading-[31px]">
              Create Customer
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="mt-[4px] text-[#1a1c1b] hover:text-[#a45d41] transition-colors disabled:opacity-40"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form body */}
        <div className="px-[40px] py-[32px] flex flex-col gap-[48px]">
          {/* Section 01 — Identity */}
          <div className="flex flex-col gap-[24px]">
            <SectionHeading num="01" title="Identity" />
            <div className="grid grid-cols-2 gap-x-[24px] gap-y-[32px]">
              {/* First Name */}
              <div>
                <FieldLabel>First Name</FieldLabel>
                <GCInput
                  inputRef={firstRef}
                  placeholder="Enter given name"
                  value={form.firstName}
                  onChange={set("firstName")}
                  error={errors.firstName}
                />
                {errors.firstName && (
                  <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                    {errors.firstName}
                  </p>
                )}
              </div>
              {/* Last Name */}
              <div>
                <FieldLabel>Last Name</FieldLabel>
                <GCInput
                  placeholder="Enter surname"
                  value={form.lastName}
                  onChange={set("lastName")}
                  error={errors.lastName}
                />
                {errors.lastName && (
                  <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                    {errors.lastName}
                  </p>
                )}
              </div>
              {/* Email */}
              <div>
                <FieldLabel>Email Address</FieldLabel>
                <GCInput
                  type="email"
                  placeholder="client@domain.com"
                  value={form.email}
                  onChange={set("email")}
                  error={errors.email}
                />
                {errors.email && (
                  <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                    {errors.email}
                  </p>
                )}
              </div>
              {/* Phone */}
              <div>
                <FieldLabel>Phone Number</FieldLabel>
                <GCInput
                  type="tel"
                  placeholder="+44 20 ...."
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
            </div>
          </div>

          {/* Section 02 — Residence */}
          {/* <div className="flex flex-col gap-[24px]">
            <SectionHeading num="02" title="Residence" />
            <div className="flex flex-col gap-[32px]">
              <div className="grid grid-cols-2 gap-x-[24px]">
                <div>
                  <FieldLabel>Address</FieldLabel>
                  <GCInput
                    placeholder="Building name or number"
                    value={form.address}
                    onChange={set("address")}
                  />
                </div>
                <div>
                  <FieldLabel>Apt/Suite</FieldLabel>
                  <GCInput
                    placeholder="Optional"
                    value={form.apt}
                    onChange={set("apt")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-x-[24px]">
                <div>
                  <FieldLabel>City</FieldLabel>
                  <GCInput
                    placeholder="City name"
                    value={form.city}
                    onChange={set("city")}
                  />
                </div>
                <div>
                  <FieldLabel>State/County</FieldLabel>
                  <select
                    value={form.province}
                    onChange={set("province")}
                    className="font-hanken w-full h-[38px] px-[17px] bg-white border border-[#d1c7bd] rounded-[8px] text-[14px] text-[#6b7280] outline-none focus:border-[#a45d41] transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Select area</option>
                    <option>England</option>
                    <option>Scotland</option>
                    <option>Wales</option>
                    <option>Northern Ireland</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Zip/Postal Code</FieldLabel>
                  <GCInput
                    placeholder="Postcode"
                    value={form.zip}
                    onChange={set("zip")}
                  />
                </div>
              </div>
            </div>
          </div> */}

          {/* API error */}
          {apiError && (
            <div className="px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-[8px]">
              <p className="font-hanken text-[13px] text-red-600">{apiError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <form onSubmit={handleSubmit}>
          <div
            className="flex items-center justify-end gap-[20px] px-[40px] pb-[20px] pt-[21px]"
            style={{
              backgroundColor: "#f6f3ee",
              borderTop: "1px solid rgba(207,196,197,0.3)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="font-hanken text-[14px] font-medium text-black uppercase px-[20px] py-[16px] hover:opacity-70 transition-opacity disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="font-hanken flex items-center gap-[8px] h-[44px] px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader size={13} className="animate-spin" />
              ) : (
                <Plus size={13} />
              )}
              {saving ? "Creating…" : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

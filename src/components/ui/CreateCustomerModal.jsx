import { useState, useEffect, useRef } from "react";
import { X, Plus, Loader } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { cn } from "../../utils/cn";
import { createCustomer } from "../../lib/shopify";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
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

function GCDropdown({ items, value, onChange, placeholder, disabled, dropUp }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  const selected = items.find((i) => i.value === value);
  const filtered = search.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : items;

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch("");
  }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="font-hanken w-full flex items-center justify-between h-[38px] px-[14px] bg-white border border-[#d1c7bd] rounded-[8px] text-[14px] outline-none hover:border-[#a45d41] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? "text-[#1a1c1b]" : "text-[#6b7280]"}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex flex-col items-center gap-[2px] flex-shrink-0 ml-[8px]">
          <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
            <path d="M3.5 0L7 5H0L3.5 0Z" fill="#9ca3af" />
          </svg>
          <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
            <path d="M3.5 5L0 0H7L3.5 5Z" fill="#9ca3af" />
          </svg>
        </div>
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-[60] w-full bg-white border border-[#d1c7bd] rounded-[10px] shadow-xl overflow-hidden",
            dropUp ? "bottom-[42px]" : "top-[42px]",
          )}
        >
          <div className="p-[8px] border-b border-[#f0ece6]">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="font-hanken w-full h-[30px] px-[10px] bg-[#f9f7f4] border border-[#e8e1d9] rounded-[6px] text-[13px] text-[#1a1c1b] placeholder:text-[#9ca3af] outline-none"
            />
          </div>
          <div className="overflow-y-auto max-h-[200px]">
            {filtered.length === 0 ? (
              <p className="font-hanken text-[13px] text-[#9ca3af] text-center py-[12px]">
                No results
              </p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full flex items-center px-[14px] py-[9px] text-left hover:bg-[#fdf5f0] transition-colors",
                    value === item.value && "bg-[#fdf5f0]",
                  )}
                >
                  <span className="font-hanken text-[13px] text-[#1a1c1b] truncate">
                    {item.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneField({ phoneIso, onPhoneIsoChange, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const allCountries = Country.getAllCountries();
  const current = allCountries.find((c) => c.isoCode === phoneIso);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex gap-[8px]">
      {/* Flag selector — up/down arrows, no search */}
      <div ref={ref} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-[6px] h-[38px] px-[10px] bg-white border border-[#d1c7bd] rounded-[8px] outline-none hover:border-[#a45d41] transition-colors cursor-pointer"
        >
          <span className="text-[20px] leading-none">
            {current?.flag ?? "🌐"}
          </span>
          {/* Up / down spinner arrows */}
          <div className="flex flex-col items-center gap-[2px]">
            <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
              <path d="M3.5 0L7 5H0L3.5 0Z" fill="#9ca3af" />
            </svg>
            <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
              <path d="M3.5 5L0 0H7L3.5 5Z" fill="#9ca3af" />
            </svg>
          </div>
        </button>

        {open && (
          <div className="absolute top-[42px] left-0 z-[60] w-[260px] bg-white border border-[#d1c7bd] rounded-[10px] shadow-xl overflow-hidden">
            <div className="overflow-y-auto max-h-[240px]">
              {allCountries.map((c) => (
                <button
                  key={c.isoCode}
                  type="button"
                  onClick={() => {
                    onPhoneIsoChange(c.isoCode);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-[10px] px-[14px] py-[8px] text-left hover:bg-[#fdf5f0] transition-colors",
                    phoneIso === c.isoCode && "bg-[#fdf5f0]",
                  )}
                >
                  <span className="text-[18px] leading-none w-[22px] flex-shrink-0">
                    {c.flag}
                  </span>
                  <span className="font-hanken text-[13px] text-[#1a1c1b] flex-1 truncate">
                    {c.name}
                  </span>
                  <span className="font-hanken text-[12px] text-[#9ca3af] flex-shrink-0">
                    +{c.phonecode}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Phone code prefix + number input in one box */}
      <div className="flex flex-1 items-center h-[38px] bg-white border border-[#d1c7bd] rounded-[8px] focus-within:border-[#a45d41] transition-colors overflow-hidden">
        {current && (
          <span className="font-hanken text-[14px] text-[#1a1c1b] pl-[14px] pr-[2px] select-none whitespace-nowrap flex-shrink-0">
            +{current.phonecode}
          </span>
        )}
        <input
          type="tel"
          value={value}
          onChange={onChange}
          placeholder={current ? "Phone number" : "+-- Phone number"}
          className="font-hanken flex-1 h-full px-[10px] bg-transparent text-[14px] text-[#1a1c1b] placeholder:text-[#6b7280] outline-none"
        />
      </div>
    </div>
  );
}

export default function CreateCustomerModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [countryIso, setCountryIso] = useState("");
  const [stateIso, setStateIso] = useState("");
  const [phoneIso, setPhoneIso] = useState("US");
  const firstRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setErrors({});
      setApiError(null);
      setCountryIso("");
      setStateIso("");
      setPhoneIso("US");
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

  function handleCountryChange(iso) {
    const c = Country.getCountryByCode(iso);
    setCountryIso(iso);
    setStateIso("");
    setPhoneIso(iso);
    setForm((f) => ({ ...f, country: c?.name ?? "", province: "", city: "" }));
    setApiError(null);
  }

  function handleStateChange(iso) {
    const s = State.getStateByCodeAndCountry(iso, countryIso);
    setStateIso(iso);
    setForm((f) => ({ ...f, province: s?.name ?? "", city: "" }));
    setApiError(null);
  }

  function handleCityChange(val) {
    setForm((f) => ({ ...f, city: val }));
    setApiError(null);
  }

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
        phone: form.phone?.trim()
          ? phoneIso
            ? `+${Country.getCountryByCode(phoneIso)?.phonecode ?? ""}${form.phone.trim()}`
            : form.phone.trim()
          : undefined,
        country: form.country?.trim() || undefined,
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
                <PhoneField
                  phoneIso={phoneIso}
                  onPhoneIsoChange={setPhoneIso}
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
            </div>
          </div>

          {/* Section 02 — Residence */}
          <div className="flex flex-col gap-[24px]">
            <SectionHeading num="02" title="Residence" />
            <div className="flex flex-col gap-[32px]">
              {/* Country */}
              <div className="grid grid-cols-2 gap-x-[24px]">
                <div>
                  <FieldLabel>Country</FieldLabel>
                  <GCDropdown
                    value={countryIso}
                    onChange={handleCountryChange}
                    placeholder="Select country"
                    items={Country.getAllCountries().map((c) => ({
                      value: c.isoCode,
                      label: c.name,
                    }))}
                  />
                </div>
              </div>
              {/* Address */}
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
              {/* City / State / Zip */}
              <div className="grid grid-cols-3 gap-x-[24px]">
                <div>
                  <FieldLabel>State</FieldLabel>
                  <GCDropdown
                    value={stateIso}
                    onChange={handleStateChange}
                    disabled={!countryIso}
                    dropUp
                    placeholder={
                      !countryIso
                        ? "Select country first"
                        : State.getStatesOfCountry(countryIso).length
                          ? "Select state"
                          : "No states"
                    }
                    items={State.getStatesOfCountry(countryIso).map((s) => ({
                      value: s.isoCode,
                      label: s.name,
                    }))}
                  />
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <GCDropdown
                    value={form.city}
                    onChange={handleCityChange}
                    disabled={!stateIso}
                    dropUp
                    placeholder={
                      !stateIso
                        ? "Select state first"
                        : City.getCitiesOfState(countryIso, stateIso).length
                          ? "Select city"
                          : "No cities"
                    }
                    items={City.getCitiesOfState(countryIso, stateIso).map(
                      (c) => ({ value: c.name, label: c.name }),
                    )}
                  />
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
          </div>

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

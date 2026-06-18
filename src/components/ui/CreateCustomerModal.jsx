import { useState, useEffect, useRef } from "react";
import { X, Plus, Loader } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { cn } from "../../utils/cn";
import { createCustomer } from "../../lib/shopify";
import { useClickOutside } from "../../hooks/useClickOutside";

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
        "font-hanken w-full h-[38px] px-[17px] py-[9px] bg-white rounded-[8px] text-[14px] text-gc-near-black2 placeholder:text-gc-muted outline-none transition-colors",
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
      <div className="flex-1 h-px bg-gc-section-divider/30" />
    </div>
  );
}

function GCDropdown({
  items,
  value,
  onChange,
  placeholder,
  disabled,
  dropUp,
  error,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  const selected = items.find((i) => i.value === value);
  const filtered = search.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : items;

  useClickOutside(ref, () => {
    setOpen(false);
    setSearch("");
  });

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
        className={cn(
          "font-hanken w-full flex items-center justify-between h-[38px] px-[14px] bg-white rounded-[8px] text-[14px] outline-none hover:border-[#a45d41] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border border-red-400" : "border border-[#d1c7bd]",
        )}
      >
        <span
          className={`truncate min-w-0 ${selected ? "text-gc-near-black2" : "text-[#6b7280]"}`}
        >
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
              className="font-hanken w-full h-[30px] px-[10px] bg-[#f9f7f4] border border-[#e8e1d9] rounded-[6px] text-[13px] text-gc-near-black2 placeholder:text-[#9ca3af] outline-none"
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
                  <span className="font-hanken text-[13px] text-gc-near-black2 truncate">
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

  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="flex gap-[8px]">
      <div ref={ref} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-[6px] h-[38px] px-[10px] bg-white border border-[#d1c7bd] rounded-[8px] outline-none hover:border-[#a45d41] transition-colors cursor-pointer"
        >
          <span className="text-[20px] leading-none">
            {current?.flag ?? "🌐"}
          </span>
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
                  <span className="font-hanken text-[13px] text-gc-near-black2 flex-1 truncate">
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

      <div className="flex flex-1 items-center h-[38px] bg-white border border-[#d1c7bd] rounded-[8px] focus-within:border-[#a45d41] transition-colors overflow-hidden">
        {current && (
          <span className="font-hanken text-[14px] text-gc-near-black2 pl-[14px] pr-[2px] select-none whitespace-nowrap flex-shrink-0">
            +{current.phonecode}
          </span>
        )}
        <input
          type="tel"
          value={value}
          onChange={onChange}
          placeholder={current ? "Phone number" : "+-- Phone number"}
          className="font-hanken flex-1 h-full px-[10px] bg-transparent text-[14px] text-gc-near-black2 placeholder:text-gc-muted outline-none"
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
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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
    setForm((f) => ({ ...f, country: c?.name ?? "", province: "", city: "" }));
    setErrors((er) => ({ ...er, country: null, province: null, city: null }));
    setApiError(null);
  }

  function handleStateChange(iso) {
    const s = State.getStateByCodeAndCountry(iso, countryIso);
    setStateIso(iso);
    setForm((f) => ({ ...f, province: s?.name ?? "", city: "" }));
    setErrors((er) => ({ ...er, province: null, city: null }));
    setApiError(null);
  }

  function handleCityChange(val) {
    setForm((f) => ({ ...f, city: val }));
    setErrors((er) => ({ ...er, city: null }));
    setApiError(null);
  }

  function validate() {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = "Invalid email";
    if (!countryIso) errs.country = "Required";
    if (!form.address.trim()) errs.address = "Required";
    const hasStates = countryIso
      ? State.getStatesOfCountry(countryIso).length > 0
      : false;
    if (hasStates && !stateIso) errs.province = "Required";
    const hasCities =
      countryIso && stateIso
        ? City.getCitiesOfState(countryIso, stateIso).length > 0
        : false;
    if (hasCities && !form.city.trim()) errs.city = "Required";
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
        address1: form.address.trim() || undefined,
        address2: form.apt.trim() || undefined,
        city: form.city.trim() || undefined,
        province: form.province.trim() || undefined,
        zip: form.zip.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px] sm:p-[24px]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={() => !saving && onClose()}
      />

      <div className="relative w-full sm:w-[672px] rounded-[12px] overflow-hidden flex flex-col max-h-full bg-gc-surface-warm shadow-2xl max-h-[min(90vh,800px)]">
        <div className="absolute top-0 right-0 w-[128px] h-[129px] pointer-events-none z-10 overflow-hidden opacity-[0.03] mix-blend-multiply">
          <img
            src={WATERMARK}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between pb-[18px] pt-[22px] sm:pt-[30px] sm:pb-[21px] px-[20px] sm:px-[40px] relative z-20 flex-shrink-0 border-b border-gc-section-divider/30">
          <div className="flex flex-col gap-[8px]">
            <h2 className="font-garamond text-[24px] font-medium text-black leading-[31px]">
              Create Customer
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="mt-[4px] text-gc-near-black2 hover:text-gc-primary transition-colors disabled:opacity-40"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-[20px] sm:px-[40px] py-[24px] sm:py-[32px] flex flex-col gap-[32px] sm:gap-[48px] overflow-y-auto flex-1">
          <div className="flex flex-col gap-[24px]">
            <SectionHeading num="01" title="Identity" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[24px] gap-y-[20px] sm:gap-y-[32px]">
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
              <div>
                <FieldLabel>
                  Phone Number{" "}
                  <span className="normal-case text-[#bbb] font-normal tracking-normal">
                    (Optional)
                  </span>
                </FieldLabel>
                <PhoneField
                  phoneIso={phoneIso}
                  onPhoneIsoChange={setPhoneIso}
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[24px]">
            <SectionHeading num="02" title="Residence" />
            <div className="flex flex-col gap-[32px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[24px]">
                <div>
                  <FieldLabel>Country</FieldLabel>
                  <GCDropdown
                    value={countryIso}
                    onChange={handleCountryChange}
                    placeholder="Select country"
                    error={errors.country}
                    items={Country.getAllCountries().map((c) => ({
                      value: c.isoCode,
                      label: c.name,
                    }))}
                  />
                  {errors.country && (
                    <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                      {errors.country}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[24px] gap-y-[20px] sm:gap-y-0">
                <div>
                  <FieldLabel>Address</FieldLabel>
                  <GCInput
                    placeholder="Building name or number"
                    value={form.address}
                    onChange={set("address")}
                    error={errors.address}
                  />
                  {errors.address && (
                    <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                      {errors.address}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>
                    Apt/Suite{" "}
                    <span className="normal-case text-[#bbb] font-normal tracking-normal">
                      (Optional)
                    </span>
                  </FieldLabel>
                  <GCInput
                    placeholder="Unit, floor, suite…"
                    value={form.apt}
                    onChange={set("apt")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-[24px] gap-y-[20px] sm:gap-y-0">
                <div>
                  <FieldLabel>State</FieldLabel>
                  <GCDropdown
                    value={stateIso}
                    onChange={handleStateChange}
                    disabled={!countryIso}
                    dropUp
                    error={errors.province}
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
                  {errors.province && (
                    <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                      {errors.province}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <GCDropdown
                    value={form.city}
                    onChange={handleCityChange}
                    disabled={!stateIso}
                    dropUp
                    error={errors.city}
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
                  {errors.city && (
                    <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                      {errors.city}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>
                    Zip/Postal Code{" "}
                    <span className="normal-case text-[#bbb] font-normal tracking-normal">
                      (Optional)
                    </span>
                  </FieldLabel>
                  <GCInput
                    placeholder="Postcode"
                    value={form.zip}
                    onChange={set("zip")}
                    error={errors.zip}
                  />
                  {errors.zip && (
                    <p className="font-hanken mt-[4px] text-[12px] text-red-500">
                      {errors.zip}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 border-t border-gc-section-divider/30 bg-gc-modal-footer"
        >
          {apiError && (
            <div className="px-[20px] sm:px-[40px] pt-[12px]">
              <p className="font-hanken text-[13px] text-red-600">{apiError}</p>
            </div>
          )}
          <div className="flex items-center justify-end gap-[12px] sm:gap-[20px] px-[20px] sm:px-[40px] pb-[20px] pt-[16px] sm:pt-[21px]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="font-hanken text-[13px] sm:text-[14px] font-medium text-black uppercase px-[14px] sm:px-[20px] py-[12px] sm:py-[16px] hover:opacity-70 transition-opacity disabled:opacity-40 cursor-pointer border border-gray-300 rounded-[8px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="font-hanken flex items-center gap-[8px] h-[40px] sm:h-[44px] px-[14px] sm:px-[16px] rounded-[8px] bg-gc-primary hover:bg-gc-primary-dark text-white text-[13px] sm:text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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

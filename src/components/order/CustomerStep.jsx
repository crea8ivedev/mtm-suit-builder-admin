import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Plus } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { fetchCustomersPage, transformCustomer } from "../../lib/shopify";

const AVATAR_PALETTE = [
  { bg: "rgba(42,10,10,0.05)", border: "rgba(42,10,10,0.1)", text: "#2a0a0a" },
  {
    bg: "rgba(146,73,50,0.05)",
    border: "rgba(146,73,50,0.1)",
    text: "#924932",
  },
  {
    bg: "rgba(119,90,25,0.05)",
    border: "rgba(119,90,25,0.1)",
    text: "#775a19",
  },
  {
    bg: "rgba(164,93,65,0.05)",
    border: "rgba(164,93,65,0.1)",
    text: "#a45d41",
  },
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(idx) {
  return AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
}

export function OrdersBadge({ count }) {
  if (count == null)
    return (
      <span className="font-hanken text-[12px] tracking-[0.9px] text-[#7e7576]">
        No history
      </span>
    );
  const many = count >= 2;
  const label = count === 1 ? "1 ORDER" : `${count} ORDERS`;
  return (
    <span
      className={`font-hanken text-[10px] font-medium tracking-[0.8px] uppercase px-[6px] py-[3px] rounded-[4px] ${many ? "bg-gc-avatar-gold/10 text-gc-avatar-gold" : "bg-gc-section-divider/20 text-[#4c4546]"}`}
    >
      {label}
    </span>
  );
}

export function CustomerSelector({ value, onChange }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);
  const initialFetched = useRef(false);
  const navigate = useNavigate();

  useClickOutside(ref, () => setOpen(false));

  function doFetch(query) {
    setResultsLoading(true);
    fetchCustomersPage({ pageSize: 20, searchQuery: query })
      .then(({ customers: raw }) => {
        setResults(raw.map(transformCustomer));
        setResultsLoading(false);
      })
      .catch(() => setResultsLoading(false));
  }

  function handleFocus() {
    setOpen(true);
    if (!initialFetched.current) {
      initialFetched.current = true;
      doFetch("");
    }
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(val), 300);
  }

  if (value) {
    const color = avatarColor(0);
    return (
      <div className="flex items-center gap-[16px] px-[16px] py-[16px] bg-white rounded-[8px] border border-gc-border-input">
        <div
          className="w-[48px] h-[48px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: color.bg,
            border: `1px solid ${color.border}`,
          }}
        >
          <span
            className="font-garamond text-[18px]"
            style={{ color: color.text }}
          >
            {getInitials(value.name)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-hanken text-[16px] font-semibold text-black leading-tight">
            {value.name}
          </p>
          {value.email && (
            <p className="font-hanken text-[10px] font-semibold text-[#4c4546] tracking-[0.9px] lowercase mt-[2px]">
              {value.email}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 mr-[8px]">
          <OrdersBadge count={value.numberOfOrders} />
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-gc-near-black2 hover:text-gc-primary transition-colors cursor-pointer p-[6px] rounded-[6px] hover:bg-[rgba(164,93,65,0.08)]"
          title="Change customer"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center h-[60px] bg-white rounded-[8px] px-[17px] gap-[10px] overflow-hidden border border-gc-border-input">
        <Search size={16} className="text-[#6b7280] flex-shrink-0" />
        <input
          type="text"
          placeholder="Search customer by name or email...."
          value={search}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          className="flex-1 font-hanken text-[14px] text-gc-near-black2 placeholder:text-gc-muted outline-none bg-transparent"
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-[4px] bg-white rounded-[8px] shadow-xl flex flex-col overflow-hidden border border-gc-border-input max-h-[min(458px,60vh)]">
          <div className="overflow-y-auto flex-1 px-px pt-[9px]">
            {resultsLoading ? (
              <div className="font-hanken p-[16px] text-[14px] text-[#6b7280] text-center">
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="font-hanken p-[16px] text-[14px] text-[#6b7280] text-center">
                No customers found
              </div>
            ) : (
              results.map((customer, idx) => {
                const color = avatarColor(idx);
                return (
                  <button
                    key={customer.id}
                    onClick={() => {
                      onChange(customer);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full flex items-center justify-between px-[12px] sm:px-[16px] py-[12px] sm:py-[16px] text-left transition-colors cursor-pointer hover:bg-gc-bg-warm border-b border-gc-section-divider/10"
                  >
                    <div className="flex items-center gap-[10px] sm:gap-[16px] min-w-0">
                      <div
                        className="w-[36px] h-[36px] sm:w-[48px] sm:h-[48px] rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: color.bg,
                          border: `1px solid ${color.border}`,
                        }}
                      >
                        <span
                          className="font-garamond text-[14px] sm:text-[18px]"
                          style={{ color: color.text }}
                        >
                          {getInitials(customer.name)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-hanken text-[14px] sm:text-[16px] font-semibold text-black leading-tight truncate max-w-full">
                          {customer.name}
                        </span>
                        {customer.email && (
                          <span className="font-hanken text-[10px] font-semibold text-[#4c4546] tracking-[0.9px] lowercase truncate max-w-full">
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-[8px]">
                      <OrdersBadge count={customer.numberOfOrders} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/customers", {
                state: { autoCreateModal: true, returnTo: "/orders/new" },
              });
            }}
            className="w-full flex items-center justify-center gap-[8px] h-[44px] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-90 rounded-bl-[8px] rounded-br-[8px] bg-gc-primary"
          >
            <Plus size={11} color="white" />
            <span className="font-hanken text-[14px] font-semibold text-white uppercase tracking-[0.5px]">
              New Customer
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

import { Menu, Search, RefreshCw, ArrowLeft } from "lucide-react";
import {
  useLocation,
  useSearchParams,
  useNavigate,
  useMatch,
} from "react-router-dom";
import { useAdminUser } from "../../hooks/useAdminUser";

export default function TopBar({ onMenuClick, onRefresh }) {
  const {
    name: adminName,
    email: adminEmail,
    initial: adminInitial,
  } = useAdminUser();
  const location = useLocation();
  const navigate = useNavigate();
  const isOrderDetail = !!useMatch("/orders/:orderId");
  const isCustomerDetail = !!useMatch("/customers/:customerId");
  const isCustomersPage = location.pathname === "/customers";
  const isSearchablePage =
    !isOrderDetail &&
    !isCustomerDetail &&
    !isCustomersPage &&
    (location.pathname === "/orders" || location.pathname === "/dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchValue = searchParams.get("search") || "";

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("search", val);
        else next.delete("search");
        return next;
      },
      { replace: true },
    );
  };

  return (
    <header
      className="fixed top-0 right-0 left-0 lg:left-[256px] h-[64px] z-30 flex items-center justify-between pb-[16px] pt-[15px] px-[24px]"
      style={{
        backgroundColor: "#fdfcfb",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid rgba(194,198,216,0.3)",
      }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-[8px] rounded-lg text-[#424656] hover:bg-gray-100 transition-colors mr-[12px]"
      >
        <Menu size={20} />
      </button>

      {/* Left area: back button OR search OR empty */}
      {isOrderDetail ? (
        <div className="flex items-center gap-[32px]">
          <button
            onClick={() =>
              location.state?.fromCustomer
                ? navigate(`/customers/${location.state.fromCustomer}`)
                : navigate("/orders")
            }
            className="font-hanken flex items-center gap-[8px] text-[14px] text-black hover:text-[#424656] transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            {location.state?.fromCustomer
              ? "Back to customer"
              : "Back to orders"}
          </button>
          <div
            className="w-px h-[24px]"
            style={{ backgroundColor: "#c5c6cd" }}
          />
        </div>
      ) : isCustomerDetail ? (
        <div className="flex items-center gap-[32px]">
          <button
            onClick={() => navigate("/customers")}
            className="font-hanken flex items-center gap-[8px] text-[14px] text-black hover:text-[#424656] transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back to customers
          </button>
          <div
            className="w-px h-[24px]"
            style={{ backgroundColor: "#c5c6cd" }}
          />
        </div>
      ) : isCustomersPage ? (
        <div />
      ) : (
        <div
          className="flex items-center w-[351px] rounded-[12px] px-[17px] py-[9px]"
          style={{ backgroundColor: "#f4f1ed", border: "1px solid #d1c7bd" }}
        >
          <Search size={17} className="text-[#6b7280] flex-shrink-0" />
          <input
            type="text"
            value={isSearchablePage ? searchValue : ""}
            onChange={isSearchablePage ? handleSearch : undefined}
            readOnly={!isSearchablePage}
            placeholder="Search orders..."
            className="font-hanken flex-1 ml-[12px] bg-transparent text-[14px] font-medium text-gc-muted outline-none placeholder:text-gc-muted"
            style={{ cursor: isSearchablePage ? "text" : "default" }}
          />
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-[20px]">
        {/* Refresh — only on pages that provide the handler */}
        {onRefresh && (
          <>
            <button
              onClick={onRefresh}
              className="flex items-center justify-center size-[18px] text-gc-text hover:text-gc-dark transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>

            {/* Divider */}
            <div
              className="w-px h-[32px]"
              style={{ backgroundColor: "rgba(194,198,216,0.3)" }}
            />
          </>
        )}

        {/* User info */}
        <div className="flex items-center gap-[12px]">
          <div className="flex flex-col items-end">
            <span className="font-garamond text-[12px] font-bold text-gc-dark leading-[14px] whitespace-nowrap">
              {adminName || "Admin"}
            </span>
            {adminEmail && (
              <span className="font-hanken text-[10px] text-gc-text leading-normal whitespace-nowrap">
                {adminEmail}
              </span>
            )}
          </div>
          <div
            className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#924932" }}
          >
            <span
              className="text-white text-[16px] font-bold"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
            >
              {adminInitial}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

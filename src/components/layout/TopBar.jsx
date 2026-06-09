import { Menu, Search, RefreshCw, ArrowLeft } from "lucide-react";
import {
  useLocation,
  useSearchParams,
  useNavigate,
  useMatch,
} from "react-router-dom";
import { useAdminUser } from "../../hooks/useAdminUser";

export default function TopBar({ onMenuClick, onRefresh, isRefreshing }) {
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
  const isStyleAdjustmentsPage = location.pathname === "/kuttailor";
  const isSearchablePage =
    !isOrderDetail &&
    !isCustomerDetail &&
    !isCustomersPage &&
    !isStyleAdjustmentsPage &&
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
    <header className="fixed top-0 right-0 left-0 lg:left-[256px] h-[64px] z-30 flex items-center justify-between pb-[16px] pt-[15px] px-[16px] sm:px-[24px] gap-[8px] bg-gc-surface backdrop-blur-[6px] border-b border-gc-topbar-divider/30">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-[8px] rounded-lg text-[#424656] hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        {isOrderDetail ? (
          <div className="flex items-center gap-[16px] sm:gap-[32px]">
            <button
              onClick={() =>
                location.state?.fromCustomer
                  ? navigate(`/customers/${location.state.fromCustomer}`)
                  : navigate("/orders")
              }
              className="font-hanken flex items-center gap-[8px] text-[13px] sm:text-[14px] text-black hover:text-[#424656] transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">
                {location.state?.fromCustomer
                  ? "Back to customer"
                  : "Back to orders"}
              </span>
            </button>
            <div className="hidden sm:block w-px h-[24px] flex-shrink-0 bg-gc-divider" />
          </div>
        ) : isCustomerDetail ? (
          <div className="flex items-center gap-[16px] sm:gap-[32px]">
            <button
              onClick={() => navigate("/customers")}
              className="font-hanken flex items-center gap-[8px] text-[13px] sm:text-[14px] text-black hover:text-[#424656] transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back to customers</span>
            </button>
            <div className="hidden sm:block w-px h-[24px] flex-shrink-0 bg-gc-divider" />
          </div>
        ) : isCustomersPage || isStyleAdjustmentsPage ? (
          <div />
        ) : (
          <div className="flex items-center w-full max-w-[351px] rounded-[12px] px-[12px] sm:px-[17px] py-[9px] bg-gc-bg border border-gc-border-input">
            <Search size={17} className="text-[#6b7280] flex-shrink-0" />
            <input
              type="text"
              aria-label="search"
              value={isSearchablePage ? searchValue : ""}
              onChange={isSearchablePage ? handleSearch : undefined}
              readOnly={!isSearchablePage}
              placeholder="Search orders..."
              className={`font-hanken flex-1 ml-[10px] bg-transparent text-[14px] font-medium text-gc-muted outline-none placeholder:text-gc-muted min-w-0 ${isSearchablePage ? "cursor-text" : "cursor-default"}`}
            />
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-[12px] sm:gap-[20px] flex-shrink-0">
        {onRefresh && (
          <>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center size-[18px] text-gc-text hover:text-gc-dark transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Refresh"
            >
              <RefreshCw
                size={18}
                className={isRefreshing ? "animate-spin" : ""}
              />
            </button>

            <div className="hidden sm:block w-px h-[32px] bg-gc-topbar-divider/30" />
          </>
        )}

        <div className="flex items-center gap-[8px] sm:gap-[12px]">
          <div className="hidden sm:flex flex-col items-end">
            <span className="font-garamond text-[12px] font-bold text-gc-dark leading-[14px] whitespace-nowrap">
              {adminName || "Admin"}
            </span>
            {adminEmail && (
              <span className="font-hanken text-[12px] text-gc-text leading-normal whitespace-nowrap">
                {adminEmail}
              </span>
            )}
          </div>
          <div className="w-[36px] h-[36px] sm:w-[40px] sm:h-[40px] rounded-full flex items-center justify-center flex-shrink-0 bg-gc-primary-dark">
            <span className="font-hanken text-white text-[14px] sm:text-[16px] font-bold">
              {adminInitial}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

import { Link, useLocation } from "react-router-dom";
import { useAdminUser } from "../../hooks/useAdminUser";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Shirt,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "../../utils/cn";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  { id: "orders", label: "Orders", path: "/orders", icon: ShoppingBag },
  { id: "customers", label: "Customers", path: "/customers", icon: Users },
  {
    id: "kuttailor",
    label: "Style Adjustments",
    path: "/kuttailor",
    icon: Shirt,
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const {
    name: adminName,
    email: adminEmail,
    initial: adminInitial,
  } = useAdminUser();

  const handleLogout = () => {
    localStorage.removeItem("suit_admin_auth");
    localStorage.removeItem("suit_admin_name");
    localStorage.removeItem("suit_admin_email");
    window.location.href = "/login";
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-[256px] flex flex-col z-50 transition-transform duration-300 ease-in-out rounded-br-[12px] bg-gc-primary",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="px-[24px] pt-[32px] pb-[48px]">
          <div className="w-fit">
            <h1 className="font-garamond text-white text-[24px] font-bold uppercase tracking-[2px] leading-tight">
              GAGE COURT
            </h1>
            <p className="font-garamond text-[#FFFFFFCC] text-[10px] font-bold uppercase tracking-[2px] leading-tight text-center">
              clothiers
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-[16px] right-[16px] lg:hidden text-white/70 hover:text-white p-[4px] rounded transition-colors"
        >
          <X size={17} />
        </button>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-[4px] overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, path, icon: Icon, disabled }) => {
            const isActive =
              location.pathname === path ||
              location.pathname.startsWith(path + "/");
            if (disabled) {
              return (
                <div
                  key={id}
                  className="flex items-center py-[12px] pl-[16px] opacity-40 cursor-not-allowed select-none"
                >
                  <Icon
                    size={16}
                    className="text-white flex-shrink-0 mr-[12px]"
                  />
                  <span className="font-hanken text-white text-[14px] font-semibold tracking-[0.7px] whitespace-nowrap leading-[16.8px]">
                    {label}
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={id}
                to={path}
                onClick={onClose}
                className={cn(
                  "flex items-center py-[12px] transition-colors",
                  isActive
                    ? "bg-[rgba(255,255,255,0.2)] border-l-2 border-white pl-[18px]"
                    : "pl-[16px] hover:bg-[rgba(255,255,255,0.1)]",
                )}
              >
                <Icon
                  size={16}
                  className="text-white flex-shrink-0 mr-[12px]"
                />
                <span className="font-hanken text-white text-[14px] font-semibold tracking-[0.7px] whitespace-nowrap leading-[16.8px]">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div>
          <div className="w-[208px] h-[1px] bg-white opacity-20 mx-auto" />
          <div className="px-[24px] pb-[32px] pt-[25px]">
            <button
              onClick={handleLogout}
              className="flex items-center gap-[4px] hover:opacity-80 transition-opacity cursor-pointer"
            >
              <LogOut size={14} className="text-white" />
              <span className="font-hanken text-white text-[14px] font-medium whitespace-nowrap">
                Log Out
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

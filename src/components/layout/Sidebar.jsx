import { Link, useLocation } from 'react-router-dom'
import { useAdminUser } from '../../hooks/useAdminUser'
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Truck,
  Settings,
  LogOut,
  X,
  Scissors,
} from 'lucide-react'
import { cn } from '../../utils/cn'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', path: '/orders', icon: ShoppingBag, badge: '248' },
  { id: 'customers', label: 'Customers', path: '/customers', icon: Users },
]

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation()
  const { name: adminName, email: adminEmail, initial: adminInitial } = useAdminUser()

  const handleLogout = () => {
    localStorage.removeItem('suit_admin_auth')
    localStorage.removeItem('suit_admin_name')
    localStorage.removeItem('suit_admin_email')
    window.location.href = '/login'
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-[260px] bg-sidebar flex flex-col z-50 transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.15)' }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-[20px] py-[18px] border-b border-sidebar-border">
          <div className="flex items-center gap-[10px]">
            <div className="w-[36px] h-[36px] rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <Scissors size={17} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-15 leading-tight">SuitAdmin</p>
              <p className="text-sidebar-text text-11 leading-tight">Order Management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-sidebar-text hover:text-white p-[4px] rounded transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-[12px] py-[16px] overflow-y-auto scroll-hidden">
          <p className="text-[10px] font-semibold text-sidebar-text uppercase tracking-widest px-[12px] mb-[10px] opacity-50">
            Main Menu
          </p>
          <ul className="space-y-[2px]">
            {NAV_ITEMS.map(({ id, label, path, icon: Icon, badge }) => {
              const isActive = location.pathname === path
              return (
                <li key={id}>
                  <Link
                    to={path}
                    onClick={onClose}
                    className={cn('nav-item', isActive && 'active')}
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    <span>{label}</span>
                    {/* {badge && (
                      <span className="ml-auto bg-brand-600 text-white text-[10px] font-semibold px-[7px] py-[2px] rounded-full leading-tight">
                        {badge}
                      </span>
                    )} */}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User / Logout */}
        <div className="px-[12px] py-[16px] border-t border-sidebar-border">
          <div className="flex items-center gap-[10px] px-[12px] mb-[10px]">
            <div className="w-[34px] h-[34px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-13 font-bold">{adminInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-13 font-semibold truncate leading-tight">{adminName}</p>
              {adminEmail && (
                <p className="text-sidebar-text text-11 truncate leading-tight">{adminEmail}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item hover:text-red-400 hover:bg-red-900/20"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

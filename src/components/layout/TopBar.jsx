import { Menu, Search } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAdminUser } from '../../hooks/useAdminUser'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/settings': 'Settings',
}

export default function TopBar({ onMenuClick }) {
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'
  const { name: adminName, initial: adminInitial } = useAdminUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchValue = searchParams.get('search') || ''

  const handleSearch = (e) => {
    const val = e.target.value
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('search', val)
      else next.delete('search')
      return next
    }, { replace: true })
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[260px] h-[64px] bg-topbar-bg border-b border-border z-30 flex items-center px-[16px] md:px-[24px] gap-[12px]">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-[8px] rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-18 font-semibold text-text-primary hidden sm:block truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search
          size={15}
          className="absolute left-[12px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={searchValue}
          onChange={handleSearch}
          placeholder="Search orders, customers..."
          className="pl-[38px] pr-[16px] py-[8px] w-[260px] xl:w-[300px] rounded-lg bg-gray-100 border border-transparent text-14 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border focus:bg-white transition-all duration-200"
        />
      </div>

      <div className="flex items-center gap-[4px]">
        {/* Notifications */}
        {/* <button className="relative p-[8px] rounded-lg hover:bg-gray-100 text-text-secondary transition-colors">
          <Bell size={18} />
          <span className="absolute top-[7px] right-[7px] w-[7px] h-[7px] bg-failed rounded-full border-2 border-white" />
        </button> */}

        <div className="w-[1px] h-[22px] bg-border mx-[6px]" />

        {/* User */}
        <button className="flex items-center gap-[8px] py-[6px] px-[8px] rounded-lg hover:bg-gray-100 transition-colors">
          <div className="w-[32px] h-[32px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-13 font-bold">{adminInitial}</span>
          </div>
          <span className="text-14 font-medium text-text-primary hidden sm:block">{adminName}</span>
        </button>
      </div>
    </header>
  )
}

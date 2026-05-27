import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const SYNC_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

function triggerSyncAll() {
  const since = localStorage.getItem('suit_admin_last_sync') || null
  const now = new Date().toISOString()
  fetch('/api/customers/sync-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ since }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (!d.locked) localStorage.setItem('suit_admin_last_sync', now)
      console.log(
        `[auto-sync] ${since ? 'incremental' : 'full'} done: ${d.synced}/${d.total} customers`
      )
    })
    .catch((e) => console.warn('[auto-sync] failed:', e.message))
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    triggerSyncAll()
    const id = setInterval(triggerSyncAll, SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-page-bg">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <TopBar onMenuClick={() => setSidebarOpen(true)} />

      <main className="lg:ml-[260px] pt-[64px] min-h-screen">
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function DashboardLayout({ children, onRefresh }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page-bg">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopBar onMenuClick={() => setSidebarOpen(true)} onRefresh={onRefresh} />
      <main className="lg:ml-[260px] pt-[64px] min-h-screen">
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

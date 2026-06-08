import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function DashboardLayout({
  children,
  onRefresh,
  isRefreshing,
  bgColor,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gc-bg">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopBar
        onMenuClick={() => setSidebarOpen(true)}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
      <main
        className="lg:ml-[260px] pt-[64px] min-h-screen"
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

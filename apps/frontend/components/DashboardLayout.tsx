"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { usePathname } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    username: string;
    role: string;
    name?: string;
  };
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Sincronización de estado durante el render (Patrón recomendado por React)
  // Evita el error de "cascading renders" al cerrar el sidebar en navegación
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsSidebarOpen(false);
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      {/* Sidebar Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 2xl:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform 2xl:relative 2xl:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen w-full 2xl:min-w-0">
        <TopBar onToggleSidebar={toggleSidebar} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
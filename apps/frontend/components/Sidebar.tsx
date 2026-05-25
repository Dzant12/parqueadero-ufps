"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Monitoreo", icon: "monitor_heart" },
  { href: "/analytics", label: "Analíticas", icon: "analytics" },
  { href: "/vehicles", label: "Registro de Vehículos", icon: "directions_car" },
  { href: "/requests", label: "Solicitudes de Visitantes", icon: "pending_actions" },
  { href: "/solicitudes-registro", label: "Solicitudes de Registro", icon: "person_add" },
  { href: "/students", label: "Directorio de Estudiantes", icon: "school" },
  { href: "/reports", label: "Reportes", icon: "assessment" },
  { href: "/database", label: "Base de Datos", icon: "database" },
];

interface SidebarProps {
  user?: {
    username: string;
    role: string;
    name?: string;
  };
  onClose?: () => void;
}

export default function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Filter items based on role
  const filteredNavItems = user?.role === "CELADOR" 
    ? navItems.filter(item => item.href === "/" || item.href === "/analytics")
    : navItems;

  return (
    <aside className="relative h-full flex flex-col bg-[var(--color-surface-container-lowest)] border-r border-[var(--color-outline-variant)]/20 w-64 2xl:static">
      {/* Logo */}
      <div className="px-6 py-8 border-b border-[var(--color-outline-variant)]/15 relative">
        <h1 className="text-base font-black tracking-tight text-[var(--color-primary)] uppercase leading-tight">
          UFPS PARKING
        </h1>

        {/* Close Button Mobile */}
        <button 
          onClick={onClose}
          className="2xl:hidden absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-low)] rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* User Info */}
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--color-primary-fixed)] flex items-center justify-center text-[var(--color-primary)] font-black text-xs">
          {user?.username?.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-[0.75rem] font-bold text-[var(--color-on-surface)] truncate w-32">{user?.name || user?.username}</span>
          <span className="text-[0.6rem] font-black text-[var(--color-primary)] uppercase tracking-widest">{user?.role}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-4 space-y-0.5">
        {filteredNavItems.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                isActive
                  ? "flex items-center gap-3 px-3 py-2.5 text-[var(--color-primary)] font-bold bg-[var(--color-primary-fixed)]/60 rounded-lg transition-all duration-150"
                  : "flex items-center gap-3 px-3 py-2.5 text-[var(--color-on-surface-variant)] font-medium hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)] rounded-lg transition-all duration-150"
              }
            >
              <span className={`material-symbols-outlined text-[1.2rem] ${isActive ? "text-[var(--color-primary)]" : "text-[var(--color-on-surface-variant)]"}`}>
                {icon}
              </span>
              <span className="font-[var(--font-label)] text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto px-3 pb-6 pt-4 space-y-0.5 border-t border-[var(--color-outline-variant)]/15">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--color-error)] font-bold hover:bg-[var(--color-error-container)]/10 rounded-lg transition-colors group"
        >
          <span className="material-symbols-outlined text-[1.2rem] group-hover:scale-110 transition-transform">logout</span>
          <span className="font-[var(--font-label)] text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}

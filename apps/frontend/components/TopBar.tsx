"use client";

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  return (
    <header className="flex justify-between items-center w-full px-4 md:px-6 py-3 bg-[var(--color-surface-container-lowest)]/90 backdrop-blur-xl sticky top-0 z-40 border-b border-[var(--color-outline-variant)]/20 shadow-sm">
      <div className="flex items-center gap-4 2xl:gap-8">
        {/* Toggle Button for mobile */}
        <button 
          onClick={onToggleSidebar}
          className="2xl:hidden w-10 h-10 flex items-center justify-center text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-low)] rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="flex items-center gap-3 text-[var(--color-primary)]">
          <span className="material-symbols-outlined">local_parking</span>
          <span className="font-[var(--font-headline)] font-bold text-[var(--color-on-surface)] tracking-tight text-sm md:text-base">
            UFPS Parking
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <button className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-all">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="flex items-center gap-2">
          <img
            alt="Administrator Avatar"
            className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover border border-[var(--color-outline-variant)]/30"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqrra-PZI-FS2wPTUcB6vHdFkHftRCe4_ms0RaEe5FeLEyWkDZtnvnukYX6jn9CjcRJPOGcITiouOE6eKUvV6L8gRv3rO6sfN4Vr09rVtwj0_eiaklVPtrbjA-7pFmAYXlbgND7zs8FdHJ7tPdEFRR1VXBNq7KiBMMdMkaTSpyprwbwOCCaTiEYvYlShGUMRT390Ylh-waG4TSGa6CNw7scZbtnS-FQVUzl-69o43Jdu7sdjWyens8blol-JGOrT7tAk5vj5m0hyL-"
          />
        </div>
      </div>
    </header>
  );
}


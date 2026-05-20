"use client";

import { useEffect, useState } from "react";

interface GateConsoleProps {
  zone: string;
  lastPlate?: string;
}

export default function GateConsole({ zone, lastPlate }: GateConsoleProps) {
  const [pulse, setPulse] = useState(false);
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastPlate) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastPlate]);

  const isExit = zone.includes("Salida");

  return (
    <div className="relative w-full h-full bg-[#0a0a0c] rounded-xl overflow-hidden border border-white/5 flex flex-col p-6">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      
      {/* Header Info */}
      <div className="relative flex justify-between items-start z-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isExit ? "bg-amber-500" : "bg-[var(--color-primary)]"} animate-pulse`} />
            <span className="text-[0.6rem] font-black tracking-[0.2em] text-white/40 uppercase">SISTEMA ACTIVO</span>
          </div>
          <h3 className="text-xl font-black text-white">{zone.toUpperCase()}</h3>
        </div>
        <div className="text-right">
          <div className="text-[0.6rem] font-black tracking-widest text-white/40 mb-1">NODE_ID: {isExit ? "GATE-OUT-02" : "GATE-IN-01"}</div>
          <div className="text-2xl font-mono font-bold text-white/90 tabular-nums" suppressHydrationWarning>
            {time}
          </div>
        </div>
      </div>

      {/* Main Functional Visual */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-10">
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Circular Rings */}
          <div className="absolute inset-0 border border-white/5 rounded-full" />
          <div className="absolute inset-4 border border-white/5 rounded-full" />
          <div className="absolute inset-8 border border-white/10 rounded-full border-dashed animate-[spin_20s_linear_infinite]" />
          
          {/* Status Icon */}
          <div className={`relative w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-500 ${
            pulse ? "scale-110 shadow-[0_0_50px_rgba(var(--color-primary-rgb),0.3)]" : "scale-100"
          } ${isExit ? "bg-amber-500/10" : "bg-[var(--color-primary)]/10"}`}>
            <span className={`material-symbols-outlined text-5xl ${isExit ? "text-amber-500" : "text-[var(--color-primary)]"}`}>
              {isExit ? "logout" : "login"}
            </span>
            <span className="text-[0.6rem] font-black mt-2 text-white/60 tracking-widest">
              {isExit ? "SALIDA" : "ENTRADA"}
            </span>
          </div>

          {/* Scanning Animation (Fake) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-20 animate-[scan_3s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* OCR Result Overlay */}
        <div className={`mt-8 transition-all duration-500 ${pulse ? "opacity-100 transform-none" : "opacity-40 scale-95"}`}>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[0.6rem] font-black tracking-widest text-white/40">ÚLTIMA DETECCIÓN OCR</span>
            <div className={`px-8 py-3 rounded-lg border-2 font-mono text-3xl font-black tracking-[0.3em] transition-all ${
              isExit ? "border-amber-500/50 text-amber-500 bg-amber-500/5" : "border-[var(--color-primary)]/50 text-[var(--color-primary)] bg-[var(--color-primary)]/5"
            }`}>
              {lastPlate || "-------"}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="relative grid grid-cols-3 gap-4 pt-6 border-t border-white/5 z-10">
        {[
          { label: "LATENCIA", value: "14ms", color: "text-green-400" },
          { label: "CONFIANZA", value: "98.4%", color: "text-blue-400" },
          { label: "TRÁFICO/H", value: isExit ? "42" : "128", color: "text-white/60" }
        ].map(stat => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="text-[0.5rem] font-black text-white/30 tracking-widest">{stat.label}</span>
            <span className={`text-xs font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-100px); opacity: 0; }
          50% { transform: translateY(100px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

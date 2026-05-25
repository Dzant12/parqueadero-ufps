"use client";

import { AccessLog } from "../generated/prisma/client";

interface ExportButtonProps {
  data: AccessLog[];
  filename?: string;
}

export default function TableExportButton({ data, filename = "log_actividad" }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const headers = ["ID", "Fecha/Hora", "Placa", "Metodo", "Zona", "Estado", "Motivo"];
    const csvRows = [
      headers.join(","),
      ...data.map(row => [
        row.id,
        new Date(row.timestamp).toLocaleString(),
        row.plate,
        row.method || "MANUAL",
        row.zone,
        row.status ? "PERMITIDO" : "DENEGADO",
        row.reason || ""
      ].map(field => `"${field}"`).join(","))
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button 
      onClick={handleExport}
      className="text-[var(--color-primary)] text-xs font-bold hover:underline flex items-center gap-1"
    >
      <span className="material-symbols-outlined text-sm">download</span>
      Exportar CSV
    </button>
  );
}

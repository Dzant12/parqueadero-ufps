"use client";

import { useState } from "react";

interface ExportPDFButtonProps {
  filename?: string;
  filters?: {
    plate?: string;
    dateFrom?: string;
    dateTo?: string;
    zone?: string;
    shift?: string;
  };
}

export default function TableExportButton({
  filename = "reporte_estacionamiento",
  filters = {},
}: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Construir query params con los filtros actuales
      const params = new URLSearchParams();
      if (filters.plate) params.set("plate", filters.plate);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.zone && filters.zone !== "all") params.set("zone", filters.zone);
      if (filters.shift && filters.shift !== "all") params.set("shift", filters.shift);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error("Error al obtener datos");

      const data: Array<{
        id: number;
        timestamp: string;
        plate: string;
        ownerName: string;
        userType: string;
        zone: string;
        status: string;
        reason: string;
        method: string;
      }> = await res.json();

      if (!data || data.length === 0) {
        alert("No hay datos para exportar");
        return;
      }

      // Importación dinámica de jsPDF para evitar problemas SSR
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // --- Encabezado / Portada ---
      const pageWidth = doc.internal.pageSize.getWidth();

      // Barra superior de color
      doc.setFillColor(34, 197, 94); // verde primario
      doc.rect(0, 0, pageWidth, 22, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("UFPS PARKING — Reporte de Acceso Vehicular", 14, 10);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Generado: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}   |   Total registros: ${data.length}`,
        14,
        17
      );

      // Filtros activos
      const shiftLabels: Record<string, string> = {
        manana: "Mañana (06:00-11:59)",
        tarde:  "Tarde (12:00-17:59)",
        noche:  "Noche (18:00-05:59)",
      };
      const activeFilters: string[] = [];
      if (filters.plate) activeFilters.push(`Placa: ${filters.plate.toUpperCase()}`);
      if (filters.zone && filters.zone !== "all") activeFilters.push(`Zona: ${filters.zone}`);
      if (filters.shift && filters.shift !== "all") activeFilters.push(`Turno: ${shiftLabels[filters.shift] ?? filters.shift}`);
      if (filters.dateFrom) activeFilters.push(`Desde: ${filters.dateFrom}`);
      if (filters.dateTo) activeFilters.push(`Hasta: ${filters.dateTo}`);
      if (activeFilters.length > 0) {
        doc.text(`Filtros: ${activeFilters.join("   |   ")}`, pageWidth - 14, 17, { align: "right" });
      }

      // --- Tabla principal ---
      doc.setTextColor(0, 0, 0);

      const tableColumns = [
        { header: "ID", dataKey: "id" },
        { header: "Fecha / Hora", dataKey: "timestamp" },
        { header: "Placa", dataKey: "plate" },
        { header: "Propietario", dataKey: "ownerName" },
        { header: "Tipo", dataKey: "userType" },
        { header: "Zona", dataKey: "zone" },
        { header: "Estado", dataKey: "status" },
        { header: "Método", dataKey: "method" },
        { header: "Motivo", dataKey: "reason" },
      ];

      const tableRows = data.map((row) => ({
        id: row.id,
        timestamp: new Date(row.timestamp).toLocaleString("es-CO", {
          timeZone: "America/Bogota",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        plate: row.plate,
        ownerName: row.ownerName,
        userType: row.userType,
        zone: row.zone,
        status: row.status,
        method: row.method,
        reason: row.reason || "—",
      }));

      autoTable(doc, {
        columns: tableColumns,
        body: tableRows,
        startY: 26,
        theme: "grid",
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        },
        alternateRowStyles: {
          fillColor: [245, 250, 245],
        },
        columnStyles: {
          id:        { halign: "center", cellWidth: 12 },
          timestamp: { cellWidth: 38 },
          plate:     { halign: "center", fontStyle: "bold", cellWidth: 22 },
          ownerName: { cellWidth: 42 },
          userType:  { halign: "center", cellWidth: 24 },
          zone:      { halign: "center", cellWidth: 20 },
          status:    { halign: "center", cellWidth: 22 },
          method:    { halign: "center", cellWidth: 20 },
          reason:    { cellWidth: "auto" },
        },
        didParseCell: (hookData) => {
          // Colorear columna estado
          if (hookData.column.dataKey === "status" && hookData.section === "body") {
            const val = hookData.cell.raw as string;
            if (val === "PERMITIDO") {
              hookData.cell.styles.textColor = [22, 163, 74];
              hookData.cell.styles.fontStyle = "bold";
            } else {
              hookData.cell.styles.textColor = [220, 38, 38];
              hookData.cell.styles.fontStyle = "bold";
            }
          }
        },
        // Pie de página con número de página
        didDrawPage: (hookData) => {
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(
            `Página ${hookData.pageNumber} — UFPS PARKING`,
            pageWidth / 2,
            pageHeight - 5,
            { align: "center" }
          );
        },
        margin: { top: 26, left: 10, right: 10 },
        rowPageBreak: "auto",
      });

      const dateStr = new Date().toISOString().split("T")[0];
      doc.save(`${filename}_${dateStr}.pdf`);
    } catch (err) {
      console.error("Error al exportar PDF:", err);
      alert("Ocurrió un error al generar el PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="text-[var(--color-primary)] text-xs font-bold hover:underline flex items-center gap-1 disabled:opacity-60 disabled:cursor-wait"
    >
      <span className="material-symbols-outlined text-sm">
        {loading ? "hourglass_top" : "picture_as_pdf"}
      </span>
      {loading ? "Generando PDF..." : "Exportar PDF"}
    </button>
  );
}

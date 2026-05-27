"use client";

import { useState } from "react";

interface CarnetPreviewProps {
  carnetUrl: string | null;
  ownerName: string;
  plate: string;
}

export default function CarnetPreview({ carnetUrl, ownerName, plate }: CarnetPreviewProps) {
  const [showModal, setShowModal] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!carnetUrl) {
    return (
      <div className="flex items-center gap-1 text-[var(--color-on-surface-variant)]/40">
        <span className="material-symbols-outlined text-sm">no_accounts</span>
        <span className="text-xs font-medium font-[var(--font-label)]">—</span>
      </div>
    );
  }

  // Check if it looks like a PDF file by extension
  const isPdf = carnetUrl.toLowerCase().split(/[?#]/)[0].endsWith(".pdf");

  return (
    <>
      <div className="flex items-center">
        {isPdf || imgError ? (
          <a
            href={carnetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 hover:scale-105 active:scale-95 transition-all text-xs font-bold font-[var(--font-label)] shrink-0 shadow-sm"
            title="Abrir PDF del carné"
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            <span>PDF</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="relative overflow-hidden rounded-md border border-[var(--color-outline-variant)]/20 bg-black/5 w-12 h-9 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-md hover:ring-2 hover:ring-[var(--color-primary)]/40 group shrink-0"
            title="Ver carné de conductor"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={carnetUrl}
              alt={`Carné de ${ownerName}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xs font-bold">zoom_in</span>
            </div>
          </button>
        )}
      </div>

      {/* --- MODAL DE CONSTATACIÓN A PANTALLA COMPLETA --- */}
      {showModal && !isPdf && !imgError && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="relative max-w-lg w-full bg-[var(--color-surface-container-lowest)] rounded-2xl border border-[var(--color-outline-variant)]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            {/* Cabecera del Modal */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-low)]">
              <div className="flex items-col gap-0.5">
                <div className="flex items-center gap-2 text-[var(--color-on-surface)]">
                  <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">badge</span>
                  <span className="font-black text-xs uppercase tracking-wider text-[var(--color-on-surface)]">
                    Credencial Digital de Acceso
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-on-surface-variant)] font-medium font-[var(--font-label)] mt-0.5">
                  Conductor: {ownerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-all"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Cuerpo del Modal con Visor de Imagen */}
            <div className="p-6 flex-1 overflow-y-auto flex items-center justify-center bg-black/5 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={carnetUrl}
                alt={`Carné completo de ${ownerName}`}
                className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-lg border border-[var(--color-outline-variant)]/10"
                onError={() => {
                  setImgError(true);
                  setShowModal(false);
                }}
              />
            </div>

            {/* Pie del Modal con Metadatos */}
            <div className="px-6 py-4 bg-[var(--color-surface-container-low)] border-t border-[var(--color-outline-variant)]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] font-mono">
                  PLACA: {plate}
                </span>
                <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)] font-[var(--font-label)]">
                  {ownerName}
                </span>
              </div>
              <div className="flex gap-2">
                <a
                  href={carnetUrl}
                  download={`carnet_${plate}.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[var(--color-primary)] hover:brightness-110 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                  Abrir Original
                </a>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[var(--color-surface-container-high)] hover:bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface)] text-xs font-bold rounded-lg transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

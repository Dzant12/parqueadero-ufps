"use client";

/**
 * @file PlateVerification.tsx
 * @description Componente de cliente React para la verificación manual de placas vehiculares en portería.
 * Este componente es utilizado por los vigilantes (celadores) para digitar de forma directa la placa
 * de vehículos que no disponen de tarjeta RFID activa, o cuando falla el escáner de red.
 * 
 * ### Flujo de Trabajo Operacional:
 * 1. **Digitación y Normalización**: Captura la placa y la normaliza a mayúsculas y libre de espacios.
 * 2. **Consulta Asíncrona (Server Action)**: Invoca la acción `verifyPlate` en el servidor, validando
 *    el historial de Anti-Passback para la zona y resolviendo el carnet digital del conductor.
 * 3. **Inspección Visual del Guardia**: Despliega la información del propietario y una miniatura ampliable
 *    de su carnet de identidad para constatar la veracidad física del conductor.
 * 4. **Registro de Bitácora**: Mediante `registerAccess`, el vigilante autoriza ("Permitir Entrada/Salida")
 *    o rechaza ("Denegar") formalmente el acceso, creando un log de auditoría permanente.
 * 
 * @component PlateVerification
 * @module frontend/components/PlateVerification
 * @requires React
 * @requires @/app/actions
 */

import { useState } from "react";
import { verifyPlate, registerAccess } from "@/app/actions";

/**
 * Componente principal de verificación manual de portones.
 * 
 * @export
 * @default
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.zone - Portón en el que se ubica la verificación ("Entrada Principal" o "Salida Principal").
 * @returns {JSX.Element} Panel de formulario de verificación manual por placa.
 */
export default function PlateVerification({ zone }: { zone: string }) {
  // --- Estados Reactivos ---
  const [plate, setPlate] = useState(""); // Valor textual de la placa ingresada en el input
  const [loading, setLoading] = useState(false); // Estado de procesamiento asíncrono (bloquea botones)
  const [showCarnetModal, setShowCarnetModal] = useState(false); // Apertura de modal a pantalla completa
  const [reason, setReason] = useState(""); // Motivo de acceso manual
  
  // Detalle de la consulta asíncrona resuelta por verifyPlate
  const [result, setResult] = useState<{
    status: string;
    type?: string;
    ownerName?: string;
    reason?: string;
    carnetUrl?: string | null;
  } | null>(null);

  /**
   * Manejador de envío del formulario.
   * Dispara la consulta asíncrona hacia la base de datos a través de Next.js Server Actions.
   * 
   * @async
   * @function handleVerify
   * @param {React.FormEvent} e - Evento nativo de envío del formulario.
   */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) return;
    
    setLoading(true);
    setResult(null); // Resetea resultados de consultas previas
    
    try {
      // Normalización estricta a mayúsculas antes de despachar al servidor
      const res = await verifyPlate(plate.toUpperCase().trim(), zone);
      setResult(res);
    } catch (error) {
      console.error("[PlateVerification] Error en verificación de placa:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Registra oficialmente el ingreso o salida (aprobado o rechazado) en la base de datos institucional.
   * Invoca la acción de servidor `registerAccess`.
   * 
   * @async
   * @function handleRegister
   * @param {boolean} granted - Especifica si el guardia concede (true) o deniega (false) el portón.
   */
  const handleRegister = async (granted: boolean) => {
    setLoading(true);
    try {
      await registerAccess(
        plate.toUpperCase().trim(),
        granted,
        result?.type || "Desconocido",
        zone,
        reason.trim() || undefined
      );
      
      // Resetea los estados de la interfaz ante un registro exitoso
      setResult(null);
      setPlate("");
      setReason("");
    } catch (error: unknown) {
      console.error("[PlateVerification] Error en registro de acceso:", error);
      // Despliega error de negocio controlado (ej: error de Anti-Passback)
      const errorMessage = error instanceof Error ? error.message : "Error al registrar acceso";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-padded mb-6">
      {/* Indicador Visual de la Portería de Control */}
      <h4 className="text-[0.7rem] font-black text-[var(--color-on-surface-variant)] tracking-widest uppercase mb-4">
        Verificación Manual - {zone.includes("Salida") ? "Salida" : "Entrada"}
      </h4>
      
      {/* Formulario de Placa */}
      <form onSubmit={handleVerify} className="flex gap-2 mb-4">
        <input
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="Ej: ABC-123"
          className="flex-1 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/30 rounded-lg px-3 py-2 text-sm font-mono uppercase text-[var(--color-on-surface)] focus:outline-none focus:border-[var(--color-primary)]"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !plate.trim()}
          className={`px-4 py-2 rounded-lg font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all ${
            zone.includes("Salida") ? "bg-amber-600 text-white" : "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
          }`}
        >
          {loading && !result ? "Verificando..." : "Verificar"}
        </button>
      </form>

      {/* Panel de Resultados de Consulta de Placa */}
      {result && (
        <div className="p-4 rounded-lg bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/20 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`material-symbols-outlined text-2xl ${
                result.status === "authorized"
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-error)]"
              }`}
            >
              {result.status === "authorized" ? "check_circle" : "cancel"}
            </span>
            <div>
              <h5 className="font-bold text-[var(--color-on-surface)] text-sm">
                {result.status === "authorized" ? "Vehículo Autorizado" : "Vehículo No Autorizado"}
              </h5>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {result.status === "authorized"
                  ? `${result.ownerName} (${result.type})`
                  : result.reason}
              </p>
            </div>
          </div>

          {/* Miniature de Carnet Asociado para Constatación */}
          {result.status === "authorized" && result.carnetUrl && (
            <div className="mt-3 mb-4 p-2.5 bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-outline-variant)]/10 flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[0.65rem] font-black uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">badge</span>
                  Constatar Carnet Asociado
                </span>
                <button
                  type="button"
                  onClick={() => setShowCarnetModal(true)}
                  className="text-[0.65rem] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-xs">zoom_in</span>
                  Ampliar
                </button>
              </div>
              <div 
                onClick={() => setShowCarnetModal(true)}
                className="relative cursor-zoom-in group overflow-hidden rounded-lg border border-[var(--color-outline-variant)]/20 bg-black/5 aspect-[4/3] flex items-center justify-center transition-all duration-300 hover:brightness-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={result.carnetUrl} 
                  alt="Carnet de conductor" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Resiliencia: Si falla el render (porque el archivo es un PDF),
                    // oculta la imagen rota y devela el visor alternativo.
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.parentElement?.querySelector(".fallback-element");
                    if (fallback) fallback.classList.remove("hidden");
                  }}
                />
                {/* Visor de Resguardo para PDF / Archivos de Carnet */}
                <div className="fallback-element hidden flex flex-col items-center justify-center gap-2 p-4 text-[var(--color-on-surface-variant)] text-center">
                  <span className="material-symbols-outlined text-3xl opacity-40">picture_as_pdf</span>
                  <span className="text-[0.65rem] font-bold opacity-75">Documento Carnet (PDF / Archivo)</span>
                  <a 
                    href={result.carnetUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    onClick={(e) => e.stopPropagation()} // Previene la burbuja de eventos (no abre modal vacío)
                    className="mt-1 px-3 py-1 bg-[var(--color-primary)] text-white text-[0.6rem] rounded font-bold hover:brightness-110 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                    Ver Documento
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Campo de Motivo de Ingreso */}
          <div className="mt-4 mb-4 pt-3 border-t border-[var(--color-outline-variant)]/10">
            <label className="block text-[0.65rem] font-black uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-2">
              Motivo de Acceso / Observación <span className="text-[var(--color-error)]">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Ingreso de visitante para reunión académica, mantenimiento de redes, etc..."
              rows={2}
              className="w-full bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-lg px-3 py-2 text-xs text-[var(--color-on-surface)] focus:outline-none focus:border-[var(--color-primary)] placeholder-[var(--color-on-surface-variant)]/40 resize-none transition-all duration-200"
              disabled={loading}
              maxLength={200}
              required
            />
          </div>

          {/* Botones de Acción: Permitir / Denegar */}
          <div className="flex gap-2 pt-3 border-t border-[var(--color-outline-variant)]/10">
            <button
              onClick={() => handleRegister(true)}
              disabled={loading || !reason.trim()}
              className={`flex-1 py-2 rounded font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                result.status === "authorized"
                  ? (zone.includes("Salida") ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90")
                  : "bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-primary)] hover:text-white"
              } ${(!reason.trim() && !loading) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="material-symbols-outlined text-sm">{zone.includes("Salida") ? "logout" : "login"}</span>
              {zone.includes("Salida") ? "Permitir Salida" : "Permitir Entrada"}
            </button>
            <button
              onClick={() => handleRegister(false)}
              disabled={loading || !reason.trim()}
              className={`flex-1 py-2 rounded font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                result.status === "unauthorized"
                  ? "bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90"
                  : "bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-error)] hover:text-white"
              } ${(!reason.trim() && !loading) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="material-symbols-outlined text-sm">block</span>
              Denegar
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL DE CONSTATACIÓN A PANTALLA COMPLETA --- */}
      {showCarnetModal && result?.carnetUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in p-4">
          <div className="relative max-w-2xl w-full bg-[var(--color-surface-container-lowest)] rounded-2xl border border-[var(--color-outline-variant)]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-low)]">
              <div className="flex items-center gap-2 text-[var(--color-on-surface)]">
                <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">badge</span>
                <span className="font-bold text-sm">Constatación de Conductor</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCarnetModal(false)}
                className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-all"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            {/* Cuerpo del Modal con Visor PDF/Imagen */}
            <div className="p-6 flex-1 overflow-y-auto flex items-center justify-center bg-black/5 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={result.carnetUrl} 
                alt="Carnet Completo" 
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg border border-[var(--color-outline-variant)]/10"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.parentElement?.querySelector(".modal-fallback-element");
                  if (fallback) fallback.classList.remove("hidden");
                }}
              />
              <div className="modal-fallback-element hidden flex flex-col items-center justify-center gap-3 p-8 text-center text-[var(--color-on-surface)]">
                <span className="material-symbols-outlined text-5xl text-[var(--color-primary)]">picture_as_pdf</span>
                <h4 className="font-bold text-sm">El carnet está en un formato no visualizable (ej. PDF)</h4>
                <p className="text-xs text-[var(--color-on-surface-variant)] max-w-sm">
                  Haz clic en el siguiente enlace para descargar o visualizar el documento de identidad en una nueva pestaña.
                </p>
                <a 
                  href={result.carnetUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-2 px-5 py-2 bg-[var(--color-primary)] text-white text-xs rounded-lg font-bold hover:brightness-110 flex items-center gap-1.5 shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Abrir Documento Carnet
                </a>
              </div>
            </div>
            <div className="px-6 py-4 bg-[var(--color-surface-container-low)] border-t border-[var(--color-outline-variant)]/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCarnetModal(false)}
                className="px-4 py-2 bg-[var(--color-surface-container-high)] hover:bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface)] text-xs font-bold rounded-lg transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

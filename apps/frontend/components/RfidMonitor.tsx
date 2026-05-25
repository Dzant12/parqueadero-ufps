"use client";

/**
 * @file RfidMonitor.tsx
 * @description Componente de cliente React para el monitoreo en tiempo real de accesos RFID.
 * Este componente realiza consultas periódicas (polling) al backend para recuperar el último
 * evento registrado en un portón determinado (Entrada o Salida) y despliega la información
 * detallada del vehículo, propietario y su carnet de seguridad institucional.
 * 
 * ### Soluciones Técnicas Implementadas:
 * 1. **Prevención de Stale Closures**: Utiliza `useRef` para sincronizar el estado reactivo `isLive`
 *    dentro del intervalo asíncrono de polling (`setInterval`), evitando fugas de memoria y lecturas obsoletas.
 * 2. **Caché-Buster Dinámico**: Agrega marcas de tiempo (`t=${Date.now()}`) y cabeceras `no-store`
 *    para neutralizar cachés intermedias del navegador o proxies locales.
 * 3. **Actualización Silenciosa del Servidor**: Cuando detecta un evento nuevo (por cambio de ID),
 *    dispara una animación de flasheo (`isNew`) y notifica a Next.js (`router.refresh()`) para que 
 *    actualice asíncronamente los Server Components de la página sin forzar un recargado completo del navegador.
 * 4. **Manejo Resiliente de Documentos**: Si el carnet digital es un PDF en lugar de una imagen,
 *    el componente intercepta el error de renderizado (`onError`) y despliega un panel de descarga/visualización alternativo.
 * 
 * @component RfidMonitor
 * @module frontend/components/RfidMonitor
 * @requires React
 * @requires next/navigation
 */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Representa la estructura de datos de un evento RFID recibido del backend.
 * @interface RfidEvent
 */
interface RfidEvent {
  id: number;
  timestamp: string;
  plate: string;
  rfidTag: string | null;
  granted: boolean;
  ownerName: string | null;
  vehicleModel: string | null;
  vehicleBrand: string | null;
  vehicleColor: string | null;
  department: string | null;
  vehicleStatus: string | null;
  carnetUrl?: string | null;
}

// Intervalo de consulta periódica para el lector (3 segundos)
const POLL_INTERVAL_MS = 3000;

/**
 * Formatea una marca de tiempo ISO en una expresión de tiempo relativo amigable (Ej: "hace 10s").
 * 
 * @function timeAgo
 * @param {string} ts - Fecha y hora del evento en formato ISO.
 * @returns {string} Texto formateado con la diferencia de tiempo relativa.
 */
function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
  return new Date(ts).toLocaleTimeString();
}

/**
 * Monitor interactivo de eventos RFID.
 * Muestra el estado del portón, simula lecturas locales del hardware y despliega credenciales visuales.
 * 
 * @export
 * @default
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.zone - Zona física a filtrar y monitorear (Ej: "Entrada Principal").
 * @returns {JSX.Element} Panel de monitoreo RFID reactivo.
 */
export default function RfidMonitor({ zone }: { zone: string }) {
  const router = useRouter();
  
  // --- Estados Reactivos ---
  const [event, setEvent] = useState<RfidEvent | null>(null);
  const [isLive, setIsLive] = useState(true); // Indica si el polling está activo
  const [showCarnetModal, setShowCarnetModal] = useState(false); // Visibilidad del modal a pantalla completa
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // Marca de tiempo del último sync exitoso
  const [isNew, setIsNew] = useState(false); // Disparador para animación visual de nuevo evento

  // --- Referencias (Refs) de Control ---
  // Mantiene sincronizada la referencia del estado de polling activo para evitar Stale Closures
  const isLiveRef = useRef(isLive);
  // Almacena el ID del último evento recibido para detectar transiciones de nuevos accesos
  const lastIdRef = useRef<number | null>(null);

  // Sincronización continua de la referencia del estado 'isLive'
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  // --- Efecto de Polling (Fetch Loop) ---
  useEffect(() => {
    /**
     * Consulta asíncronamente el endpoint más reciente de RFID filtrado por la zona activa.
     */
    const fetchLatest = async () => {
      if (!isLiveRef.current) return;
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
        const normalizedBackendUrl = backendUrl.replace(/\/$/, "");
        
        // Cache-buster: Agregamos query param dinámico con Date.now() para forzar al
        // navegador a bypassear cachés físicas y CDN en cada petición.
        const finalUrl = `${normalizedBackendUrl}/api/rfid/latest?zone=${encodeURIComponent(zone)}&t=${Date.now()}`;
        
        console.log(`[RfidMonitor] Polling ${zone}:`, finalUrl);
        
        const res = await fetch(finalUrl, { 
          cache: "no-store", // Indica explícitamente a fetch que evite cachés
          headers: { "Accept": "application/json" }
        });
        
        if (!res.ok) {
          console.error(`[RfidMonitor] HTTP Error ${res.status} for ${zone}`);
          return;
        }
        const data = await res.json();

        if (data.event) {
          // --- DETECCIÓN DE NUEVOS EVENTOS ---
          // Si el ID del evento es diferente al último almacenado, es una lectura nueva.
          if (lastIdRef.current !== null && data.event.id !== lastIdRef.current) {
            setIsNew(true);
            setTimeout(() => setIsNew(false), 1200); // Remueve la clase de animación tras 1.2 segundos
            
            // Notifica al App Router de Next.js que purgue la caché local del cliente.
            // Esto actualiza los Server Components adyacentes de la página (ej: la tabla histórica de logs).
            router.refresh();
          }
          lastIdRef.current = data.event.id;
          
          setEvent(data.event);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error("[RfidMonitor] Error en polling:", error);
      }
    };

    // Ejecuta de inmediato y luego establece el ciclo periódico
    fetchLatest();
    const intervalId = setInterval(fetchLatest, POLL_INTERVAL_MS);
    
    // Remueve el intervalo al desmontar el componente para evitar fugas de hilos de CPU
    return () => clearInterval(intervalId);
  }, [zone, router]);

  return (
    <div
      className={`card overflow-hidden transition-all duration-500 ${
        isNew ? "ring-2 ring-[var(--color-primary)] shadow-[0_0_20px_var(--color-primary)]/30" : ""
      }`}
    >
      {/* Cabecera del Panel */}
      <div className={`bg-gradient-to-r ${zone.includes("Salida") ? "from-amber-600 to-orange-400" : "from-[var(--color-primary)] to-[var(--color-tertiary)]"} px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-white text-lg">nfc</span>
          <h3 className="text-white text-xs font-black tracking-widest uppercase">
            Monitor RFID - {zone.includes("Salida") ? "Salida" : "Entrada"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 text-white/80 text-[0.6rem] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              EN VIVO
            </span>
          )}
          {/* Botón Simulador de Lectura de TAG (Mocks ESP32 hardware behavior) */}
          <button
            onClick={async () => {
              const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
              const normalizedBackendUrl = backendUrl.replace(/\/$/, "");
              await fetch(`${normalizedBackendUrl}/api/rfid?zone=${encodeURIComponent(zone)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: "TEST-RFID-" + Math.floor(Math.random() * 1000) })
              });
            }}
            className="text-white/70 hover:text-white transition-colors"
            title="Simular lectura en esta zona"
          >
            <span className="material-symbols-outlined text-base">sensors</span>
          </button>
          {/* Botón Pause/Play Polling */}
          <button
            onClick={() => setIsLive((p) => !p)}
            className="text-white/70 hover:text-white transition-colors"
            title={isLive ? "Pausar polling" : "Reanudar polling"}
          >
            <span className="material-symbols-outlined text-base">
              {isLive ? "pause_circle" : "play_circle"}
            </span>
          </button>
        </div>
      </div>

      {/* Contenido Dinámico del Monitor */}
      <div className="p-5">
        {event ? (
          <div className={`transition-all duration-500 ${isNew ? "scale-[1.01]" : ""}`}>
            {/* Banner de Estado (Concedido/Denegado) */}
            <div
              className={`flex items-center gap-3 p-3 rounded-lg mb-4 ${
                event.granted
                  ? "bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20"
                  : "bg-[var(--color-error)]/10 border border-[var(--color-error)]/20"
              }`}
            >
              <span
                className={`material-symbols-outlined text-2xl ${
                  event.granted ? "text-[var(--color-primary)]" : "text-[var(--color-error)]"
                }`}
              >
                {event.granted ? "verified" : "block"}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-black tracking-wider ${
                    event.granted ? "text-[var(--color-primary)]" : "text-[var(--color-error)]"
                  }`}
                >
                  {event.granted ? "ACCESO CONCEDIDO" : "ACCESO DENEGADO"}
                </p>
                <p className="text-[0.65rem] text-[var(--color-on-surface-variant)] mt-0.5 font-mono truncate">
                  TAG: {event.rfidTag ?? "—"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-lg font-black text-[var(--color-on-surface)]">
                  {event.plate === "UNKNOWN" ? "???" : event.plate}
                </p>
                <p className="text-[0.6rem] text-[var(--color-on-surface-variant)]" suppressHydrationWarning>
                  {timeAgo(event.timestamp)}
                </p>
              </div>
            </div>

            {/* Metadatos del Vehículo y Conductor */}
            {event.plate !== "UNKNOWN" && (
              <div className="space-y-2.5 border-t border-[var(--color-outline-variant)]/15 pt-3">
                <InfoRow
                  icon="person"
                  label="Propietario"
                  value={event.ownerName ?? "Desconocido"}
                />
                {event.vehicleBrand && (
                  <InfoRow
                    icon="directions_car"
                    label="Vehículo"
                    value={`${event.vehicleBrand} ${event.vehicleModel ?? ""}`.trim()}
                  />
                )}

                {event.department && (
                  <InfoRow icon="domain" label="Departamento" value={event.department} />
                )}

                {/* Sección de Vista Previa del Carnet del Conductor */}
                {event.granted && event.carnetUrl && (
                  <div className="mt-3 p-2.5 bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-outline-variant)]/10 flex flex-col gap-2">
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
                    {/* Caja de previsualización interactiva con zoom */}
                    <div 
                      onClick={() => setShowCarnetModal(true)}
                      className="relative cursor-zoom-in group overflow-hidden rounded-lg border border-[var(--color-outline-variant)]/20 bg-black/5 aspect-[4/3] flex items-center justify-center transition-all duration-300 hover:brightness-95"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={event.carnetUrl} 
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
                          href={event.carnetUrl} 
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
              </div>
            )}

            {event.plate === "UNKNOWN" && (
              <p className="text-center text-[var(--color-on-surface-variant)] text-xs py-2">
                TAG no registrado en el sistema
              </p>
            )}
          </div>
        ) : (
          /* Estado Esperando Lectura */
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-[var(--color-on-surface-variant)]">
            <span className="material-symbols-outlined text-4xl opacity-30">nfc</span>
            <p className="text-xs font-semibold">Esperando lectura RFID...</p>
            <p className="text-[0.65rem] opacity-60">
              El ESP32 notificará aquí cuando detecte un TAG
            </p>
          </div>
        )}

        {/* Marca de sincronía */}
        {lastUpdated && (
          <p className="text-[0.6rem] text-[var(--color-on-surface-variant)]/60 text-right mt-3 font-mono" suppressHydrationWarning>
            Sync: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* --- MODAL DE CONSTATACIÓN A PANTALLA COMPLETA --- */}
      {showCarnetModal && event?.carnetUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in p-4">
          <div className="relative max-w-2xl w-full bg-[var(--color-surface-container-lowest)] rounded-2xl border border-[var(--color-outline-variant)]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-low)]">
              <div className="flex items-center gap-2 text-[var(--color-on-surface)]">
                <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">badge</span>
                <span className="font-bold text-sm">Constatación de Conductor (RFID)</span>
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
                src={event.carnetUrl} 
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
                  href={event.carnetUrl} 
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

/**
 * Fila de información descriptiva para el bloque del vehículo/propietario.
 * 
 * @function InfoRow
 * @param {Object} props - Parámetros de Props.
 * @param {string} props.icon - Nombre del Google Material Icon a renderizar.
 * @param {string} props.label - Etiqueta descriptiva del dato (Ej: "Color").
 * @param {string} props.value - Valor o metadato textual.
 * @returns {JSX.Element} Fila estructurada de datos.
 */
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="material-symbols-outlined text-sm text-[var(--color-primary)] w-4 shrink-0">
        {icon}
      </span>
      <span className="text-[0.7rem] text-[var(--color-on-surface-variant)] w-20 shrink-0">
        {label}
      </span>
      <span className="text-xs font-bold text-[var(--color-on-surface)] truncate">{value}</span>
    </div>
  );
}

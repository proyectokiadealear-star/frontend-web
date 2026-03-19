"use client";

import { cn } from "@/lib/utils";
import { VehicleStatus, type VehicleStatusType } from "@/lib/constants";
import type { StatusHistoryEntry } from "@/types";
import { Check, RotateCcw, SkipForward, Minus } from "lucide-react";

// ─── Phase definitions ────────────────────────────────────────────────────────

interface Phase {
  id: number;
  label: string;
  shortLabel: string;
  statuses: VehicleStatusType[];
}

const PHASES: Phase[] = [
  {
    id: 1,
    label: "Ingreso",
    shortLabel: "Ingreso",
    statuses: [VehicleStatus.NO_FACTURADO, VehicleStatus.POR_ARRIBAR],
  },
  {
    id: 2,
    label: "Matriculación",
    shortLabel: "Matrículas",
    statuses: [VehicleStatus.ENVIADO_A_MATRICULAR],
  },
  {
    id: 3,
    label: "Documentación",
    shortLabel: "Docs.",
    statuses: [
      VehicleStatus.DOCUMENTACION_PENDIENTE,
      VehicleStatus.DOCUMENTADO,
    ],
  },
  {
    id: 4,
    label: "Certificación",
    shortLabel: "Certif.",
    statuses: [VehicleStatus.CERTIFICADO_STOCK],
  },
  {
    id: 5,
    label: "Accesorización",
    shortLabel: "Accesorios",
    statuses: [
      VehicleStatus.ORDEN_GENERADA,
      VehicleStatus.ASIGNADO,
      VehicleStatus.EN_INSTALACION,
      VehicleStatus.REAPERTURA_OT,
      VehicleStatus.INSTALACION_COMPLETA,
    ],
  },
  {
    id: 6,
    label: "Entrega",
    shortLabel: "Entrega",
    statuses: [
      VehicleStatus.LISTO_PARA_ENTREGA,
      VehicleStatus.AGENDADO,
      VehicleStatus.ENTREGADO,
    ],
  },
];

// Status display labels (short, for sub-label under active node)
const STATUS_SHORT_LABEL: Partial<Record<VehicleStatusType, string>> = {
  NO_FACTURADO: "Sin factura",
  POR_ARRIBAR: "Por arribar",
  ENVIADO_A_MATRICULAR: "En matriculación",
  DOCUMENTACION_PENDIENTE: "Docs. pendiente",
  DOCUMENTADO: "Documentado",
  CERTIFICADO_STOCK: "Certificado",
  ORDEN_GENERADA: "OT generada",
  ASIGNADO: "Asignado",
  EN_INSTALACION: "En instalación",
  REAPERTURA_OT: "Reapertura OT",
  INSTALACION_COMPLETA: "Instalación completa",
  LISTO_PARA_ENTREGA: "Listo p/ entrega",
  AGENDADO: "Agendado",
  ENTREGADO: "Entregado",
  CEDIDO: "Cedido",
};

// ─── Phase state derivation ───────────────────────────────────────────────────

type PhaseState = "completed" | "active" | "skipped" | "pending";

/** Returns the phase index (0-based) for a given status */
function phaseIndexOf(status: VehicleStatusType): number {
  return PHASES.findIndex((p) =>
    (p.statuses as string[]).includes(status)
  );
}

/**
 * Detect fast-track (no accessories): vehicle jumped from DOCUMENTADO directly
 * to LISTO_PARA_ENTREGA without going through CERTIFICADO_STOCK/ORDEN_GENERADA.
 */
function isFastTrack(
  currentStatus: VehicleStatusType,
  history: StatusHistoryEntry[]
): boolean {
  const deliveryPhaseStatuses: string[] = [
    VehicleStatus.LISTO_PARA_ENTREGA,
    VehicleStatus.AGENDADO,
    VehicleStatus.ENTREGADO,
  ];
  if (!deliveryPhaseStatuses.includes(currentStatus)) return false;

  // Check if CERTIFICADO_STOCK or ORDEN_GENERADA ever appeared in history
  const hadCertOrOrder = history.some(
    (h) =>
      h.status === VehicleStatus.CERTIFICADO_STOCK ||
      h.status === VehicleStatus.ORDEN_GENERADA
  );
  return !hadCertOrOrder;
}

interface PhaseStates {
  states: PhaseState[];
  activePhaseIndex: number;
}

function derivePhaseStates(
  status: VehicleStatusType,
  isReopening: boolean,
  certifiedWhileNoFacturado: boolean,
  history: StatusHistoryEntry[]
): PhaseStates {
  const activePhaseIndex = phaseIndexOf(status);
  const fastTrack = isFastTrack(status, history);

  const states: PhaseState[] = PHASES.map((_, i) => {
    // Active phase
    if (i === activePhaseIndex) return "active";

    // Phases before active → completed (unless skipped via fast-track)
    if (i < activePhaseIndex) {
      // Phases 3 (Certif, index=3) and 4 (Accesoriz, index=4) are skipped on fast-track
      if (fastTrack && (i === 3 || i === 4)) return "skipped";
      return "completed";
    }

    // Phases after active → pending
    // Special case: if certifiedWhileNoFacturado and we're still in phase 0 or 1,
    // phase 3 (Certif.) shows as "pre-certified" — we reuse "completed" with a flag
    // handled in the render, but mark it pending here; render reads the flag separately.
    return "pending";
  });

  // REAPERTURA_OT — if the current status is literally REAPERTURA_OT it maps to phase 4 (Accesoriz),
  // but visually we want to highlight that as an exception — handled in render via isReopening / status check
  return { states, activePhaseIndex };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VehicleStatusStepperProps {
  status: VehicleStatusType;
  isReopening?: boolean;
  certifiedWhileNoFacturado?: boolean;
  history?: StatusHistoryEntry[];
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VehicleStatusStepper({
  status,
  isReopening = false,
  certifiedWhileNoFacturado = false,
  history = [],
  className,
}: VehicleStatusStepperProps) {
  // ── CEDIDO: special terminal state — replace entire stepper ──────────────
  if (status === VehicleStatus.CEDIDO) {
    return (
      <div
        className={cn(
          "w-full rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-center gap-3",
          className
        )}
      >
        <Minus size={16} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-500">
          Vehículo cedido — transferido a otro concesionario
        </span>
      </div>
    );
  }

  const { states, activePhaseIndex } = derivePhaseStates(
    status,
    isReopening,
    certifiedWhileNoFacturado,
    history
  );

  const isReopeningActive =
    isReopening || status === VehicleStatus.REAPERTURA_OT;
  const fastTrack = isFastTrack(status, history);

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* ── Reapertura OT banner ─────────────────────────────────────────── */}
      {isReopeningActive && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2">
          <RotateCcw size={13} className="text-amber-600 shrink-0" />
          <span className="text-xs font-semibold text-amber-700">
            Reapertura de OT en curso
          </span>
        </div>
      )}

      {/* ── Stepper rail ─────────────────────────────────────────────────── */}
      <div className="w-full rounded-xl border border-gray-200 bg-white px-6 py-5">
        <div className="flex items-start">
          {PHASES.map((phase, i) => {
            const phaseState = states[i];
            const isActive = phaseState === "active";
            const isCompleted = phaseState === "completed";
            const isSkipped = phaseState === "skipped";
            const isPending = phaseState === "pending";

            // Pre-certification: phase 3 (Certif.) when certifiedWhileNoFacturado
            // and vehicle is still in phase 0 or 1
            const isPreCertified =
              i === 3 &&
              certifiedWhileNoFacturado &&
              activePhaseIndex <= 1 &&
              isPending;

            // Connector (rendered between nodes, not after last)
            const showConnector = i < PHASES.length - 1;

            return (
              <div key={phase.id} className="flex items-start flex-1 min-w-0">
                {/* ── Node + label ── */}
                <div className="flex flex-col items-center gap-1.5 min-w-0" style={{ flex: "0 0 auto" }}>
                  {/* Circle */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all",
                      // Completed
                      isCompleted &&
                        "bg-gray-900 text-white",
                      // Active
                      isActive &&
                        "bg-gray-900 text-white ring-2 ring-gray-900 ring-offset-2",
                      // Reapertura active — amber ring override
                      isActive &&
                        isReopeningActive &&
                        "ring-amber-500",
                      // Skipped (fast-track)
                      isSkipped &&
                        "bg-white border-2 border-dashed border-gray-300 text-gray-300",
                      // Pending
                      isPending &&
                        !isPreCertified &&
                        "bg-white border-2 border-gray-200 text-gray-300",
                      // Pre-certified (pending but special)
                      isPreCertified &&
                        "bg-white border-2 border-blue-300 text-blue-400"
                    )}
                  >
                    {isCompleted && <Check size={14} strokeWidth={2.5} />}
                    {isActive && !isReopeningActive && (
                      <span className="text-[11px] font-black">{phase.id}</span>
                    )}
                    {isActive && isReopeningActive && (
                      <RotateCcw size={13} className="text-amber-300" />
                    )}
                    {isSkipped && <SkipForward size={12} />}
                    {isPending && !isPreCertified && (
                      <span className="text-[11px] font-semibold text-gray-300">
                        {phase.id}
                      </span>
                    )}
                    {isPreCertified && (
                      <Check size={13} strokeWidth={2.5} />
                    )}
                  </div>

                  {/* Phase label */}
                  <span
                    className={cn(
                      "text-[11px] font-semibold text-center leading-tight whitespace-nowrap",
                      isCompleted && "text-gray-700",
                      isActive && !isReopeningActive && "text-gray-900",
                      isActive && isReopeningActive && "text-amber-700",
                      isSkipped && "text-gray-300 line-through",
                      isPending && !isPreCertified && "text-gray-400",
                      isPreCertified && "text-blue-500"
                    )}
                  >
                    {phase.shortLabel}
                  </span>

                  {/* Sub-label: current status short name (active only) */}
                  {isActive && (
                    <span
                      className={cn(
                        "text-[10px] font-medium text-center leading-tight whitespace-nowrap px-1.5 py-0.5 rounded-full",
                        isReopeningActive
                          ? "bg-amber-50 text-amber-600"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {STATUS_SHORT_LABEL[status] ?? status}
                    </span>
                  )}

                  {/* Pre-certified tooltip hint */}
                  {isPreCertified && (
                    <span className="text-[9px] text-blue-400 font-medium text-center whitespace-nowrap">
                      Pre-certif.
                    </span>
                  )}

                  {/* Skipped hint */}
                  {isSkipped && (
                    <span className="text-[9px] text-gray-300 font-medium text-center whitespace-nowrap">
                      Omitido
                    </span>
                  )}
                </div>

                {/* ── Connector line ── */}
                {showConnector && (
                  <div className="flex-1 mt-4 mx-1.5">
                    <div
                      className={cn(
                        "h-0.5 w-full rounded-full transition-all",
                        // Connector is filled when left phase is completed
                        isCompleted ? "bg-gray-900" : "bg-gray-200",
                        // Dashed style for skipped connectors
                        isSkipped && "bg-gray-200 opacity-50"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Fast-track note ────────────────────────────────────────────── */}
        {fastTrack && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
            <SkipForward size={11} />
            <span>
              Vehículo sin accesorios — certificación y accesorización omitidas
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

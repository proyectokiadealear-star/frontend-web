import type { Vehicle, Certification, Documentation, StatusHistoryEntry, DeliveryCeremony } from "@/types";
import { VehicleStatusLabel, AccessoryLabel, AccessoryClassificationLabel } from "@/lib/constants";

// ─── Kia Brand Palette ─────────────────────────────────────
const KIA_NAVY = "#05141F";
const KIA_RED = "#C9002B";
const KIA_LIGHT = "#F5F6F7";
const KIA_BORDER = "#DDE0E3";
const KIA_MUTED = "#8A9099";

// ─── Helpers ───────────────────────────────────────────────
function fmt(value?: string | null | Record<string, number>): string {
  if (!value) return "—";
  if (typeof value === "object" && "_seconds" in value) {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date((value as { _seconds: number })._seconds * 1000));
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("es-EC", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }).format(d);
    }
  }
  return String(value);
}

function fmtDate(value?: string | null | Record<string, number>): string {
  if (!value) return "—";
  if (typeof value === "object" && "_seconds" in value) {
    return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })
      .format(new Date((value as { _seconds: number })._seconds * 1000));
  }
  if (typeof value === "string") {
    const d = new Date(value.length === 10 ? value + "T12:00:00" : value);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
    }
  }
  return String(value);
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:7px 12px;color:${KIA_MUTED};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;width:38%;border-bottom:1px solid ${KIA_BORDER}">${label}</td>
      <td style="padding:7px 12px;color:#1A1D23;font-size:13px;border-bottom:1px solid ${KIA_BORDER}">${value || "—"}</td>
    </tr>`;
}

function sectionTitle(title: string): string {
  return `
    <div style="margin:28px 0 0;border-top:3px solid ${KIA_RED};padding-top:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${KIA_NAVY}">${title}</span>
    </div>`;
}

function table(content: string): string {
  return `<table style="width:100%;border-collapse:collapse;margin-top:10px;background:#FFF;border-radius:6px;overflow:hidden;border:1px solid ${KIA_BORDER}">${content}</table>`;
}

// ─── Main Generator ────────────────────────────────────────
export interface VehiclePDFData {
  vehicle: Vehicle;
  cert: Certification | null;
  doc: Documentation | null;
  ceremony: DeliveryCeremony | null;
  history: StatusHistoryEntry[];
}

export function generateVehiclePDF({
  vehicle,
  cert,
  doc,
  ceremony,
  history,
}: VehiclePDFData): void {
  const generatedAt = new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date());

  const statusLabel = VehicleStatusLabel[vehicle.status] ?? vehicle.status;

  // ── Status color map (print-safe: avoid bg-color on print) ─
  const statusColors: Record<string, string> = {
    POR_ARRIBAR: "#64748B",
    ENVIADO_A_MATRICULAR: "#4F46E5",
    CERTIFICADO_STOCK: "#2563EB",
    DOCUMENTACION_PENDIENTE: "#D97706",
    DOCUMENTADO: "#7C3AED",
    ORDEN_GENERADA: "#0284C7",
    ASIGNADO: "#0369A1",
    EN_INSTALACION: "#EA580C",
    INSTALACION_COMPLETA: "#16A34A",
    REAPERTURA_OT: "#DC2626",
    LISTO_PARA_ENTREGA: "#15803D",
    AGENDADO: "#059669",
    ENTREGADO: "#1A1D23",
    CEDIDO: "#94A3B8",
  };
  const statusColor = statusColors[vehicle.status] ?? KIA_NAVY;

  // ── Section: Vehículo ────────────────────────────────────
  const vehicleSection = `
    ${sectionTitle("Datos del Vehículo")}
    ${table(`
      ${row("Modelo", vehicle.model)}
      ${row("Año", String(vehicle.year))}
      ${row("Color", vehicle.color)}
      ${row("Chasis / VIN", vehicle.chassis)}
      ${row("Sede", vehicle.sede)}
      ${vehicle.originConcessionaire ? row("Concesionario origen", vehicle.originConcessionaire) : ""}
      ${vehicle.registeredDate ? row("Fecha registro contable", fmtDate(vehicle.registeredDate)) : ""}
      ${vehicle.registrationSentDate ? row("Fecha envío a matricular", fmtDate(vehicle.registrationSentDate)) : ""}
      ${vehicle.receptionDate ? row("Fecha de recepción", fmtDate(vehicle.receptionDate)) : ""}
      ${row("Estado actual", statusLabel)}
    `)}`;

  // ── Section: Certificación ───────────────────────────────
  const certSection = cert ? `
    ${sectionTitle("Certificación de Stock")}
    ${table(`
      ${row("Kilometraje", `${cert.mileage} km`)}
      ${row("Radio", cert.radio || "—")}
      ${row("Tipo de asiento", cert.seatType || "—")}
      ${row("Improntas", cert.hasImprints ? "Sí" : "No")}
      ${cert.notes ? row("Notas", cert.notes) : ""}
      ${cert.certifiedAt ? row("Certificado el", fmt(cert.certifiedAt)) : ""}
      ${cert.certifiedBy ? row("Certificado por", cert.certifiedBy) : ""}
    `)}` : "";

  // ── Section: Documentación ───────────────────────────────
  let docSection = "";
  if (doc) {
    const accRows = Array.isArray(doc.accessories) && doc.accessories.length > 0
      ? `
        <tr style="background:${KIA_LIGHT}">
          <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid ${KIA_BORDER}">Accesorio</th>
          <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid ${KIA_BORDER}">Clasificación</th>
        </tr>
        ${doc.accessories.map(acc => `
          <tr>
            <td style="padding:7px 12px;font-size:12px;color:#1A1D23;border-bottom:1px solid ${KIA_BORDER}">${AccessoryLabel[acc.key] ?? acc.key}</td>
            <td style="padding:7px 12px;font-size:12px;color:#1A1D23;border-bottom:1px solid ${KIA_BORDER}">${AccessoryClassificationLabel[acc.classification] ?? acc.classification}</td>
          </tr>`).join("")}`
      : `<tr><td colspan="2" style="padding:12px;text-align:center;color:${KIA_MUTED};font-size:12px">Sin accesorios registrados</td></tr>`;

    docSection = `
      ${sectionTitle("Documentación del Cliente")}
      ${table(`
        ${row("Nombre del cliente", doc.clientName)}
        ${row("Cédula", doc.clientId)}
        ${row("Teléfono", doc.clientPhone)}
        ${doc.registrationType ? row("Tipo de matrícula", doc.registrationType) : ""}
        ${doc.paymentMethod ? row("Método de pago", doc.paymentMethod) : ""}
        ${doc.targetConcessionaire ? row("Concesionario destino", doc.targetConcessionaire) : ""}
        ${doc.documentedAt ? row("Documentado el", fmt(doc.documentedAt)) : ""}
        ${doc.documentedBy ? row("Documentado por", doc.documentedBy) : ""}
      `)}
      <div style="margin-top:14px">
        <p style="font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Accesorios</p>
        <table style="width:100%;border-collapse:collapse;background:#FFF;border:1px solid ${KIA_BORDER};border-radius:6px;overflow:hidden">
          ${accRows}
        </table>
      </div>`;
  }

  // ── Section: Ceremonia de Entrega ────────────────────────
  const ceremonySection = ceremony ? `
    ${sectionTitle("Ceremonia de Entrega")}
    ${table(`
      ${ceremony.deliveredAt ? row("Fecha de entrega", fmt(ceremony.deliveredAt)) : ""}
      ${ceremony.advisorName ? row("Asesor responsable", ceremony.advisorName) : ""}
      ${ceremony.clientName ? row("Cliente", ceremony.clientName) : ""}
      ${ceremony.notes ? row("Observaciones", ceremony.notes) : ""}
      ${ceremony.signedActaUrl ? row("Acta firmada", `<a href="${ceremony.signedActaUrl}" style="color:${KIA_RED}">Ver documento</a>`) : ""}
    `)}` : "";

  // ── Section: Historial ───────────────────────────────────
  const sorted = [...history].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  const historyRows = sorted.map((entry, i) => {
    const bg = i % 2 === 0 ? "#FFF" : KIA_LIGHT;
    return `
      <tr style="background:${bg}">
        <td style="padding:7px 12px;font-size:12px;color:#1A1D23;border-bottom:1px solid ${KIA_BORDER}">${VehicleStatusLabel[entry.status] ?? entry.status}</td>
        <td style="padding:7px 12px;font-size:12px;color:#1A1D23;border-bottom:1px solid ${KIA_BORDER}">${fmt(entry.changedAt)}</td>
        <td style="padding:7px 12px;font-size:12px;color:#1A1D23;border-bottom:1px solid ${KIA_BORDER}">${entry.changedByName || "—"}</td>
        <td style="padding:7px 12px;font-size:12px;color:#1A1D23;border-bottom:1px solid ${KIA_BORDER}">${entry.sede || "—"}</td>
        ${entry.notes ? `<td style="padding:7px 12px;font-size:11px;color:${KIA_MUTED};font-style:italic;border-bottom:1px solid ${KIA_BORDER}">${entry.notes}</td>` : `<td style="border-bottom:1px solid ${KIA_BORDER}"></td>`}
      </tr>`;
  }).join("");

  const historySection = `
    ${sectionTitle("Historial de Estados")}
    <table style="width:100%;border-collapse:collapse;margin-top:10px;background:#FFF;border:1px solid ${KIA_BORDER};border-radius:6px;overflow:hidden">
      <tr style="background:${KIA_LIGHT}">
        <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid ${KIA_BORDER}">Estado</th>
        <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid ${KIA_BORDER}">Fecha</th>
        <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid ${KIA_BORDER}">Responsable</th>
        <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid ${KIA_BORDER}">Sede</th>
        <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:700;color:${KIA_MUTED};text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid ${KIA_BORDER}">Notas</th>
      </tr>
      ${historyRows}
    </table>`;

  // ── Full HTML Document ────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reporte · ${vehicle.chassis}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #F0F2F5;
      color: #1A1D23;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      max-width: 860px;
      margin: 0 auto;
      background: #FFF;
      min-height: 100vh;
    }

    /* ── Header ── */
    .header {
      background: ${KIA_NAVY};
      padding: 28px 40px 24px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }
    .kia-logo {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: .18em;
      color: #FFF;
      line-height: 1;
      font-style: italic;
    }
    .kia-logo span {
      display: block;
      font-size: 10px;
      font-weight: 400;
      letter-spacing: .14em;
      color: rgba(255,255,255,.55);
      margin-top: 4px;
      font-style: normal;
    }
    .header-right {
      text-align: right;
    }
    .header-right .doc-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: rgba(255,255,255,.45);
    }
    .header-right .doc-date {
      font-size: 11px;
      color: rgba(255,255,255,.75);
      margin-top: 3px;
    }

    /* ── Red accent bar ── */
    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg, ${KIA_RED} 60%, transparent 100%);
    }

    /* ── Vehicle hero ── */
    .vehicle-hero {
      background: ${KIA_LIGHT};
      padding: 24px 40px;
      border-bottom: 1px solid ${KIA_BORDER};
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .vehicle-hero-title {
      font-size: 22px;
      font-weight: 700;
      color: ${KIA_NAVY};
      letter-spacing: -.01em;
    }
    .vehicle-hero-chassis {
      font-size: 12px;
      color: ${KIA_MUTED};
      margin-top: 4px;
      font-family: 'Courier New', monospace;
      letter-spacing: .05em;
    }
    .status-pill {
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      color: ${statusColor};
      border: 1.5px solid ${statusColor};
      background: transparent;
      white-space: nowrap;
    }

    /* ── Content ── */
    .content {
      padding: 8px 40px 48px;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 40px;
      padding-top: 14px;
      border-top: 1px solid ${KIA_BORDER};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left {
      font-size: 10px;
      color: ${KIA_MUTED};
    }
    .footer-right {
      font-size: 10px;
      color: ${KIA_MUTED};
      font-weight: 600;
      letter-spacing: .06em;
      text-transform: uppercase;
    }

    /* ── Print ── */
    @media print {
      body { background: #FFF; }
      .page { box-shadow: none; }
      .no-print { display: none !important; }
      table { page-break-inside: avoid; }
      .content > div { page-break-inside: avoid; }
    }

    @page {
      margin: 14mm 10mm;
      size: A4;
    }
  </style>
</head>
<body>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="kia-logo">KIA<span>Ecuador · Grupo Concesionario</span></div>
    </div>
    <div class="header-right">
      <div class="doc-label">Reporte de Trazabilidad</div>
      <div class="doc-date">Generado el ${generatedAt}</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <!-- Vehicle hero -->
  <div class="vehicle-hero">
    <div>
      <div class="vehicle-hero-title">${vehicle.model} &mdash; ${vehicle.color}</div>
      <div class="vehicle-hero-chassis">${vehicle.chassis}${vehicle.year ? ` &nbsp;·&nbsp; ${vehicle.year}` : ""}</div>
    </div>
    <div>
      <div class="status-pill">${statusLabel}</div>
    </div>
  </div>

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="display:flex;justify-content:flex-end;padding:12px 40px;gap:10px;border-bottom:1px solid ${KIA_BORDER};background:#FFF">
    <button onclick="window.print()" style="padding:8px 22px;background:${KIA_NAVY};color:#FFF;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:.02em">
      Imprimir / Guardar PDF
    </button>
    <button onclick="window.close()" style="padding:8px 16px;background:transparent;color:${KIA_MUTED};border:1.5px solid ${KIA_BORDER};border-radius:6px;font-size:13px;cursor:pointer">
      Cerrar
    </button>
  </div>

  <!-- Content -->
  <div class="content">

    ${vehicleSection}
    ${certSection}
    ${docSection}
    ${ceremonySection}
    ${historySection}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        Documento generado por el Sistema de Gestión KIA &nbsp;·&nbsp; Uso interno
      </div>
      <div class="footer-right">KIA Ecuador</div>
    </div>

  </div>
</div>

</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=800");
  if (!win) {
    alert("Activa las ventanas emergentes para generar el reporte.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

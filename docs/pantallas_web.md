# 🖥️ PLAN DE PANTALLAS WEB — Next.js

## Sistema de Diseño Base

### Principios de Diseño

**1. Jerarquía Visual**
Los elementos se ordenan por importancia: el estado del vehículo y el chasis son siempre el dato más prominente. Las acciones primarias (botones CTA) tienen mayor peso visual que las secundarias.

**2. Consistencia**
Un único sistema de componentes compartido (sidebar, header, cards, tablas, modales) garantiza que el usuario nunca tenga que reaprender patrones. Todos los formularios usan la misma estructura de secciones con título + campos agrupados.

**3. Accesibilidad**
- Contraste mínimo WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- Todos los inputs tienen `label` asociado con `htmlFor`
- Tabindex correcto en formularios de múltiples pasos
- Estados de foco visibles con outline en color de acento
- Mensajes de error descriptivos (no solo color rojo)
- Textos alternativos en todas las imágenes y PDFs

**4. Feedback Claro**
- Botones muestran spinner mientras el request está pendiente
- Toast de éxito/error tras cada acción (esquina superior derecha, 3s)
- Skeletons mientras cargan los datos (nunca pantalla en blanco)
- Confirmación modal antes de acciones destructivas (eliminar, ceder)
- Badge de estado del vehículo con color contextual en cada card

---

### Tokens de Diseño

```css
/* Tipografía */
--font-primary: 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', monospace;  /* Para chasis y códigos */

--text-xs:    11px / line-height: 16px
--text-sm:    13px / line-height: 20px
--text-base:  15px / line-height: 24px
--text-lg:    18px / line-height: 28px
--text-xl:    22px / line-height: 32px
--text-2xl:   28px / line-height: 36px
--text-3xl:   36px / line-height: 44px

font-weight-regular: 400
font-weight-medium:  500
font-weight-semibold: 600
font-weight-bold:    700

/* Colores Primarios */
--color-primary:      #000000   /* Negro puro — acciones principales, headers */
--color-primary-hover: #1a1a1a  /* Negro suavizado para hover */
--color-background:   #FFFFFF   /* Blanco — fondo principal */
--color-surface:      #F8F8F8   /* Blanco cálido — cards, sidebars */
--color-border:       #E5E5E5   /* Gris muy claro — bordes */
--color-border-dark:  #CCCCCC   /* Gris medio — separadores visibles */

/* Escala de Grises */
--color-gray-50:  #FAFAFA
--color-gray-100: #F5F5F5
--color-gray-200: #E5E5E5
--color-gray-300: #D4D4D4
--color-gray-400: #A3A3A3
--color-gray-500: #737373
--color-gray-600: #525252
--color-gray-700: #404040
--color-gray-800: #262626
--color-gray-900: #171717

/* Colores de Acento Funcional */
--color-accent:        #2563EB  /* Azul KIA — links, focus rings, acciones secundarias */
--color-success:       #16A34A  /* Verde — estado positivo, completado */
--color-warning:       #D97706  /* Ámbar — alertas, pendiente */
--color-error:         #DC2626  /* Rojo — errores, acciones destructivas */
--color-info:          #0284C7  /* Azul info — notificaciones informativas */

/* Colores de Estado del Vehículo */
--status-recepcionado:    #737373  /* Gris — recién ingresado */
--status-certificado:     #2563EB  /* Azul — en stock */
--status-doc-pendiente:   #D97706  /* Ámbar — falta documentar */
--status-documentado:     #7C3AED  /* Violeta — documentado */
--status-orden:           #0284C7  /* Azul info — OT generada */
--status-instalacion:     #EA580C  /* Naranja — en proceso */
--status-listo:           #16A34A  /* Verde — listo */
--status-agendado:        #059669  /* Verde esmeralda — agendado */
--status-entregado:       #000000  /* Negro — completado */
--status-cedido:          #9CA3AF  /* Gris claro — fuera del flujo */
--status-reapertura:      #DC2626  /* Rojo — alerta de retroceso */

/* Espaciados */
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px

/* Border Radius */
--radius-sm:  4px
--radius-md:  8px
--radius-lg:  12px
--radius-xl:  16px
--radius-full: 9999px

/* Sombras */
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
--shadow-md:  0 4px 6px rgba(0,0,0,0.07)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.1)
```

---

### Componentes Globales Web

#### `<AppLayout>` — Layout base
```
┌─────────────────────────────────────────────────┐
│  HEADER (fixed, h=64px)                          │
│  [Logo "KIA Dealer"] ─── [🔔 3] ─── [👤 Nombre] │
├─────────┬───────────────────────────────────────┤
│ SIDEBAR │  MAIN CONTENT                          │
│ (240px) │  (flex-1, overflow-y-auto)             │
│         │                                        │
│  Nav    │                                        │
│  items  │                                        │
│         │                                        │
└─────────┴───────────────────────────────────────┘
```

Props: `children`, `role` (determina qué nav items mostrar)

#### `<Header>`
- Logo: "KIA Dealer" en `font-bold text-xl`
- `<NotificationBell>`: ícono con badge de conteo no leídos → abre `<NotificationPanel>`
- `<UserMenu>`: nombre + avatar iniciales → dropdown con "Configuración" y "Cerrar sesión"

#### `<Sidebar>`
- Ancho: 240px, colapsable a 64px (icon-only)
- Items de navegación según rol (ver secciones por rol abajo)
- Item activo: fondo negro, texto blanco
- Item hover: fondo `--color-gray-100`

#### `<VehicleCard>`
```
┌──────────────────────────────────┐
│  [Foto del auto 160x100px]       │
│                                  │
│  KIA Sportage — Blanco    🔵 Doc. │
│  Chasis: 9BFPK62M0PB001234       │
│  Sede: SurMotor | Año: 2026      │
│  Recepcionado: 23/02/2026        │
└──────────────────────────────────┘
```

Props: `vehicle`, `onClick`, `actions[]` (botones contextuales por rol)

#### `<StatusBadge>`
Chip con color según `VehicleStatus`. Siempre visible en cards y detalle.

#### `<SearchFilterBar>`
Input de búsqueda + selects de filtro (sede, estado, cédula). Se usa en Stock, Documentación, Cambio de Sede, Reportes.

#### `<PdfViewer>`
Modal overlay con `react-pdf`. Controles de página, zoom, botón descargar, botón reemplazar (por rol).

#### `<TraceabilityTimeline>`
Lista vertical de pasos con ícono ✅/⏳/— según estado. Muestra fecha, usuario y sede de cada cambio.

#### `<ConfirmModal>`
Modal de confirmación para acciones destructivas. Props: `title`, `description`, `confirmLabel`, `onConfirm`.

#### `<Toast>`
Notificación flotante. Tipos: success, error, warning, info. Auto-dismiss en 3s.

---

## PANTALLAS: ROL DOCUMENTACION

### Sidebar Nav
```
◉ Inicio
○ Stock
○ Documentación
○ Cambio de Sede
○ Cambio de Concesionario
```

---

### Pantalla: Inicio (Documentación)

**Jerarquía visual:** El dashboard prioriza los vehículos pendientes de documentar (el trabajo inmediato del usuario).

**Componentes:**
```
<PageHeader title="Inicio" />

<StatsGrid cols={3}>
  <StatCard icon="car" label="Listos para documentar" value={12} color="blue" />
  <StatCard icon="clock" label="Documentación pendiente" value={4} color="amber" />
  <StatCard icon="check" label="Documentados hoy" value={7} color="green" />
</StatsGrid>

<SectionTitle>Vehículos certificados — Listos para documentar</SectionTitle>
<VehicleGrid>
  <VehicleCard
    vehicle={v}
    badge={<StatusBadge status="CERTIFICADO_STOCK" />}
    action={<Button onClick={goToDoc}>Documentar</Button>}
  />
</VehicleGrid>

<SectionTitle>Documentación en standby</SectionTitle>
<VehicleGrid>
  <VehicleCard
    vehicle={v}
    badge={<StatusBadge status="DOCUMENTACION_PENDIENTE" />}
    action={<Button onClick={goToDoc} variant="outline">Continuar</Button>}
  />
</VehicleGrid>
```

**Feedback:** Al cargar, muestra `<SkeletonGrid>`. Al hacer click en "Documentar", navega a `/documentacion/[vehicleId]`.

---

### Pantalla: Stock (Documentación)

**Componentes:**
```
<PageHeader title="Stock de Vehículos" />

<SearchFilterBar
  searchPlaceholder="Buscar por chasis o cédula..."
  filters={[
    { label: "Sede", options: sedes },
    { label: "Estado", options: vehicleStatuses }
  ]}
/>

<VehicleGrid>
  {vehicles.map(v => (
    <VehicleCard
      vehicle={v}
      onClick={() => navigate(`/stock/${v.id}`)}
      badge={<StatusBadge status={v.status} />}
      footer={
        v.status === 'CERTIFICADO_STOCK' &&
        <Button size="sm">Ir a Documentar</Button>
      }
    />
  ))}
</VehicleGrid>

<Pagination total={total} page={page} />
```

**Al hacer click en una card → `<VehicleDetailPage>`:**

```
<PageHeader
  title={`${vehicle.model} — ${vehicle.color}`}
  subtitle={`Chasis: ${vehicle.chassis}`}
  badge={<StatusBadge status={vehicle.status} />}
  actions={[
    <Button onClick={goToDoc}>Documentar</Button>  // Solo si CERTIFICADO_STOCK
  ]}
/>

<TabBar tabs={["Ingreso/Certificación", "Documentación", "Trazabilidad"]} />

/* Tab: Ingreso/Certificación */
<FieldsGrid>
  <Field label="Modelo" value={vehicle.model} />
  <Field label="Año" value={vehicle.year} />
  <Field label="Color" value={vehicle.color} />
  <Field label="Concesionario origen" value={vehicle.originConcessionaire} />
  <Field label="Sede" value={vehicle.sede} />
  <Field label="Recibido por" value={vehicle.receivedByName} />
  <Field label="Fecha recepción" value={format(vehicle.receptionDate)} />
  <VehiclePhoto src={vehicle.photoUrl} />
  /* Certificación */
  <Field label="Radio" value={certification.radio} />
  <Field label="Aros" value={certification.rims.status} />
  <RimsPhoto src={certification.rims.photoUrl} />
  <Field label="Asientos" value={certification.seatType} />
  /* ... resto de campos */
</FieldsGrid>

/* Tab: Documentación */
/* Solo visible si ya fue documentado */
<ClientSection {...documentation.client} />
<DocumentsList documents={documentation.documents} />  // Con PdfViewer
<AccessoriesClassification accessories={documentation.accessories} editable />

/* Tab: Trazabilidad */
<TraceabilityTimeline history={vehicle.statusHistory} />
```

---

### Pantalla: Documentación

**Jerarquía visual:** El formulario está dividido en 3 secciones claramente separadas (Cliente → Documentos → Accesorios) para guiar al usuario linealmente.

```
<PageHeader title="Documentación de Vehículos" />

<SearchFilterBar
  searchPlaceholder="Buscar por chasis..."
  filters={[{ label: "Sede", options: sedes }]}
/>

<VehicleGrid>
  {certifiedVehicles.map(v => (
    <VehicleCard
      vehicle={v}
      badge={<StatusBadge status={v.status} />}
      footer={<Button onClick={() => navigate(`/documentacion/${v.id}`)}>Documentar</Button>}
    />
  ))}
</VehicleGrid>
```

**Pantalla de formulario `/documentacion/[vehicleId]`:**

```
<PageHeader
  title="Documentar Vehículo"
  subtitle={`${vehicle.model} | Chasis: ${vehicle.chassis}`}
/>

<FormStepper steps={["Cliente", "Documentos", "Accesorios"]} current={step} />

/* Sección 1: Datos del Cliente */
<FormSection title="Datos del Comprador">
  <FormField label="Nombre completo" name="clientName" required />
  <FormField label="Cédula" name="clientId" type="text" pattern="[0-9]{10}" required />
  <FormField label="Teléfono" name="clientPhone" type="tel" required />
  <FormSelect label="Tipo de matrícula" name="registrationType"
    options={["NORMAL", "RÁPIDA", "EXCLUSIVA"]} required />
</FormSection>

/* Sección 2: Documentos */
<FormSection title="Documentos del Vehículo">
  <FileUpload
    label="Factura del vehículo (PDF)"
    name="vehicleInvoice"
    accept=".pdf"
    maxSize="10MB"
    preview={<PdfPreviewThumbnail />}
  />
  <FileUpload
    label="Correo de obsequio (PDF)"
    name="giftEmail"
    accept=".pdf"
    optional
  />
  <FileUpload
    label="Factura de accesorios (PDF)"
    name="accessoryInvoice"
    accept=".pdf"
    optional
  />
</FormSection>

/* Sección 3: Clasificación de Accesorios */
<FormSection title="Clasificación de Accesorios">
  <AccessoryTable>
    {accessories.map(acc => (
      <AccessoryRow
        key={acc.key}
        label={acc.label}
        value={acc.classification}
        onChange={updateClassification}
        options={["VENDIDO", "OBSEQUIADO", "NO_APLICA"]}
        // Campo "otros" es textarea libre
        extra={acc.key === 'otros' ? <TextArea /> : null}
      />
    ))}
  </AccessoryTable>
</FormSection>

<FormActions>
  <Button variant="outline" onClick={saveAsPending} loading={isPending}>
    Guardar como pendiente
  </Button>
  <Button variant="primary" onClick={saveAsDocumented} loading={isLoading}>
    Guardar y documentar
  </Button>
</FormActions>
```

**Feedback:**
- Errores de validación inline bajo cada campo
- Si guardado exitoso como DOCUMENTADO → Toast verde + redirección a Stock
- Si guardado como PENDIENTE → Toast ámbar "Guardado como pendiente"

---

### Pantalla: Cambio de Sede

```
<PageHeader title="Cambio de Sede" />

<SearchBar placeholder="Buscar vehículo por chasis..." onSearch={searchByChassis} />

{foundVehicle && (
  <VehicleCard vehicle={foundVehicle} badge={<StatusBadge />} />

  <FormSection title="Nueva Sede">
    <FormSelect
      label="Seleccionar sede destino"
      name="newSede"
      options={sedesExcluding(foundVehicle.sede)}
      required
    />
  </FormSection>

  <ConfirmButton
    label="Confirmar cambio de sede"
    onConfirm={handleSedeChange}
    confirmMessage={`¿Cambiar el vehículo ${chassis} de ${currentSede} a ${newSede}?`}
  />
)}
```

---

### Pantalla: Cambio de Concesionario

```
<PageHeader title="Cesión a Concesionario" />

<SearchBar placeholder="Buscar vehículo por chasis..." />

{foundVehicle && (
  <VehicleCard vehicle={foundVehicle} />

  <FormSection title="Concesionario Destino">
    <FormSelect label="Concesionario" name="targetConcessionaire" options={concessionaires} />
    <FileUpload label="Documento de cesión (PDF)" name="transferDocument" required />
  </FormSection>

  <Button variant="danger" onClick={handleTransfer}>
    Ceder vehículo
  </Button>
)}

<SectionTitle>Historial de vehículos cedidos</SectionTitle>
<DataTable
  columns={["Chasis", "Modelo", "Concesionario destino", "Fecha", "Documento"]}
  data={cededVehicles}
  rowAction={(v) => <PdfViewerButton url={v.transferDocUrl} />}
/>
```

---

## PANTALLAS: ROL JEFE DE TALLER

### Sidebar Nav
```
◉ Inicio
○ Stock
○ Agendamiento
○ Reportes
○ Gestión de Usuarios
○ Gestión de Información
```

---

### Pantalla: Inicio (Jefe de Taller)

**Jerarquía visual:** KPIs de alto nivel arriba en formato de grandes números. Gráficas de tendencia en el medio. Rankings en la parte inferior.

```
<PageHeader title="Dashboard General" />
Guía Descriptiva: Dashboard de Gestión KIA Control 360°

Este dashboard ha sido diseñado para centralizar la operación de las tres sedes (SurMotor, Shyris, Grandas Centenos) bajo un modelo de gestión basado en datos. A continuación, se detalla la funcionalidad de cada componente.

1. Sistema de Filtrado Global (Barra de Sedes)

Ubicada en la parte superior derecha, esta barra permite al Jefe de Taller segmentar toda la información del dashboard.

Funcionalidad: Al seleccionar una sede específica (ej. Shyris), los KPIs, rankings de asesores y cuellos de botella se recalculan para mostrar solo la realidad de esa ubicación.

Contexto: Es vital para comparar el rendimiento de sedes con estructuras distintas (como Sur que tiene roles divididos vs. Shyris que es polifuncional).

2. Tarjetas de Indicadores Clave (KPIs)

Son el "termómetro" inmediato de la operación:

Ciclo Total: Mide los días promedio desde el ingreso por QR hasta la entrega final. Ideal para detectar lentitud operativa general.

Conversión Accesorios: Porcentaje de accesorios vendidos sobre el total instalado. Indica la efectividad del asesor en convertir obsequios en ventas reales.

Órdenes Totales: Contador de OTs generadas en el mes actual.

Capacidad Sede: Porcentaje de ocupación del taller basado en el personal activo y vehículos en instalación.

3. Estado del Flujo y Cuellos de Botella (Gráfico de Área)

Visualiza el inventario de vehículos según su estado en el flujo de trabajo (CERTIFICADO, DOCUMENTADO, INSTALACIÓN, etc.).

Identificación de Crisis: Las fases marcadas como "Críticas" (en rojo) indican donde hay más vehículos estancados o donde el tiempo de espera supera el promedio.

Uso: Permite al Jefe de Taller redistribuir técnicos hacia las áreas con mayor saturación.

4. Rankings de Asesores (Tops de Rendimiento)

Sustituye la telemetría por una visión enfocada en el capital humano:

Top Entregas (Trofeo): Clasifica a los asesores que han completado la ceremonia de entrega. Es el KPI de cierre de ventas.

Top Carga OTs (Medalla): Mide quién está gestionando más vehículos simultáneamente. Ayuda a detectar sobrecarga de trabajo en asesores específicos.

Ratio de Eficiencia: Un cálculo rápido de cuántas de las OTs abiertas terminan en entrega efectiva.

5. Mix de Accesorios (Gráfico de Barras Apiladas)

Analiza la estrategia comercial por cada modelo de vehículo (Sportage, Seltos, etc.).

Vendido vs. Obsequiado: Visualiza la proporción de ingresos reales vs. cortesías comerciales.

Potencial Up-sell: Indica accesorios sugeridos que aún no han sido cerrados como venta, señalando oportunidades de negocio para los asesores de servicio.

6. Productividad por Sede (Comparativa Operativa)

Muestra el balance de salud de cada sede física.

Ingresos vs. Entregas: Permite ver qué sede está procesando vehículos más rápido.

En Taller: Indica cuántos autos están ocupando espacio físico en las bahías de trabajo actualmente.

7. Proyección de Cierre de Mes (Barra Inferior)

Panel de alineación de objetivos:

Meta vs. Proyectado: Utiliza el ritmo actual de trabajo para predecir si se llegará a la meta mensual (ej. 450 unidades).

Gap: La diferencia negativa en rojo alerta sobre la necesidad de acelerar procesos de documentación o instalación para cumplir la cuota.

Nota Técnica: El dashboard utiliza Lucide React para iconografía y Recharts para el procesamiento de datos dinámicos, garantizando una interfaz fluida y profesional.
---

### Pantalla: Stock (Jefe de Taller)

Igual que Stock de Documentación pero con más poderes:
- CRUD completo en el detalle del vehículo (puede editar cualquier campo)
- Puede reemplazar foto del vehículo
- Puede eliminar el vehículo (`<ConfirmModal>`)
- Botón "Generar Reporte PDF" en el detalle

```
/* En VehicleDetailPage para Jefe */
<PageHeader
  actions={[
    <Button variant="outline" onClick={generateReport} icon="download">Reporte PDF</Button>,
    <Button variant="outline" onClick={editVehicle} icon="edit">Editar</Button>,
    <Button variant="danger" onClick={confirmDelete} icon="trash">Eliminar</Button>,
  ]}
/>
```

---

### Pantalla: Agendamiento (Jefe de Taller)

```
<PageHeader title="Agendamiento de Entregas" />

<TabBar tabs={["Calendario", "Pendientes de Agendar"]} />

/* Tab: Calendario */
<CalendarControls month year onPrev onNext />
<CalendarGrid>
  {events.map(e => (
    <CalendarEvent
      date={e.scheduledDate}
      label={`${e.model} — ${e.advisorName}`}
      status={e.status}
      onClick={() => openEventDetail(e)}
    />
  ))}
</CalendarGrid>

/* Modal detalle evento */
<EventDetailModal event={selectedEvent}>
  <VehicleInfo />
  <AdvisorInfo />
  <Button onClick={reassignAdvisor}>Cambiar asesor</Button>
  <Button onClick={reschedule}>Reagendar</Button>
</EventDetailModal>

/* Tab: Pendientes de Agendar */
<VehicleGrid>
  {readyVehicles.map(v => (
    <VehicleCard
      vehicle={v}
      action={<Button onClick={() => openScheduleModal(v)}>Agendar</Button>}
    />
  ))}
</VehicleGrid>
```

---

### Pantalla: Reportes (Jefe de Taller)

```
<PageHeader title="Reportes de Trazabilidad" />

<SearchBar placeholder="Buscar por chasis..." />
<FilterBar filters={[sede, dateRange]} />

<DataTable
  columns={["Chasis", "Modelo", "Sede", "Estado", "Fechas clave", "Acciones"]}
  data={vehicles}
  rowAction={(v) => (
    <>
      <Button size="sm" onClick={() => viewTraceability(v)}>Ver trazabilidad</Button>
      <Button size="sm" icon="download" onClick={() => generatePdf(v)}>PDF</Button>
    </>
  )}
/>

/* Panel de trazabilidad lateral */
<TraceabilityDrawer vehicle={selectedVehicle}>
  <TraceabilityTimeline history={statusHistory} />
  <DocumentsSection documents={documentation.documents} />
  <Button onClick={downloadReport} icon="download">Generar reporte PDF</Button>
</TraceabilityDrawer>
```

---

### Pantalla: Gestión de Usuarios

```
<PageHeader title="Gestión de Usuarios"
  actions={[<Button icon="plus" onClick={openCreateModal}>Nuevo usuario</Button>]} />

<SearchFilterBar filters={[role, sede, active]} />

<DataTable
  columns={["Nombre", "Email", "Rol", "Sede", "Activo", "Acciones"]}
  data={users}
  rowActions={(u) => (
    <>
      <IconButton icon="edit" onClick={() => openEditModal(u)} tooltip="Editar" />
      <IconButton icon="key" onClick={() => resetPassword(u)} tooltip="Reset contraseña" />
      <IconButton icon={u.active ? "lock" : "unlock"}
        onClick={() => toggleActive(u)} tooltip={u.active ? "Desactivar" : "Activar"} />
    </>
  )}
/>

/* Modal crear/editar usuario */
<UserFormModal>
  <FormField label="Nombre completo" name="displayName" required />
  <FormField label="Email" name="email" type="email" required />
  <FormSelect label="Rol" name="role" options={roles} required />
  <FormSelect label="Sede" name="sede" options={sedes} required />
</UserFormModal>
```

---

### Pantalla: Gestión de Información (Catálogos)

```
<PageHeader title="Gestión de Información" />

<TabBar tabs={["Colores", "Modelos", "Concesionarios", "Sedes", "Accesorios"]} />

/* Cada tab muestra DataTable con CRUD */
<CatalogSection catalogType="colors">
  <DataTable columns={["Nombre", "Código Hex", "Acciones"]} data={colors} />
  <AddCatalogItemForm fields={[{ name: "name", label: "Nombre" }, { name: "hexCode", label: "Color" }]} />
</CatalogSection>
```
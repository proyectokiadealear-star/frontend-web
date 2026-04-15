# 🔄 COMPARATIVA: PANTALLAS WEB vs ENDPOINTS — PLAN DE INTEGRACIÓN

> **Contexto:** La plataforma web tiene **2 roles activos**: `DOCUMENTACION` y `JEFE_TALLER`.  
> Las páginas existen con datos mock. `lib/api.ts` tiene el cliente Axios pero **sin funciones de endpoint definidas**.  
> Este documento mapea cada acción de cada pantalla con su endpoint correspondiente y define el estado de integración.

---

## 📊 RESUMEN EJECUTIVO

| Rol | Páginas web | Llamadas API requeridas | Estado actual |
|-----|-------------|------------------------|---------------|
| DOCUMENTACION | 5 pantallas | 12 endpoints | 🔴 Sin integrar (mock) |
| JEFE_TALLER | 6 pantallas | 24 endpoints | 🔴 Sin integrar (mock) |

---

## ROL: `DOCUMENTACION`

### 📄 Sidebar Nav
```
Inicio | Stock | Documentación | Cambio de Sede | Cambio de Concesionario
```

---

### 1. Pantalla: Inicio — `/dashboard`

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Contar vehículos listos para documentar | `GET /vehicles?status=CERTIFICADO_STOCK` | KPI card "Listos para documentar" | Contar `total` de respuesta |
| Contar documentación en standby | `GET /vehicles?status=DOCUMENTACION_PENDIENTE` | KPI card "Doc. Pendiente" | |
| Contar documentados hoy | `GET /vehicles?status=DOCUMENTADO` + filtro fecha | KPI card "Documentados hoy" | Filtrar por `receptionDate` en frontend |
| Listar vehículos "Listos para documentar" | `GET /vehicles?status=CERTIFICADO_STOCK&limit=10` | Grid principal | `page=1&limit=10` |
| Listar vehículos "Standby" | `GET /vehicles?status=DOCUMENTACION_PENDIENTE&limit=10` | Grid secundario | |
| Navegar a formulario de documentar | — | Botón "Documentar" / "Continuar" | Route: `/dashboard/documentation/[id]` |

**Dependencias de datos al cargar:**
```
Promise.all([
  GET /vehicles?status=CERTIFICADO_STOCK&page=1&limit=10   → grid principal
  GET /vehicles?status=DOCUMENTACION_PENDIENTE&page=1&limit=10  → grid standby
  GET /catalogs/sedes                                      → filtros disponibles
])
```

---

### 2. Pantalla: Stock — `/dashboard/vehicles`

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Listar inventario activo con filtros | `GET /vehicles?sede=X&status=X&chassis=X&page=1&limit=20` | Tabla / Grid principal | Multi-status con coma |
| Ver detalle de vehículo | `GET /vehicles/:id` | Al hacer click en card | Incluye cert. y doc. embebidas |
| Ver historial de estados (Tab Trazabilidad) | `GET /vehicles/:id/status-history` | Tab "Trazabilidad" del detalle | |
| Filtro por sede | `GET /catalogs/sedes` | Select de filtro | Cargar opciones al montar |
| Navegar a documentar | — | Botón "Ir a Documentar" (solo si `CERTIFICADO_STOCK`) | Route: `/dashboard/documentation/[id]` |

**Acciones NO disponibles para DOCUMENTACION en Stock:**
- ❌ Editar campos del vehículo (`PATCH /vehicles/:id`) — solo JEFE_TALLER
- ❌ Eliminar vehículo (`DELETE /vehicles/:id`) — solo JEFE_TALLER
- ❌ Generar Reporte PDF (`GET /reports/vehicle/:vehicleId`) — solo JEFE_TALLER o SOPORTE

---

### 3. Pantalla: Documentación — `/dashboard/documentation` y `/dashboard/documentation/[id]`

#### Lista de vehículos certificados:

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Listar certificados pendientes de documentar | `GET /vehicles?status=CERTIFICADO_STOCK,DOCUMENTACION_PENDIENTE` | Grid de la pantalla | |
| Buscar por chasis | `GET /vehicles?chassis=XXXX` | SearchBar | Búsqueda parcial |
| Filtrar por sede | query param `&sede=X` | Select sede | |

#### Formulario de documentar `/documentation/[id]`:

| Funcionalidad | Endpoint | Método | Body / Notas |
|---------------|----------|--------|-------|
| Cargar datos del vehículo | `GET /vehicles/:id` | Al montar el form | Pre-llenar modelo/chasis |
| Cargar catálogo de accesorios | `GET /catalogs/accessories` | Al montar el form | Para renderizar tabla de clasificación |
| Cargar lista de concesionarios | `GET /catalogs/concessionaires` | Al montar el form | Para campo concesionario origen |
| **Guardar y documentar** | `POST /documentation/:vehicleId` | Botón "Guardar y Documentar" | `multipart/form-data` con PDFs + fields |
| **Guardar como pendiente** | `POST /documentation/:vehicleId` con `saveAsPending: true` | Botón "Guardar como Pendiente" | `saveAsPending: "true"` como text field |
| **Editar documentación existente** | `PATCH /documentation/:vehicleId` | Si ya tiene doc (re-editar) | |
| Reemplazar PDF individual | `PATCH /documentation/:vehicleId` | Botón reemplazar en PdfViewer | Solo el campo del PDF específico |
| Eliminar PDF individual | `DELETE /documentation/:vehicleId/files/:fileType` | Ícono borrar en PdfViewer | `fileType`: `invoiceUrl` / `giftEmailUrl` / `accessoryInvoiceUrl` |

**multipart/form-data campos:**
```
clientName             (text)
clientId               (text - cédula)
clientPhone            (text)
registrationType       (text: NORMAL / RÁPIDA / EXCLUSIVA)
paymentMethod          (text: CONTADO / CREDITO)
accessories            (JSON string con clasificaciones)
saveAsPending          (text: "true" | "false")
invoiceFile            (binary PDF - opcional)
giftEmailFile          (binary PDF - opcional)
accessoryInvoiceFile   (binary PDF - opcional)
```

---

### 4. Pantalla: Cambio de Sede — (dentro de `/dashboard/documentation` o ruta propia)

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Buscar vehículo por chasis | `GET /vehicles?chassis=XXXX` | SearchBar | Retorna el vehículo encontrado |
| Cargar sedes disponibles | `GET /catalogs/sedes` | Select destino | Excluir sede actual del vehículo |
| **Ejecutar cambio de sede** | `PATCH /documentation/:vehicleId/sede` | Botón "Confirmar cambio" | Body: `{ newSede: "SHYRIS" }` |

**Precondición:** El vehículo debe tener documentación (estado `DOCUMENTADO` o posterior). El endpoint NO cambia el `status` del vehículo, solo registra en `statusHistory`.

---

### 5. Pantalla: Cambio de Concesionario (Cesión) — (ruta propia o dentro de Documentación)

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Buscar vehículo por chasis | `GET /vehicles?chassis=XXXX` | SearchBar | |
| Cargar lista de concesionarios | `GET /catalogs/concessionaires` | Select destino | |
| **Ejecutar cesión** | `PATCH /documentation/:vehicleId/transfer` | Botón "Ceder vehículo" | Estado → `CEDIDO` (terminal) |
| Ver historial de cedidos | `GET /vehicles?status=CEDIDO` | Tabla inferior | |
| Ver doc. de cesión (PDF) | `GET /documentation/:vehicleId` → campo `transferDocUrl` | Botón ver PDF | Abrir en `<PdfViewer>` |

**⚠️ IMPORTANTE:** Una vez ejecutado `CEDIDO`, el estado es **terminal e irreversible**. Mostrar `<ConfirmModal>` con mensaje de advertencia.

---
---

## ROL: `JEFE_TALLER`

### 📄 Sidebar Nav
```
Inicio | Stock | Agendamiento | Reportes | Gestión de Usuarios | Gestión de Información
```

---

### 1. Pantalla: Dashboard (KPIs) — `/dashboard`

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| KPIs por sede (conteos por estado) | `GET /vehicles/stats/by-sede` | Cards de KPIs | Responde `{ sede, counts_by_status }` |
| Analytics globales (tiempos, volumen) | `GET /reports/analytics?from=X&to=X` | Gráfica de área + cuellos de botella | `sede` opcional |
| Vehículos agendados hoy | `GET /vehicles/stats/today-deliveries` | Sección de agendamientos del día | |
| Listar agendamientos (para ranking de asesores) | `GET /appointments?date=HOY` | Ranking top entregas | |
| Performance de técnicos | `GET /reports/technician-performance/:uid` | Word map técnicos | Llamar por cada técnico activo |
| Filtro global por sede | — | Barra sede superior | Parámetro `?sede=X` en todas las llamadas |

**Nota:** Los datos del dashboard actual son 100% mock. Requiere conectar `GET /vehicles/stats/by-sede` y `GET /reports/analytics` como mínimo para el MVP.

---

### 2. Pantalla: Stock — `/dashboard/vehicles`

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Listar inventario completo (todas las sedes) | `GET /vehicles?page=1&limit=20` | Grid/Tabla | Sin filtro de sede por defecto (JEFE ve todo) |
| Buscar por chasis | `GET /vehicles?chassis=XXXX` | SearchBar | |
| Filtrar por sede | `GET /vehicles?sede=X` | Select filtro | |
| Filtrar por estado | `GET /vehicles?status=X,Y` | Select estado | Multi-status |
| Filtrar por cédula cliente | `GET /vehicles?clientId=XXXXXXX` | Input cédula | |
| Ver detalle completo | `GET /vehicles/:id` | Click en card | |
| Ver historial estados | `GET /vehicles/:id/status-history` | Tab "Trazabilidad" | |
| **Editar vehículo** | `PATCH /vehicles/:id` | Botón "Editar" | Corrección admin |
| **Eliminar vehículo** | `DELETE /vehicles/:id` | Botón "Eliminar" + `<ConfirmModal>` | Permanente |
| **Generar reporte PDF** | `GET /reports/vehicle/:vehicleId` | Botón "Reporte PDF" | Descarga PDF |
| Cargar sedes y catálogos | `GET /catalogs/sedes`, `GET /catalogs/models` | Selects de filtro | |

---

### 3. Pantalla: Agendamiento — `/dashboard/agendamiento`

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Listar todos los agendamientos | `GET /appointments` | Calendario y tabla | Sin filtro sede → ve todos |
| Filtrar por fecha | `GET /appointments?date=2026-02-25` | Navegación de calendario | |
| Filtrar por asesor | `GET /appointments?advisorUid=X` | Select asesor | |
| Ver detalle de agendamiento | ↑ datos del GET anterior | Modal evento calendario | |
| Listar vehículos listos para agendar | `GET /vehicles?status=LISTO_PARA_ENTREGA` | Tab "Pendientes de Agendar" | |
| **Crear agendamiento** | `POST /appointments` | Botón "Agendar" desde pendientes | Body con vehicleId, date, time, advisorUid |
| **Reagendar** | `PATCH /appointments/:id` | Botón "Reagendar" en modal | Actualiza fecha/hora |
| **Reasignar asesor** | `PATCH /appointments/:id` | Botón "Cambiar asesor" en modal | Actualiza `assignedAdvisorUid` |
| Listar asesores disponibles | `GET /users?role=ASESOR&sede=X&active=true` | Select asesor al crear/reasignar | |

**Body POST /appointments:**
```json
{
  "vehicleId": "uuid",
  "scheduledDate": "2026-03-01",
  "scheduledTime": "10:00",
  "assignedAdvisorUid": "uid-firebase",
  "assignedAdvisorName": "Juan Pérez"
}
```

---

### 4. Pantalla: Reportes — `/dashboard/reports`

| Funcionalidad | Endpoint | Método | Notas |
|---------------|----------|--------|-------|
| Buscar vehículo para reporte | `GET /vehicles?chassis=X` | SearchBar | |
| Listar con filtros (sede, fecha) | `GET /vehicles?sede=X` | Tabla principal | |
| **Ver trazabilidad** | `GET /vehicles/:id/status-history` | Panel lateral `<TraceabilityDrawer>` | |
| Ver documentos PDF del vehículo | `GET /documentation/:vehicleId` | Sección docs en drawer | |
| **Generar reporte PDF completo** | `GET /reports/vehicle/:vehicleId` | Botón "Generar reporte PDF" | Descarga PDF |
| Analytics globales | `GET /reports/analytics?from=X&to=X&sede=X` | Gráficas de analytics | |
| Performance técnicos | `GET /reports/technician-performance/:uid` | Tabla de técnicos | |

---

### 5. Pantalla: Gestión de Usuarios — `/dashboard/users`

| Funcionalidad | Endpoint | Método | Body / Notas |
|---------------|----------|--------|-------|
| Listar todos los usuarios | `GET /users` | Tabla principal | |
| Filtrar por rol | `GET /users?role=ASESOR` | Select rol | |
| Filtrar por sede | `GET /users?sede=X` | Select sede | |
| Filtrar activos/inactivos | `GET /users?active=true` | Toggle activo | |
| **Crear usuario** | `POST /users` | Modal "Nuevo usuario" | `{ displayName, email, role, sede }` |
| **Editar usuario** | `PATCH /users/:uid` | Modal edición | `{ displayName, role, sede }` |
| **Desactivar / Activar usuario** | `PATCH /users/:uid` | Toggle `active` | `{ active: false }` |
| **Eliminar usuario** | `DELETE /users/:uid` | Botón eliminar + confirm | Firebase Auth + Firestore |
| **Reset contraseña** | `POST /users/:uid/reset-password` | Ícono llave | Envía email automático |
| Cargar sedes para el form | `GET /catalogs/sedes` | Al abrir modal | Select sede |

**Roles disponibles en el create/edit form:**
```
ASESOR | LIDER_TECNICO | PERSONAL_TALLER | DOCUMENTACION
(JEFE_TALLER no debería crear otros JEFE sin cuidado)
```

---

### 6. Pantalla: Gestión de Información (Catálogos) — `/dashboard/settings`

| Tab | Funcionalidad | Endpoint | Método |
|-----|---------------|----------|--------|
| **Colores** | Listar | `GET /catalogs/colors` | — |
| | Crear | `POST /catalogs/colors` | `{ name }` → MAYÚSCULAS |
| | Eliminar | `DELETE /catalogs/colors/:id` | + `<ConfirmModal>` |
| **Modelos** | Listar | `GET /catalogs/models` | — |
| | Crear | `POST /catalogs/models` | `{ name }` |
| | Eliminar | `DELETE /catalogs/models/:id` | |
| **Concesionarios** | Listar | `GET /catalogs/concessionaires` | — |
| | Crear | `POST /catalogs/concessionaires` | `{ name }` |
| | Editar nombre | `PATCH /catalogs/concessionaires/:id` | `{ name }` |
| | Eliminar | `DELETE /catalogs/concessionaires/:id` | |
| **Sedes** | Listar | `GET /catalogs/sedes` | — |
| | Crear | `POST /catalogs/sedes` | `{ name, code }` |
| **Accesorios** | Listar | `GET /catalogs/accessories` | — |
| | Crear | `POST /catalogs/accessories` | `{ name, key }` |
| | Editar nombre | `PATCH /catalogs/accessories/:id` | `{ name }` |
| | Eliminar | `DELETE /catalogs/accessories/:id` | |

---
---

## 🗺️ MAPA GLOBAL DE INTEGRACIÓN

### Endpoints requeridos vs. pantalla (trazabilidad completa)

| Endpoint | DOCS — Inicio | DOCS — Stock | DOCS — Documentar | DOCS — Cambio Sede | DOCS — Cesión | JEFE — Dashboard | JEFE — Stock | JEFE — Agenda | JEFE — Reportes | JEFE — Usuarios | JEFE — Catálogos |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /vehicles` | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — |
| `GET /vehicles/:id` | — | ✅ | ✅ | — | ✅ | — | ✅ | — | ✅ | — | — |
| `PATCH /vehicles/:id` | — | — | — | — | — | — | ✅ | — | — | — | — |
| `DELETE /vehicles/:id` | — | — | — | — | — | — | ✅ | — | — | — | — |
| `GET /vehicles/stats/by-sede` | — | — | — | — | — | ✅ | — | — | — | — | — |
| `GET /vehicles/stats/today-deliveries` | — | — | — | — | — | ✅ | — | — | — | — | — |
| `GET /vehicles/:id/status-history` | — | ✅ | — | — | — | — | ✅ | — | ✅ | — | — |
| `POST /documentation/:vehicleId` | — | — | ✅ | — | — | — | — | — | — | — | — |
| `PATCH /documentation/:vehicleId` | — | — | ✅ | — | — | — | — | — | — | — | — |
| `GET /documentation/:vehicleId` | — | ✅ | ✅ | — | ✅ | — | ✅ | — | ✅ | — | — |
| `DELETE /documentation/:vehicleId/files/:type` | — | — | ✅ | — | — | — | — | — | — | — | — |
| `PATCH /documentation/:vehicleId/sede` | — | — | — | ✅ | — | — | — | — | — | — | — |
| `PATCH /documentation/:vehicleId/transfer` | — | — | — | — | ✅ | — | — | — | — | — | — |
| `GET /appointments` | — | — | — | — | — | ✅ | — | ✅ | — | — | — |
| `POST /appointments` | — | — | — | — | — | — | — | ✅ | — | — | — |
| `PATCH /appointments/:id` | — | — | — | — | — | — | — | ✅ | — | — | — |
| `GET /reports/vehicle/:vehicleId` | — | — | — | — | — | — | ✅ | — | ✅ | — | — |
| `GET /reports/analytics` | — | — | — | — | — | ✅ | — | — | ✅ | — | — |
| `GET /reports/technician-performance/:uid` | — | — | — | — | — | ✅ | — | — | ✅ | — | — |
| `GET /users` | — | — | — | — | — | — | — | ✅ | — | ✅ | — |
| `POST /users` | — | — | — | — | — | — | — | — | — | ✅ | — |
| `PATCH /users/:uid` | — | — | — | — | — | — | — | — | — | ✅ | — |
| `DELETE /users/:uid` | — | — | — | — | — | — | — | — | — | ✅ | — |
| `POST /users/:uid/reset-password` | — | — | — | — | — | — | — | — | — | ✅ | — |
| `GET /catalogs/sedes` | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /catalogs/accessories` | — | — | ✅ | — | — | — | — | — | — | — | ✅ |
| `GET /catalogs/concessionaires` | — | — | ✅ | — | ✅ | — | — | — | — | — | ✅ |
| `GET /catalogs/models` | — | ✅ | — | — | — | — | ✅ | — | ✅ | — | ✅ |
| `POST/DELETE /catalogs/*` | — | — | — | — | — | — | — | — | — | — | ✅ |

---

## 🔑 ENDPOINTS QUE NECESITAN CURL PARA INTEGRAR

Los siguientes endpoints necesitan validación/curl antes de integrar (por tener lógica de negocio compleja o multipart):

### Prioridad ALTA (bloquean flujo principal):

1. **`POST /documentation/:vehicleId`** — multipart con PDFs + clasificación accesorios
   - Es el endpoint más complejo del rol DOCUMENTACION
   - Necesito el curl con ejemplo completo de body

2. **`PATCH /documentation/:vehicleId/transfer`** — Cesión (estado terminal)
   - ¿Acepta multipart para documento de cesión PDF o solo JSON?

3. **`GET /vehicles/stats/by-sede`** — Shape exacta de respuesta para los KPIs del dashboard JEFE
   - ¿Retorna `{ sede, counts: { RECEPCIONADO: N, CERTIFICADO_STOCK: N, ... } }`?

4. **`GET /reports/analytics`** — Shape exacta de respuesta para las gráficas

5. **`POST /auth/login`** — Flujo completo de autenticación Firebase → token → claims
   - Para integrar el `lib/api.ts` con intercept de token correcto

### Prioridad MEDIA (bloquean features secundarias):

6. **`PATCH /service-orders/:id/assign`** — Para cuando el JEFE reasigne técnicos desde web
7. **`GET /appointments`** — Shape exacta de respuesta para el calendario
8. **`POST /users`** — ¿Devuelve el uid del usuario creado en Firebase?

---

## 🏗️ PLAN DE IMPLEMENTACIÓN SUGERIDO

### Fase 1 — Base de integración (sin esta fase, nada funciona)
```
1. lib/api.ts → definir funciones tipadas por módulo
2. Contexto de autenticación → guardar token Firebase, adjuntar en interceptor
3. Hook useVehicles() → GET /vehicles con params
4. Hook useCatalogs() → GET /catalogs/* (sedes, accessories, concessionaires)
```

### Fase 2 — Rol DOCUMENTACION (flujo completo)
```
5. Pantalla Inicio → KPI cards conectadas a GET /vehicles?status=...
6. Pantalla Stock → listar + filtrar + detalle con tabs
7. Pantalla Documentar → formulario multipart + validaciones
8. Pantalla Cambio de Sede → búsqueda + confirm modal
9. Pantalla Cesión → búsqueda + confirm modal + historial cedidos
```

### Fase 3 — Rol JEFE_TALLER (gestión y control)
```
10. Dashboard → conectar stats reales (GET /vehicles/stats/by-sede, GET /reports/analytics)
11. Stock → agregar acciones CRUD (edit, delete, report)
12. Agendamiento → calendario real con POST/PATCH /appointments
13. Reportes → TraceabilityDrawer + generador PDF
14. Gestión Usuarios → CRUD completo
15. Catálogos → CRUD por tab
```

### Fase 4 — Autenticación y Permisos
```
16. Guardar role/sede del token en contexto global
17. Renderizado condicional de acciones y secciones por rol
18. Middleware Next.js para proteger rutas por rol
19. Integrar notificaciones push (GET /users + FCM token)
```

---

## 📌 ESTADO ACTUAL DEL CÓDIGO

| Archivo | Estado |
|---------|--------|
| `lib/api.ts` | ⚠️ Axios base creado, sin funciones de endpoint |
| `app/dashboard/page.tsx` | 🔴 100% mock data (sin llamadas API) |
| `app/dashboard/vehicles/page.tsx` | 🔴 100% mock data |
| `app/dashboard/documentation/page.tsx` | 🔴 UI base sin integrar |
| `app/dashboard/agendamiento/page.tsx` | 🔴 Sin revisar |
| `app/dashboard/reports/page.tsx` | 🔴 Sin revisar |
| `app/dashboard/users/page.tsx` | 🔴 Sin revisar |
| `app/dashboard/settings/page.tsx` | 🔴 Sin revisar |
| `app/dashboard/transfers/page.tsx` | 🔴 Sin revisar |

> **Próximo paso:** Pasame los curls de los endpoints de Prioridad ALTA para comenzar la integración desde `lib/api.ts`.

---

## 🧩 Actualización BI JEFE — Contrato general KPIs

- El dashboard BI de JEFE (`app/dashboard/DashboardBI.tsx`) ya consume `GET /reports/analytics` con contrato tipado desde `lib/api.ts`.
- Mapeo vigente de filtros frontend → API para BI:
  - `dateFrom` y `dateTo` obligatorios (formato `DD/MM/YYYY`).
  - `sede` y `model` opcionales (se omiten cuando están vacíos).
- Semántica aplicada en UI BI:
  - `total` + `byStatus` se muestran como inventario activo.
  - `vehiclesDelivered` y `vehiclesCreatedInPeriod` se muestran como métricas del período.
  - Tasa de entrega = `vehiclesDelivered / vehiclesCreatedInPeriod`.
- La pantalla BI se endureció para payloads parciales: claves opcionales ausentes (`byColor`, `byModelRotation`, etc.) no deben romper render.

# Cursor-first pagination migration

Este documento resume el uso del cliente comun de paginacion cursor-first en frontend.

## API comun reutilizable

Ubicacion: `web/lib/api.ts`

Funciones expuestas:

- `getFirstPage(endpoint, options)`
- `getNextPage(endpoint, nextCursor, options)`
- `fetchAllPagesCursor(endpoint, options)`

`options` soporta:

- `params`: filtros o query params adicionales
- `limit`: tamano de pagina
- `legacyArrayFallback`: compatibilidad para respuestas antiguas en arreglo
- `maxPages`: tope de seguridad de paginas acumuladas (por defecto `50`)
- `onPage`: callback opcional invocado por cada pagina acumulada para progreso/render incremental
- `signal`: `AbortSignal` para cancelar requests en vuelo y evitar race conditions

Ambas funciones retornan shape normalizada:

```ts
{
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextCursor: string | null;
}
```

## Helper reutilizable para acumulacion completa

`fetchAllPagesCursor<T>()` centraliza el patron de acumulacion cursor-first (`getFirstPage` + `getNextPage`) y evita duplicar bucles manuales en pantallas.

Retorna:

```ts
{
  items: T[];
  pagesFetched: number;
  lastPage: PaginatedResponse<T>;
}
```

Ejemplo:

```ts
const { items, pagesFetched, lastPage } = await fetchAllPagesCursor<Vehicle>(
  "/vehicles",
  {
    params: { status: "AGENDADO,LISTO_PARA_ENTREGA" },
    limit: 200,
    maxPages: 50,
  },
);
```

Ejemplo con callback incremental (`onPage`):

```ts
const [rows, setRows] = useState<Vehicle[]>([]);
const [progress, setProgress] = useState({ pagesFetched: 0, loadedCount: 0 });

await fetchAllPagesCursor<Vehicle>("/vehicles", {
  params: { status: "AGENDADO,LISTO_PARA_ENTREGA" },
  limit: 200,
  maxPages: 50,
  onPage: (pageData, meta) => {
    setProgress({ pagesFetched: meta.pageNumber, loadedCount: meta.accumulated });
    setRows((prev) =>
      meta.pageNumber === 1 ? [...pageData.data] : [...prev, ...pageData.data]
    );
  },
});
```

Uso actual del helper:

- `web/app/dashboard/agendamiento/page.tsx` (`fetchAllVehicles`)
- `web/app/dashboard/DashboardCallCenter.tsx` (`fetchCallCenter`)

## Compatibilidad legacy en /appointments

Si backend devuelve `Appointment[]` (array legacy), el cliente lo transforma internamente a:

```ts
{
  data: appointments,
  total: appointments.length,
  page: 1,
  limit: appointments.length,
  totalPages: 1,
  nextCursor: null,
}
```

## Integracion por endpoint

### 1) GET /vehicles

Integrado en `getVehicles` dentro de `web/lib/api.ts`.

- Mantiene firma actual para pantallas existentes (`filters` con `page` y `limit`).
- Internamente usa cursor-first (`getFirstPage` + `getNextPage`) para llegar a la pagina solicitada.

Uso actual (sin cambios en UX):

```ts
const res = await getVehicles({ status: "AGENDADO", page: 2, limit: 20 });
const rows = res.data.data;
```

### 2) GET /vehicles/call-center

Integrado en `getVehiclesCallCenter` dentro de `web/lib/api.ts` y en `web/app/dashboard/DashboardCallCenter.tsx`.

- El dashboard ahora pagina por `nextCursor` en bucle para acumular resultados, en lugar de `totalPages` + `page`.
- Se conserva la misma experiencia de filtros y tabla.

### 3) GET /appointments

Integrado en `getAppointments` dentro de `web/lib/api.ts`.

- Retorna shape paginado normalizado (incluye fallback legacy para array).
- Consumidores actualizados:
  - `web/app/dashboard/agendamiento/page.tsx`
  - `web/app/dashboard/AsesorLiderDashboard.tsx`

Uso:

```ts
const first = await getAppointments({ date: "2026-04-16", limit: 50 });
const items = first.data.data;

if (first.data.nextCursor) {
  const next = await getAppointments({
    date: "2026-04-16",
    limit: 50,
    cursor: first.data.nextCursor,
  });
}
```

## Nota de filtros y cursor

Cada vez que cambian filtros, se debe reiniciar el flujo desde `getFirstPage(...)` para evitar reutilizar cursores anteriores.
Esto ya se aplica en las pantallas migradas al recrear el fetch al cambiar dependencias de filtros.

## Cancelacion con AbortController

Para evitar condiciones de carrera cuando cambian filtros rapidamente:

1. Crear `AbortController` por cada ejecucion de fetch.
2. Abortar el anterior antes de iniciar uno nuevo.
3. Pasar `signal` a `getFirstPage/getNextPage/fetchAllPagesCursor`.
4. Ignorar errores de cancelacion (`AbortError`, `CanceledError`, `ERR_CANCELED`) usando `isRequestAborted(error)`.
5. En cleanup de `useEffect`, abortar request en vuelo.

Ejemplo rapido:

```ts
const controller = new AbortController();
const data = await fetchAllPagesCursor<Vehicle>("/vehicles", {
  params: filters,
  limit: 200,
  signal: controller.signal,
});

// cleanup
controller.abort();
```

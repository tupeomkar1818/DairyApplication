# AI Instructions — Expo Frontend Mockup with Backend-Ready Contracts

## Project Goal

This is an **Expo (React Native)** app targeting **iOS, Android, and Web**. We are building **UI mockups first**, backed by **in-memory storage (AsyncStorage / localStorage)**. Later, the same operations will be swapped out for real backend calls (Next.js API routes or .NET Web API). The architecture must make this swap trivial.

---

## Core Principles

1. **Contract-First Development** — Every module starts by defining its domain contracts (entities, DTOs, enums, validation schemas, and service interfaces) before any UI code is written. These contracts are the **single source of truth** shared between frontend mockup and future backend.

2. **No Redundant Entities** — Before creating any new entity, enum, or type, search the entire `src/domain/` tree for an existing definition. If a concept exists (even partially), extend it — do not duplicate it. Flag any ambiguity to the user.

3. **Dependency Awareness** — When an entity references another (e.g., `Order` references `Customer`), the referenced entity must already exist in `src/domain/` or be created in the same changeset. Never leave dangling references. Document all cross-module dependencies in the module's `index.ts` barrel export.

4. **Validation Colocation** — All validation rules live in `src/domain/<module>/validations.ts` using **Zod schemas**. The same schema is used for form validation on the frontend AND will be mirrored 1:1 in the backend. Never scatter validation logic into components or hooks.

5. **Mockup ≠ Throwaway** — The mockup code is the real app minus the network layer. Component structure, navigation, state management, and domain logic must be production-grade.

---

## Folder Structure

```
src/
├── domain/                         # THE CONTRACT LAYER (backend-portable)
│   ├── shared/                     # Cross-module shared types
│   │   ├── types.ts                # Base types (Id, Timestamp, PaginatedResult, etc.)
│   │   ├── enums.ts                # Shared enums (Status, Role, etc.)
│   │   └── errors.ts               # Domain error codes and types
│   │
│   ├── <module>/                   # e.g., auth/, products/, orders/
│   │   ├── entities.ts             # Core entity interfaces (pure types, no logic)
│   │   ├── dtos.ts                 # Request/Response DTOs (CreateXRequest, XResponse, etc.)
│   │   ├── enums.ts                # Module-specific enums
│   │   ├── validations.ts          # Zod schemas for every DTO and mutation input
│   │   ├── service.interface.ts    # IXService interface — all operations for this module
│   │   ├── service.mock.ts         # In-memory implementation of IXService (AsyncStorage)
│   │   ├── service.api.ts          # (Created later) Real API implementation of IXService
│   │   └── index.ts                # Barrel export + dependency documentation
│   │
│   └── index.ts                    # Top-level barrel exporting all modules
│
├── infrastructure/                 # Non-domain technical concerns
│   ├── storage/                    # AsyncStorage wrapper, storage keys
│   ├── api/                        # (Later) HTTP client, interceptors, auth headers
│   └── service-registry.ts         # Maps interfaces to current implementation (mock vs api)
│
├── hooks/                          # React hooks that consume domain services
│   └── <module>/                   # useProducts(), useCreateOrder(), etc.
│       └── index.ts
│
├── components/                     # Presentational + screen components
│   ├── shared/                     # Reusable UI components
│   └── <module>/                   # Module-specific screens and components
│
├── navigation/                     # Expo Router or React Navigation setup
│
└── app/                            # Expo Router entry points (if using expo-router)
```

---

## Contract File Conventions

### entities.ts
```typescript
// Pure interfaces. No methods, no defaults, no imports from outside domain/.
// Every entity MUST have: id (string), createdAt (string ISO), updatedAt (string ISO).
// Use branded types from shared/types.ts for IDs where possible.

export interface Product {
  id: string;
  name: string;
  categoryId: string;      // FK — references Category.id (from categories module)
  price: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}
```

### dtos.ts
```typescript
// DTOs map to API request/response shapes.
// Create/Update DTOs omit server-generated fields (id, createdAt, updatedAt).
// Response DTOs can extend entity or reshape it.
// ALWAYS define: CreateXRequest, UpdateXRequest, XResponse, XListResponse

export interface CreateProductRequest {
  name: string;
  categoryId: string;
  price: number;
}

export interface UpdateProductRequest {
  name?: string;
  categoryId?: string;
  price?: number;
}

export interface ProductResponse extends Product {}

export interface ProductListResponse {
  items: ProductResponse[];
  total: number;
  page: number;
  pageSize: number;
}
```

### validations.ts
```typescript
// One Zod schema per DTO. Export both the schema and the inferred type.
// Name pattern: <DtoName>Schema
// These MUST match the DTO fields exactly — the Zod schema is the canonical validation.
// When backend is built, these schemas are translated 1:1 to:
//   - .NET: FluentValidation rules
//   - Next.js: Same Zod schemas reused server-side

import { z } from 'zod';

export const CreateProductRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  categoryId: z.string().uuid('Invalid category'),
  price: z.number().positive('Price must be positive'),
});

export const UpdateProductRequestSchema = CreateProductRequestSchema.partial();
```

### service.interface.ts
```typescript
// Pure interface. No implementation details.
// Method signatures map directly to backend API endpoints.
// Comment each method with the intended HTTP method + route.

export interface IProductService {
  /** GET /api/products */
  list(params: { page: number; pageSize: number; search?: string }): Promise<ProductListResponse>;

  /** GET /api/products/:id */
  getById(id: string): Promise<ProductResponse>;

  /** POST /api/products */
  create(data: CreateProductRequest): Promise<ProductResponse>;

  /** PUT /api/products/:id */
  update(id: string, data: UpdateProductRequest): Promise<ProductResponse>;

  /** DELETE /api/products/:id */
  delete(id: string): Promise<void>;
}
```

### service.mock.ts
```typescript
// Implements IXService using AsyncStorage.
// Simulates realistic behavior: generates IDs, timestamps, enforces unique constraints.
// Throws domain errors (from shared/errors.ts), not generic errors.
// Simulates network delay with a configurable artificial delay (default 300ms).

export class ProductServiceMock implements IProductService {
  // ... full implementation using AsyncStorage
}
```

### Environment Configuration

The mock/api toggle is driven by an environment variable, **never a hardcoded constant**.

**.env** (root of project):
```env
# Set to "mock" for in-memory mockup, "api" when backend is ready
EXPO_PUBLIC_SERVICE_MODE=mock

# Base URL for real API (used only when SERVICE_MODE=api)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

- Expo exposes env vars prefixed with `EXPO_PUBLIC_` to the client bundle via `process.env`.
- Add `.env` to `.gitignore`. Commit a `.env.example` with placeholder values so collaborators know which vars are needed.

### service-registry.ts
```typescript
// Central switch between mock and real implementations.
// Reads EXPO_PUBLIC_SERVICE_MODE from .env — "mock" | "api".
// All hooks resolve services through this registry — never import mock/api directly.

import { IProductService } from '@/domain/products/service.interface';
import { ProductServiceMock } from '@/domain/products/service.mock';
// import { ProductServiceApi } from '@/domain/products/service.api';

type ServiceMode = 'mock' | 'api';

const SERVICE_MODE = (process.env.EXPO_PUBLIC_SERVICE_MODE ?? 'mock') as ServiceMode;

function resolveProductService(): IProductService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
      // return new ProductServiceApi();
    case 'mock':
    default:
      return new ProductServiceMock();
  }
}

export const services = {
  products: resolveProductService(),
};
```

---

## Rules for the AI

### When Creating a New Module

1. **Search first**: Grep `src/domain/` for any existing entity or enum that overlaps with the new module. Report findings before proceeding.
2. **Define contracts first**: Create `entities.ts`, `dtos.ts`, `enums.ts`, `validations.ts`, `service.interface.ts` — in that order — before any UI work.
3. **Document dependencies**: In the module's `index.ts`, add a comment block listing all cross-module dependencies (e.g., `// Depends on: categories, users`).
4. **Then implement mock**: Build `service.mock.ts` implementing every method in the interface.
5. **Register the service**: Add the new service to `service-registry.ts`.
6. **Then build UI**: Create hooks, then components, then screens/navigation.

### When Modifying an Existing Module

1. Update contracts first (entities/DTOs/validations), then propagate changes to mock service, then hooks, then UI.
2. If a field is added to an entity, check if any other module references this entity and may be affected.

### Validation Rules

- All user-facing form inputs validate using the Zod schema from `validations.ts`.
- The validation schema is the **single source of truth** — do not add ad-hoc validation in components.
- Validation error messages must be user-friendly and specific (not "Invalid input").
- For cross-field validations (e.g., endDate > startDate), add `.refine()` to the Zod schema.

### Entity Hygiene

- No entity should exist in two places. If `User` is defined in `domain/auth/entities.ts`, other modules import it from there.
- Use `Pick<>`, `Omit<>`, or DTO wrappers when a module only needs a subset of another entity — do not create a parallel lightweight type.
- Enums shared across 2+ modules move to `domain/shared/enums.ts`. Module-specific enums stay in their module.

### Naming Conventions

| Artifact | Pattern | Example |
|---|---|---|
| Entity | PascalCase noun | `Product`, `OrderItem` |
| DTO | `<Action><Entity>Request/Response` | `CreateProductRequest` |
| Zod schema | `<DtoName>Schema` | `CreateProductRequestSchema` |
| Service interface | `I<Entity>Service` | `IProductService` |
| Mock implementation | `<Entity>ServiceMock` | `ProductServiceMock` |
| API implementation | `<Entity>ServiceApi` | `ProductServiceApi` |
| Hook | `use<Action><Entity>` | `useCreateProduct`, `useProducts` |
| Storage key | `SCREAMING_SNAKE` | `PRODUCTS_STORE_KEY` |

### Backend Generation Readiness

The `src/domain/` folder must be self-contained enough that an AI given ONLY that folder can:

1. Generate a full **Next.js API route** or **.NET Controller + Service + Repository** for each module.
2. Generate **backend validation** (FluentValidation / Zod) matching `validations.ts` exactly.
3. Generate **integration tests** for every method in `service.interface.ts`.
4. Generate **database schema / migrations** from `entities.ts`.
5. Generate **API client** (`service.api.ts`) by reading `service.interface.ts` route comments.

To ensure this, every `service.interface.ts` must include:
- HTTP method and route in JSDoc comments
- Clear input/output types (no `any`, no implicit types)
- Error cases documented as JSDoc `@throws` annotations

---

## Tech Stack

- **Framework**: Expo SDK (latest stable) with Expo Router
- **Language**: TypeScript (strict mode)
- **Validation**: Zod
- **State/Data Fetching**: TanStack Query (React Query) for async state, Zustand for client-only state
- **Storage (Mockup Phase)**: AsyncStorage (`@react-native-async-storage/async-storage`)
- **UI Components**: Choose a consistent library (e.g., Tamagui, NativeWind, or React Native Paper) — stick with one
- **Navigation**: Expo Router (file-based routing)

---

## Anti-Patterns to Avoid

- **No inline types in components** — all types come from `domain/`.
- **No business logic in components** — components call hooks, hooks call services.
- **No direct AsyncStorage access outside `service.mock.ts`** — all storage goes through the service layer.
- **No `any` types in the domain layer** — use `unknown` + type guards if truly dynamic.
- **No optional chaining as validation** — if a field can be undefined, the Zod schema and DTO must reflect it.
- **No circular dependencies between modules** — if A depends on B and B depends on A, extract shared types to `domain/shared/`.

---

## Render Performance Rules (prevent browser-hang regressions)

These rules exist because the web build has repeatedly hung on admin screens (Products list, Add Customer dialog, Customer Detail, OTP). Every rule below was violated by at least one real bug.

### R1. Never put an inline array/object literal in a `useEffect` / `useMemo` / `useCallback` dependency array

An inline literal (`['x', id]`, `{ a }`, `() => …`) is a **new reference every render**, so the hook's memoization is defeated — effects re-run, memos recompute, subscriptions tear down and reopen. When such an effect also opens a `BroadcastChannel`, attaches a global listener, or starts a `setInterval`, the main thread saturates and the browser hangs.

- **Do** hoist composite deps with `useMemo`: `const queryKey = useMemo(() => ['x', id] as const, [id]);` then depend on `queryKey`.
- **Do** pass primitive dependencies directly (`[id, qc]`) and let the effect callback close over memoized values.
- **Don't** write `useEffect(() => …, [['x', id]])` or `useEffect(() => …, [{ foo }])`.

### R2. Query hooks that subscribe to external sources (storage, sockets, intervals) must have stable deps

Any hook calling `subscribeStorageKey`, `addEventListener`, or `setInterval` inside `useEffect` MUST have a dep array containing only stable values: primitives, memoized objects, or React Query's `QueryClient` (stable from context). The same rule applies to `refetch`/`mutate` callbacks from TanStack Query — they are stable, but the query object itself (`boy`, `products`) is a new reference every render and must NOT appear in effect deps.

### R3. Shared web side-effects (BroadcastChannel, WebSocket, etc.) must be module-level singletons

Never allocate a `BroadcastChannel` (or similar) inside a hook, an effect, or a callback that runs per-render. Open it once at module scope (`let sharedChannel: BroadcastChannel | null = null;`) and share it across all subscribers. Close it only on full teardown (typically never).

### R4. Do not wrap a `<FlatList>` (or any `VirtualizedList`) in a `<ScrollView>` of the same axis

This disables virtualization on React Native Web, forces every row to render, and on web can trigger a layout-measurement feedback loop that freezes the tab. If you need a sticky header above a list, make the list the scroll container and put the header above it at the same flex level.

### R5. Heavy per-keystroke work must be deferred, not run synchronously

Any `useMemo` whose computation is non-trivial (Zod `safeParse` on a large schema, multi-month billing loops, `.find()` across a 1000-item list, date parsing over each subscription plan) and whose deps include a form state object or a query result **must** wrap those deps with `useDeferredValue`. Typing stays responsive; the heavy pass runs when the main thread is idle. For final correctness (e.g., on Save), recompute synchronously against the current (non-deferred) value in the handler.

Rule of thumb: if the `useMemo` body is longer than ~20 lines or calls a schema validator, defer its inputs.

### R6. No timers faster than the UI update frequency

If the rendered output only changes every second (countdown display, clock), use `setInterval(..., 1000)`. Never `250` or `16` just because "it feels responsive" — each tick is a full React re-render. For animations, use `Animated`/`requestAnimationFrame`, not React state updates.

### R7. No polling with `setInterval` unless TanStack Query's `refetchInterval` can't express it

Prefer `useQuery({ refetchInterval: 5000 })` over `useEffect(() => setInterval(() => qc.invalidateQueries(...)))`. If you must hand-roll an interval, its `useEffect` must follow R2.

### R8. State setters must never be called during render

`if (x) setX(...)` at the top level of a component is a guaranteed re-render loop. Put it inside an event handler, a `useEffect`, or derive the value with `useMemo` instead.

### R9. Validate render hot-paths

Before merging any admin screen change, open Chrome DevTools → Performance, record 5 s of typing in a form or scrolling a list, and confirm the main thread is not saturated by React commits. If it is, one of R1–R8 is being violated.

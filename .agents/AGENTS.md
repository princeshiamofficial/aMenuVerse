# aMenuVerse Project Agent Rules

This file contains workspace-scoped rules and references for AI agents working on this project.

## Engineering Standards

For complete full-stack engineering guidelines — including MySQL connection pooling, database architecture, API design, authentication, validation, UI/UX principles, performance, error handling, testing, and the feature completion checklist — refer to:

> **[ENGINEERING_STANDARDS.md](./ENGINEERING_STANDARDS.md)**

All agents must read and follow the standards in that file before implementing any feature.

## Universal AI Engineering Framework

- **Mission**: Build production-ready software using an inspect → plan → implement → verify workflow.
- **Core Rules**:
  - Never claim success without empirical evidence.
  - Prefer maintainable, secure, scalable solutions.
  - Preserve existing working code and maintain state resilience.
  - Validate all external input and enforce server-side authorization.
  - Run build, lint, typecheck, and tests when available.
  - Report verified, assumed, untested, and blocked items separately.
- **Completion Gate**:
  - Implementation finished & Build succeeds.
  - Relevant tests pass & Documentation updated.
  - Zero critical errors remain.

## Fast Implementation Guidelines

For guidelines on fast start rules, search budgets, minimal file reading, targeted analysis limits, minimal changes, fast CRUD/bug-fix paths, tool call efficiency, and compact final responses, refer to:

> **[AGENTS_FAST.md](./AGENTS_FAST.md)**

## Error Resolution & Prevention Rules

- **Prettier Multiline Object Parameter Formatting Rule**:
  - Always wrap object literal arguments passed inside function calls (e.g. `updateAppearanceAndSync({ ...appearance, menuLayout: layout.id })`) across multiple lines with trailing commas whenever line length exceeds Prettier print width limits to prevent ESLint/Prettier lint syntax errors.
- **Deterministic Multi-Tenant Session Key & Database Isolation Rule**:
  - Always generate unique, deterministic session user IDs and cookies from full email identifiers (e.g. `demo-owner-sultansdine-com` vs `demo-owner-burgercraft-com`) rather than simple role prefix strings (`email.split("@")[0]`) to prevent session user collision across tenants.
  - Ensure all database queries, getter/setter server functions (`getRestaurantProfile`, `getBranchesServer`, `getCategoriesServer`, `getFoodItemsServer`, `getOrdersServer`, `getReservationsServer`, `getPromotionsServer`), and seed scripts enforce explicit `WHERE restaurant_id = ?` filters so data never leaks or overlaps between different restaurant tenants.
- **Tenant Administrative Route & RBAC Access Rule**:
  - Maintain strict 3-tier security for administrative routes:
    1. **Sidebar / Navigation UI (`app-sidebar.tsx`)**: Strictly restrict `/restaurant-profile`, `/branches`, `/categories`, `/food-items`, and `/subscription` to `"Owner"` and `"Super Admin"`. Ensure `manager` cannot access branches, categories, food-items, or subscription.
    2. **TanStack Router Route Guards (`route.tsx`, `restaurant-profile.tsx`, `branches.tsx`, `categories.tsx`, `food-items.tsx`, `subscription.tsx`)**: Enforce `beforeLoad` redirects so managers and non-owner staff are prevented from accessing `/branches`, `/categories`, `/food-items`, and `/subscription` and are redirected to `/dashboard` or their assigned role panels.
    3. **Backend Server Permissions (`permissions.ts`)**: Ensure `"branches:manage"`, `"branch_tables:manage"`, `"categories:manage"`, and `"food_items:manage"` permissions are granted strictly to `owner` and `super_admin`.
- **Branch-Aware Data Isolation & Mapping Rule**:
  - Always map and return `branchId: r.branch_id ? String(r.branch_id) : undefined` in server queries (`getOrdersServer`, `getReservationsServer`, `getPromotionsServer`).
  - When saving orders (e.g. `saveOrderServer`, POS checkout, and table ordering), always store the explicit `branch_id`.
  - In analytics, dashboard views, and order lists, resolve target branch filters across both branch ID (`branch.id`) and branch display name (`branch.name`). For legacy or unassigned records lacking an explicit `branch_id`, safely attribute them to the tenant's primary/default branch (`isDefault: true` or `branches[0]`) so dashboard charts, total revenue, customer count, and live activities always render accurately upon selecting any branch.
- **Authenticated Route Component Scope & Session State Rule**:
  - Always ensure components that reference user properties (such as `currentUser?.branch` or `currentUser?.role`) in JSX markup explicitly declare and populate a React state variable (`const [currentUser, setCurrentUser] = useState(...)`) from `getCurrentUser()`. Never leave session variables undeclared to prevent runtime `ReferenceError: currentUser is not defined` crashes.
- **Role Route Guard Synchronization Rule**:
  - Always ensure `beforeLoad` route guard checks in `_authenticated/route.tsx` mirror the navigation permissions defined in `app-sidebar.tsx`. Never redirect operational roles (e.g. `cashier`, `waiter`, `host`) away from `/dashboard` or authorized operational routes (`/pos`, `/orders`, `/reservations`, `/waiter-panel`), ensuring seamless navigation across all accessible panels.
- **Realistic Skeleton Screen Loading Rule**:
  - Whenever loading asynchronous server function data across admin panels (e.g. `dashboard.tsx`, `orders.tsx`, `pos.tsx`, `reservations.tsx`, `analytics.tsx`, `staff.tsx`, `waiter-panel.tsx`, `kitchen.tsx`, `food-items.tsx`, `categories.tsx`, `branches.tsx`), always render dedicated responsive skeleton layout screens (`<SkeletonDashboard />`, `<SkeletonOrdersPage />`, `<SkeletonPOSPage />`, etc.) while `loading` or `!hydrated`. Never return `null`, empty screens, or basic spinners.
- **Server-Side Data Filtering & Database Parameterization Rule**:
  - Always enforce that all primary search, category, status, type, branch, and date range filtering logic is executed on the backend server via TanStack Start `createServerFn` handlers with parameterized MySQL `WHERE` clauses. Client route components must pass their active filter states directly in server query payloads `{ data: { ... } }` and debounce input changes, preventing unbounded database reads and guaranteeing authoritative multi-tenant data scoping.
- **Hook Dependency & Scope Declaration Ordering Rule**:
  - Always declare custom hook variables, computed properties, and role context values (e.g. `userRole`, `isGlobalOwner`, `isStaffScoped`, `staffBranchName`) lexically BEFORE any `useEffect` or `useMemo` hooks that include them in their dependency arrays. Never reference variables before their initialization to avoid TypeScript TDZ (Temporal Dead Zone) and hoisting errors (`TS2448`/`TS2454`).
- **Mandatory Customer Name & Phone Checkout Validation Rule**:
  - Always enforce required customer name (`customerName.trim().length > 0`) and contact phone number (`phone.trim().length > 0`) validation both in client cart/checkout drawers and in server mutations (`placeOrderAction`). Store customer details with sanitized SQL parameters in `pos_orders` (`customer_name`, `phone`) so kitchen display systems, order lists, receipts, and waiter calls always identify the specific ordering guest.
- **Unconditional Server Mutation & Resilient Cart Serialization Rule**:
  - Never retain mock or early-return condition branches (e.g. `if (typeof restaurant.id === "number") return;`) in client order submission handlers. All customer orders must unconditionally execute `placeOrderAction` on the backend server, serialize line item properties (`itemId`, `name`, `qty`, `quantity`, `price`, `unitPrice`, `total`) cleanly for MySQL `lines_json`, and map fallbacks in `getOrdersServer` so customer orders immediately show across all panels (Orders, POS, Kitchen, Waiter, and Customer History).
- **Localized In-Place Skeleton Loading Rule**:
  - Render targeted in-place skeleton placeholders (`<Skeleton className="..." />`) inside individual data slots (such as stat card numeric values, chart containers, and activity rows) rather than blanking out or replacing entire page layouts. Pass `isLoading={loading || isFiltering}` directly to data widgets so UI header frames, filters, and cards remain stable and visible without layout shift or page flickering.
- **Real-Time Multi-Tenant Event Streaming & Audio Alert Rule**:
  - Always broadcast mutations (`saveOrderServer`, `updateOrderStatusServer`, `deleteOrderServer`, `createWaiterRequestServer`, `updateWaiterRequestServer`) via `broadcastRealtimeEvent(...)` in `src/lib/realtime.server.ts` through the persistent `/api/realtime` stream.
  - Enforce tenant and branch room isolation (`client.restaurantId === event.restaurantId && client.branchId === event.branchId`) so real-time events never leak across tenants or unrelated branches.
- **Dual Subdomain & Path-Based Encrypted Table Route Rule**:
  - Always maintain dual route handlers for table QR tokens: `src/routes/e.$token.tsx` (for subdomain access e.g. `http://burgercraft.localhost:8080/e/:token`) and `src/routes/$restaurantUsername.e.$token.tsx` (for direct IP or path-based access e.g. `http://192.168.10.115:8082/:restaurantUsername/e/:token`). Both routes must extract and decode table tokens with `decodeTableToken` and render `PublicRestaurantView` with the decoded `tableNumber` and `branchId` to prevent 404 Not Found errors on mobile LAN scanning.
- **Self Profile Avatar Permission Bypass Rule**:
  - Always allow authenticated staff members (Chef, Waiter, Cashier, Host, Manager, Owner) to update their OWN profile avatar picture without requiring administrative `staff:manage` permission. In `updateStaffAvatarServer`, verify `const isSelf = authUser.id === data.id || authUser.email === data.id` before enforcing `staff:manage` permissions.
- **Authoritative Direct Image URL Architecture Standard**:
  - All images across database, server functions, and client UI components must use standard authoritative CDN/HTTP/HTTPS or data URLs directly without local blob URL conversions. Never store ephemeral `blob:` URLs in the database to guarantee cross-device, mobile, and LAN network reliability.
- **Optional Object Property String Method Safety Rule**:
  - When querying or filtering items with optional metadata properties (e.g. `address`, `manager`, `phone` on `Branch`), always use safe fallbacks `(b.prop || "").toLowerCase().includes(...)` before executing string prototype methods to prevent TypeScript `TS2532: Object is possibly undefined` errors.
- **Valid ESLint Directives & Prettier Code Cleanliness Standard**:
  - Do not use non-existent or obsolete ESLint rule directives (e.g. `@typescript-eslint/no-require-imports`) in Node.js helper scripts. Run `npx prettier --write` and `npx eslint --fix` to ensure zero linter errors and uniform LF formatting across utility scripts.
- **Zero-Fallback Strict DB Data & Resolution Standard**:
  - No server function or public menu resolution logic (`getRestaurantData`, `getRestaurantProfile`, `getCategoriesServer`, `getFoodItemsServer`, `getBranchesServer`, `getUserAssignedBranches`) may inject or fall back to mock data structures (`baseRestaurant.categories`, `baseRestaurant.menuItems`, `DEFAULT_BRANCHES_MAP`) when database queries return zero rows. If a tenant has 0 categories, 0 items, or 0 branches in MySQL, the functions must strictly return empty arrays `[]` or `null`. Unregistered/non-existent slugs must return `null` and immediately render the 404 Restaurant Not Found view without rendering dummy tenant data.
- **TanStack Start Server Function Parameter Payload Standard**:
  - Always wrap all validator-backed `createServerFn` calls with `{ data: {} }` or `{ data: { ... } }` on client components (e.g. `getOrdersServer({ data: {} })`, `getBranchesServer({ data: {} })`, `getCategoriesServer({ data: {} })`, `getFoodItemsServer({ data: {} })`, `getPromotionsServer({ data: {} })`, `getReservationsServer({ data: {} })`, `getStaffServer({ data: {} })`). Never invoke validator-backed server functions without the `{ data: ... }` wrapper to prevent empty array returns or runtime validation rejections.
- **MySQL utf8mb4 4-Byte Emoji Support Standard**:
  - Always configure `charset: "utf8mb4"` in connection pool options (`mysql.ts` and `db.ts`) and execute `ALTER TABLE table_name CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` across all tables holding user text, emojis, icons, and food names to prevent 4-byte UTF-8 emoji truncation or `ER_TRUNCATED_WRONG_VALUE_FOR_FIELD` errors.

---

## 🚫 Zero-localStorage Rule — MySQL-First Persistence (Production Mandate)

> **This is a hard production requirement. No exceptions.**

### The Problem with localStorage

`localStorage` is a browser-only, per-device, ephemeral key-value store. It was used in early development for convenience, but it is **completely unsuitable for production** for the following reasons:

| localStorage Problem             | Real-World Impact                                                 |
| -------------------------------- | ----------------------------------------------------------------- |
| Per-browser storage              | Staff on POS tablet sees different data than manager on desktop   |
| Lost on incognito / private mode | No data visible to guest sessions                                 |
| Lost on `localStorage.clear()`   | Silent data deletion by browser or user                           |
| Not shared across devices        | Branch tables created on PC never appear on phone or tablet       |
| No backup or recovery            | Data disappears forever on browser reinstall                      |
| No multi-user consistency        | Two staff members create conflicting records simultaneously       |
| Cannot be audited or queried     | No reporting, analytics, or admin visibility                      |
| Fails in production deployment   | Vercel / Railway / Docker deployments have no shared localStorage |

### The Rule

**Every piece of data that the admin creates, edits, or configures MUST be persisted in MySQL via a TanStack Start server function. `localStorage` and disk-cache JSON files must NEVER be the primary source of truth for any feature.**

This applies to ALL of the following (and anything similar):

- Branches (`menuverse:branches`)
- Branch tables (`menuverse:branch-tables:{id}`)
- Categories (`menuverse:categories`)
- Food items (`menuverse:food-items`)
- Staff / user accounts (`menuverse:staff`)
- Orders (`menuverse:orders`)
- Restaurant profile (`menuverse:restaurant-profile`)
- Promotions, reservations, analytics data

### Required Implementation Pattern

Every data entity must follow this exact pattern:

```ts
// 1. SERVER FUNCTION — in src/lib/db-queries.server.ts
export const getEntityServer = createServerFn().handler(async () => {
  const rows = await query("SELECT * FROM entity_table ORDER BY created_at DESC");
  return rows;
});

export const saveEntityServer = createServerFn()
  .validator(z.object({ data: z.array(EntitySchema) }))
  .handler(async ({ data }) => {
    // upsert into MySQL
  });

// 2. REACT COMPONENT — useEffect on mount, reads from MySQL
useEffect(() => {
  async function load() {
    try {
      const rows = await getEntityServer();
      setData(rows);
    } catch {
      setData([]); // safe fallback, never localStorage
    }
  }
  load();
}, []);

// 3. SAVE — always writes to MySQL, never to localStorage
async function save(updated) {
  await saveEntityServer({ data: updated });
  setData(updated);
}
```

### localStorage is Allowed ONLY for UI State (Non-Data)

`localStorage` may ONLY be used for **transient UI preferences** that have zero data integrity requirements, for example:

- Sidebar collapsed/expanded state
- Dark/light mode preference (if not stored in DB)
- Last selected tab or filter in a session

It must NEVER be used for anything the user creates, configures, or expects to persist reliably.

### Migration Priority

The following features still use localStorage and must be migrated to MySQL before production deployment:

- [ ] **Branch tables** — `menuverse:branch-tables:{branchId}` → MySQL `branch_tables` table
- [ ] **Food items** — `menuverse:food-items` → already partially in MySQL, ensure full migration
- [ ] **Categories** — `menuverse:categories` → already partially in MySQL, ensure full migration
- [ ] **Orders** — `menuverse:orders` → MySQL `orders` table
- [ ] **Staff** — `menuverse:staff` → MySQL `users` table
- [ ] **Promotions** — `menuverse:promotions` → MySQL `promotions` table
- [ ] **Restaurant profile** — `menuverse:restaurant-profile` + `profile-data-cache.json` → MySQL `restaurant_profiles` table (already partially done)

### Agent Instruction

- **NEVER write `localStorage.setItem(...)` or `readJSON(...)` for any admin-created data.**
- **ALWAYS create a MySQL table, a `createServerFn()` getter, and a `createServerFn()` setter for every new feature.**
- When fixing or adding any feature that currently uses localStorage, migrate it to MySQL as part of the same task.
- If a server function fails, show a user-facing error toast — **do not silently fall back to localStorage**.

---

## ⚡ Everything Claude Code Toolkit Integration

This workspace includes integrated components from the **Everything Claude Code** framework:

- **Subagents (`.agents/agents/`)**: Specialized subagents (`planner`, `architect`, `tdd-guide`, `code-reviewer`, `security-reviewer`, `build-error-resolver`, `e2e-runner`, `refactor-cleaner`, `doc-updater`).
- **Skills (`.agents/skills/`)**: Modular domain skills (`backend-patterns`, `frontend-patterns`, `coding-standards`, `continuous-learning`, `eval-harness`, `security-review`, `strategic-compact`, `tdd-workflow`, `verification-loop`).
- **Commands (`.agents/commands/`)**: Custom commands (`/tdd`, `/plan`, `/build-fix`, `/code-review`, `/e2e`, `/eval`, `/learn`, `/orchestrate`, `/verify`, `/setup-pm`).
- **Hooks & Scripts (`.agents/hooks/`, `.agents/scripts/`)**: Node.js cross-platform scripts and hooks for package manager detection and workflow execution.

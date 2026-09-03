# AGENTS.md

<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

Welcome to the **aMenuVerse** repository.

## Repository Overview

- **Framework**: TanStack Router + Vite (React)
- **Database**: MySQL / Supabase
- **Styling**: Tailwind CSS & Radix UI

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

## Interaction Guidelines

- **Premium UI**: Always prioritize high-end design. Use Radix UI components, Framer Motion transitions, and curated color palettes.
- **Banglish Summary**: Provide a concise summary of the work performed in **Banglish** (Bengali written in Latin/English script) after completing each task. **NEVER use direct Bengali Unicode characters (e.g., বাংলা)** — always write Bengali phonetically in English letters only (e.g., "Ami kaj shesh korlam").
- **Summary of Actions**: After the Banglish summary, provide a clear, bulleted "Summary of Actions" in English detailing specific technical steps taken.
- **Benefit Comparison Table**: Always provide a comparison table in **Banglish** (using Latin/English script, never Unicode Bengali) showing the **Previous State/Implementation** vs. the **Recent State/Benefits** of your changes at the end of each task.
- **Automatic Error-Fix Rule Recording**: Whenever an error, bug, or issue is resolved during a task, immediately document and append the exact resolution pattern & prevention rule to `AGENTS.md`.

---

## Code Quality & Zero-Error Standards

### 1. Code Quality & Formatting Standards

- **Strict Prettier & ESLint Formatting**:
  - Surround Markdown headings and lists with blank lines (`MD022` and `MD032`).
  - Declare variables with `const` unless reassigned (`prefer-const`).
  - Never leave double blank lines anywhere in TypeScript/TSX files.
  - Wrap long string properties, function parameters, state updaters, and JSX `cn(...)` calls across newlines per Prettier rules.
  - Include trailing commas in multiline objects, arrays, parameter lists, and arrow function calls.
  - Omit unnecessary quotes on valid identifier keys (e.g., `$: "..."` instead of `"$": "..."`).
  - Keep short inline ternary return expressions on a single line.
  - Format JSX multiline attributes with each attribute on its own indented line.

### 2. Security, RBAC & Multi-Tenant Isolation Standards

- **Official SaaS & Restaurant Role Architecture**:
  - Distinction between global SaaS role (`"Super Admin"`) and 6 official tenant roles: `"Owner"` (Tenant Admin), `"Manager"` (Branch Operations), `"Cashier"` (POS Billing), `"Chef"` (KDS), `"Waiter"` (Table Service), and `"Host"` (Reservations).
- **3-Tier RBAC Access**:
  1. Navigation UI (`app-sidebar.tsx`): Restrict `/restaurant-profile`, `/branches`, `/categories`, `/food-items`, `/subscription` to `"Owner"` and `"Super Admin"`.
  2. Route Guards (`route.tsx`, individual routes): Enforce `beforeLoad` redirects for unauthorized roles.
  3. Backend Permissions (`permissions.ts`): Enforce server-level authorization checks.
- **Role Route Guard Synchronization**: Ensure `beforeLoad` checks in `_authenticated/route.tsx` mirror permissions in `app-sidebar.tsx`.
- **Multi-Tenant Session & DB Isolation**:
  - Generate session user IDs from full email identifiers (`demo-owner-sultansdine-com`).
  - Enforce explicit `WHERE restaurant_id = ?` filters across all server queries.
- **Upload Endpoint Security**: Protect upload endpoints (`uploadToImgBBServer`) with authentication, size limit (<5MB), and MIME verification (`jpeg`, `png`, `webp`, `gif`, `svg+xml`).
- **Public Order Subscription Limits**: Use `getPublicTenantOrderLimits(restaurantId)` in anonymous guest checkout actions (`placeOrderAction`) without requiring session context.

### 3. Database & Server Functions Standards (Zero-localStorage Mandate)

- **MySQL-First Persistence**: Every admin-created item (branches, categories, food items, staff, orders, profile, promotions) MUST be persisted in MySQL via TanStack Start server functions (`createServerFn`). `localStorage` is allowed ONLY for non-data UI preferences (e.g., sidebar collapsed state).
- **Server-Side Order Price Recalculation & ACID Transactions**: Recalculate item subtotal/total prices server-side using authoritative unit prices from MySQL `food_items`. Wrap order creation (`orders`/`pos_orders`) and details (`order_items`) inside a single database transaction.
- **Central DDL Schema Initialization**: Keep `CREATE TABLE IF NOT EXISTS` and DDL statements inside `ensureAllTablesExist()` in `src/lib/mysql.ts`.
- **Branch-Aware Data Mapping & Default Branch Enforcement**: Always include `branch_id` in queries and mutations. Enforce at least one default branch (`is_default = 1`), automatically promoting the first branch if unassigned.
- **Server-Side Data Filtering & Parameterization**: Execute search, category, status, branch, and date range filtering via server function parameterized `WHERE` clauses.
- **TanStack Start Client Call Wrapping**: Always wrap server function call parameters in `{ data: { ... } }` on client routes.

### 4. UI/UX & Component Engineering Standards

- **Tailwind Utility Standards**: Prefer standard Tailwind CSS utility classes over arbitrary brackets (`min-w-32.5` over `min-w-[130px]`).
- **Widescreen Banners**: Render cover photo banners full-width (`w-full object-cover object-center` / `w-full h-56 sm:h-72 md:h-80 bg-cover bg-center`).
- **Vector SVG Badges & Headers**: Render logo avatars and promotional badges using 2-in-1 integrated vector SVG containers with radial gradients and Playfair Display serif fonts.
- **PageHeader Component Actions Prop**: Pass header action buttons via `actions={<Button>...</Button>}` prop rather than JSX children.
- **Standalone Toolbars**: Render top page toolbars in standalone flex containers (`<div className="flex flex-wrap items-center justify-between gap-3">`) outside table card containers.
- **Font Preview Override**: Use dedicated preview selectors `[data-font-preview="..."] { font-family: ... !important; }` inside font picker components.
- **Realistic & Localized Skeleton Loading**: Render responsive full-page skeleton screens (`<SkeletonDashboard />`, `<SkeletonOrdersPage />`) during initial load, and targeted in-place skeleton elements (`<Skeleton className="..." />`) during filtering.

### 5. Thermal Receipt Printing & Barcode Standards

- **Thermal Print Styles & Preview**: Pass dedicated thermal print CSS through `useReactToPrint({ pageStyle })` and sync with the `@media print` fallback block inside receipt dialogs.
- **Print Style Scope Retention**: Always ensure `printPageStyle` and `handleReactToPrint` remain declared within `PrintReceiptDialog` and receipt modal components when refactoring or updating props to prevent runtime `ReferenceError: printPageStyle is not defined` crashes.
- **Dialog Early Null Guard Rule**: Always place `if (!order) return null;` immediately before the dialog's JSX return statement in receipt and details dialogs to prevent runtime `TypeError: Cannot read properties of null (reading 'createdAt')` crashes when dialogs are in an inactive/closed state.
- **Reference-Matched Card Print**: Preserve dashed rounded card borders, shadows, `* qty` markers, bullet date separators, and total colors in print output.
- **Barcode Standards**: Use complete Code39 character maps or dense Code128-B SVG bars (`preserveAspectRatio="none"`). Render shared barcode image sources (`<img>` SVG URI) identically in preview and print.
- **Full-Page Centered Print Canvas**: Keep print canvas body at full page width (`width: 100%`) and center fixed 80mm receipt cards.

### 6. TypeScript & Component Scope Standards

- **React Fast Refresh Rules**: Extract non-component async helper functions and constants out of TSX route files into dedicated library modules (e.g. `src/lib/public-menu.ts`).
- **Session State Declaration**: Explicitly declare and initialize user session state (`const [currentUser, setCurrentUser] = useState(...)`) in components referencing user properties.
- **Hook Dependency & TDZ Safety**: Declare custom hook variables and role context lexically BEFORE any `useEffect` or `useMemo` hooks referencing them.
- **Strict Property Typing**: Define optional properties on TypeScript interfaces instead of using `as any` type assertions.
- **Explicit Return Types**: Provide explicit return type annotations on helper functions returning object literal structures.
- **Customer Checkout Validation & Unconditional Server Mutations**: Enforce non-empty `customerName` and `phone` validation. Unconditionally execute `placeOrderAction` on the backend server for all checkout submissions.
- **Table Badge Component SSR Resilience**: Fully define, export, and type SVG icon badge components to prevent Rolldown/Vite SSR bundling 500 errors on public menu pages.
- **Self Profile Avatar Permission Bypass Rule**: Always allow authenticated staff members (Chef, Waiter, Cashier, Host, Manager, Owner) to update their OWN profile avatar picture without requiring administrative `staff:manage` permission. In `updateStaffAvatarServer`, check `const isSelf = authUser.id === data.id || authUser.email === data.id` before enforcing `staff:manage` permissions.
- **Authoritative Direct Image URL Architecture Standard**: All images across database, server functions, and client UI components must use standard authoritative CDN/HTTP/HTTPS or data URLs directly without local blob URL conversions. Never store ephemeral `blob:` URLs in the database to guarantee cross-device, mobile, and LAN network reliability.

- **Strict Branch-Based Access Control Standard**: Non-admin users (`manager`, `cashier`, `chef`, `waiter`, `host`) must only see and interact with their assigned branches. All server functions (`getBranchesServer`, `getOrdersServer`, `getOrderStatusCountsServer`, `getReservationsServer`, `getBranchTablesServer`, `getStaffServer`, `getPromotionsServer`) must evaluate assigned branches using `getUserAssignedBranches(tenant)` and reject unassigned branch filter requests returning empty sets with zero data leaks. If a user has 0 assigned branches, return an empty list; if 1 assigned branch, lock to that branch; if multiple assigned branches, show only those branches; global admins (`super_admin`, `owner`) retain full multi-branch visibility.

### 7. Real-Time Streaming & Subdomain Routing Standards

- **Real-Time Event Streaming**: Broadcast mutations (`placeOrderAction`, `saveOrderServer`, `updateOrderStatusServer`, etc.) via `broadcastRealtimeEvent(...)` over `/api/realtime` with strict tenant/branch room isolation and Web Audio chime triggers.
- **Dual Subdomain & Path-Based Encrypted Table Routing**: Maintain dual route handlers for table QR tokens (`e.$token.tsx` and `$restaurantUsername.e.$token.tsx`).
- **Path-Based Token Decoding**: Decode table tokens with `decodeTableToken(token)` to extract `tableNumber` and `branchId` for order placement.
- **Waiter Panel Branch Scoping & Order Association Standard**: All waiter panel server functions (`getWaiterRequestsServer`, `getWaiterRequestHistoryServer`, `getWaiterActiveOrdersServer`) must resolve branch queries using `resolveBranchIdentifiers(tenant.restaurantId, targetBranch)` and explicitly return `branchId: r.branch_id ? String(r.branch_id) : undefined`. Client modal forms (`OrderModal`, `openNewOrder`) must bind the active `branchId` to all placed dine-in orders and format all prices using the database-configured currency.
- **Optional Object Property String Method Safety Rule**: When querying or filtering items with optional metadata properties (e.g. `address`, `manager`, `phone` on `Branch`), always use safe fallbacks `(b.prop || "").toLowerCase().includes(...)` before executing string prototype methods to prevent TypeScript `TS2532: Object is possibly undefined` errors.
- **Valid ESLint Directives & Prettier Code Cleanliness Standard**: Do not use non-existent or obsolete ESLint rule directives (e.g. `@typescript-eslint/no-require-imports`) in Node.js helper scripts. Run `npx prettier --write` and `npx eslint --fix` to ensure zero linter errors and uniform LF formatting across utility scripts.
- **Default Tenant Resolution & Fallback Isolation Rule**: When resolving public restaurant menus by slug or username (e.g. `/menuverse`), `resolvePublicRestaurant` must search both MySQL DB and static `RESTAURANTS` data. If an unseeded or custom slug is requested, server resolution must return `{ restaurantId: 0, slug: target }` instead of hardcoding a fallback to restaurantId 1 (`burgercraftlab`). Additionally, `fetchPublicMenu` must verify `dbProfile.slug` alignment before overwriting public restaurant branding names.
- **Zero-Fallback Strict DB Data & Resolution Standard**: No server function or public menu resolution logic (`getRestaurantData`, `getRestaurantProfile`, `getCategoriesServer`, `getFoodItemsServer`, `getBranchesServer`, `getUserAssignedBranches`) may inject or fall back to mock data structures (`baseRestaurant.categories`, `baseRestaurant.menuItems`, `DEFAULT_BRANCHES_MAP`) when database queries return zero rows. If a tenant has 0 categories, 0 items, or 0 branches in MySQL, the functions must strictly return empty arrays `[]` or `null`. Unregistered/non-existent slugs must return `null` and immediately render the 404 Restaurant Not Found view without rendering dummy tenant data.

### 8. Deployment Docs & Secrets Management Standards

- **No Plaintext Credentials in Committed Scripts**: Never hardcode SSH passwords, MySQL passwords, or JWT/session secrets in tracked files. The `scripts/deploy-*.js` helpers must read every credential from `process.env.*` (loaded from the git-ignored `.env`), never inline literals. If a secret is ever committed, treat it as compromised and rotate it — git history retains it even after the file is edited.
- **Deployment Doc ↔ Code Sync Standard**: Keep `DEPLOY.md` aligned with the real codebase. DB helper scripts live in `scripts/` (e.g. `node scripts/init-db.js`, `node scripts/create-admin.js`, `node scripts/seed.js`), **not** the repo root. The production process runs the Nitro build `.output/server/index.mjs` via `ecosystem.config.cjs` (PM2 app `amenuverse`, port `3000`). Env keys are `MYSQL_*`, `JWT_SECRET`/`VITE_JWT_SECRET`, optional `REDIS_URL`, and optional `BRIGHTDATA_API_KEY`/`VITE_BRIGHTDATA_API_KEY`. MySQL tables auto-create on boot via `ensureAllTablesExist()` in `src/lib/mysql.ts`, so a fresh deploy only needs an empty database plus credentials.
- **Seeder Env-File Consistency**: `scripts/seed.js` reads only `.env.local`, whereas `scripts/init-db.js` and `scripts/create-admin.js` read both `.env` and `.env.local`. When documenting or running seeding, account for this difference (create a `.env.local` for `seed.js`), and change or remove the demo `password123` accounts from `create-admin.js` before production.
- **TanStack Start Server Function Parameter Payload Standard**: Always wrap all validator-backed `createServerFn` calls with `{ data: {} }` or `{ data: { ... } }` on client components (e.g. `getOrdersServer({ data: {} })`, `getBranchesServer({ data: {} })`, `getCategoriesServer({ data: {} })`, `getFoodItemsServer({ data: {} })`, `getPromotionsServer({ data: {} })`, `getReservationsServer({ data: {} })`, `getStaffServer({ data: {} })`). Never invoke validator-backed server functions without the `{ data: ... }` wrapper to prevent empty array returns or runtime validation rejections.
- **Next.js App Router Server Actions & Route Standardization**: All backend mutations and database queries must use `"use server";` server files with asynchronous server action functions or route handlers. Pure calculation utilities (e.g. `resolvePlanLimits`) must reside in dedicated helper modules (`plan-limits.ts`) to avoid Next.js synchronous export compile errors. Global CSS and UI providers (`ThemeProvider`, `Toaster`) must wrap root layouts (`src/app/layout.tsx`).
- **Next.js Server Actions Pure Async Export Mandate**: Files marked with `"use server";` must ONLY export asynchronous function definitions. Never export plain objects, module variables, or constants (e.g. `export const LIVE_PROFILE_STORES = {}`), nor re-export type aliases (`export type { ... }`) from `"use server"` files. Keep module-level caches/variables private (`const LIVE_PROFILE_STORES = {}`) and store shared data types in non-server library modules to prevent Next.js runtime `A "use server" file can only export async functions, found object` errors.
- **Next.js Static Asset Image Import Rule**: When importing static image assets (e.g. `import authBg from "@/assets/auth-bg.jpg"`) in Next.js, the imported module is a `StaticImageData` object containing `{ src, height, width }`. Never interpolate raw image objects inside CSS template strings (e.g. ``style={{ backgroundImage: `url(${authBg})` }}``) because it evaluates to `url([object Object])` and fails to render. Use Next.js `<Image src={authBg} alt="..." fill priority />` or explicitly access `authBg.src`.
- **Next.js Page Component Default Export Rule**: Next.js App Router route files (`page.tsx`) must strictly export the primary page React component as `export default function PageComponent()`. Never export helper sub-components or utility badge functions (e.g. `export default function getRoleBadge`) as default exports, which breaks page rendering and causes Next.js runtime type/parameter mismatch errors.
- **API Endpoint Authentication & Anti-SSRF Standard**: All HTTP route handlers (`/api/push/test`, `/api/push/subscribe`, `/api/realtime`, `/api/image-proxy`) must enforce strict server session authentication (`verifySession()`), RBAC role checks, user-level rate limiting, and private IP / loopback blocking (preventing SSRF). All external third-party API keys (e.g., ImgBB) must remain strictly on the backend server and never be exposed in client code via `NEXT_PUBLIC_` prefixes.
- **Unique Key & Join Deduplication Standard**: When querying user accounts or multi-role relations that join `user_roles` or 1-to-many tables in SQL, group joined subqueries (`GROUP BY user_id`) and deduplicate rows in backend server functions (`getAdminUsersServer`). In client React components, deduplicate memoized collections and provide unique, composite, or index-backed `key` props (e.g. `key={u.id ? (u.id + '-' + idx) : ...}`) on `<TableRow>` and mapped elements to prevent React duplicate key runtime warnings and hydration glitches.
- **Next.js Subdomain Multi-Tenant Routing Standard**: Use `src/middleware.ts` to inspect incoming request host headers and rewrite subdomain requests (e.g. `bellapizza.localhost:3000/bd76cb40/5a26a9ca` → `/bellapizza/bd76cb40/5a26a9ca` and `bellapizza.localhost:3000/` → `/bellapizza`). Preserve app/admin/auth/dashboard route prefixes without rewriting, enabling seamless dining table QR scanning, public tenant menus, and administrative dashboards across subdomains and multi-tenant custom domains without 404 Not Found routing errors.
- **Singleton Push Notification Listener & Toast Deduplication Standard**: Enforce a global reference-counted singleton pattern (`setupPushNotificationListener`) with unique toast `id` tags (`realtime-order-${id}`, `order-${id}`) and time-window deduplication caches (`PROCESSED_NOTIFICATION_KEYS`) to prevent duplicate Web Push / SSE toast notifications from stacking on client screens.
- **Direct Server Functions & Zero REST Endpoint Standard**: Never call unhandled REST `/api/branch-tables`, `/api/orders`, `/api/settings`, or `/api/reservations` on client routes. Always invoke authoritative TanStack Start / Next.js server functions directly (`validateTableQrServer`, `getPublicOrderStatusesServer`, `getSettingsServer`, `getReservationsServer`, `getBranchTablesServer`, `getPromotionsServer`) with `{ data: ... }` parameters to prevent 404 network errors in the browser console.
- **Branch Table Persistence & Auto-Sync Prevention Standard**: Do not invoke global background synchronization mutations (`updateBranchesServer`) inside unmonitored component mount or search `useEffect` hooks. Branch mutations must strictly execute upon explicit user actions (modal submit, delete, set default). In `getBranchTablesServer` and `saveBranchTablesServer`, always resolve and query across all branch alias identifiers (`resolveBranchIdentifiers`) scoped to the authoritative `restaurant_id` to guarantee zero table loss across page reloads and branch rename operations.
- **Strict Multi-Branch Room Isolation Standard**: Prohibit wildcard branch matching (e.g. `clientBranch === "main branch"`) in real-time streaming hubs (`realtime.server.ts`) and database helper queries (`resolveBranchIdentifiers`). Enforce exact branch ID matching across real-time events, order placement, staff, reservations, and waiter requests to guarantee zero data leakage between branches.
- **Web Audio Concurrency & Event Listener Thread-Safety Standard**: Never attach high-frequency event listeners (such as `mousemove`, `pointermove`, or `scroll`) to trigger heavy Web Audio context operations, file fetches, or `ctx.decodeAudioData` decodes. Audio preload functions (`loadSoundWavBuffer`) must enforce an in-flight concurrency lock (`let isSoundLoading = false`) and user gesture unlock handlers must use `{ once: true }` or low-frequency interaction events (`click`, `keydown`, `touchstart`) to prevent flooding the JavaScript microtask queue and causing Chrome "Pages Unresponsive" browser thread freezing.
- **Runtime DDL Prevention & Client Route Timeout Safety Standard**: Never execute DDL SQL statements (`ALTER TABLE`, `CREATE TABLE`) inside request-time server functions (such as `validateTableQrServer`, `getCategoriesServer`, or public menu endpoints). Runtime DDL operations acquire exclusive MySQL metadata locks that block concurrent database transactions. In addition, all public table QR route components (`[branchId]/[tableId]/page.tsx`, `e/[token]/page.tsx`) must enforce an asynchronous mount guard (`isMounted`) and an automatic fallback safety timer (`setTimeout(..., 3500)`) so the client never stays stuck indefinitely on skeleton loading screens if a network request hangs.
- **Skeleton Lock Elimination & Deterministic Initial Shell Standard**: Never gate client table QR or public menu routes on raw unconditional `if (loading) return <Skeleton />`. Always check for the presence of the restaurant data (`if (loading && !restaurantData)`). Client route components must initialize a deterministic base restaurant state immediately from URL pathname segments (`usePathname().split("/")`) so that `PublicRestaurantView` mounts instantly. Table verification mutations (`validateTableQrServer`) and background fresh menu fetches (`fetchPublicMenu`) must run concurrently via `Promise.allSettled` without blocking the initial menu render or trapping the user on infinite full-page skeletons.
- **Head Mutation Observer Prohibition Standard**: Never attach a MutationObserver to observe attributes or children on `document.head` and simultaneously mutate `document.head` (such as appending link elements or modifying `link.href`). This creates an infinite, recursive DOM mutation loop that saturates the JavaScript microtask queue at 100% CPU and triggers the browser's "Page Unresponsive" renderer thread freeze. Document title and favicon updates must be direct, conditional mutations without observer loops.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

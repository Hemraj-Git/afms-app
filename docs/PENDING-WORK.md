# AFMS — Pending Work

What is **not** done yet, as of 21 Sep 2026 (branch `feat/demo-fixes`, on top of `main` @ `2e61333`).
Nothing here blocks the client demo; see `TEST-CHECKLIST.md` for what *is* built and how to check it,
and `YOUR-ACTIONS.md` for what has to be done on the Supabase / Vercel side.

Priority: **H** = do soon, **M** = next release, **L** = later / optional.

---

## 1. Interface and forms (Phase 5, the part not started)

| # | Item | Pri | Notes |
|---|---|---|---|
| 1.1 | ~~**Shared Radix modal**~~ — *done 28 Sep* | — | `src/components/ui/Modal.tsx` (Radix Dialog) now wraps **49 modals and drawers on 23 screens** (desktop + field app), keeping each screen's own panel classes so they look the same. Escape closes; focus stays inside and returns afterwards; the page behind doesn't scroll; screen readers hear a titled dialog. A click outside still doesn't close (no lost typing). Not portalled, so print previews and nested modals behave as before. Also: the 13 browser `confirm()` pop-ups are now an in-app dialog (`confirmAction()`, `src/lib/confirm.ts`), with focus starting on **Cancel**. Left as they were: the QR scanner, the mobile sidebar backdrop, the bell's click-away layer. |
| 1.2 | **Shared Radix Select** | L | Native `<select>`s throughout. Radix Select/Dialog packages are already installed but unused. |
| 1.3 | **react-hook-form + zod** — *main forms done 28 Sep* | L | **Done:** rules in `src/lib/validation/forms.ts` (+tests), messages under the fields (`src/components/ui/FormField.tsx`), focus jumps to the first problem. **Create Service Request** and **Create Work Order** use react-hook-form + zod; the **asset wizard** uses the same zod rules on its existing state and shows every problem in a step at once (was one `alert()` at a time). Fixed on the way: the Work Order form could keep a person hidden from the assignee list after the type changed. **No `alert()` is left anywhere:** the rest became in-app toasts (a new blue *info* toast for notices). **Smaller forms, also done 28 Sep:** categories, departments, vendors (page + the quick-add modals in the asset and inventory forms), documents (title + file), rooms and room types, sub-categories (step 1, each custom-field label, the new-template modal), PM / inspection templates (title and each item), inventory item, deploy-a-spare (both screens), and reservations (room, dates in order, dates in range, time slot, purpose), all through `src/lib/useFormCheck.tsx` with the same rules file. **Still open (small):** the *Add / Edit Personnel* form and the *Adjust Stock* box still use the browser's own "required" bubble; the field app (`/mobile`) keeps its own in-app toasts for its forms. |
| 1.4 | **`date-fns`** | L | Installed, zero imports. Either make `src/lib/dateUtils.ts` a thin wrapper over it or remove the dependency. |
| 1.5 | **Type the shared Supabase client** | M | Now a one-line change (`createBrowserClient<Database>` in `src/lib/supabase/client.ts`); type-check shows **0 errors** with it on. Also regenerate `src/types/database.ts` (it was edited by hand for `departments.head_user_id`). |
| 1.6 | **Per-section loading instead of the global skeleton gate** | L | Kept on purpose so the tested loading behaviour doesn't change. It is now driven by the query layer; the plan's end state was per-query skeletons and no `AppLayout` gate. Visible change. |

## 2. Tables, search and scale (deferred by decision)

| # | Item | Pri | Notes |
|---|---|---|---|
| 2.1 | **TanStack Table + pagination** — *table UI done 28 Sep* | L | **Done:** shared `src/components/ui/DataTable.tsx` (TanStack Table v8) on the main lists: Assets, Service Requests, Work Orders, Corrective, Preventive, Housekeeping, Outside Repairs, Inspections, Inventory, Users (Registered + Guests), Reservations (list view), QR Codes (Rooms + Assets). Click a heading to sort (priority Critical→Low, statuses in workflow order, dates and costs by value); 25 rows a page by default, 10/25/50/100 remembered per table in the browser; a new search or filter returns to page 1. Each page keeps its own search and filters. **Still open:** (a) **server-side paging** (`.range()` in the queries), which matters more as data grows. First candidates are the activity logs and room access logs; search, filters and the dashboard counts read the full in-memory lists today, so paging changes those too. (b) Not converted: the reservation timetable grid (a grid, not a list), the Departments list, the tables inside detail pages (asset history, room logs) and the 11 tables in *Reports*. (c) No column show/hide. |
| 2.2 | ~~**Global search**~~ — *done 28 Sep* | — | Header search box + **Ctrl+K / ⌘K** palette (`src/components/GlobalSearch.tsx`, Radix Dialog). It searches assets (tag, name, serial, model, maker), work orders, service requests, inspections, outside repairs, rooms, inventory, vendors and registered users, and lists the top 5 per group. It opens the asset / room / spare page, or the list page with its search box filled in (`?q=`, via `src/lib/useSearchPrefill.ts`); Inspections got a search box for this. Ranking and matching: `src/lib/globalSearch.ts` (+tests). The desktop is Admin-only, so it searches everything the Admin has loaded. **Not included:** search inside the mobile app, full-text search in descriptions or remarks, and server-side search (it searches the in-memory lists, like the list pages do). |
| 2.3 | ~~**Alerts when the app is closed**~~ — *done 28 Sep* | — | **Web Push.** A switch in both bells (*Alerts when the app is closed*) subscribes the device (`src/lib/push.ts`, service worker `public/sw.js`). Migration **0044** (applied): `push_subscriptions` (own rows; writes via `register_push_subscription`, only real browser push services accepted), `push_config`, and triggers that call the Edge Function **`send-push`** (deployed) through `pg_net` for **every new notification** (work / inspection assigned, vendor handover, outside repair sent / overdue, auto check-out) and, for Admins, **every new service request**. The function builds and encrypts the push itself with WebCrypto (`supabase/functions/send-push/webpush.ts`, checked against the reference implementation in `src/lib/webPush.test.ts`), makes its own VAPID keys on first use (no secret to manage), sends each alert once while fresh, and drops dead devices. Tapping opens the right page (desktop page for Admins, `/mobile` for everyone else). Sign-out removes the device. Real PNG app icons from the HMS logo (`scripts/make-icons.mjs`). Verified live end to end up to Google's push service; **the last hop (a real phone showing it) needs your check (6.23).** **Not included:** re-subscribing automatically if a browser rotates its subscription (turn the switch on again), per-type choice of which alerts to push, quiet hours, and a flashing tab title. iPhone needs *Add to Home Screen* (iOS 16.4+). |

## 3. Security follow-ups

| # | Item | Pri | Notes |
|---|---|---|---|
| 3.0 | ~~**Anyone could make themselves an Admin**~~ — *fixed 28 Sep* | — | Found while building the end-to-end tests: the new-account trigger took the role from sign-up metadata, which the person signing up controls, so an anonymous (guest) sign-in or an email sign-up asking for `role: Admin` became an Admin. Confirmed in a rolled-back test; no existing account was affected. **Migration 0045 (applied live)**: guests are always Guest, a self-asked Admin becomes Faculty, server-set roles are trusted; the invite action now sets the role itself (branch `fix/signup-role`). **Still yours: switch off public sign-up** (`YOUR-ACTIONS.md` B); after that and once the new invite code is live, the trigger can stop reading the requested role at all. |
| 3.1 | **Anonymous write policies (3): remove** | H | `Public insert room log for guest checkin` and `Public update room log for guest checkout` on `room_access_logs`, and `Public insert service request from QR` on `service_requests`. Reviewed 21 Sep: **nothing uses them** (every page needs a session, `/qr` redirects a logged-out scan to login, guests sign in with Supabase anonymous auth which is the *authenticated* role, check-in/out use database functions `anon` cannot run, and the last 24 h of API traffic had **zero anonymous writes**). Today anyone holding the public anon key can insert fake access logs or spam tickets. Verified in a rolled-back test that removing all three blocks anonymous writes while a signed-in guest can still raise a ticket and check in. **Awaiting your go-ahead to apply.** (The read-only `Public read rooms/assets for QR scan` policies are separate and left alone.) |
| 3.2 | *(merged into 3.1)* | — | |
| 3.3 | **Leaked-password protection** | H | Dashboard toggle; only you can switch it on (see `YOUR-ACTIONS.md`). |
| 3.4 | **Guest re-login is an email lookup with no verification** | M | Accepted tradeoff (anyone who knows a guest's email can resume their history). Options later: emailed one-time code. |
| 3.5 | `SECURITY DEFINER` functions callable by signed-in users | L | `current_user_role`, `room_check_in`, `room_check_out`, `set_asset_status`. Intentional (they are the controlled write paths); listed so it is a known, reviewed warning. |

## 4. Database housekeeping

| # | Item | Pri | Notes |
|---|---|---|---|
| 4.1 | 23 foreign keys without a covering index (advisor, informational) | L | Includes the new `departments.head_user_id`. Add indexes when tables grow. |
| 4.2 | 24 "multiple permissive policies" warnings | L | Expected with "Admin all" + own-row policies. Merge only if performance needs it. |
| 4.3 | Test guest profiles from development | L | ~22 `Guest` profiles exist, mostly from testing. Clean before a real rollout. |
| 4.4 | `unit` on inventory items has no column | L | Every item reads back as "Units". Add a column if units matter. |
| 4.5 | ~~Duplicate asset-timeline rows~~ | — | **Done 21 Sep:** the 9 duplicate rows the old code wrote before 21 Sep (React ran a state update twice in development) were removed, keeping one copy of each; 59 → 50 rows. New events are recorded once and cannot repeat. |
| 4.6 | Older timeline entries have no reference number | L | `asset_activity_logs.reference_id` is new (migration 0037); events recorded before it show no "Ref". Backfill from work orders / inspections only if needed. |

## 5. Product behaviour worth a decision later

- ~~SLA priority: move it from the sub-category to the asset~~ | **Done 28 Sep.** The asset wizard now sets it (`assets.sla_priority`, migration 0042); both the mobile and desktop Maintenance request forms lock to the **asset's** priority first, falling back to its sub-category's for an asset with none (every asset that predates this change, plus any still made by the legacy Excel bulk importer, which doesn't ask for one). The Sub-Categories screen no longer edits it. Shared logic + tests: `src/lib/assetSlaPriority.ts`. Verified against the live database: every existing asset (none has a priority yet) resolves to its sub-category's real priority, exactly as the app now would.
- **Outside repairs (built 28 Sep)** — not included yet: repair costs in *Reports*, a printable gate pass / delivery challan, spare-part stock movements when a part is replaced, outside repairs on Preventive orders (Corrective only today), deleting a wrongly-entered send-out (Admins can correct fields; no delete button), and an alert when an item comes back.
- **Vendor handover is a flag, not a status:** a job handed to a vendor is "In Progress" with *Execution Mode = Vendor* (shown as a **With vendor** tag). There is no separate status, no vendor-facing portal or email/SMS to the vendor, no tracking of the vendor's SLA or invoice approval, and the vendor cost is shown on the work order but not yet in *Reports*. Only the **Corrective** flow supports a handover. A job handed over and closed in the same save sends no Admin alert.

- **Reassigned work orders:** a technician whose order is reassigned away receives no live event; it disappears after they refocus the app. (Documented, accepted.)
- **Realtime connections:** one websocket per open app instance. Check the Supabase plan's concurrent-connection and message limits before a large rollout (the app already drops the connection after 30 s hidden).
- **Follow-on effects timing:** work-order / inspection completion now saves first and then creates follow-ups, so next-cycle records appear after a short save delay rather than instantly.
- **Priority lock:** Maintenance requests take the sub-category's SLA priority; IT Support and other types keep a free priority.

## 6. Quality and process

| # | Item | Pri | Notes |
|---|---|---|---|
| 6.1 | ~~**End-to-end tests**~~ — *done 28 Sep* | — | Playwright (`e2e/`, `npm run e2e`): signs in as real test accounts and clicks through **guest check-in / check-out**, **guest service request → Admin desk**, **Admin creates a corrective work order → technician sends a part out, gets it back and completes it with photos on the phone**, **technician passes an inspection → Admin sees PASS**, plus every main Admin screen, list search/sort/paging, Ctrl+K search and the inline form errors. Runs against the dev project with its own `[E2E]` accounts, room, asset and inspection, created before and deleted after every run (records, photos, accounts); `npm run e2e:cleanup` removes leftovers of an interrupted run. [E2E] requests never go out as phone alerts (migration 0046). It already caught two bugs, both fixed: the desktop header failed React hydration on every page, and the field app asked the database for the notifications of the placeholder user "guest" before the profile loaded. **Not covered yet:** housekeeping and PM completion, vendor handover, reservations, inventory, reports, the push alert itself, and running in CI (it needs the service-role key). |
| 6.2 | **Component tests** | L | No React Testing Library tests for pages/modals yet. |
| 6.3 | **Update the published roadmap artifact** | M | It still describes the plan as it stood after the audit. |
| 6.4 | Very large files | L | `reports/page.tsx` (~1,700 lines) and several 700–1,000-line pages; `AFMSContext.tsx` is now ~2,100 lines (was 3,247) and is mostly thin wrappers. Split when touching them. |
| 6.5 | Delete merged local branches | L | `fix/critical-role-escalation`, `fix/high-severity`, `fix/medium-severity`, `fix/low-severity`, `feat/skeleton-loading`, `feat/realtime`, `chore/test-tooling`, `feat/query-migration` are all inside `main`. (`origin/subh-update` is someone else's; left alone.) |
| 6.7 | **In-app data importer** | L | Client data is loaded once by a script (`docs/DATA-LOAD.md`, `src/lib/dataLoad/`, `scripts/data/`). If the client will keep bulk-loading, put a screen on the same parse/validate/build modules (dry-run, downloadable error report). The old asset importer (`src/utils/assetExcelUtils.ts`) still reads the first sheet only, guesses at near-matches, labels cost in USD and uses the `xlsx` library with the unpatched vulnerability; retire it when the new importer exists. |
| 6.8 | **Pin the Node version** | L | `npm test` does not start on Node 20 (jsdom's dependency needs a newer Node); Node 24 works. Add `engines` to `package.json` and an `.nvmrc`, and set the same version in Vercel. |
| 6.6 | **Promote to production** | — | `prod/main` is still at `e298d74`. Promotion is a separate, explicit step. The database changes for Phases 1–4C and 0035–0036 are already live and were built to work with the old code. |

## 7. Known limits carried over (not bugs to fix now)

- The Realtime refresh re-renders the whole context tree (debounced).
- An open modal keeps the snapshot it opened with; it is not rewritten under someone mid-edit.
- Anything not listed in this document has not been scoped.

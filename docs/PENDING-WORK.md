# AFMS — Pending Work

What is **not** done yet, as of 21 Sep 2026 (branch `feat/demo-fixes`, on top of `main` @ `2e61333`).
Nothing here blocks the client demo; see `TEST-CHECKLIST.md` for what *is* built and how to check it,
and `YOUR-ACTIONS.md` for what has to be done on the Supabase / Vercel side.

Priority: **H** = do soon, **M** = next release, **L** = later / optional.

---

## 1. Interface and forms (Phase 5, the part not started)

| # | Item | Pri | Notes |
|---|---|---|---|
| 1.1 | **Shared Radix modal** | M | 52 hand-rolled modal overlays in 27 files, no Radix import anywhere. Gives Escape-to-close and focus trapping (also the deferred Phase 4 item). Visible change on ~23 screens, so migrate a few at a time and spot-check each. |
| 1.2 | **Shared Radix Select** | L | Native `<select>`s throughout. Radix Select/Dialog packages are already installed but unused. |
| 1.3 | **react-hook-form + zod** | M | 79 `alert()` calls are used for validation. Adopt form by form (start with the Service Request, Asset and Work Order forms). |
| 1.4 | **`date-fns`** | L | Installed, zero imports. Either make `src/lib/dateUtils.ts` a thin wrapper over it or remove the dependency. |
| 1.5 | **Type the shared Supabase client** | M | Now a one-line change (`createBrowserClient<Database>` in `src/lib/supabase/client.ts`); type-check shows **0 errors** with it on. Also regenerate `src/types/database.ts` (it was edited by hand for `departments.head_user_id`). |
| 1.6 | **Per-section loading instead of the global skeleton gate** | L | Kept on purpose so the tested loading behaviour doesn't change. It is now driven by the query layer; the plan's end state was per-query skeletons and no `AppLayout` gate. Visible change. |

## 2. Tables, search and scale (deferred by decision)

| # | Item | Pri | Notes |
|---|---|---|---|
| 2.1 | **TanStack Table + pagination** | L | Not installed; every table is hand-written markup showing the full list. Two parts: the table UI (sorting, paging, column visibility) and **server-side paging** (`.range()` in the queries), which matters more. First candidates: activity logs and room access logs (they grow on every action). Search, filters and the dashboard counts read full in-memory lists today, so paging changes those too. |
| 2.2 | **Header search bar does nothing** | M | It is only a text box: no results, no Enter handler, and the ⌘K hint has no shortcut. Either build a global search (assets, work orders, tickets, rooms, users) with a ⌘K palette, or hide it. Decide before the demo (see `YOUR-ACTIONS.md`). |

## 3. Security follow-ups

| # | Item | Pri | Notes |
|---|---|---|---|
| 3.1 | **Anonymous write policies on `room_access_logs`** | H | Two policies let the *anon* role (no login) insert and update access logs (`Public insert room log for guest checkin`, `Public update room log for guest checkout`, both `true`/open-session). Guest check-in now uses an authenticated (anonymous-auth) session, so these are probably obsolete. Confirm the QR flow, then drop them. |
| 3.2 | **Anonymous insert on `service_requests`** | H | `Public insert service request from QR` (anon, `with check true`). Same question: probably obsolete since guests are signed in. |
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

## 5. Product behaviour worth a decision later

- **Reassigned work orders:** a technician whose order is reassigned away receives no live event; it disappears after they refocus the app. (Documented, accepted.)
- **Realtime connections:** one websocket per open app instance. Check the Supabase plan's concurrent-connection and message limits before a large rollout (the app already drops the connection after 30 s hidden).
- **Follow-on effects timing:** work-order / inspection completion now saves first and then creates follow-ups, so next-cycle records appear after a short save delay rather than instantly.
- **Priority lock:** Maintenance requests take the sub-category's SLA priority; IT Support and other types keep a free priority.

## 6. Quality and process

| # | Item | Pri | Notes |
|---|---|---|---|
| 6.1 | **End-to-end tests** | M | 118 unit tests cover the data layer, helpers and the Realtime hook, not the screens or the flows across them. Add Playwright for: guest request, work-order lifecycle, inspection pass/fail, check-in/out. |
| 6.2 | **Component tests** | L | No React Testing Library tests for pages/modals yet. |
| 6.3 | **Update the published roadmap artifact** | M | It still describes the plan as it stood after the audit. |
| 6.4 | Very large files | L | `reports/page.tsx` (~1,700 lines) and several 700–1,000-line pages; `AFMSContext.tsx` is now ~2,100 lines (was 3,247) and is mostly thin wrappers. Split when touching them. |
| 6.5 | Delete merged local branches | L | `fix/critical-role-escalation`, `fix/high-severity`, `fix/medium-severity`, `fix/low-severity`, `feat/skeleton-loading`, `feat/realtime`, `chore/test-tooling`, `feat/query-migration` are all inside `main`. (`origin/subh-update` is someone else's; left alone.) |
| 6.6 | **Promote to production** | — | `prod/main` is still at `e298d74`. Promotion is a separate, explicit step. The database changes for Phases 1–4C and 0035–0036 are already live and were built to work with the old code. |

## 7. Known limits carried over (not bugs to fix now)

- The Realtime refresh re-renders the whole context tree (debounced).
- An open modal keeps the snapshot it opened with; it is not rewritten under someone mid-edit.
- Anything not listed in this document has not been scoped.

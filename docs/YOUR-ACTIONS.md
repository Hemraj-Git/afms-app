# AFMS — What You Need To Do From Your Side

Things only you can do (dashboards, accounts, decisions). Code and database work is already done.

## A. Before you demo

1. **Test locally first.** `npm run dev` → http://localhost:3000. Work through `TEST-CHECKLIST.md` (the demo path in section 0 is the short version).
2. **Prepare the demo data** (this matters — see the two fixes in this branch):
   - **Sub-category SLA priority.** The priority is now really saved and the Maintenance request form is **locked** to it. Every existing sub-category is still on the default **Medium**, because it was never saved before. Open *Sub-Categories*, edit each one and set its real priority (Critical / High / Medium / Low), or the client will see every maintenance request locked to Medium.
   - **Department heads.** Open *Admin → Users → Departments* and choose a head for each department from the registered users. Nothing is assigned yet.
   - Make sure you have one account for each role you will show: **Admin, Technician, Housekeeping, Faculty**, plus a guest email for the QR/mobile flow.
   - Check rooms, assets (with a sub-category that has maintenance and inspection templates), and a few open tickets so the dashboard is not empty.
3. ~~Header search bar~~ — **done:** the header search (Ctrl+K) works now (`TEST-CHECKLIST.md` 6.22).
4. **Use two browser windows** for the live parts: an Admin window and a Technician (or guest phone) window, to show live assignment, live ticket status and live room occupancy.
5. **Phone alerts (Web Push)** need the app on **HTTPS** (Vercel is; `localhost` also works for testing). On each phone: open the app, tap the bell → **Alerts when the app is closed** → allow. **iPhone/iPad:** first *Share → Add to Home Screen*, open AFMS from the Home Screen icon, then turn it on (iOS 16.4 or later; Safari tabs cannot receive push). Android Chrome, desktop Chrome, Edge and Firefox work directly. Checklist 6.23.

## B. Supabase dashboard (project: your AFMS project)

| Setting | Where | What to do |
|---|---|---|
| **"Allow new users to sign up" — keep ON** | Authentication → Sign In / Providers → User Signups | Must stay **on**. Turning it off **also blocks anonymous sign-ins**, so every guest login and QR check-in fails with "Signups not allowed for this instance" (happened 29 Sep, reverted the same day). It is safe on: since migrations 0048/0049 a self-registered account can only ever be a **Guest** (no staff directory, same access as any QR visitor), and staff roles come only from the app's invite. |
| Leaked-password protection | Authentication → Policies (Password) | Turn **on**. (May require the Pro plan.) |
| Password-reset and invite emails | Authentication → Emails → Templates | **Reset password — done 1 Oct.** **Invite user — check it too:** its link must be `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` instead of the default `{{ .ConfirmationURL }}`, or an invited person lands on the sign-in page instead of *Set password*. |
| Password rules | Authentication → Providers → Email | **Done 1 Oct:** minimum 8 characters; lowercase, uppercase, digit and symbol. The *Set password* screen shows the same rules as a checklist (`src/lib/authPolicy.ts`). **If you change them here, tell me so the screen matches.** |
| Email link lifetime | Authentication → Providers → Email → *Email OTP Expiration* | **Done 1 Oct: 43,200 s (12 hours)** for invite and reset links. The app says "12 hours" in the invite confirmation, the reset confirmation and the expired-link page (`EMAIL_LINK_VALID_HOURS` in `src/lib/authPolicy.ts`). |
| Email sending (SMTP) | Authentication → Emails → SMTP Settings | **Before go-live:** Supabase's built-in sender is for testing (very few emails an hour, and on newer projects only to your own Supabase team members). Connect the client's mail service or a provider (Resend, SendGrid, Amazon SES) so staff actually receive invites and reset links. |
| Site URL / redirect URLs | Authentication → URL Configuration | Site URL = your production domain. Add `http://localhost:3000` under redirect URLs for testing. |
| Anonymous sign-ins | Authentication → Providers | Must stay **enabled** (guests use it). |
| Adding staff | — | Always through the app (*Users → Add New Personnel*), never *Add user* in the Supabase dashboard: a dashboard-created account starts as a **Guest** (migration 0049) and the app will not promote a Guest to staff. |
| Email templates and `/auth/confirm` | Authentication → Email Templates | `/auth/confirm` now accepts only **invite** and **recovery** links. If you ever point another template (magic link, email change) at it, tell me so its type is added to the allowlist in `src/app/auth/confirm/route.ts`. |
| Realtime limits | Project Settings → (Realtime / Usage) | The app uses one live connection per open browser tab. Check your plan's concurrent connection limit if many people will have the app open. |

**No SQL to run.** All migrations (up to `0049`) were applied to the live project as they were built. The files are in `supabase/migrations/` for the record.

**Phone alerts (Edge Function `send-push`):** already deployed on this project, with **no secret to set**: it creates its own push keys on first use and keeps them in the database (table `push_config`, readable only by the server). For the **client's production project** it must be deployed once there too (I do it with the migrations; it runs with *Verify JWT* **off**, because the database calls it, and it only ever sends a fresh alert once to its real recipient). No Vercel variable is needed for it.

## C. Vercel (the `afms-prod` project)

Confirm these **environment variables** exist for Production (Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only; do not give it a `NEXT_PUBLIC_` prefix.** Needed for: inviting users, an Admin editing or deleting users, and the guest sign-in name lookup. Without it those features fail.

## D. Getting the code live (when you are ready)

The database is already ahead of production, so deploy soon after testing.

1. Tell me the local test passed (or list what failed).
2. I merge `feat/demo-fixes` into `main` and push `origin/main`.
3. **You** say "promote to prod" and I push `main` to the `prod` remote (Vercel builds it). I never do this without that instruction.
4. After the deploy, run the *smoke test* at the end of `TEST-CHECKLIST.md` on the production URL.

## E. Collecting the client's data (Excel)

Full runbook: `DATA-LOAD.md`. From your side:

1. **Tell me when the client's production database exists** (a Supabase project with migrations `0001`–`0049` applied and the `send-push` Edge Function deployed) and give me its env file (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) **privately**, not in chat. Until then I test only on the current project.
2. **Decide the data-entry deadline** with the client and who at their end fills each workbook (one person is easiest).
3. **Send the client the Masters workbook first** (`npm run data:masters-template`), then the Assets workbook only after I have loaded their masters (it is built from them).
4. **Open both workbooks in Excel once** yourself (checklist 6.14 and 6.15) before sending; I can check the file structure and the formulas, but not how Excel looks.
5. **Decide before go-live** whether the asset-level SLA priority change (`PENDING-WORK.md` section 5) ships first; otherwise every maintenance request is locked to Medium.
6. Photos and documents are not part of the Excel files: agree a folder-per-asset hand-over with the client.

## F. Decisions I need from you (any time)

- Whether to add TanStack Table + pagination now or after the demo (you said later).
- ~~Remove the three anonymous write policies~~ — done (migration 0047, `PENDING-WORK.md` 3.1); guest check-in and guest tickets tested still working.
- ~~Delete the 9 duplicate asset-timeline rows~~ — done (`PENDING-WORK.md` 4.5).

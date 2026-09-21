# AFMS — What You Need To Do From Your Side

Things only you can do (dashboards, accounts, decisions). Code and database work is already done.

## A. Before you demo

1. **Test locally first.** `npm run dev` → http://localhost:3000. Work through `TEST-CHECKLIST.md` (the demo path in section 0 is the short version).
2. **Prepare the demo data** (this matters — see the two fixes in this branch):
   - **Sub-category SLA priority.** The priority is now really saved and the Maintenance request form is **locked** to it. Every existing sub-category is still on the default **Medium**, because it was never saved before. Open *Sub-Categories*, edit each one and set its real priority (Critical / High / Medium / Low), or the client will see every maintenance request locked to Medium.
   - **Department heads.** Open *Admin → Users → Departments* and choose a head for each department from the registered users. Nothing is assigned yet.
   - Make sure you have one account for each role you will show: **Admin, Technician, Housekeeping, Faculty**, plus a guest email for the QR/mobile flow.
   - Check rooms, assets (with a sub-category that has maintenance and inspection templates), and a few open tickets so the dashboard is not empty.
3. **Decide on the header search bar.** It is a text box that does nothing. For the demo either (a) leave it and don't click it, or (b) ask me to hide it (a few minutes), or (c) ask me to build a real search (a small project). I recommend (b) for the demo.
4. **Use two browser windows** for the live parts: an Admin window and a Technician (or guest phone) window, to show live assignment, live ticket status and live room occupancy.

## B. Supabase dashboard (project: your AFMS project)

| Setting | Where | What to do |
|---|---|---|
| Leaked-password protection | Authentication → Policies (Password) | Turn **on**. (May require the Pro plan.) |
| Password-reset email | Authentication → Email Templates → *Reset password* | Set the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` instead of the default `{{ .ConfirmationURL }}`. Without this the "Forgot password" link may not open the app's *set password* page. Same change for the *Invite user* template with `&type=invite` (see the comment in `src/app/auth/confirm/route.ts`). |
| Site URL / redirect URLs | Authentication → URL Configuration | Site URL = your production domain. Add `http://localhost:3000` under redirect URLs for testing. |
| Anonymous sign-ins | Authentication → Providers | Must stay **enabled** (guests use it). |
| Realtime limits | Project Settings → (Realtime / Usage) | The app uses one live connection per open browser tab. Check your plan's concurrent connection limit if many people will have the app open. |

**No SQL to run.** All migrations (`0028`–`0036`) were applied to the live project as they were built. The files are in `supabase/migrations/` for the record.

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

## E. Decisions I need from you (any time)

- Header search: hide it, leave it, or build it (see A.3).
- Whether to add TanStack Table + pagination now or after the demo (you said later).
- Whether to remove the two anonymous write policies (`PENDING-WORK.md` 3.1, 3.2) — I need to confirm the QR flow with you first.

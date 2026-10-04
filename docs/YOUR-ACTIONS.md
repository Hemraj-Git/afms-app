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
| **Migration 0054** (security review, 4 Oct) | SQL Editor | **Before go-live.** Guests only reach what their screens use; signed-out QR scans get just a name; guests upload photos only; at most 5 service requests an hour per guest (30 for staff). |
| **Migration 0055** (SLA settings, 4 Oct) | SQL Editor | SLA hours move from each Admin's browser into the database, so phones and every computer use the same numbers. Each new service request gets its deadline from the database; existing requests keep theirs. After applying, re-enter your SLA hours once under Work Orders → Configure SLA Rules (they start at 4 / 12 / 24 / 48). |
| Auth rate limits | Authentication → Rate Limits | Check the defaults are on: sign-ins and anonymous sign-ins per IP per hour, emails per hour, token refreshes. These are the app's protection against password guessing and bot guests. |
| Bot protection for guest sign-in (optional) | Authentication → Attack Protection → CAPTCHA (Cloudflare Turnstile) | Worth adding if bots start creating guest sessions; needs a small app change to show the CAPTCHA. |
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

**Client branding (optional, per deployment).** The top of the sidebar shows the client's logo; with nothing set it shows *AssetNXG*. Redeploy after changing any of these (they are read at build time):

- `NEXT_PUBLIC_CLIENT_NAME` — shown in About as "Licensed to", on the sign-in page, in the browser tab, across the top of each room's QR placard, and with its initials when there is no logo.
- `NEXT_PUBLIC_CLIENT_SHORT_NAME` — e.g. `SoMS` (as in the subdomain). Printed on the small 5 cm asset QR labels, where the full name doesn't fit.
- `NEXT_PUBLIC_CLIENT_LOGO_URL` — the wide logo (put the file in `public/images/`, or a full https link). Shown up to 196 × 48 px.
- `NEXT_PUBLIC_CLIENT_LOGO_MARK_URL` — the square mark for the collapsed sidebar (40 × 40 px).

For the School of Maritime Studies deployment (the logo files are already in `public/images/`):

```
NEXT_PUBLIC_CLIENT_NAME=School of Maritime Studies, Centurion University
NEXT_PUBLIC_CLIENT_SHORT_NAME=SoMS
NEXT_PUBLIC_CLIENT_LOGO_URL=/images/client-logo.png
NEXT_PUBLIC_CLIENT_LOGO_MARK_URL=/images/client-logo-mark.png
```

The version shown in About comes from `package.json` (now 1.0.0); raise it for each release.

**Each client gets its own address: `<short name>.assetnxg.app`** — for the School of Maritime Studies (SoMS): **`https://soms.assetnxg.app`**. To set one up:

1. **Vercel** → the project → Settings → Domains → add `soms.assetnxg.app`.
2. **DNS** for `assetnxg.app` (where the domain was bought): add the record Vercel shows, normally a `CNAME` from `soms` to `cname.vercel-dns.com`. Vercel issues the HTTPS certificate itself.
3. **Supabase** → Authentication → URL Configuration: set **Site URL** to `https://soms.assetnxg.app` and add `https://soms.assetnxg.app/**` to **Redirect URLs**. Invite and password-reset emails link to the Site URL; with the old address there, those links open the wrong site.
4. **Print the QR labels from `https://soms.assetnxg.app`.** Each QR code holds the address of the page it was printed from, so labels printed from any other address send phones there. (The in-app scanner reads either.)
5. Staff who installed the app on their phones from the old address should install it again from the new one; push alerts are tied to the address too.

Also check the **Supabase email templates** (Authentication → Emails: invite and password reset) and the sender name: change any "AFMS" there to "AssetNXG".

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

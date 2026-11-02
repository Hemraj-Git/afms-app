# Setting up AssetNXG for a new client

Each client gets its own Supabase project (database, sign-in, emails, files) and its own
Vercel project, at `<id>.assetnxg.app`. All code lives in this repository (`afms-app`).
Nothing here touches another client: every command takes the new client's env file and
refuses a database that already has the app.

## How releases reach each client

| Client | Vercel project builds from | A release is |
|---|---|---|
| SoMS (soms.assetnxg.app) | `afms-app`, branch `main` | merging into `main` |
| PMS (pms.assetnxg.app) | `afms-pms`, branch `main` (a release copy) | `git push pms main` |

`afms-pms` is never edited: it only receives `afms-app`'s `main` when that client is to be
upgraded, so both clients run the same code, each on its own schedule. A new client gets
its own empty private repository `afms-<id>` the same way (`git remote add <id> …`).
Before pushing a release to a client, apply any new migrations to that client's database.

Below, `abc` stands for the new client's id (its subdomain).

## 1. Client file

Copy `clients/soms.json` to `clients/abc.json` and fill it in (fields: `clients/README.md`).
Put the logos in `public/images/clients/abc/` (`logo.png` wide, about 400 × 100 px, and
`logo-mark.png` square) and point `logo` / `logoMark` at `/images/clients/abc/logo.png` and so on.

## 2. Env file (private, never in git or chat)

`.env.abc` in the repo folder (ignored by git):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Project Settings → API Keys: anon / publishable>
SUPABASE_SERVICE_ROLE_KEY=<Project Settings → API Keys: service_role / secret>
SUPABASE_DB_URL=<Connect → Connection string → Session pooler, with the database password>
```

Use the **Session pooler** string (`postgresql://postgres.<ref>:<password>@aws-….pooler.supabase.com:5432/postgres`):
the direct one needs IPv6.

## 3. Database

```bash
npm run client:db -- --env .env.abc --target <ref>            # checks: project empty, what will run
npm run client:db -- --env .env.abc --target <ref> --commit   # sets it up, in one transaction
```

This runs `supabase/baseline/0000_baseline.sql` (the whole schema as of migration 0056:
tables, functions, security rules, permissions, file buckets, live updates, the three daily
jobs, default SLA hours and room types), then every later migration, then compares the result
with the SoMS fingerprint (`supabase/baseline/expected-fingerprint.json`). All parts should say
`same`. If anything fails, nothing is kept.

**Later migrations** go to every client: apply each new file to a client's database before
releasing the code that needs it to that client.

## 4. Phone alerts function

Deploy `supabase/functions/send-push` (the three files) as `send-push` with **Verify JWT off**:

```bash
npx supabase login                     # once, opens the browser
npx supabase functions deploy send-push --project-ref <ref> --no-verify-jwt --use-api
```

No secrets: it makes its own keys on first use.

## 5. Supabase settings (dashboard)

`npm run client:kit -- --client abc` writes `clients/out/abc/`: the two emails filled in, and
`settings.md` with the exact values below.

| Where | Setting |
|---|---|
| Authentication → URL Configuration | Site URL `https://abc.assetnxg.app`; Redirect URLs `https://abc.assetnxg.app/**` |
| Authentication → Sign In / Providers | Allow new users to sign up **on**; Anonymous sign-ins **on** |
| Authentication → Providers → Email | Password: min 8, lowercase + uppercase + digit + symbol; Email OTP Expiration **43200** |
| Authentication → Emails → SMTP | Same as SoMS: Resend (`smtp.resend.com`, 465, user `resend`, the Resend API key), sender `no-reply@assetnxg.app`, name **AssetNXG Admin** |
| Authentication → Emails → Templates | Invite user and Reset password: subjects from `settings.md`, bodies from `invite.html` / `recovery.html` |
| Authentication → Policies | Leaked-password protection on |
| Authentication → Rate Limits | Defaults on |

Choose the **Pro plan** for a live client: free projects pause after a week without use and
have no daily backups.

## 6. Vercel and the address

1. New Vercel project importing the client's release repository (`afms-<id>`, branch `main`).
   If Vercel doesn't list it, give the Vercel GitHub app access to it (GitHub → Settings →
   Applications → Vercel → Configure).
2. Environment variables (Production and Preview): the block in `settings.md`, the anon key and
   service-role key from `.env.abc`, and the four Sentry variables as on SoMS
   (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`). Errors are
   tagged with the client's short name in Sentry.
3. Settings → Domains → add `abc.assetnxg.app`; at the DNS for `assetnxg.app`, a `CNAME` from
   `abc` to `cname.vercel-dns.com`.
4. Deploy, and open the address: sign-in page with the client's name and logo.

## 7. People

1. **Our support login** (never shared with the client): Authentication → Users → Add user →
   `admin@assetnxg.app`, a strong password, Auto Confirm. Then make it an Admin in the SQL Editor:
   `update public.profiles set role = 'Admin' where email = 'admin@assetnxg.app';`
   (accounts created in the dashboard start as Guests).
2. Sign in with it, and from **Users → Add New Personnel** invite the client's first administrator
   (`firstAdmin`) as **Admin**, on handover day.

## 8. Data

```bash
npm run data:masters-template -- --out abc-masters.xlsx           # send to the client
npm run data:load -- --stage masters --file filled.xlsx --env .env.abc                       # dry run
npm run data:load -- --stage masters --file filled.xlsx --env .env.abc --commit --target <ref>
npm run data:assets-template -- --env .env.abc --out abc-assets.xlsx   # after masters are in
```

See `docs/DATA-LOAD.md`. Then the client sets SLA hours (Work Orders → Configure SLA Rules) and
prints QR codes **from `https://abc.assetnxg.app`**.

## 9. Guides

Take the screenshots from the client's app with sample data, build, and clean up
(`docs/manual/README.md`), with `.env.abc` in place of `.env.local` and `--client abc`:

```bash
npx tsx scripts/manual/build.ts --client abc        # → docs/manual/out/abc/
```

## 10. Check before handover

- Sign in, invite, password reset (the email arrives from AssetNXG Admin, links open `abc.assetnxg.app`)
- Guest QR check-in from a phone, a service request, a work order assigned and done on the phone
- A phone alert arrives (turn alerts on in the field app)
- `npm run client:fingerprint -- --env .env.abc`: all `same`
- Sentry: no new issues tagged `client:<shortName>`

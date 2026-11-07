# Clients

One file per client deployment, `<id>.json`. It fills the client's details into the
invitation and password emails (`supabase/templates/`) and the user guides
(`docs/manual/src/`), and gives the Vercel branding variables. Nothing secret goes here:
keys and passwords stay in the client's `.env.<id>` file, outside git.

| Field | Example (SoMS) | Used for |
|---|---|---|
| `id` | `soms` | File names, `--client soms` |
| `name` | School of Maritime Studies, Centurion University | Full name: emails, guide covers and footers, `NEXT_PUBLIC_CLIENT_NAME` |
| `orgName` | School of Maritime Studies | In running text and the invitation subject |
| `shortName` | SoMS | Small QR labels, `NEXT_PUBLIC_CLIENT_SHORT_NAME`, the Sentry tag |
| `domain` | soms.assetnxg.app | The web address |
| `logo`, `logoMark` | /images/client-logo.png | Wide logo and square mark, files under `public/` |
| `firstAdmin` | maintenance.soms@cutm.ac.in | The client's first administrator (Getting Started guide) |
| `supabaseRef` | rtastehzscrbfvnffrct | The client's Supabase project |
| `masterDataLabel`, `masterData` | Already loaded / Your campus, 9 buildings… | Optional. The Getting Started row on master data; without them it says the HMS team loads it before go-live |
| `guidesDate` | October 2026 | Optional. The edition date on the guide covers; without it, the month they are built |

`npm run client:kit -- --client <id>` writes the client's ready-to-paste emails and settings
to `clients/out/<id>/` (not kept in git). See `docs/NEW-CLIENT.md`.

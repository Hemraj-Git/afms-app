# User manuals

Four PDFs for the client, written in HTML and printed with Chromium:

| Source (`src/`) | PDF (`out/`) | For |
|---|---|---|
| `admin-guide.html` | AssetNXG-Administrator-Guide.pdf | The facility office (desktop) |
| `field-guide.html` | AssetNXG-Field-App-Guide.pdf | Technicians, housekeeping, faculty, guests (phone) |
| `quick-cards.html` | AssetNXG-Quick-Reference-Cards.pdf | One page per role, and a visitor notice for rooms |
| `getting-started.html` | AssetNXG-Getting-Started.pdf | The client's administrator, for going live |

`shots/` (screenshots) and `out/` (PDFs) are generated and not kept in git.

## Rebuilding after a change to the app

The screenshots need sample records. They are added to the database in `.env.local`
and removed afterwards; if that is the live client database, agree a time with the client first.

```bash
npx tsx scripts/manual/demo.ts seed          # sample people, assets, jobs (ids saved in data-loads/)
npm run build && npx next start -p 3100      # in a second terminal
npx tsx scripts/manual/capture.ts all        # or: desktop | phone, optionally followed by shot names
npx tsx scripts/manual/build.ts              # or: admin-guide | field-guide | quick-cards | getting-started
npx tsx scripts/manual/demo.ts clean         # removes exactly what seed added
```

`clean` can't put the database's number counters back (it has no permission to), so the
sample records use up some numbers. On a client database, reset them afterwards in the
Supabase SQL editor, if no real records have been created meanwhile:

```sql
select setval('public.inspections_seq', 1, false), setval('public.outside_repairs_seq', 1, false),
       setval('public.room_activity_seq', 1, false), setval('public.service_requests_ticket_seq', 1, false),
       setval('public.work_orders_cr_seq', 1, false), setval('public.work_orders_pm_seq', 1, false);
```

Cleaning-job (WO-HK), asset (AST), spare (INV) and reservation (RSV) numbers are worked
out from the existing records, so they need nothing.

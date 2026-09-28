# AFMS — Loading the client's data

How to collect a client's master data and equipment list in Excel and load it once. Two workbooks, one command-line tool. Everything here runs **on our machine**, never inside the app.

## The flow

| Step | Who | What |
|---|---|---|
| 1 | We | `npm run data:masters-template` → **Masters workbook** (locations, vendors, categories, sub-categories with custom fields, maintenance and inspection templates) |
| 2 | Client | Fills it in until the Read Me says **"Rows still needing attention: 0"**, sends it back |
| 3 | We | Dry-run, send the client the report if there are errors, repeat until clean, then **commit** |
| 4 | We | `npm run data:assets-template` → **Assets workbook**, built from what was just loaded: one tab per sub-category, its custom fields as columns, dropdowns holding the real rooms and vendors |
| 5 | Client | Fills in the equipment (one row per asset, on the tab for its type), sends it back |
| 6 | We | Dry-run, fix, **pilot batch of ~10 assets** reviewed together, then the full commit |
| 7 | We | Send the client the import report for sign-off |

Why two: the asset columns depend on the custom fields the client defines in step 2.

## Before the real load

- The target database exists and has **every migration applied through `0049`** (`supabase/migrations/`). `0042` adds `assets.sla_priority`; the assets stage refuses to run without it.
- An env file for that project, e.g. `.env.client`, with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the service-role key bypasses row-level security: keep it out of git and out of chat). The default is `.env.local`. **Check which database an env file points at before every commit.**
- **Node 22 or newer** (Node 24 recommended; `npm test` does not start on Node 20) and `npm install`.
- Test data from development (about 20 guest profiles, demo assets, etc.) is cleared if this project becomes the client's production.
- Rooms, vendors and sub-categories the client needs must be loaded (step 3) before the Assets workbook is made: it can only offer what already exists.

Everything the tool writes goes under `data-loads/` (ignored by git: it holds client data): the blank workbooks, import reports and load manifests.

## Commands

```bash
# 1. the blank Masters workbook
npm run data:masters-template                          # -> data-loads/AFMS-Masters-Workbook.xlsx

# 2. check a returned workbook. NOTHING is written. Add --env .env.client for another project
npm run data:load -- --stage masters --file returned-masters.xlsx

# 3. load it. --target must match part of the database host shown in the output
npm run data:load -- --stage masters --file returned-masters.xlsx --commit --target abcdefgh

# 4. the Assets workbook, made from what is now in the database
npm run data:assets-template -- --env .env.client      # -> data-loads/AFMS-Assets-Workbook.xlsx

# 5. check and load the returned assets
npm run data:load -- --stage assets --file returned-assets.xlsx
npm run data:load -- --stage assets --file returned-assets.xlsx --commit --target abcdefgh

# remove a whole load (newest first: assets before masters)
npm run data:undo -- --manifest data-loads/<timestamp>-assets.json --target abcdefgh
```

A dry run prints what it would create, then every error and warning (also saved as `data-loads/report-<stage>-<time>.xlsx` to send to the client: tab, row, what to fix). Errors stop the load; warnings do not.

## What the loader checks

- The workbook is the one we sent: tabs present, column headings exactly as issued (a renamed, moved or deleted column would shift every value). For the Assets workbook, a hidden tab records which tab is which sub-category, so a renamed tab or a sub-category whose custom fields changed since the workbook was made is refused ("ask for a fresh workbook").
- **Exact matching only** (ignoring case and spacing): a room, vendor, category, template or sub-category that is not spelled exactly as it exists is an error, never "the nearest one".
- Required cells, numbers (no text, no negatives; `₹` and thousands separators are accepted), dates (real Excel dates, or `DD-MM-YYYY`; impossible dates are refused), Yes/No, and every dropdown choice.
- The same name twice; a template with no steps; the same step number twice; a custom field added twice; a serial number repeated on the workbook or already in the app.
- Names that already exist in the database are reported as conflicts (the tool only creates; it does not update).
- Warnings, not errors: a sub-category with no maintenance or inspection template (its assets get nothing scheduled), a category with no sub-categories, a room type outside the usual list, an asset "maintained by Vendor" with no vendor, a last-serviced date in the future.

## What a load creates

The same records the app creates itself, with the app's own numbering (`CAM-####`, `BLD-####`, `ROM-####` + QR key, `VND-####`, category and sub-category codes, `AST-####` + QR link):

- **Masters:** campuses, buildings, rooms, vendors, categories, templates (maintenance steps are tick-boxes, inspection steps Pass/Fail, as in the app) and sub-categories with their custom fields and template links. Sub-category SLA priority is left at the app's default (Medium): priority now belongs to each asset.
- **Assets:** each asset (SLA priority and custom values included; custom values are stored as text, as the app does), **one preventive work order per maintenance template and one inspection per inspection template** of its sub-category, and an "Asset Created" history entry. The first cycle is due one interval after **Last serviced date**, or after the load date if it is blank (never from the installation date). Work orders get a `PENDING-…` number until a technician is assigned, like every other scheduled work order; the database numbers inspections.

Tests (`src/lib/dataLoad/parity.test.ts`) run every row through the app's own mappers, so the loader cannot drift from what the app writes.

## Safety

- Dry run is the default; `--commit` is explicit.
- `--commit` and `undo` also need `--target <part of the host>`; a value that does not match the env file's database is refused. This is what stops a load going to the wrong project.
- Every commit writes a manifest (the ids it created). If anything fails part-way, what was written is removed automatically. `data:undo` removes a whole load.
- The same file cannot be committed twice (checked by file hash).
- Undo removes only what that load created. If someone has since attached other records to those rows, the database refuses and the tool says which.
- Number sequences are not rewound by an undo (the next numbers simply continue).

## Not covered

- Photos and documents (the workbook says to send them separately, in a folder named after the asset).
- Users, assignees, departments, and updating existing records.
- ~~The app did not read asset-level SLA priority~~ — **fixed 28 Sep**: the asset wizard now sets it, and Maintenance requests lock to the asset's priority (falling back to its sub-category's for an asset with none, e.g. anything loaded before this change). See `PENDING-WORK.md`, section 5.

## If something goes wrong

| Symptom | Cause / fix |
|---|---|
| `--target ... does not match` | The env file points somewhere else. Check `Database:` in the output. |
| `column 3 should be "…"` | The client changed a heading. Ask them to use a fresh copy of the template. |
| `changed after this workbook was made` | Custom fields were edited after the Assets workbook was issued. Regenerate it. |
| `no sla_priority column` | Apply migration `0042` to that project. |
| Load stopped part-way | It rolled itself back; the message says so. Fix the cause and run again. |
| Tests do not start | Use Node 22+ (Node 20 fails inside jsdom). |

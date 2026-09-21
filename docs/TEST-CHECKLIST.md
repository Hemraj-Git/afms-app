# AFMS — Test Checklist (Phase 1 → today)

Tick each box as you go. Test locally at http://localhost:3000 before anything goes to production.

**You need:** an **Admin**, a **Technician**, a **Housekeeping** and a **Faculty** account, a phone (or a second browser window) for the mobile app at `/mobile`, and a couple of guest email addresses. Use **two browser windows** for anything marked 🔴 *live*.

**Tip:** after a code change hard-refresh (Ctrl+F5). DevTools → Network → throttling "Slow 3G" shows the loading skeletons.

---

## 0. Ten-minute demo path (if you only have time for this)

- [ ] **Guest** scans/opens `/mobile`, signs in with name + email, raises a Maintenance request against an asset → gets a ticket number; it shows under *My Requests*. (5.1)
- [ ] **Admin** sees that ticket appear on *Service Requests* without refreshing. 🔴 (4C.3)
- [ ] Admin converts it to a **Corrective work order**, assigns the **Technician** → work order gets a real `WO-CR-…` number; the ticket shows it. (5.16)
- [ ] **Technician** (mobile/second window) sees the notification and the work order live, starts and completes it. 🔴 (4C.1)
- [ ] Admin sees the order **Completed** and the ticket **Resolved** without refreshing. 🔴
- [ ] **Live occupancy:** a person checks into a room on mobile → the Admin's *Rooms* page and *Dashboard* "Occupied Rooms" update by themselves. 🔴 (6.3)
- [ ] Create an **asset** whose sub-category has maintenance + inspection templates → its scheduled preventive orders and inspection appear. (5.11)
- [ ] Open **Users → Departments** and show a **department head chosen from registered users**. (6.2)
- [ ] Raise a Maintenance request as Admin against an asset → **priority is locked to its sub-category's SLA priority**. (6.1)

---

## Phase 1 — Role-escalation fix

- [ ] Admin: *Users* → edit a user's **role** → it saves and survives a reload.
- [ ] Sign in as a **non-Admin** (Faculty/Technician): you cannot reach *Users*.
- [ ] (Technical) Verified by me with database tests: a Guest changing their own role to Admin is now rejected ("Only an Admin can change a user's role."). To re-check, ask me to re-run it.

## Phase 2 — Access scoping, user management, honest errors

**Guests only see their own data**
- [ ] Guest on mobile: *My Requests* shows only that guest's requests (including earlier visits with the same email).
- [ ] Admin *Users → Guests* tab shows all guests; each guest's detail shows **only access log + raised requests** (no assigned assets).

**Admin edits/deletes other users (Admin-verified server actions)**
- [ ] Edit another user's name/role/department → saves and persists after reload.
- [ ] Delete a user with no requests → disappears and stays gone.
- [ ] Delete a user who has raised service requests → refused with a clear message; the user comes back.
- [ ] Try to remove **your own Admin role** → refused with a message; screen reverts.
- [ ] Try to delete **yourself** → refused.
- [ ] Try to demote/delete the **last Admin** → refused.

**Failed writes are no longer silent** (toast + undo)
- [ ] With the network offline (DevTools → Offline), rename a campus/department/vendor → you get an "…failed and was undone" toast and the old value returns.

## Phase 3 — Uploads, storage, double-submit, overdue

- [ ] Upload an **image over 5 MB** as an asset photo → rejected with a clear size message (evidence photos allow 15 MB, documents 25 MB).
- [ ] Upload a **wrong file type** (e.g. `.exe`, `.zip`) → rejected.
- [ ] A valid photo/document uploads and **opens by its link**.
- [ ] Double-click **Submit** on a new Service Request → only **one** request is created.
- [ ] A **Cancelled** work order does **not** show "Overdue" on the Preventive / Corrective / Work Orders pages.

## Phase 4 — Hardening

- [ ] After a hard refresh you never see an Admin-level screen flash before login completes.
- [ ] (Dashboard) Leaked-password protection is switched on — see `YOUR-ACTIONS.md`.

## Phase 4B — Loading states

Throttle to **Slow 3G**, hard-refresh each page:
- [ ] Dashboard, Assets, Work Orders, Service Requests, Reports, and `/mobile` show a **skeleton**, never a flash of "No data" or zeros.
- [ ] Deep-link refresh `/maintenance/work-orders` and `/service-requests` → the *Create* forms open with a room/asset **preselected**.
- [ ] Go offline and refresh → an **error banner with Retry** appears; going online and Retry recovers.
- [ ] Log out and back in → dashboard shows a skeleton, not an empty flash.

## Phase 4C — Live updates (Realtime)  🔴 two windows

- [ ] **4C.1** Admin assigns a work order to the Technician → the technician's **bell** gets a new unread item and the order **appears without reload** within ~2 s.
- [ ] Technician completes it → the Admin's *Work Orders* page and *Dashboard* update without refresh, with **no skeleton** flashing.
- [ ] **4C.2** Inspection assigned to the technician → appears live.
- [ ] **4C.3** A guest raises a request → Admin's *Service Requests* updates live. Admin changes its status → the guest's *My Requests* updates live.
- [ ] A **second guest** with a different email sees nothing of the first guest's requests.
- [ ] Go **offline ~30 s** then online → data catches up. Background the mobile app **> 30 s** and return → data is current.
- [ ] **Log out** → no live connection remains (DevTools → Network → WS closes).
- [ ] Create an asset that schedules several orders → the list updates **once**, not repeatedly.
- [ ] A form you are editing is **not overwritten** by a live update.

---

## Phase 5 — Data layer (every screen reads/writes through the new layer)

For each item: **create → edit → delete**, then **reload** to confirm it persisted. A failed save should show a toast and undo.

- [ ] **5.1 Service Requests** — create as guest (mobile) and as Admin; ticket number shown; status changes; dismiss with a reason → Closed. The **requester role** shows correctly (Guest / Faculty, not always "Staff").
- [ ] **5.2 Vendors** — add / edit / delete; a vendor linked to an asset **cannot** be deleted (message shown); quick-add vendor inside the asset and inventory wizards selects it.
- [ ] **5.3 Departments** — add / edit / delete; a department with users cannot be deleted.
- [ ] **5.4 Campuses / 5.5 Buildings** — add / edit / delete; editing a building's **campus** now persists; a campus with buildings / a building with rooms cannot be deleted.
- [ ] **5.6 Categories / 5.7 Sub-categories** — codes are unique ("Electronics" after "Electrical" gets `ELEC-2`); linked items block deletion.
- [ ] **5.8 Rooms** — add / edit; **floor, size and building persist**; QR page "last printed" persists.
- [ ] **5.9 Maintenance & Inspection templates** — create / edit / delete; a new template made from the sub-category page is usable immediately.
- [ ] **5.10 Inventory** — add a part, adjust quantity, edit, delete; **Deploy to asset** converts one unit and re-points its documents.
- [ ] **5.11 Assets** — single add (with a document), **bulk import** (assignee + AMC dates now saved), edit, status change; the asset gets its preventive orders + inspections and an **"Asset Created"** activity entry.
- [ ] **5.12 Documents** — upload from the library; create one inside the asset wizard and inventory wizard; link/unlink.
- [ ] **5.13 Reservations** — book a room for **several dates** (all slots appear together and survive reload; grouped); an already-booked slot gives the conflict message; cancel and delete.
- [ ] **5.14 Room access logs / check-in-out** — check in and out as guest and as Admin; log entries show the **room name** (and follow a renamed room); room shows Occupied then Available.
- [ ] **5.15 Inspections** — assign to a technician; technician completes as **Pass** (next cycle scheduled, asset Operational) and as **Fail** (next cycle + a Corrective order raised); the "not yet attemptable" alert still appears before the window opens; a refused completion creates **no** follow-ups.
- [ ] **5.16 Work orders** — corrective from a request, then assign → real `WO-CR-…` number carried onto the ticket and asset goes *Under Maintenance*; start → complete → asset *Operational*, ticket *Resolved*; completing a **Preventive** order schedules the next pending one from the completion date; **double-click Complete** creates only one follow-up; Preventive outside its window shows the alert; **Housekeeping** order from a request → assign staff → start/complete on mobile.
- [ ] **5.17 Users** — invite, edit, delete (see Phase 2); editing **your own** name updates the header.
- [ ] **5.18 Demo users** — no fake "USR-000x" people appear in any assignee dropdown (including for a guest).
- [ ] Log out and back in as **another user** → no data carries over.

---

## 6. Latest fixes (this branch)

- [ ] **6.1 Sub-category SLA priority** — set a sub-category's priority to *Critical*, reload → it is still Critical. Raise a **Maintenance** request against an asset in it (mobile *and* Admin form): the priority field is **locked to Critical** and the SLA due time follows it. An *IT Support* / *General* request still lets you choose priority.
- [ ] **6.2 Department head** — *Users → Departments → Add/Edit*: "Head of Department" is a **dropdown of registered users** (no guests). Save, reload → head still shown in the table. Choose "No head assigned" → cleared. Delete that user → the department shows no head.
- [ ] **6.3 Live occupancy** 🔴 — Window A: Admin on *Organization → Rooms* and *Dashboard*. Window B: check into a room on mobile. A shows **Occupied / "In use by …"** and the tile count changes without refresh; check out → **Available** again. Leave someone checked in past 23:59 (or ask me to simulate) → the server auto-checkout also appears live.

---

- [ ] **6.4 Asset activity timeline** — open an asset's *Activity & History* tab. Complete a work order for it **once** → exactly **one** "…Maintenance Completed" entry appears. Complete another inspection → one "Inspection Done/Failed". Each shows `Ref: #` with the **real** number (e.g. `WO-CR-2026-0007`, `INSP-2026-0003`) and it is **still the same after a reload** (it used to change to made-up `EVT-101…` labels). "Asset Created" / "Asset Updated" entries show no Ref. Older entries from before 21 Sep show no Ref (the old duplicated entries have been removed).
- [ ] **6.5 Notification sound** 🔴 — Click anywhere on the page once (browsers only allow sound after a click/tap). **Admin window:** have someone raise a service request (guest on mobile, or another user) → a short **two-note chime** plays and the bell count goes up. The chime does **not** play when you open or refresh a page that already has open requests, when you navigate between pages, or for a request **you** raised. **Technician on mobile:** assign them a work order or inspection → chime + the bell gets an unread item. In either bell menu, the **speaker button** mutes/unmutes (turning it on plays a sample); the choice survives a reload and is per browser. Muted → no sound.
- [ ] **6.6 Mobile request form — no "General Room Fixture"** — On `/mobile`, raise a **Maintenance** request and choose a room that has equipment: the equipment dropdown starts on **"-- Select the equipment --"** (not selectable as an answer), and submitting without choosing shows *"Please select the equipment that needs attention."*. A room with **no** registered equipment still shows the note that the ticket is logged for the room itself and can be submitted. **Housekeeping** requests are unaffected.

---

## 7. Features built before the roadmap (worth showing the client)

- [ ] **Guest login by email** — sign in again with the same email (name left blank) → same name, earlier requests visible; a different phone number doesn't rename them.
- [ ] **Forgot password** link on the login page → email → set-new-password page → can sign in (needs the email-template setting in `YOUR-ACTIONS.md`).
- [ ] **Users page** — *Registered* / *Guests* tabs; guest detail shows access log with **dates (DD-MM-YYYY)** and raised requests; registered detail also shows assigned assets and raised requests; no UUIDs in the registered list.
- [ ] **Assignments** — asset / work order / inspection assignee dropdowns list **registered users only** (no guests).
- [ ] **Housekeeping page** — work orders shown as a **table**; *Assign / Reassign* to a Housekeeping user; a housekeeping order created from a request is **not** auto-assigned to anyone (the Admin assigns it).
- [ ] **Mobile** — a **completed** work order opens **read-only**; the Housekeeping link appears under Maintenance in the sidebar.

---

## 8. Not built (don't demo as working)

- [ ] The **header search bar** is hidden — there is no global search yet.
- [ ] No table pagination / sorting controls yet (TanStack Table is a later stage).
- [ ] Modals still close only by their button (no Escape-to-close yet).

## 9. Production smoke test (after deploy)

- [ ] Login as Admin, Technician and a guest; dashboard loads with data.
- [ ] Create one request → work order → complete it (section 0 path).
- [ ] Invite a user (email arrives, link opens *set password*).
- [ ] Forgot-password email link works.
- [ ] Check the browser console for errors on Dashboard, Assets, Work Orders and `/mobile`.

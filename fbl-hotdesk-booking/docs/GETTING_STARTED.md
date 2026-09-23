# Getting started — from sample data to a real system

Follow this in order. It's a sequencing guide — the exact columns and
flow logic live in `DATA_MODEL.md` and `POWER_AUTOMATE_FLOWS.md`; this
doc tells you what order to do things in and calls out the fiddly bits
(especially the confirmation email and its cancel link) in more detail.

Rough time: an hour or two for someone comfortable in SharePoint/Power
Automate, done in one sitting or spread across a few.

## 0. Before you start

- [ ] A SharePoint site you can create lists on (an existing FBL ops
      site is fine, or a new one).
- [ ] Access to Power Automate in the same Microsoft 365 tenant
      (you'll have this already if you have SharePoint access via
      Curtin O365).
- [ ] A **shared FBL mailbox** to send confirmation emails from — not
      a personal account. You'll sign the "Send an email" connector in
      as this mailbox (or connect with an account that has Send As
      permission on it) when you get to step 4.
- [ ] Know (or guess for now) the GitHub Pages URL this will end up
      live at, e.g. `https://curtin-fbl.github.io/hotdesk-booking/`.
      You'll put this into the cancel link — easy to fix later if it
      changes, it's one value in one flow.

## 1. SharePoint: create the lists + library

In your chosen site, create six lists and one document library:

- [ ] `HD_Locations`
- [ ] `HD_WorkTypes`
- [ ] `HD_Equipment`
- [ ] `HD_Buildings`
- [ ] `HD_Desks`
- [ ] `HD_Bookings`
- [ ] `HD_DeskPhotos` — a **document library**, not a list

Exact columns for each are in `DATA_MODEL.md`. Two things worth doing
while you're in there:

- [ ] On `HD_Desks`, set **Enforce unique values** on the `Title`
      column (list settings → columns → Title → additional column
      settings). This backstops the duplicate-desk-code check the
      flows do, at the platform level.
- [ ] Skip `HD_Admins` for now — it's only needed if you later switch
      the admin login away from the shared access code (see the open
      question in `README.md`).

Add your real locations/buildings/work types/equipment now if you
want (Bentley, City, your actual building codes, etc.) — or leave the
lists empty and add everything through the admin screen once flows 1
and 8/9 are live, whichever's easier for you.

## 2. Power Automate: the read-only flows first

Build these five in any order — each is safe to test in isolation the
moment it's saved, no data gets written:

- [ ] `HD_GetLocations`
- [ ] `HD_GetBuildings`
- [ ] `HD_GetWorkTypes`
- [ ] `HD_GetEquipment`
- [ ] `HD_GetDesks`

Full spec for each in `POWER_AUTOMATE_FLOWS.md` (#1–5). Test each one
by pasting its URL straight into a browser tab — a GET flow with no
required body just returns JSON on load. `HD_GetDesks` needs query
parameters to test properly, e.g.:
`...?buildingId=1&date=2026-10-01&start=08:00&end=17:00`

## 3. The booking flow — the one to get right

### 3a. `HD_CreateBooking`

This is the flow that matters most, since it's what a person actually
sees. Full field-by-field spec is `POWER_AUTOMATE_FLOWS.md` #6, but
here's the shape of it as a build order:

- [ ] Trigger: POST, with a Request Body JSON Schema generated from:
      `{"deskId":12,"date":"2026-10-01","start":"09:00","end":"12:00","staffId":"1234567A","email":"g.smith@curtin.edu.au"}`
- [ ] **Get items** on `HD_Bookings`, filtered to the same desk, same
      date, `Status eq 'Confirmed'`, and overlapping the requested
      time. Because the times are zero-padded "HH:mm" strings, you can
      do the overlap test right in the filter query — no separate
      Apply-to-each needed:
      `DeskId eq '<deskId>' and BookingDate eq '<date>' and Status eq 'Confirmed' and StartTime lt '<end>' and EndTime gt '<start>'`
- [ ] **Condition**: did that return any rows? If yes → **Response**
      `{"success":false,"reason":"already_booked"}` and stop here.
- [ ] **Compose** a `CancelToken`: expression `guid()`.
- [ ] **Get item** on `HD_Desks` (by `deskId`) → gives you Room,
      DeskNumber, BuildingId.
- [ ] **Get item** on `HD_Buildings` (by that BuildingId) → gives you
      the building's Code.
- [ ] **Compose** the desk code by concatenating Code + "-" + Room +
      "-" + DeskNumber (e.g. "B407-333-D01") — you'll use this twice,
      in the list item's Title and in the email.
- [ ] **Create item** on `HD_Bookings`: Title (desk code + date, for
      readability in the list view), DeskId, BookingDate, StartTime,
      EndTime, StaffId, Email, Status = "Confirmed", CancelToken (from
      the Compose step), CreatedUtc = `utcNow()`.
- [ ] **Compose** the cancel link:
      `concat('https://YOUR-PAGES-URL/cancel.html?booking=', outputs('Create_item')?['body/ID'], '&token=', <the CancelToken compose output>)`
      — swap in your real GitHub Pages URL.
- [ ] **Send an email (V2)** — see 3b below, this is the part worth
      slowing down for.
- [ ] **Response**: `{"success":true,"bookingId": <the new item's ID>}`

### 3b. The email itself

- Connect the "Send an email (V2)" action signed in as the **shared
  FBL mailbox**, not your own account — otherwise every confirmation
  (and every reply/bounce) comes from and goes to your personal inbox.
  If the mailbox can't sign in directly, connect with an account that
  has **Send As** permission on it instead.
- **To:** the booking's email (from the trigger body).
- **Subject:** something like `Desk booking confirmed — B407-333-D01, 2026-10-01`
  (built from the desk code and date Composed earlier).
- **Body:** plain text or simple HTML is fine — date, time, desk code,
  and the Curtin ID, plus the cancel link as an actual clickable link:
  `<a href="[cancel link]">Cancel this booking</a>`. Keep it short;
  this isn't a marketing email.

### 3c. `HD_CancelBooking` — where that link goes

Spec is `POWER_AUTOMATE_FLOWS.md` #7. Short enough to just build
directly:

- [ ] Trigger: **GET** (a link clicked from an email can only ever be
      a GET — there's no way to make an emailed link fire a POST).
      Two query parameters: `booking` and `token`.
- [ ] **Get item** on `HD_Bookings` by the `booking` ID.
- [ ] **Condition**: does that item's `CancelToken` equal the `token`
      query parameter?
  - No → **Response** `{"success":false,"reason":"invalid_token"}`.
  - Yes → **Update item**: `Status = "Cancelled"` → **Response**
    `{"success":true}`.

That's the whole loop closed: book → email → click → cancelled. Test
it end to end once both flows are live — book a desk from the app
using an email address you can actually check, confirm the email
arrives and reads sensibly, click the cancel link, confirm
`cancel.html` shows the cancelled message, and confirm the desk shows
as free again in a fresh search.

## 4. The admin flows

- [ ] `HD_AdminSave` and `HD_AdminDelete` (#8–9) — the shared CRUD
      flows behind every admin tab. The `HD_Desks` branch of
      `HD_AdminSave` has two extra pieces worth not skimming:
      the duplicate-desk-code check, and the three-way branch on
      `PhotoUrl` (a `data:` URL means upload it to `HD_DeskPhotos` and
      swap in the resulting link; an `https://` URL means leave it
      alone; empty means clear it). Both are spelled out in full in
      `POWER_AUTOMATE_FLOWS.md`.
- [ ] `HD_AdminGetAll` (#10) — bundles all five lists for the admin
      screens in one call.
- [ ] `HD_AdminGetBookings` and `HD_AdminCancelBooking` (#12–13) — back
      the admin Bookings tab (search by day/desk/Curtin ID/email, and
      cancel from there directly).
- [ ] `HD_CheckAdminAccess` (#11) — **skip this for now.** It's only
      needed if you switch the admin login away from the shared access
      code later.

## 5. Wire it up

- [ ] Open `js/config.js` and paste each flow's URL into the matching
      key (`getLocations`, `getBuildings`, and so on — the key names
      match the flow names).
- [ ] Turn flows on one at a time if you'd rather test incrementally —
      any endpoint left blank just keeps using sample data, so nothing
      breaks while the rest are still empty.

## 6. Go live

- [ ] Push the folder to GitHub Pages — see `SETUP.md`.
- [ ] Update the cancel-link URL in `HD_CreateBooking` (step 3a above)
      to the real Pages URL if you guessed at it earlier.
- [ ] Change `adminAccessCode` in `js/config.js` from `fbl-desks` to
      something real before sharing the admin link with anyone.
- [ ] Do one full real-world test: book a desk, get the email, cancel
      it, check it shows as free again — same as the test in step 3c,
      but against the live GitHub Pages site instead of a local file.

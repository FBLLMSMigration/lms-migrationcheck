# FBL Hotdesk Booking

A staff hotdesk booking tool for FBL — replaces the WordPress/Webba
Booking plugin. Same architecture as the LMS Migration Check: a static
site on GitHub Pages, with Power Automate HTTP flows standing in for a
backend and SharePoint lists standing in for a database. Nothing to
host, nothing to patch.

## Branding
Colours are sampled directly from Curtin's logo and the FBL green
button you supplied — charcoal `#231F20` (masthead, text), FBL green
`#566D31` (primary buttons, borders, active states), gold `#C5960C`
(a sparing accent). Buttons are the pill shape with bold uppercase
text from your reference image. `assets/curtin-logo.png` is the actual
logo file you provided, wired into the masthead on every page; if it's
ever missing (e.g. left out of a deploy), every page falls back
automatically to a plain text "Curtin University" mark instead of
breaking.

## Where's the data?
Right now: nowhere but your browser. There's no backend wired up yet,
so everything runs on sample data held in `localStorage` — nothing
leaves your machine, nothing is shared between people who open the
link, and it resets if the browser's site data is cleared. Once the
Power Automate flows below are built, real bookings live in SharePoint
lists — that's the production home for the data (see
`docs/DATA_MODEL.md`). Desk photos are the one exception: they'll live
in a SharePoint document library rather than a list — see the note in
`docs/DATA_MODEL.md`.

## What's here

```
index.html          End-user booking: location → date/time → desk grid → book
cancel.html          Landing page for the "cancel booking" link in confirmation emails
admin.html           Admin console: locations, work types, equipment, buildings, desks, bookings
css/styles.css       All styling
js/config.js         Power Automate endpoint URLs — edit this file to go live
js/api.js            Talks to the real flows if configured, otherwise the mock backend
js/mockdata.js       Sample data + booking logic, held in the browser's localStorage
js/booking.js        End-user page logic
js/admin.js          Admin page logic
js/cancel.js         Cancel page logic
assets/curtin-logo.png      The Curtin logo, shown in the masthead
docs/DATA_MODEL.md          The six SharePoint lists (+ one document library) and their columns
docs/POWER_AUTOMATE_FLOWS.md  Every flow to build, with exact request/response JSON
docs/SETUP.md               Deploying to GitHub Pages, wiring up config.js
```

## Try it now
Open `index.html` in a browser (or serve the folder any way you like —
no build step, no dependencies to install). It runs on sample data —
two locations, three buildings, a handful of desks — until you wire up
the real flows. Book a desk, then open `admin.html` (access code
`fbl-desks` for now — see the open question below) to see the same
data from the management side.

## End-user flow
There's a number of hotdesks available for FBL staff to book at both
Perth City and Bentley campuses. Pick a desk location (every building
shown as a button, tagged Bentley or City — no separate campus step,
there aren't enough locations to warrant it) → pick a date (one-tap
chips for today through the next week, or the native date picker for
anything further out — the native picker is deliberate: it's the best
calendar UX mobile already has, finger-friendly out of the box) and a
time range on a slider (8am–9pm, defaults to 8–5, with every hour
marked along the track) → see every desk in that building grouped by
work type (open plan, office, quiet zone…), each group with a short
description, colour-coded free or taken. Each desk tile shows its full
code (e.g. `B407-333-D01`) and a short equipment label (e.g. "2x
Screens/Dock") right on the tile. Click a free desk → see a photo of
it if one's been added, its full code, equipment, and the time →
pick Staff / Student / Visitor, enter an ID, and the email fills in
automatically (`<id>@curtin.edu.au` for staff, `<id>@student.curtin.edu.au`
for students; Visitor leaves email blank for you to fill in) — every
field stays editable in case it needs correcting → confirm. A
confirmation email goes out with a link to cancel.

Both the ID and email fields use standard browser autocomplete, so
returning users get the browser's own remembered-value suggestions on
both desktop and mobile — nothing extra to build or configure for that.

### Why it can't read a Curtin computer's login automatically
Worth addressing directly since it came up: a web page has no way to
read the Windows/OS username of the computer it's running on — that's
not a gap in this build, it's a security boundary every browser
enforces, and no JavaScript (here or anywhere) can cross it. The one
real path to something like this is Microsoft 365 sign-in: if end
users signed into the booking page with their Curtin Microsoft 365
account (the same SSO option mentioned below for admin login), the
signed-in account's ID and type would be known without anyone typing
anything. That's a genuinely different trade-off though — it means
every booking requires signing in first, which cuts against the "as
easy as possible, no login" brief this was built around. Happy to
build that version if the trade-off is worth it to you; just say so.

## Desk naming
Each desk's code is **Building code + Room/area + Desk number**, e.g.
`B407-333-D01`. It has to be unique — the admin screen blocks a save
that would duplicate an existing building/room/desk-number combination,
and `docs/DATA_MODEL.md` has a note on adding a matching **Enforce
unique values** constraint in SharePoint itself as a second guarantee.
The desk number itself is auto-assigned (next free number for that
building+room) and locked in the admin screen — an admin has to
re-enter the access code to unlock it and set one manually, e.g. to
fill a gap left by a deleted desk.

## Admin flow
Six tabs:
- **Locations** — Bentley, City, etc.
- **Work types** — Open plan, Office, Quiet zone…, each with a
  description shown to staff.
- **Equipment** — what's at a desk, each with a full name (shown in
  the booking confirmation) and a short label (shown on the desk tile).
- **Buildings** — each with a short code (e.g. "B407") and a location.
- **Desks** — building, room, work type, equipment, available days and
  hours, an optional photo, and active/inactive. The photo is resized
  in the browser before it's stored, so uploads stay small regardless
  of the original file size.
- **Bookings** — look up who's booked what, by day (one-tap chips
  centred on today, or the date picker for any day past or future),
  by desk, by Curtin ID, or by email. Admins can cancel a booking from
  here directly — note this doesn't email the staff member, so let
  them know separately if that matters.

A desk that's outside its own available window, or already booked over
the requested time, shows as taken to end users automatically.

## What's built vs what's still needed
The front end above is complete and fully working against sample data.
What's still needed to go live:
1. Create the six SharePoint lists and the one document library in
   `docs/DATA_MODEL.md`.
2. Build the thirteen Power Automate flows in
   `docs/POWER_AUTOMATE_FLOWS.md` — each one is short, and the doc
   gives the exact fields and logic, including how the desk-photo
   upload should be handled.
3. Paste the resulting URLs into `js/config.js`.
4. Push to GitHub Pages (see `docs/SETUP.md`).

None of this requires touching the HTML/CSS/JS above — the mock backend
and the real flows implement the identical contract, so the switch is
config-only.

## One open decision: admin login
Right now `admin.html` is gated by a single shared access code
(`js/config.js` → `adminAccessCode`), the simplest option and a
placeholder until you decide. Two better long-term options, both of
which I'll build once you pick one:
- **Email allow-list** — a small `HD_Admins` SharePoint list of approved
  staff emails; the login screen just asks for an email and checks it
  against the list (flow spec is already written, `HD_CheckAdminAccess`).
- **Microsoft 365 sign-in** — real SSO via Curtin's Entra ID, so admins
  sign in with their existing staff account and no code/password exists
  anywhere. More secure and no code to share around, but needs an app
  registration in Curtin's tenant, which I can't set up myself.

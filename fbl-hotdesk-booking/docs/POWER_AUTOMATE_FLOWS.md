# Power Automate flows

Thirteen flows, all triggered by **"When an HTTP request is received"**.
Each one becomes a URL you paste into `js/config.js`. Build them in this
order — the first six are read-only and safe to test straight away; the
booking and cancel flows write data and send email.

Every flow's trigger uses **Request Body JSON Schema** generated from the
example payload shown under "Request". Every flow ends with a
**Response** action, Content-Type `application/json`, body built with
`compose` from the example under "Response". Keep the field names exact —
`js/api.js` reads them by name.

---

## 1. HD_GetLocations
**Trigger:** GET, no parameters.
**Actions:** Get items (HD_Locations) → Select (id: `ID`, name: `Title`) → Response.
**Response**
```json
[ { "id": 1, "name": "Bentley" }, { "id": 2, "name": "City" } ]
```

## 2. HD_GetBuildings
**Trigger:** GET. Query parameter `locationId` — **optional**: when
present, filter to that location (end-user flow); when blank, return
every building with its `locationId` included (admin "all buildings"
table).
**Actions:** Get items (HD_Buildings), ordered by `SortOrder ascending`;
if `locationId` is provided, add the filter query `LocationId eq
'<locationId>'`; Select (id: `ID`, name: `Title`, code: `Code`,
locationId: `LocationId`, sortOrder: `SortOrder`) → Response.
**Response**
```json
[ { "id": 5, "name": "Building 407", "code": "B407", "locationId": 1, "sortOrder": 1 } ]
```

## 3. HD_GetWorkTypes
**Trigger:** GET, no parameters.
**Response**
```json
[ { "id": 1, "name": "Open plan", "description": "Shared desks, no partitions" } ]
```

## 4. HD_GetEquipment
**Trigger:** GET, no parameters.
**Actions:** Get items (HD_Equipment) → Select (id: `ID`, name: `Title`, shortName: `ShortName`) → Response.
**Response**
```json
[
  { "id": 1, "name": "Two screens and a laptop dock", "shortName": "2x Screens/Dock" },
  { "id": 2, "name": "Single curved screen and dock", "shortName": "1x Curved Screen/Dock" },
  { "id": 3, "name": "No equipment", "shortName": "No Equipment" }
]
```

## 5. HD_GetDesks
The one with real logic: return every active desk in a building, each
flagged as available or not for the requested date/time.

**Trigger:** GET. Query parameters `buildingId`, `date` (YYYY-MM-DD),
`start` (HH:mm), `end` (HH:mm).

**Actions:**
1. Get items (HD_Desks), filter `BuildingId eq '<buildingId>' and Active eq 1`.
2. Get items (HD_Bookings), filter `BookingDate eq '<date>' and Status eq 'Confirmed'`.
3. Apply to each desk:
   - Work out the day name from `date` (expression: `dayOfWeek` → map 0–6 to Sun–Sat, or use `formatDateTime(date,'ddd')`).
   - `isOpenDay` = day name is in the desk's `AvailableDays` (use `contains`).
   - `isInWindow` = requested `start` >= desk `AvailableStart` **and** requested `end` <= desk `AvailableEnd` (string compare works fine for zero-padded "HH:mm").
   - `hasClash` = any booking with matching `DeskId` where requested start < booking `EndTime` **and** requested end > booking `StartTime` (standard overlap test).
   - `available` = `isOpenDay` and `isInWindow` and not `hasClash`.
4. Select into the response shape below. The front end already has the
   building's code (from HD_GetBuildings) and builds the full desk code
   (e.g. "B407-333-D01") itself from `room` + `deskNumber` — no need to
   compute it in this flow. `photoUrl` is the desk's `PhotoUrl` column,
   or `""` if blank — it's a small string either way, so including it
   here doesn't meaningfully bloat this response even across many desks.

**Response**
```json
[
  { "id": 12, "room": "333", "deskNumber": "D01", "workTypeId": 1, "equipmentId": 1, "photoUrl": "https://curtin.sharepoint.com/.../desk12.jpg", "available": true },
  { "id": 13, "room": "333", "deskNumber": "D02", "workTypeId": 1, "equipmentId": 3, "photoUrl": "", "available": false }
]
```

## 6. HD_CreateBooking
**Trigger:** POST.
**Request**
```json
{ "deskId": 12, "date": "2026-09-22", "start": "09:00", "end": "12:00", "staffId": "12345678", "email": "g.smith@curtin.edu.au" }
```
**Actions:**
1. Re-run the same clash check as flow 5 for this one desk (Get items on
   HD_Bookings filtered by `DeskId` and `BookingDate`, overlap test on
   start/end). If it clashes, skip to the response with `success: false`.
2. `Compose` a GUID for `CancelToken`: expression `guid()`.
3. Create item in HD_Bookings: DeskId, BookingDate=date, StartTime=start,
   EndTime=end, StaffId, Email, Status="Confirmed", CancelToken (from
   step 2), CreatedUtc=`utcNow()`.
4. Look up the desk's `Title` (the full code, e.g. "B407-333-D01") to
   write a readable email.
5. Send an email (V2) — Office 365 Outlook connector, **from a shared FBL
   mailbox**, to the booking's `email`:
   - Subject: `Desk booking confirmed — <desk Title>, <date>`
   - Body: date, time, desk code, staff ID, and a cancel link:
     `https://<your-github-pages-domain>/cancel.html?token=<CancelToken>&booking=<new item ID>`
6. Response.
**Response**
```json
{ "success": true, "bookingId": 88 }
```
On a clash: `{ "success": false, "reason": "already_booked" }`.

## 7. HD_CancelBooking
**Trigger:** GET (a link in an email can only be a GET). Query parameters
`booking` (item ID) and `token`.
**Actions:**
1. Get item (HD_Bookings, by ID from `booking`).
2. Condition: does its `CancelToken` equal the `token` query parameter?
   - No → Response `{ "success": false, "reason": "invalid_token" }`.
   - Yes → Update item: `Status = "Cancelled"` → Response `{ "success": true }`.
**Response**
```json
{ "success": true }
```

## 8–9. Admin write flows: HD_AdminSave, HD_AdminDelete
Two small CRUD flows that cover all five manageable lists (Locations,
WorkTypes, Equipment, Buildings, Desks) — this is intentionally the
boring, repetitive part:

- **Trigger:** POST, body `{ "listName": "HD_Desks", "id": 12, "fields": { ... } }` for save, or `{ "listName": "HD_Desks", "id": 12 }` for delete.
- **Actions:** a Switch on `listName`, each branch doing a plain "Create
  item" (when `id` is empty/absent) or "Update item" (when `id` is
  present) — or "Delete item" for the delete flow — against the matching
  list, using `fields` as the field map.
- **Response:** `{ "success": true, "id": 12 }`.

**Important: `fields` is a *partial* update on an edit.** The front end
sometimes sends only one or two keys on purpose — e.g. reordering
buildings sends just `{ "sortOrder": 4 }`, nothing else. On the Update
Item branch, every column needs a fallback to its **current** value
when `fields` doesn't include it, rather than a blind direct mapping —
otherwise a partial save like that would blank out the building's
Name/Code/LocationId. The pattern for every column is the same:
`coalesce(fields?['ColumnName'], item()?['ColumnName'])` (or, in the
UI, "Fields.ColumnName" with a fallback to the existing item's value —
however your version of the Update Item action exposes that). Create
doesn't have this problem since there's no existing item to preserve.

**One extra step, only on the `HD_Desks` branch of `HD_AdminSave`:**
before the Create/Update, check for a duplicate desk code. Get items on
HD_Desks filtered by `BuildingId eq '<fields.BuildingId>' and Room eq
'<fields.Room>' and DeskNumber eq '<fields.DeskNumber>'` (and, on an
edit, exclude the row's own `id` from the results). If that returns any
row, skip the write and respond `{ "success": false, "reason":
"duplicate_desk_code" }` instead. Also set `Title` on the Create/Update
to the computed code (`<building Code>-<Room>-<DeskNumber>` — a quick
"Get item" on HD_Buildings gets you the building's `Code`). This, plus
**Enforce unique values** on HD_Desks' `Title` column (see
`DATA_MODEL.md`), means a duplicate code can't get through either by a
bug in this flow or by two people saving at the same moment.

`DeskNumber` itself is auto-assigned by the front end (the admin screen
locks the field and computes "next" locally before ever calling this
flow), so this flow doesn't need any special-case numbering logic — it
just receives whatever `fields.DeskNumber` the front end sent, same as
any other field.

**Desk photos:** `fields.PhotoUrl` on the `HD_Desks` branch can arrive
in three shapes — branch on which one it is before writing:
- **Starts with `data:`** — a new or changed photo. Decode the base64
  payload (strip the `data:image/...;base64,` prefix first), use
  "Create file" to save it into the `HD_DeskPhotos` document library
  (a filename like `guid() + ".jpg"` avoids collisions), then use that
  file's web URL as the actual `PhotoUrl` value you write to HD_Desks —
  never write the `data:` string itself into the list column.
- **A `https://` URL** — an existing photo, untouched since the last
  save. Write it straight through, no re-upload needed.
- **Empty string** — no photo (or the admin removed it). Clear the
  column.

Collapsing five entities into one save flow and one delete flow (rather
than ten separate flows) keeps the Power Automate side small; the
Switch branches are short because every list here has 3–8 columns.

## 10. HD_AdminGetAll
The admin console's five management tabs need the raw, unfiltered rows
(with their schedule/description fields, not the date-specific
availability that HD_GetDesks computes) — this one flow returns all of
it in a single call so the admin screens aren't juggling five separate
requests.

**Trigger:** GET, no parameters.
**Actions:** Get items on each of the five lists (Locations, Buildings,
WorkTypes, Equipment, Desks — full column set) → Select each → Compose
the object below → Response.
**Response**
```json
{
  "locations": [ { "id": 1, "name": "Bentley" } ],
  "buildings": [ { "id": 5, "name": "Building 407", "code": "B407", "locationId": 1, "sortOrder": 1 } ],
  "workTypes": [ { "id": 1, "name": "Open plan", "description": "Shared desks, no partitions" } ],
  "equipment": [ { "id": 1, "name": "Two screens and a laptop dock", "shortName": "2x Screens/Dock" } ],
  "desks": [
    { "id": 12, "room": "333", "deskNumber": "D01", "buildingId": 5, "workTypeId": 1, "equipmentId": 1,
      "availableDays": "Mon,Tue,Wed,Thu,Fri", "availableStart": "08:00",
      "availableEnd": "17:00", "active": true, "photoUrl": "https://curtin.sharepoint.com/.../desk12.jpg" }
  ]
}
```

## 11. HD_CheckAdminAccess
Only needed if you switch the admin login from the shared access code
to the email allow-list option later.
**Trigger:** POST, body `{ "email": "g.smith@curtin.edu.au" }`.
**Actions:** Get items (HD_Admins), filter `Title eq '<lower-cased email>'`.
**Response:** `{ "isAdmin": true }` or `{ "isAdmin": false }`.

## 12. HD_AdminGetBookings
Backs the admin console's Bookings tab — look up who's booked what by
day (a single day, or a range), desk, Curtin ID, or email. Defaults to
"every upcoming booking" when the front end sends only `dateFrom` (set
to today) with no `dateTo`.

**Trigger:** GET. Query parameters `dateFrom`, `dateTo`, `deskId`,
`email`, `staffId` — all **optional**; apply only the ones that are
present, as `and` conditions in the filter query:
- `dateFrom` present → `BookingDate ge '<dateFrom>'`
- `dateTo` present → `BookingDate le '<dateTo>'`
- Both present → both conditions, giving an inclusive range
- Neither present → no date restriction at all (every booking, ever)

Since `BookingDate` is stored as a zero-padded "YYYY-MM-DD" string,
plain string comparison (`ge`/`le`) sorts correctly in chronological
order — no date-type conversion needed in the filter itself.

**Actions:** Get items (HD_Bookings) with whichever filters were
supplied → for each row, "Get item" on HD_Desks (by `DeskId`) and
HD_Buildings (by that desk's `BuildingId`) to build the desk code →
Select into the shape below, sorted by date then start time.
**Response**
```json
[
  { "id": 88, "deskId": 12, "deskCode": "B407-333-D01", "bookingDate": "2026-09-22",
    "startTime": "09:00", "endTime": "12:00", "staffId": "12345678",
    "email": "g.smith@curtin.edu.au", "status": "Confirmed", "createdUtc": "2026-09-20T03:00:00Z" }
]
```

## 13. HD_AdminCancelBooking
The admin console's "Cancel" button on a booking — same effect as
`HD_CancelBooking`, but called from the authenticated admin screen
rather than an emailed link, so it doesn't need the `CancelToken`
check.
**Trigger:** POST, body `{ "id": 88 }`.
**Actions:** Update item (HD_Bookings, by `id`): `Status = "Cancelled"` → Response.
**Response**
```json
{ "success": true }
```
Note this doesn't email the staff member — if they need to know, that's
a manual follow-up for now.

---

## CORS
Power Automate HTTP-triggered flows allow cross-origin calls from any
origin by default, so calls from your GitHub Pages domain will work with
no extra configuration. If you later restrict it, allow your Pages
domain explicitly.

## Auth on the HTTP trigger
Set every trigger's "Who can trigger the flow" to **Anyone**, and treat
the auto-generated URL itself as the secret — anyone with the URL can
call the flow. This matches the LMS Migration Check's approach. Don't
put these URLs in a public GitHub repo's committed `config.js`; see
`SETUP.md` for keeping them out of version control.

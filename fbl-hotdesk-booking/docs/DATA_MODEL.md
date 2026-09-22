# Data model — SharePoint lists

Same pattern as the LMS Migration Check: no database, no server. SharePoint
lists hold the data, Power Automate flows read/write them, GitHub Pages
serves the static front end that calls the flows over HTTP.

Create one SharePoint site (or reuse an existing FBL ops site) with six
lists and one document library. Column names below are what the flows in
`POWER_AUTOMATE_FLOWS.md` expect — keep them exact, or update the flows to
match.

## HD_Locations
Top-level campus, e.g. Bentley, City.

| Column | Type | Notes |
|---|---|---|
| Title | Single line text | Location name, e.g. "Bentley" |

## HD_Buildings
| Column | Type | Notes |
|---|---|---|
| Title | Single line text | Building name, e.g. "Building 407" |
| Code | Single line text | Short building code used in the desk naming convention below, e.g. "B407" |
| LocationId | Single line text | The numeric SharePoint item ID of the parent HD_Locations row |
| SortOrder | Number | Controls display order — both in the admin table and as the building buttons on the booking page. The admin screen's up/down arrows swap this value between two adjacent buildings; a new building gets `max(existing) + 1` so it lands at the end. |

## HD_WorkTypes
| Column | Type | Notes |
|---|---|---|
| Title | Single line text | e.g. "Office", "Open plan", "Quiet zone" |
| Description | Multiple lines of text | Shown to end users under the group heading |

## HD_Equipment
The set of desk equipment options staff can choose between when adding a
desk (e.g. "Two screens and a laptop dock", "Single curved screen and
dock", "No equipment"). Kept as its own small list, same pattern as
HD_WorkTypes, so new equipment options can be added later without
touching any code.

| Column | Type | Notes |
|---|---|---|
| Title | Single line text | Full name, e.g. "Two screens and a laptop dock" — shown in the booking confirmation |
| ShortName | Single line text | Compact label shown directly on the desk tile, e.g. "2x Screens/Dock" |

## HD_Desks
Each desk's unique code is Building code + Room/Area + Desk number, e.g.
**B407-333-D01**. `Title` holds that computed code so it's the thing
admins see in the SharePoint list view, but `Room` and `DeskNumber` are
stored separately so the admin screen can edit them individually.

| Column | Type | Notes |
|---|---|---|
| Title | Single line text | Computed: `{building Code}-{Room}-{DeskNumber}`, e.g. "B407-333-D01". Set **Enforce unique values** on this column in the list's column settings — that gives you a hard guarantee against duplicates at the SharePoint level, on top of the check `HD_AdminSave` does before writing (see below) |
| Room | Single line text | Room/area number, e.g. "333" |
| DeskNumber | Single line text | Desk number within the room, e.g. "D01" — set once by `HD_AdminSave`'s auto-numbering; the admin screen locks this field behind a re-entered access code so it isn't casually overwritten |
| BuildingId | Single line text | Item ID of the parent HD_Buildings row |
| WorkTypeId | Single line text | Item ID of the parent HD_WorkTypes row |
| EquipmentId | Single line text | Item ID of the parent HD_Equipment row |
| AvailableDays | Single line text | Comma list of days it can ever be booked, e.g. "Mon,Tue,Wed,Thu,Fri" |
| AvailableStart | Single line text | 24h "HH:mm", e.g. "08:00" |
| AvailableEnd | Single line text | 24h "HH:mm", e.g. "17:00" |
| Active | Yes/No | Turn a desk off without deleting its booking history |
| PhotoUrl | Single line text | Direct link to the desk's photo in the `HD_DeskPhotos` document library below. Blank if no photo. |

### HD_DeskPhotos (document library, not a list)
A plain SharePoint **document library** (not a list) to hold the actual
photo files. `HD_AdminSave`'s desk branch uploads to this library and
writes the resulting file's URL into `PhotoUrl` above — see
`POWER_AUTOMATE_FLOWS.md` for exactly how. No columns of its own beyond
the default ones a document library already has.

One thing worth checking once this is live: whether staff can actually
view files in this library without extra prompts. If they're already
signed into Curtin's Microsoft 365 in the browser they're booking from
(likely, for staff on a Curtin device), it should just work; if the
library's permissions are locked down further than that, the photo may
prompt for sign-in or fail to load for some staff. Worth a quick test
with a non-admin account after setup.

## HD_Bookings
| Column | Type | Notes |
|---|---|---|
| Title | Single line text | Auto — set to the desk code + date for readability in the SharePoint UI |
| DeskId | Single line text | Item ID of the HD_Desks row |
| BookingDate | Single line text | "YYYY-MM-DD" |
| StartTime | Single line text | "HH:mm" |
| EndTime | Single line text | "HH:mm" |
| StaffId | Single line text | Holds the Curtin ID — column name kept as `StaffId` to avoid a breaking rename across the flows |
| Email | Single line text | |
| Status | Choice: Confirmed, Cancelled | |
| CancelToken | Single line text | GUID generated at booking time, put in the cancel-link URL so a booking can only be cancelled by whoever holds the confirmation email |
| CreatedUtc | Single line text | ISO timestamp |

Optional, only if you want the email allow-list admin login rather than
Microsoft 365 sign-in (see the open question in the chat):

## HD_Admins
| Column | Type | Notes |
|---|---|---|
| Title | Single line text | Staff email address, lower-cased |

## Why item IDs as plain text instead of SharePoint Lookup columns

Lookup columns work, but every extra lookup is one more thing that can
silently break when a list gets recreated or renamed, and Power Automate's
"Get items" filter syntax on lookups is fiddlier than on plain text/number
columns. Storing the parent's numeric ID as a single-line text field keeps
every flow a plain `Filter query: LocationId eq '3'`, easy to read and
easy to fix by hand in the SharePoint UI if something ever needs manual
correction.

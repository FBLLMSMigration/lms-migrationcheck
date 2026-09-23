# Setup

## Running it right now, with no backend at all
Open `index.html` and `admin.html` directly (or push the repo to GitHub
Pages). With `js/config.js` left at its defaults, the app runs entirely
on sample data held in the browser's `localStorage` — Bentley/City,
two buildings, three work types, a dozen desks. Every screen works:
searching, booking, cancelling, and all the admin CRUD screens. This is
so you and colleagues can click through the real UX before a single
Power Automate flow exists.

Nothing you do in this mode reaches SharePoint — it's local to whichever
browser you're using, and resets if you clear site data. Use it for
review and sign-off, not for a real desk roster.

## Switching a flow on
Build the flows in `POWER_AUTOMATE_FLOWS.md` one at a time. Each one
gives you an HTTP POST URL when you save it (Power Automate shows it on
the trigger step). Paste each URL into the matching key in
`js/config.js`:

```js
const CONFIG = {
  endpoints: {
    getLocations: "",   // HD_GetLocations URL here
    getBuildings: "",
    getWorkTypes: "",
    getDesks: "",
    createBooking: "",
    cancelBooking: "",
    adminSave: "",
    adminDelete: "",
    checkAdminAccess: "",
  },
  adminAccessCode: "changeme",
};
```

`js/api.js` checks each key: empty string → use the local mock data for
that call; a URL → call the real flow. You can turn flows on one at a
time and the rest keep using mock data, which makes testing each flow in
isolation straightforward.

## Keeping the flow URLs out of a public repo
Power Automate HTTP trigger URLs embed a long shared-secret query string
— anyone with the URL can call the flow. If the GitHub repo is public:
- Make the repo private (GitHub Pages works fine on a private repo with
  GitHub Pro/Education, or Curtin's GitHub org plan), **or**
- Keep `js/config.js` out of the repo (add it to `.gitignore`, commit
  `js/config.example.js` instead) and paste the real file onto the
  server after deploying — GitHub Pages will still serve it, it's just
  never in version control, **or**
- Put a rotating check inside each flow itself (e.g. a shared header
  value your JS sends) rather than relying on URL secrecy alone.

## Custom domain / branding
GitHub Pages serves from `https://<org>.github.io/<repo>/` by default,
or a custom domain via a `CNAME` file — same as the LMS Migration Check.

## Email sender
`HD_CreateBooking`'s "Send an email (V2)" step should send from a shared
FBL mailbox (e.g. a shared mailbox Outlook connection), not a personal
account, so cancellations and replies land somewhere the whole team can
see, and so the tool doesn't stop working if one person leaves.

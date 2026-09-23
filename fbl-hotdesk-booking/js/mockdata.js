// Stand-in for the Power Automate flows in docs/POWER_AUTOMATE_FLOWS.md.
// Every function here returns the exact same shape the real flow would,
// so js/api.js can swap one for the other without the rest of the app
// knowing the difference. Backed by localStorage so it persists across
// a page reload but never leaves the browser.

const MockBackend = (() => {
  const STORE_KEY = "fbl_hotdesk_mock_v4";

  function seed() {
    return {
      nextId: 100,
      locations: [
        { id: 1, name: "Bentley" },
        { id: 2, name: "City" },
      ],
      buildings: [
        { id: 1, name: "Building 407", code: "B407", locationId: 1, sortOrder: 1 },
        { id: 2, name: "Building 408", code: "B408", locationId: 1, sortOrder: 2 },
        { id: 3, name: "Wesfarmers Centre", code: "WFC", locationId: 2, sortOrder: 3 },
      ],
      workTypes: [
        { id: 1, name: "Open plan", description: "Shared desks, no partitions" },
        { id: 2, name: "Office", description: "Enclosed office space" },
        { id: 3, name: "Quiet zone", description: "Low-traffic area for focused work" },
      ],
      equipment: [
        { id: 1, name: "Two screens and a laptop dock", shortName: "2x Screens/Dock" },
        { id: 2, name: "Single curved screen and dock", shortName: "1x Curved Screen/Dock" },
        { id: 3, name: "No equipment", shortName: "No Equipment" },
      ],
      desks: [
        { id: 1, room: "333", deskNumber: "D01", buildingId: 1, workTypeId: 1, equipmentId: 1, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
        { id: 2, room: "333", deskNumber: "D02", buildingId: 1, workTypeId: 1, equipmentId: 1, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
        { id: 3, room: "333", deskNumber: "D03", buildingId: 1, workTypeId: 1, equipmentId: 2, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
        { id: 4, room: "333", deskNumber: "D04", buildingId: 1, workTypeId: 1, equipmentId: 3, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
        { id: 5, room: "416", deskNumber: "D01", buildingId: 1, workTypeId: 2, equipmentId: 1, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
        { id: 6, room: "416", deskNumber: "D02", buildingId: 1, workTypeId: 2, equipmentId: 2, availableDays: "Mon,Wed,Fri", availableStart: "08:00", availableEnd: "13:00", active: true },
        { id: 7, room: "201", deskNumber: "D01", buildingId: 2, workTypeId: 3, equipmentId: 3, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
        { id: 8, room: "510", deskNumber: "D09", buildingId: 3, workTypeId: 1, equipmentId: 1, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
        { id: 9, room: "510", deskNumber: "D10", buildingId: 3, workTypeId: 1, equipmentId: 2, availableDays: "Mon,Tue,Wed,Thu,Fri", availableStart: "08:00", availableEnd: "17:00", active: true },
      ],
      bookings: [],
    };
  }

  function load() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const fresh = seed();
      localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return JSON.parse(raw);
  }

  function save(db) {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  }

  function dayName(dateStr) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // Parse as local date, not UTC, so "2026-09-22" means the 22nd everywhere.
    const [y, m, d] = dateStr.split("-").map(Number);
    return days[new Date(y, m - 1, d).getDay()];
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
  }

  function isDeskFree(db, desk, date, start, end, ignoreBookingId) {
    const inWindow = start >= desk.availableStart && end <= desk.availableEnd;
    const openDay = desk.availableDays.split(",").includes(dayName(date));
    if (!inWindow || !openDay) return false;
    const clash = db.bookings.some(
      (b) =>
        b.deskId === desk.id &&
        b.bookingDate === date &&
        b.status === "Confirmed" &&
        b.id !== ignoreBookingId &&
        overlaps(start, end, b.startTime, b.endTime)
    );
    return !clash;
  }

  function deskCode(db, desk) {
    const building = db.buildings.find((b) => b.id === desk.buildingId);
    return `${building ? building.code : "?"}-${desk.room}-${desk.deskNumber}`;
  }

  const LIST_KEY = { HD_Locations: "locations", HD_Buildings: "buildings", HD_WorkTypes: "workTypes", HD_Equipment: "equipment", HD_Desks: "desks" };

  return {
    getLocations() {
      return Promise.resolve(load().locations);
    },

    getBuildings(locationId) {
      const db = load();
      const rows = locationId
        ? db.buildings.filter((b) => b.locationId === Number(locationId))
        : db.buildings.slice();
      rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return Promise.resolve(rows);
    },

    getWorkTypes() {
      return Promise.resolve(load().workTypes);
    },

    getEquipment() {
      return Promise.resolve(load().equipment);
    },

    getDesks(buildingId, date, start, end) {
      const db = load();
      const rows = db.desks
        .filter((d) => d.buildingId === Number(buildingId) && d.active)
        .map((d) => ({
          id: d.id,
          room: d.room,
          deskNumber: d.deskNumber,
          workTypeId: d.workTypeId,
          equipmentId: d.equipmentId,
          photoUrl: d.photoUrl || "",
          available: isDeskFree(db, d, date, start, end),
        }));
      return Promise.resolve(rows);
    },

    createBooking({ deskId, date, start, end, staffId, email }) {
      const db = load();
      const desk = db.desks.find((d) => d.id === Number(deskId));
      if (!desk || !isDeskFree(db, desk, date, start, end)) {
        return Promise.resolve({ success: false, reason: "already_booked" });
      }
      const id = db.nextId++;
      const token = "mock-" + Math.random().toString(36).slice(2, 10);
      db.bookings.push({
        id,
        deskId: desk.id,
        bookingDate: date,
        startTime: start,
        endTime: end,
        staffId,
        email,
        status: "Confirmed",
        cancelToken: token,
        createdUtc: new Date().toISOString(),
      });
      save(db);
      return Promise.resolve({ success: true, bookingId: id, cancelToken: token, deskCode: deskCode(db, desk) });
    },

    cancelBooking(bookingId, token) {
      const db = load();
      const booking = db.bookings.find((b) => b.id === Number(bookingId));
      if (!booking || booking.cancelToken !== token) {
        return Promise.resolve({ success: false, reason: "invalid_token" });
      }
      booking.status = "Cancelled";
      save(db);
      return Promise.resolve({ success: true });
    },

    adminGetBookings({ dateFrom, dateTo, deskId, email, staffId } = {}) {
      const db = load();
      let rows = db.bookings;
      if (dateFrom) rows = rows.filter((b) => b.bookingDate >= dateFrom);
      if (dateTo) rows = rows.filter((b) => b.bookingDate <= dateTo);
      if (deskId) rows = rows.filter((b) => b.deskId === Number(deskId));
      if (email) rows = rows.filter((b) => b.email.toLowerCase().includes(email.toLowerCase()));
      if (staffId) rows = rows.filter((b) => b.staffId.toLowerCase().includes(staffId.toLowerCase()));
      rows = rows
        .map((b) => {
          const desk = db.desks.find((d) => d.id === b.deskId);
          return { ...b, deskCode: desk ? deskCode(db, desk) : "?" };
        })
        .sort((a, b) => (a.bookingDate + a.startTime).localeCompare(b.bookingDate + b.startTime));
      return Promise.resolve(rows);
    },

    adminCancelBooking(bookingId) {
      const db = load();
      const booking = db.bookings.find((b) => b.id === Number(bookingId));
      if (!booking) return Promise.resolve({ success: false, reason: "not_found" });
      booking.status = "Cancelled";
      save(db);
      return Promise.resolve({ success: true });
    },

    adminGetAll() {
      const db = load();
      return Promise.resolve({
        locations: db.locations,
        buildings: db.buildings.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        workTypes: db.workTypes,
        equipment: db.equipment,
        desks: db.desks,
      });
    },

    adminSave(listName, id, fields) {
      const db = load();
      const key = LIST_KEY[listName];
      const list = db[key];

      if (listName === "HD_Desks") {
        const dup = list.find(
          (r) =>
            r.buildingId === Number(fields.buildingId) &&
            r.room === fields.room &&
            r.deskNumber === fields.deskNumber &&
            r.id !== Number(id)
        );
        if (dup) return Promise.resolve({ success: false, reason: "duplicate_desk_code" });
      }

      if (id) {
        const row = list.find((r) => r.id === Number(id));
        Object.assign(row, fields);
        save(db);
        return Promise.resolve({ success: true, id: row.id });
      }
      const newId = db.nextId++;
      list.push({ id: newId, ...fields });
      save(db);
      return Promise.resolve({ success: true, id: newId });
    },

    adminDelete(listName, id) {
      const db = load();
      const key = LIST_KEY[listName];
      db[key] = db[key].filter((r) => r.id !== Number(id));
      save(db);
      return Promise.resolve({ success: true, id });
    },

    checkAdminAccess() {
      return Promise.resolve({ isAdmin: true });
    },
  };
})();

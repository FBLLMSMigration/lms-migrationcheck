// Every function returns a Promise resolving to the same shape whether
// it hit a real Power Automate flow or the local mock — see
// docs/POWER_AUTOMATE_FLOWS.md for the exact contract each one follows.

const Api = (() => {
  function isLive(key) {
    return Boolean(CONFIG.endpoints[key] && CONFIG.endpoints[key].trim());
  }

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  }

  return {
    usingMockData() {
      return !Object.values(CONFIG.endpoints).some((v) => v && v.trim());
    },

    getLocations() {
      if (isLive("getLocations")) return getJson(CONFIG.endpoints.getLocations);
      return MockBackend.getLocations();
    },

    getBuildings(locationId) {
      if (isLive("getBuildings")) {
        const url = new URL(CONFIG.endpoints.getBuildings);
        if (locationId) url.searchParams.set("locationId", locationId);
        return getJson(url.toString());
      }
      return MockBackend.getBuildings(locationId);
    },

    getWorkTypes() {
      if (isLive("getWorkTypes")) return getJson(CONFIG.endpoints.getWorkTypes);
      return MockBackend.getWorkTypes();
    },

    getEquipment() {
      if (isLive("getEquipment")) return getJson(CONFIG.endpoints.getEquipment);
      return MockBackend.getEquipment();
    },

    getDesks(buildingId, date, start, end) {
      if (isLive("getDesks")) {
        const url = new URL(CONFIG.endpoints.getDesks);
        url.searchParams.set("buildingId", buildingId);
        url.searchParams.set("date", date);
        url.searchParams.set("start", start);
        url.searchParams.set("end", end);
        return getJson(url.toString());
      }
      return MockBackend.getDesks(buildingId, date, start, end);
    },

    createBooking(payload) {
      if (isLive("createBooking")) return postJson(CONFIG.endpoints.createBooking, payload);
      return MockBackend.createBooking(payload);
    },

    cancelBooking(bookingId, token) {
      if (isLive("cancelBooking")) {
        const url = new URL(CONFIG.endpoints.cancelBooking);
        url.searchParams.set("booking", bookingId);
        url.searchParams.set("token", token);
        return getJson(url.toString());
      }
      return MockBackend.cancelBooking(bookingId, token);
    },

    adminGetAll() {
      if (isLive("adminGetAll")) return getJson(CONFIG.endpoints.adminGetAll);
      return MockBackend.adminGetAll();
    },

    adminSave(listName, id, fields) {
      if (isLive("adminSave")) return postJson(CONFIG.endpoints.adminSave, { listName, id, fields });
      return MockBackend.adminSave(listName, id, fields);
    },

    adminDelete(listName, id) {
      if (isLive("adminDelete")) return postJson(CONFIG.endpoints.adminDelete, { listName, id: Number(id) });
      return MockBackend.adminDelete(listName, id);
    },

    adminGetBookings(filters) {
      if (isLive("adminGetBookings")) {
        const url = new URL(CONFIG.endpoints.adminGetBookings);
        Object.entries(filters || {}).forEach(([k, v]) => {
          if (v) url.searchParams.set(k, v);
        });
        return getJson(url.toString());
      }
      return MockBackend.adminGetBookings(filters);
    },

    adminCancelBooking(bookingId) {
      if (isLive("adminCancelBooking")) return postJson(CONFIG.endpoints.adminCancelBooking, { id: Number(bookingId) });
      return MockBackend.adminCancelBooking(bookingId);
    },

    checkAdminAccess(email) {
      if (isLive("checkAdminAccess")) return postJson(CONFIG.endpoints.checkAdminAccess, { email });
      return MockBackend.checkAdminAccess(email);
    },
  };
})();

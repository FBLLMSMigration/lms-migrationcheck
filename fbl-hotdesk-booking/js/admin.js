(() => {
  const SESSION_KEY = "fbl_admin_session";
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let data = { locations: [], buildings: [], workTypes: [], equipment: [], desks: [] };
  let editing = { location: null, workType: null, equipment: null, building: null, desk: null };
  let deskDays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  let deskPhotoDataUrl = ""; // current photo for the desk form, as a data: URL

  function el(id) { return document.getElementById(id); }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function hourOptions() {
    const opts = [];
    for (let h = 7; h <= 21; h++) opts.push(String(h).padStart(2, "0") + ":00");
    return opts;
  }

  // ---- login ---------------------------------------------------------

  function checkSession() {
    if (sessionStorage.getItem(SESSION_KEY) === "1") showAdmin();
  }

  el("loginBtn").addEventListener("click", () => {
    // Placeholder auth: a single shared access code, matching the
    // simplicity of the rest of the tool. Swap for HD_CheckAdminAccess
    // (email allow-list) or Microsoft 365 sign-in later without
    // touching the rest of this file — see docs/SETUP.md.
    const entered = el("accessCodeInput").value;
    if (entered === CONFIG.adminAccessCode) {
      sessionStorage.setItem(SESSION_KEY, "1");
      showAdmin();
    } else {
      el("loginError").innerHTML = '<div class="notice is-error">That code isn\'t right.</div>';
    }
  });

  el("signOutLink").addEventListener("click", (e) => {
    e.preventDefault();
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  function showAdmin() {
    el("loginShell").style.display = "none";
    el("adminShell").style.display = "";
    el("signOutLink").style.display = "";
    el("signOutNavSep").style.display = "";
    if (!CONFIG.endpoints.adminGetAll || !CONFIG.endpoints.adminGetAll.trim()) {
      el("mockFlag").innerHTML = '<div class="mock-flag">HD_AdminGetAll isn\'t wired up yet — showing sample data here (Bentley/City etc.), even though other flows may already be live. See docs/SETUP.md.</div>';
    }
    loadAll();
  }

  // ---- tabs -----------------------------------------------------------

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      ["Locations", "WorkTypes", "Equipment", "Buildings", "Desks", "Bookings"].forEach((name) => {
        el("tab" + name).style.display = "none";
      });
      const map = { locations: "tabLocations", workTypes: "tabWorkTypes", equipment: "tabEquipment", buildings: "tabBuildings", desks: "tabDesks", bookings: "tabBookings" };
      el(map[tab.dataset.tab]).style.display = "";
      if (tab.dataset.tab === "bookings") searchBookings();
    });
  });

  // ---- load + render everything ---------------------------------------

  async function loadAll() {
    data = await Api.adminGetAll();
    renderLocations();
    renderWorkTypes();
    renderEquipment();
    renderBuildings();
    renderDesks();
    fillSelect(el("buildingLocationSelect"), data.locations, "Select a location");
    fillSelect(el("deskBuildingSelect"), data.buildings, "Select a building");
    fillSelect(el("deskWorkTypeSelect"), data.workTypes, "Select a work type");
    fillSelect(el("deskEquipmentSelect"), data.equipment, "Select equipment");
    fillDeskFilterBuildingSelect();
    if (!el("deskStartSelect").options.length) {
      const hours = hourOptions();
      el("deskStartSelect").innerHTML = hours.map((h) => `<option value="${h}">${h}</option>`).join("");
      el("deskEndSelect").innerHTML = hours.map((h) => `<option value="${h}">${h}</option>`).join("");
      el("deskStartSelect").value = "08:00";
      el("deskEndSelect").value = "17:00";
    }
    renderDayToggles();
    updateDeskCodePreview();
    fillBookingsDeskSelect();
  }

  function fillBookingsDeskSelect() {
    const current = el("bookingsDeskSelect").value;
    const sorted = data.desks.slice().sort((a, b) => deskCode(a).localeCompare(deskCode(b), undefined, { numeric: true }));
    el("bookingsDeskSelect").innerHTML = `<option value="">Any desk</option>` + sorted.map((d) => `<option value="${d.id}">${escapeHtml(deskCode(d))}</option>`).join("");
    if (sorted.some((d) => String(d.id) === current)) el("bookingsDeskSelect").value = current;
  }

  function fillSelect(selectEl, rows, placeholder) {
    const current = selectEl.value;
    selectEl.innerHTML = `<option value="" disabled>${placeholder}</option>` + rows.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    if (rows.some((r) => String(r.id) === current)) selectEl.value = current;
  }

  function locationName(id) {
    const l = data.locations.find((x) => x.id === Number(id));
    return l ? l.name : "—";
  }
  function buildingById(id) {
    return data.buildings.find((x) => x.id === Number(id));
  }
  function workTypeName(id) {
    const w = data.workTypes.find((x) => x.id === Number(id));
    return w ? w.name : "—";
  }
  function equipmentName(id) {
    const e = data.equipment.find((x) => x.id === Number(id));
    return e ? e.name : "—";
  }
  function deskCode(desk) {
    const b = buildingById(desk.buildingId);
    return `${b ? b.code : "?"}-${desk.room}-${desk.deskNumber}`;
  }

  // ---- Locations --------------------------------------------------------

  function renderLocations() {
    el("locationsTable").querySelector("tbody").innerHTML = data.locations
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.name)}</td>
          <td>
            <button class="btn btn-quiet" data-act="edit" data-id="${r.id}">Edit</button>
            <button class="btn btn-quiet" data-act="delete" data-id="${r.id}">Delete</button>
          </td>
        </tr>`
      )
      .join("");
    el("locationsTable").querySelectorAll("[data-act=edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const row = data.locations.find((r) => r.id === Number(b.dataset.id));
        editing.location = row.id;
        el("locationNameInput").value = row.name;
        el("locationSaveBtn").textContent = "Save changes";
      })
    );
    el("locationsTable").querySelectorAll("[data-act=delete]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this location? Its buildings and desks will be orphaned, not deleted.")) return;
        await Api.adminDelete("HD_Locations", b.dataset.id);
        loadAll();
      })
    );
  }

  el("locationSaveBtn").addEventListener("click", async () => {
    const name = el("locationNameInput").value.trim();
    if (!name) return;
    await Api.adminSave("HD_Locations", editing.location, { name });
    editing.location = null;
    el("locationNameInput").value = "";
    el("locationSaveBtn").textContent = "Add location";
    loadAll();
  });

  // ---- Work types ---------------------------------------------------------

  function renderWorkTypes() {
    el("workTypesTable").querySelector("tbody").innerHTML = data.workTypes
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.description || "")}</td>
          <td>
            <button class="btn btn-quiet" data-act="edit" data-id="${r.id}">Edit</button>
            <button class="btn btn-quiet" data-act="delete" data-id="${r.id}">Delete</button>
          </td>
        </tr>`
      )
      .join("");
    el("workTypesTable").querySelectorAll("[data-act=edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const row = data.workTypes.find((r) => r.id === Number(b.dataset.id));
        editing.workType = row.id;
        el("workTypeNameInput").value = row.name;
        el("workTypeDescInput").value = row.description || "";
        el("workTypeSaveBtn").textContent = "Save changes";
      })
    );
    el("workTypesTable").querySelectorAll("[data-act=delete]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this work type?")) return;
        await Api.adminDelete("HD_WorkTypes", b.dataset.id);
        loadAll();
      })
    );
  }

  el("workTypeSaveBtn").addEventListener("click", async () => {
    const name = el("workTypeNameInput").value.trim();
    if (!name) return;
    await Api.adminSave("HD_WorkTypes", editing.workType, { name, description: el("workTypeDescInput").value.trim() });
    editing.workType = null;
    el("workTypeNameInput").value = "";
    el("workTypeDescInput").value = "";
    el("workTypeSaveBtn").textContent = "Add work type";
    loadAll();
  });

  // ---- Equipment ------------------------------------------------------------

  function renderEquipment() {
    el("equipmentTable").querySelector("tbody").innerHTML = data.equipment
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.shortName || "")}</td>
          <td>
            <button class="btn btn-quiet" data-act="edit" data-id="${r.id}">Edit</button>
            <button class="btn btn-quiet" data-act="delete" data-id="${r.id}">Delete</button>
          </td>
        </tr>`
      )
      .join("");
    el("equipmentTable").querySelectorAll("[data-act=edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const row = data.equipment.find((r) => r.id === Number(b.dataset.id));
        editing.equipment = row.id;
        el("equipmentNameInput").value = row.name;
        el("equipmentShortInput").value = row.shortName || "";
        el("equipmentSaveBtn").textContent = "Save changes";
      })
    );
    el("equipmentTable").querySelectorAll("[data-act=delete]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this equipment option?")) return;
        await Api.adminDelete("HD_Equipment", b.dataset.id);
        loadAll();
      })
    );
  }

  el("equipmentSaveBtn").addEventListener("click", async () => {
    const name = el("equipmentNameInput").value.trim();
    const shortName = el("equipmentShortInput").value.trim();
    if (!name) return;
    await Api.adminSave("HD_Equipment", editing.equipment, { name, shortName: shortName || name });
    editing.equipment = null;
    el("equipmentNameInput").value = "";
    el("equipmentShortInput").value = "";
    el("equipmentSaveBtn").textContent = "Add equipment";
    loadAll();
  });

  // ---- Buildings ----------------------------------------------------------

  function renderBuildings() {
    el("buildingsTable").querySelector("tbody").innerHTML = data.buildings
      .map(
        (r, i) => `<tr>
          <td>
            <button class="btn btn-quiet" data-act="moveUp" data-id="${r.id}" ${i === 0 ? "disabled" : ""} title="Move up">\u2191</button>
            <button class="btn btn-quiet" data-act="moveDown" data-id="${r.id}" ${i === data.buildings.length - 1 ? "disabled" : ""} title="Move down">\u2193</button>
          </td>
          <td><span class="tag">${escapeHtml(r.code || "—")}</span></td>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(locationName(r.locationId))}</td>
          <td>
            <button class="btn btn-quiet" data-act="edit" data-id="${r.id}">Edit</button>
            <button class="btn btn-quiet" data-act="delete" data-id="${r.id}">Delete</button>
          </td>
        </tr>`
      )
      .join("");
    el("buildingsTable").querySelectorAll("[data-act=edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const row = data.buildings.find((r) => r.id === Number(b.dataset.id));
        editing.building = row.id;
        el("buildingCodeInput").value = row.code || "";
        el("buildingNameInput").value = row.name;
        el("buildingLocationSelect").value = row.locationId;
        el("buildingSaveBtn").textContent = "Save changes";
      })
    );
    el("buildingsTable").querySelectorAll("[data-act=delete]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this building? Its desks will be orphaned, not deleted.")) return;
        await Api.adminDelete("HD_Buildings", b.dataset.id);
        loadAll();
      })
    );
    el("buildingsTable").querySelectorAll("[data-act=moveUp]").forEach((b) =>
      b.addEventListener("click", () => moveBuilding(Number(b.dataset.id), -1))
    );
    el("buildingsTable").querySelectorAll("[data-act=moveDown]").forEach((b) =>
      b.addEventListener("click", () => moveBuilding(Number(b.dataset.id), 1))
    );
  }

  // data.buildings is already sorted by sortOrder (from adminGetAll), so
  // swapping with the array neighbour is the same as swapping with the
  // building displayed right above/below it.
  async function moveBuilding(id, direction) {
    const index = data.buildings.findIndex((b) => b.id === id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= data.buildings.length) return;
    const a = data.buildings[index];
    const b = data.buildings[swapIndex];
    const aOrder = a.sortOrder ?? index;
    const bOrder = b.sortOrder ?? swapIndex;
    await Promise.all([
      Api.adminSave("HD_Buildings", a.id, { sortOrder: bOrder }),
      Api.adminSave("HD_Buildings", b.id, { sortOrder: aOrder }),
    ]);
    loadAll();
  }

  el("buildingSaveBtn").addEventListener("click", async () => {
    const code = el("buildingCodeInput").value.trim();
    const name = el("buildingNameInput").value.trim();
    const locationId = el("buildingLocationSelect").value;
    if (!code || !name || !locationId) return;
    const fields = { name, code, locationId: Number(locationId) };
    if (!editing.building) {
      // New building — put it at the end of the current order.
      const maxOrder = data.buildings.reduce((max, b) => Math.max(max, b.sortOrder ?? 0), 0);
      fields.sortOrder = maxOrder + 1;
    }
    await Api.adminSave("HD_Buildings", editing.building, fields);
    editing.building = null;
    el("buildingCodeInput").value = "";
    el("buildingNameInput").value = "";
    el("buildingSaveBtn").textContent = "Add building";
    loadAll();
  });

  // ---- Desks ------------------------------------------------------------

  function renderDayToggles() {
    el("deskDayToggles").innerHTML = DAYS.map((d) => `<button type="button" class="day-toggle ${deskDays.has(d) ? "is-on" : ""}" data-day="${d}">${d}</button>`).join("");
    el("deskDayToggles").querySelectorAll(".day-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const day = btn.dataset.day;
        if (deskDays.has(day)) deskDays.delete(day);
        else deskDays.add(day);
        btn.classList.toggle("is-on");
      });
    });
  }

  function updateDeskCodePreview() {
    const building = buildingById(el("deskBuildingSelect").value);
    const room = el("deskRoomInput").value.trim();
    const num = el("deskNumberInput").value.trim();
    if (building && room && num) {
      el("deskCodePreview").textContent = `${building.code}-${room}-${num}`;
    } else {
      el("deskCodePreview").textContent = "—";
    }
  }

  // Desk number is locked by default: while adding a new desk, it's
  // auto-set to the next free number for that building+room. Admins can
  // unlock it (re-entering the access code) to set one manually — e.g.
  // to fill a gap left by a deleted desk.
  function nextDeskNumber(buildingId, room) {
    const existing = data.desks.filter((d) => Number(d.buildingId) === Number(buildingId) && d.room === room);
    if (existing.length === 0) return "D01";
    let maxNum = 0, prefix = "D", width = 2;
    existing.forEach((d) => {
      const m = String(d.deskNumber).match(/^([A-Za-z]*)(\d+)$/);
      if (m) {
        if (m[1]) prefix = m[1];
        width = Math.max(width, m[2].length);
        maxNum = Math.max(maxNum, parseInt(m[2], 10));
      }
    });
    return prefix + String(maxNum + 1).padStart(width, "0");
  }

  function refreshDeskNumberSuggestion() {
    if (editing.desk || !el("deskNumberInput").disabled) return; // only in add mode, only while locked/auto
    const buildingId = el("deskBuildingSelect").value;
    const room = el("deskRoomInput").value.trim();
    el("deskNumberInput").value = buildingId && room ? nextDeskNumber(buildingId, room) : "";
    updateDeskCodePreview();
  }

  function lockDeskNumber() {
    el("deskNumberInput").disabled = true;
    el("deskNumberUnlockBtn").textContent = "Unlock";
    el("deskNumberUnlockBtn").style.display = "";
  }

  el("deskNumberUnlockBtn").addEventListener("click", () => {
    const code = prompt("Enter the admin access code to set the desk number manually:");
    if (code === null) return;
    if (code === CONFIG.adminAccessCode) {
      el("deskNumberInput").disabled = false;
      el("deskNumberInput").focus();
      el("deskNumberUnlockBtn").style.display = "none";
    } else {
      alert("That code isn't right.");
    }
  });

  el("deskBuildingSelect").addEventListener("change", () => {
    updateDeskCodePreview();
    refreshDeskNumberSuggestion();
  });
  el("deskRoomInput").addEventListener("input", () => {
    updateDeskCodePreview();
    refreshDeskNumberSuggestion();
  });
  el("deskNumberInput").addEventListener("input", updateDeskCodePreview);

  // ---- Desk photo: resized client-side before it's ever stored --------

  function resizeImageFile(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That doesn't look like an image."));
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setDeskPhoto(dataUrl) {
    deskPhotoDataUrl = dataUrl || "";
    if (deskPhotoDataUrl) {
      el("deskPhotoPreview").src = deskPhotoDataUrl;
      el("deskPhotoPreviewField").style.display = "";
    } else {
      el("deskPhotoPreviewField").style.display = "none";
    }
  }

  el("deskPhotoInput").addEventListener("change", async () => {
    const file = el("deskPhotoInput").files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 800, 0.72);
      setDeskPhoto(dataUrl);
    } catch (err) {
      el("deskFormError").innerHTML = `<div class="notice is-error">${escapeHtml(err.message)}</div>`;
    }
    el("deskPhotoInput").value = "";
  });

  el("deskPhotoRemoveBtn").addEventListener("click", () => setDeskPhoto(""));

  function getFilteredDesks() {
    const q = (el("deskSearchInput").value || "").trim().toLowerCase();
    const buildingFilter = el("deskFilterBuildingSelect").value;
    const excludeInactive = el("deskExcludeInactiveToggle").checked;

    let rows = data.desks;
    if (buildingFilter) rows = rows.filter((r) => Number(r.buildingId) === Number(buildingFilter));
    if (excludeInactive) rows = rows.filter((r) => r.active);
    if (q) {
      rows = rows.filter((r) => {
        const building = buildingById(r.buildingId);
        const haystack = [deskCode(r), building ? building.name : "", workTypeName(r.workTypeId), equipmentName(r.equipmentId)]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    return rows.slice().sort((a, b) => deskCode(a).localeCompare(deskCode(b), undefined, { numeric: true }));
  }

  function fillDeskFilterBuildingSelect() {
    const current = el("deskFilterBuildingSelect").value;
    el("deskFilterBuildingSelect").innerHTML =
      `<option value="">All buildings</option>` + data.buildings.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
    if (data.buildings.some((b) => String(b.id) === current)) el("deskFilterBuildingSelect").value = current;
  }

  el("deskFilterBuildingSelect").addEventListener("change", renderDesks);
  el("deskExcludeInactiveToggle").addEventListener("change", renderDesks);

  function openDeskModal() {
    el("deskModalBackdrop").style.display = "flex";
  }
  function closeDeskModal() {
    el("deskModalBackdrop").style.display = "none";
  }

  function renderDesks() {
    const rows = getFilteredDesks();
    el("desksTable").querySelector("tbody").innerHTML = rows
      .map(
        (r) => `<tr class="${r.active ? "" : "admin-row-inactive"}">
          <td>${r.photoUrl ? `<img src="${escapeHtml(r.photoUrl)}" alt="" style="height:36px;width:36px;object-fit:cover;border-radius:var(--radius);border:1px solid var(--line-soft);">` : "—"}</td>
          <td><strong>${escapeHtml(deskCode(r))}</strong></td>
          <td>${escapeHtml(buildingById(r.buildingId) ? buildingById(r.buildingId).code : "—")}</td>
          <td>${escapeHtml(workTypeName(r.workTypeId))}</td>
          <td>${escapeHtml(r.availableDays)}</td>
          <td>${escapeHtml(r.availableStart)}\u2013${escapeHtml(r.availableEnd)}</td>
          <td>${r.active ? '<span class="tag">active</span>' : '<span class="tag">off</span>'}</td>
          <td>
            <button class="btn btn-quiet" data-act="edit" data-id="${r.id}">Edit</button>
            <button class="btn btn-quiet" data-act="delete" data-id="${r.id}">Delete</button>
          </td>
        </tr>`
      )
      .join("");
    if (rows.length === 0) {
      el("desksTable").querySelector("tbody").innerHTML = `<tr><td colspan="8">No desks match that search.</td></tr>`;
    }
    el("desksTable").querySelectorAll("[data-act=edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const row = data.desks.find((r) => r.id === Number(b.dataset.id));
        editing.desk = row.id;
        el("deskBuildingSelect").value = row.buildingId;
        el("deskRoomInput").value = row.room;
        el("deskNumberInput").value = row.deskNumber;
        lockDeskNumber();
        el("deskWorkTypeSelect").value = row.workTypeId;
        el("deskEquipmentSelect").value = row.equipmentId;
        el("deskStartSelect").value = row.availableStart;
        el("deskEndSelect").value = row.availableEnd;
        el("deskActiveInput").checked = Boolean(row.active);
        setDeskPhoto(row.photoUrl || "");
        deskDays = new Set(row.availableDays.split(","));
        renderDayToggles();
        updateDeskCodePreview();
        el("deskFormHeading").textContent = `Editing ${deskCode(row)}`;
        el("deskSaveBtn").textContent = "Save changes";
        el("deskFormError").innerHTML = "";
        openDeskModal();
      })
    );
    el("desksTable").querySelectorAll("[data-act=delete]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this desk? Its booking history stays on record.")) return;
        await Api.adminDelete("HD_Desks", b.dataset.id);
        loadAll();
      })
    );
  }

  el("deskSearchInput").addEventListener("input", renderDesks);
  el("deskAddBtn").addEventListener("click", () => {
    resetDeskForm();
    openDeskModal();
  });

  function resetDeskForm() {
    editing.desk = null;
    el("deskBuildingSelect").value = "";
    el("deskRoomInput").value = "";
    el("deskNumberInput").value = "";
    lockDeskNumber();
    el("deskWorkTypeSelect").value = "";
    el("deskEquipmentSelect").value = "";
    el("deskStartSelect").value = "08:00";
    el("deskEndSelect").value = "17:00";
    el("deskActiveInput").checked = true;
    setDeskPhoto("");
    deskDays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    renderDayToggles();
    updateDeskCodePreview();
    el("deskFormHeading").textContent = "Add a desk";
    el("deskSaveBtn").textContent = "Add desk";
    el("deskFormError").innerHTML = "";
  }

  el("deskCancelEditBtn").addEventListener("click", () => {
    resetDeskForm();
    closeDeskModal();
  });

  el("deskSaveBtn").addEventListener("click", async () => {
    const buildingId = el("deskBuildingSelect").value;
    const room = el("deskRoomInput").value.trim();
    const deskNumber = el("deskNumberInput").value.trim();
    const workTypeId = el("deskWorkTypeSelect").value;
    const equipmentId = el("deskEquipmentSelect").value;
    const start = el("deskStartSelect").value;
    const end = el("deskEndSelect").value;

    el("deskFormError").innerHTML = "";

    if (!buildingId || !room || !deskNumber || !workTypeId || !equipmentId || deskDays.size === 0) {
      el("deskFormError").innerHTML = '<div class="notice is-error">Fill in building, room, desk number, work type, equipment, and at least one available day.</div>';
      return;
    }
    if (start >= end) {
      el("deskFormError").innerHTML = '<div class="notice is-error">"Until" needs to be later than "From".</div>';
      return;
    }

    const result = await Api.adminSave("HD_Desks", editing.desk, {
      buildingId: Number(buildingId),
      room,
      deskNumber,
      workTypeId: Number(workTypeId),
      equipmentId: Number(equipmentId),
      availableDays: DAYS.filter((d) => deskDays.has(d)).join(","),
      availableStart: start,
      availableEnd: end,
      active: el("deskActiveInput").checked,
      photoUrl: deskPhotoDataUrl,
    });

    if (!result.success) {
      const building = buildingById(buildingId);
      const attemptedCode = building ? `${building.code}-${room}-${deskNumber}` : `${room}-${deskNumber}`;
      el("deskFormError").innerHTML = `<div class="notice is-error">${escapeHtml(attemptedCode)} already exists — each building/room/desk number combination has to be unique.</div>`;
      return;
    }

    resetDeskForm();
    closeDeskModal();
    loadAll();
  });

  // ---- Bookings lookup ----------------------------------------------------

  // Formats using the date's own local year/month/day — never via
  // toISOString(), which converts to UTC first and silently rolls the
  // date back a day for any timezone ahead of UTC (e.g. Perth, AWST
  // UTC+8) once local midnight crosses into the previous UTC day.
  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function renderBookingsDateChips() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chips = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const value = isoDate(d);
      let label;
      if (offset === 0) label = "Today";
      else if (offset === -1) label = "Yesterday";
      else if (offset === 1) label = "Tomorrow";
      else label = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" });
      chips.push({ value, label });
    }
    el("bookingsDateChips").innerHTML = chips
      .map((c) => `<button type="button" class="date-chip" data-date="${c.value}">${escapeHtml(c.label)}</button>`)
      .join("");
    el("bookingsDateChips").querySelectorAll(".date-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        // A chip picks a single specific day — From and To both land on it.
        el("bookingsDateFromInput").value = btn.dataset.date;
        el("bookingsDateToInput").value = btn.dataset.date;
        syncBookingsDateChipHighlight();
        searchBookings();
      });
    });
  }

  function syncBookingsDateChipHighlight() {
    const from = el("bookingsDateFromInput").value;
    const to = el("bookingsDateToInput").value;
    el("bookingsDateChips").querySelectorAll(".date-chip").forEach((btn) => {
      // Only show a chip as selected when From and To are both pinned to
      // that exact single day — not while in a range or "upcoming" state.
      btn.classList.toggle("is-selected", from === btn.dataset.date && to === btn.dataset.date);
    });
  }

  function formatBookingDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  }

  let lastBookingsRows = [];

  async function searchBookings() {
    const dateFrom = el("bookingsDateFromInput").value;
    const dateTo = el("bookingsDateToInput").value;
    const deskId = el("bookingsDeskSelect").value;
    const staffId = el("bookingsIdInput").value.trim();
    const email = el("bookingsEmailInput").value.trim();

    el("bookingsTable").querySelector("tbody").innerHTML = `<tr><td colspan="7">Searching…</td></tr>`;
    const rows = await Api.adminGetBookings({ dateFrom, dateTo, deskId, email, staffId });
    // Current to past: soonest/most-recent date first, oldest last.
    rows.sort((a, b) => (b.bookingDate + b.startTime).localeCompare(a.bookingDate + a.startTime));
    lastBookingsRows = rows;

    if (rows.length === 0) {
      el("bookingsTable").querySelector("tbody").innerHTML = `<tr><td colspan="7">No bookings match those filters.</td></tr>`;
      return;
    }

    el("bookingsTable").querySelector("tbody").innerHTML = rows
      .map(
        (b) => `<tr>
          <td>${escapeHtml(formatBookingDate(b.bookingDate))}</td>
          <td>${escapeHtml(b.startTime)}\u2013${escapeHtml(b.endTime)}</td>
          <td><strong>${escapeHtml(b.deskCode)}</strong></td>
          <td>${escapeHtml(b.staffId)}</td>
          <td>${escapeHtml(b.email)}</td>
          <td>${b.status === "Confirmed" ? '<span class="tag">confirmed</span>' : '<span class="tag">cancelled</span>'}</td>
          <td>${b.status === "Confirmed" ? `<button class="btn btn-quiet" data-act="cancel" data-id="${b.id}">Cancel</button>` : ""}</td>
        </tr>`
      )
      .join("");

    el("bookingsTable").querySelectorAll("[data-act=cancel]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Cancel this booking? The staff member won't be notified automatically — let them know separately if needed.")) return;
        await Api.adminCancelBooking(btn.dataset.id);
        searchBookings();
      })
    );
  }

  function csvEscape(value) {
    const str = String(value ?? "");
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function exportBookingsCsv() {
    if (lastBookingsRows.length === 0) {
      alert("No bookings to export — search for something first.");
      return;
    }
    const header = ["Date", "Start", "End", "Desk", "Curtin ID", "Email", "Status"];
    const lines = [header, ...lastBookingsRows.map((b) => [b.bookingDate, b.startTime, b.endTime, b.deskCode, b.staffId, b.email, b.status])];
    const csv = lines.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${isoDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  el("bookingsExportBtn").addEventListener("click", exportBookingsCsv);
  el("bookingsSearchBtn").addEventListener("click", searchBookings);
  el("bookingsDeskSelect").addEventListener("change", searchBookings);
  el("bookingsDateFromInput").addEventListener("change", () => {
    syncBookingsDateChipHighlight();
    searchBookings();
  });
  el("bookingsDateToInput").addEventListener("change", () => {
    syncBookingsDateChipHighlight();
    searchBookings();
  });
  el("bookingsClearBtn").addEventListener("click", () => {
    el("bookingsDateFromInput").value = isoDate(new Date());
    el("bookingsDateToInput").value = "";
    el("bookingsDeskSelect").value = "";
    el("bookingsIdInput").value = "";
    el("bookingsEmailInput").value = "";
    syncBookingsDateChipHighlight();
    searchBookings();
  });

  renderBookingsDateChips();
  // Default view: every upcoming booking from today onwards (From = today, To = unbounded).
  el("bookingsDateFromInput").value = isoDate(new Date());
  syncBookingsDateChipHighlight();

  checkSession();
})();

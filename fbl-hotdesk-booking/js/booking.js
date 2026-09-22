(() => {
  const state = {
    locations: [],
    buildings: [],
    workTypes: [],
    equipment: [],
    buildingId: null,
    date: "",
    startHour: 8,
    endHour: 17,
    selectedDesk: null,
  };

  const SLIDER_MIN = 8;
  const SLIDER_MAX = 21;
  const THUMB_RADIUS = 13; // half the 26px thumb — keep in sync with css/styles.css

  // Native range-input thumbs are inset by their own radius from each
  // edge (the thumb's center never reaches the true 0%/100% points),
  // so a position derived from a raw linear percentage would drift out
  // past where the thumb can actually go. This keeps the fake track/
  // fill/ticks lined up with where the thumb really renders.
  function sliderPos(frac) {
    return `calc(${THUMB_RADIUS}px + ${frac} * (100% - ${THUMB_RADIUS * 2}px))`;
  }

  function el(id) { return document.getElementById(id); }

  function hourLabel(h) {
    const ampm = h >= 12 ? "pm" : "am";
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:00 ${ampm}`;
  }
  function hourToTime(h) { return String(h).padStart(2, "0") + ":00"; }

  function markStep(n) {
    document.querySelectorAll(".step").forEach((s) => {
      const step = Number(s.dataset.step);
      s.classList.remove("is-active", "is-done");
      if (step < n) s.classList.add("is-done");
      if (step === n) s.classList.add("is-active");
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function locationNameFor(locationId) {
    const loc = state.locations.find((l) => l.id === Number(locationId));
    return loc ? loc.name : "";
  }

  function buildingById(id) {
    return state.buildings.find((b) => b.id === Number(id));
  }

  function equipmentNameFor(equipmentId) {
    const eq = state.equipment.find((e) => e.id === Number(equipmentId));
    return eq ? eq.name : "";
  }

  function equipmentShortNameFor(equipmentId) {
    const eq = state.equipment.find((e) => e.id === Number(equipmentId));
    return eq ? eq.shortName || eq.name : "";
  }

  // Building code + room + desk number, e.g. "B407-333-D01"
  function deskCode(desk) {
    const building = buildingById(state.buildingId);
    return `${building ? building.code : "?"}-${desk.room}-${desk.deskNumber}`;
  }

  // ---- dual time-range slider -------------------------------------------

  function initSlider() {
    const startInput = el("startRange");
    const endInput = el("endRange");

    function render() {
      let s = Number(startInput.value);
      let e = Number(endInput.value);
      if (s >= e) {
        // keep a minimum 1-hour gap, dragging whichever handle just moved
        if (document.activeElement === startInput) { e = Math.min(SLIDER_MAX, s + 1); endInput.value = e; }
        else { s = Math.max(SLIDER_MIN, e - 1); startInput.value = s; }
      }
      state.startHour = s;
      state.endHour = e;
      const leftFrac = (s - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
      const rightFrac = (e - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
      el("rangeFill").style.left = sliderPos(leftFrac);
      el("rangeFill").style.right = sliderPos(1 - rightFrac);
      el("rangeLabel").textContent = `${hourLabel(s)} \u2013 ${hourLabel(e)}`;
      updateSearchButtonState();
    }

    startInput.addEventListener("input", render);
    endInput.addEventListener("input", render);
    // Search on "change" (fires once, when the drag/interaction actually
    // ends) rather than "input" (fires continuously while dragging) — so
    // dragging doesn't spam a search request on every pixel of movement.
    startInput.addEventListener("change", () => {
      if (!el("searchBtn").disabled) loadDesks();
    });
    endInput.addEventListener("change", () => {
      if (!el("searchBtn").disabled) loadDesks();
    });
    render();
    renderSliderTicks();
  }

  // Static hour markers under the track — every 2 hours, labelled with
  // an am/pm suffix only where it actually changes (8am, 10, 12pm, 2...).
  function renderSliderTicks() {
    const hours = [];
    for (let h = SLIDER_MIN; h <= SLIDER_MAX; h += 1) hours.push(h);
    if (hours[hours.length - 1] !== SLIDER_MAX) hours.push(SLIDER_MAX);

    el("rangeTicks").innerHTML = hours
      .map((h, i) => {
        const frac = (h - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
        const prevAmpm = i > 0 ? (hours[i - 1] >= 12 ? "pm" : "am") : null;
        const ampm = h >= 12 ? "pm" : "am";
        let hour12 = h % 12;
        if (hour12 === 0) hour12 = 12;
        const isEnd = i === 0 || i === hours.length - 1 || h === 17;
        const label = isEnd || ampm !== prevAmpm ? `${hour12}${ampm}` : String(hour12);
        return `<span style="left:${sliderPos(frac)};">${label}</span>`;
      })
      .join("");
  }

  // ---- quick-pick date chips, for fast one-tap booking on mobile ----------

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

  function renderDateChips() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chips = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const value = isoDate(d);
      let label;
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      else label = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" });
      chips.push({ value, label });
    }

    el("dateChips").innerHTML = chips
      .map((c) => `<button type="button" class="date-chip" data-date="${c.value}">${escapeHtml(c.label)}</button>`)
      .join("");

    el("dateChips").querySelectorAll(".date-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        el("dateInput").value = btn.dataset.date;
        syncDateChipHighlight();
        handleDateChanged();
      });
    });
  }

  function syncDateChipHighlight() {
    const current = el("dateInput").value;
    el("dateChips").querySelectorAll(".date-chip").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.date === current);
    });
  }

  // Re-runs the search automatically whenever the date changes, as long
  // as a building and a valid time range are already picked.
  function handleDateChanged() {
    syncDateChipHighlight();
    updateSearchButtonState();
    if (!el("searchBtn").disabled) loadDesks();
  }

  // ---- init ---------------------------------------------------------------

  async function init() {
    if (Api.usingMockData()) {
      el("mockFlag").innerHTML = '<div class="mock-flag">Running on sample data — no Power Automate flows configured yet. See docs/SETUP.md.</div>';
    }
    const [locations, buildings, workTypes, equipment] = await Promise.all([
      Api.getLocations(),
      Api.getBuildings(), // no locationId = every building, flat list
      Api.getWorkTypes(),
      Api.getEquipment(),
    ]);
    state.locations = locations;
    state.buildings = buildings.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    state.workTypes = workTypes;
    state.equipment = equipment;

    el("buildingChoices").innerHTML = buildings
      .map(
        (b) => `<button type="button" class="choice-btn" data-id="${b.id}">${escapeHtml(b.name)}<span class="sub">${escapeHtml(locationNameFor(b.locationId))}</span></button>`
      )
      .join("");
    el("buildingChoices").querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectBuilding(Number(btn.dataset.id), btn));
    });

    initSlider();
    renderDateChips();

    const today = isoDate(new Date());
    el("dateInput").min = today;
    el("dateInput").value = today;
    state.date = today;
    syncDateChipHighlight();

    el("dateInput").addEventListener("change", handleDateChanged);

    el("searchBtn").addEventListener("click", loadDesks);
    el("modalCancel").addEventListener("click", closeModal);
    el("bookingForm").addEventListener("submit", (e) => {
      e.preventDefault();
      submitBooking();
    });

    document.querySelectorAll("#userTypeChoices .usertype-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectUserType(btn.dataset.type));
    });
    el("staffIdInput").addEventListener("input", () => {
      if (selectedUserType !== "visitor" && !emailTouched) {
        el("emailInput").value = deriveEmail(selectedUserType, el("staffIdInput").value.trim());
      }
    });
    el("emailInput").addEventListener("input", () => {
      emailTouched = true;
    });

    updateSearchButtonState();
  }

  function selectBuilding(id, btnEl) {
    state.buildingId = id;
    document.querySelectorAll("#buildingChoices .choice-btn").forEach((b) => b.classList.remove("is-selected"));
    btnEl.classList.add("is-selected");
    el("panelDesks").style.display = "none";
    updateSearchButtonState();
    if (!el("searchBtn").disabled) loadDesks();
  }

  function updateSearchButtonState() {
    state.date = el("dateInput").value;
    const ready = Boolean(state.buildingId && state.date && state.startHour < state.endHour);
    el("searchBtn").disabled = !ready;
  }

  async function loadDesks() {
    markStep(2);
    el("panelDesks").style.display = "";
    el("desksContent").innerHTML = '<div class="empty-state">Checking desks…</div>';
    if (typeof el("panelDesks").scrollIntoView === "function") {
      el("panelDesks").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const start = hourToTime(state.startHour);
    const end = hourToTime(state.endHour);
    let desks;
    try {
      desks = await Api.getDesks(state.buildingId, state.date, start, end);
    } catch (err) {
      el("desksContent").innerHTML = '<div class="notice is-error">Something went wrong checking availability. Try again, or check back shortly.</div>';
      return;
    }

    if (desks.length === 0) {
      el("desksContent").innerHTML = '<div class="empty-state">No desks are set up in this building yet.</div>';
      return;
    }

    // Order by location first (room, then desk number) so even without
    // a room heading, desks from the same area land next to each other.
    const byLocation = (a, b) => {
      const roomCompare = a.room.localeCompare(b.room, undefined, { numeric: true });
      if (roomCompare !== 0) return roomCompare;
      return a.deskNumber.localeCompare(b.deskNumber, undefined, { numeric: true });
    };

    const byType = {};
    desks.forEach((d) => {
      (byType[d.workTypeId] = byType[d.workTypeId] || []).push(d);
    });

    const html = Object.entries(byType)
      .map(([typeId, group]) => {
        group.sort(byLocation);
        const type = state.workTypes.find((t) => t.id === Number(typeId));
        const freeCount = group.filter((d) => d.available).length;
        return `
          <div class="worktype-group">
            <div class="worktype-intro">
              <div class="worktype-title-row">
                <h3>${escapeHtml(type ? type.name : "Other")}</h3>
                <span class="count">${freeCount} of ${group.length} free</span>
              </div>
              ${type && type.description ? `<p class="worktype-description">${escapeHtml(type.description)}</p>` : ""}
            </div>
            <div class="desk-grid">
              ${group
                .map((d) => {
                  const code = deskCode(d);
                  const eqName = equipmentNameFor(d.equipmentId);
                  const eqShort = equipmentShortNameFor(d.equipmentId);
                  return `<button class="desk ${d.available ? "is-available" : "is-booked"}" data-id="${d.id}" title="${escapeHtml(code)}${eqName ? " \u2014 " + escapeHtml(eqName) : ""}" ${d.available ? "" : "disabled"}>
                    <span class="desk-code">${escapeHtml(code)}</span>
                    <span class="desk-equipment">${escapeHtml(eqShort)}</span>
                  </button>`;
                })
                .join("")}
            </div>
          </div>`;
      })
      .join("");

    el("desksContent").innerHTML = html;
    el("desksContent").querySelectorAll(".desk.is-available").forEach((btn) => {
      const desk = desks.find((d) => d.id === Number(btn.dataset.id));
      btn.addEventListener("click", () => openModal(desk));
    });
  }

  let selectedUserType = "staff";
  let emailTouched = false; // true once the person types into email directly, so we stop overwriting it

  const EMAIL_DOMAIN = { staff: "@curtin.edu.au", student: "@student.curtin.edu.au" };
  const ID_LABEL = { staff: "Staff ID", student: "Student ID", visitor: "Curtin ID" };
  const ID_PLACEHOLDER = { staff: "e.g. 123456A", student: "e.g. 12345678" };

  function deriveEmail(type, id) {
    if (!id || !EMAIL_DOMAIN[type]) return "";
    return id + EMAIL_DOMAIN[type];
  }

  function selectUserType(type) {
    selectedUserType = type;
    document.querySelectorAll("#userTypeChoices .usertype-btn").forEach((b) => b.classList.toggle("is-selected", b.dataset.type === type));
    el("staffIdLabel").textContent = ID_LABEL[type];

    if (type === "visitor") {
      el("staffIdInput").value = "Visitor";
      el("staffIdInput").placeholder = "";
      el("emailInput").value = "";
      emailTouched = false;
    } else {
      el("staffIdInput").placeholder = ID_PLACEHOLDER[type];
      if (el("staffIdInput").value === "Visitor") el("staffIdInput").value = "";
      if (!emailTouched) el("emailInput").value = deriveEmail(type, el("staffIdInput").value.trim());
    }
  }

  function openModal(desk) {
    state.selectedDesk = desk;
    const code = deskCode(desk);
    const building = buildingById(state.buildingId);
    el("modalDeskLabel").textContent = code;
    const summary = building ? `${building.name}, ${locationNameFor(building.locationId)}` : "";
    el("modalTimeSummary").innerHTML =
      `${escapeHtml(summary)} — ${formatDate(state.date)}, ${hourLabel(state.startHour)}\u2013${hourLabel(state.endHour)}` +
      `<br>${escapeHtml(equipmentNameFor(desk.equipmentId))}`;
    if (desk.photoUrl) {
      el("modalDeskPhoto").src = desk.photoUrl;
      el("modalDeskPhoto").style.display = "";
    } else {
      el("modalDeskPhoto").style.display = "none";
    }
    el("staffIdInput").value = "";
    el("emailInput").value = "";
    emailTouched = false;
    selectUserType("staff");
    el("modalError").innerHTML = "";
    el("modalBackdrop").style.display = "flex";
  }

  function closeModal() {
    el("modalBackdrop").style.display = "none";
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  }

  async function submitBooking() {
    const staffId = el("staffIdInput").value.trim();
    const email = el("emailInput").value.trim();
    const errors = [];

    if (selectedUserType === "staff") {
      if (!/^\d{6}[A-Za-z]$/.test(staffId)) errors.push("Staff ID should be 6 numbers followed by a letter, e.g. 123456A.");
    } else if (selectedUserType === "student") {
      if (!/^\d{8}$/.test(staffId)) errors.push("Student ID should be 8 numbers, e.g. 12345678.");
    } else if (!staffId) {
      errors.push("Enter your Curtin ID.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email address.");

    if (errors.length) {
      el("modalError").innerHTML = `<div class="notice is-error">${errors.join(" ")}</div>`;
      return;
    }

    el("modalConfirm").disabled = true;
    const result = await Api.createBooking({
      deskId: state.selectedDesk.id,
      date: state.date,
      start: hourToTime(state.startHour),
      end: hourToTime(state.endHour),
      staffId,
      email,
    });
    el("modalConfirm").disabled = false;

    if (!result.success) {
      el("modalError").innerHTML = '<div class="notice is-error">That desk was just booked by someone else — pick another.</div>';
      closeModal();
      loadDesks();
      return;
    }

    const code = deskCode(state.selectedDesk);
    closeModal();
    el("desksContent").innerHTML = `
      <div class="notice is-success">
        Desk ${escapeHtml(code)} booked for ${formatDate(state.date)}, ${hourLabel(state.startHour)}\u2013${hourLabel(state.endHour)}.
        A confirmation with a cancellation link has been sent to ${escapeHtml(email)}.
      </div>`;
  }

  init();
})();

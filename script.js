/* ============ NutriLens AI — application logic ============
 * Vanilla JS only. Data lives in browser localStorage:
 *   - nutrilens.entries : { "YYYY-MM-DD": [entry, ...], ... }  (grouped by date)
 *   - nutrilens.goals   : { calories, protein }
 * Nutrition formula: consumed = per100 * grams / 100.
 * No AI, no backend — reliable manual calculations only.
 * v2: searchable food combobox, entry editing, protein progress bar.
 */
(function () {
  "use strict";

  // ---------- Built-in food database (example values per 100 g) ----------
  // Approximate nutrition values for common Indian foods; labelled as examples in the UI.
  const FOOD_DB = [
    { name: "Roti (whole wheat)", cal: 297, prot: 11 },
    { name: "Rice (cooked, white)", cal: 130, prot: 2.7 },
    { name: "Dal (cooked, toor)", cal: 116, prot: 7 },
    { name: "Paneer", cal: 265, prot: 18 },
    { name: "Curd (plain, whole milk)", cal: 61, prot: 3.5 },
    { name: "Milk (whole)", cal: 62, prot: 3.2 },
    { name: "Banana", cal: 89, prot: 1.1 },
    { name: "Egg (boiled)", cal: 155, prot: 13 },
    { name: "Chapati (plain)", cal: 240, prot: 8 },
    { name: "Idli", cal: 132, prot: 4 },
    { name: "Dosa (plain)", cal: 168, prot: 4.5 },
    { name: "Poha", cal: 130, prot: 2.6 },
    { name: "Upma", cal: 132, prot: 3.4 },
    { name: "Chicken (cooked)", cal: 239, prot: 27 },
    { name: "Potato (boiled)", cal: 87, prot: 1.9 },
    { name: "Spinach (palak, cooked)", cal: 23, prot: 3 },
    { name: "Cauliflower (cooked)", cal: 23, prot: 1.8 },
    { name: "Okra (bhindi, cooked)", cal: 33, prot: 1.9 },
    { name: "Tomato", cal: 18, prot: 0.9 },
    { name: "Cucumber", cal: 15, prot: 0.7 },
    { name: "Carrot", cal: 41, prot: 0.9 },
    { name: "Chana (cooked chickpeas)", cal: 164, prot: 8.9 },
    { name: "Rajma (cooked kidney beans)", cal: 127, prot: 8.7 },
    { name: "Peanuts (roasted)", cal: 567, prot: 26 },
    { name: "Ghee", cal: 900, prot: 0 },
  ];

  const DEFAULT_GOALS = { calories: 2000, protein: 60 }; // example values, user-changeable
  const STORE_ENTRIES = "nutrilens.entries";
  const STORE_GOALS = "nutrilens.goals";
  const STORE_THEME = "nutrilens.theme";
  const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
  const MEAL_META = {
    breakfast: { label: "Breakfast", icon: "🌅" },
    lunch: { label: "Lunch", icon: "🌞" },
    dinner: { label: "Dinner", icon: "🌙" },
    snack: { label: "Snacks", icon: "🍎" },
  };

  // ---------- State ----------
  let selectedDate = todayKey();
  let editingId = null;        // id of the entry being edited, or null when adding
  let editingDate = null;      // date key the edited entry belongs to
  let activeSuggestion = -1;   // highlighted row in the suggestion list

  // ---------- Helpers ----------
  function todayKey() {
    return toKey(new Date());
  }

  function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      showToast("Could not save — browser storage unavailable.", "error");
      return false;
    }
  }

  function getEntries() {
    const all = loadJSON(STORE_ENTRIES, {});
    return typeof all === "object" && !Array.isArray(all) ? all : {};
  }

  function getDayEntries(dateKey) {
    const all = getEntries();
    return Array.isArray(all[dateKey]) ? all[dateKey] : [];
  }

  function setDayEntries(dateKey, list) {
    const all = getEntries();
    if (list.length === 0) {
      delete all[dateKey];
    } else {
      all[dateKey] = list;
    }
    return saveJSON(STORE_ENTRIES, all);
  }

  function getGoals() {
    const g = loadJSON(STORE_GOALS, DEFAULT_GOALS);
    const cal = Number(g.calories);
    const prot = Number(g.protein);
    return {
      calories: Number.isFinite(cal) && cal > 0 ? cal : DEFAULT_GOALS.calories,
      protein: Number.isFinite(prot) && prot > 0 ? prot : DEFAULT_GOALS.protein,
    };
  }

  // Core formula: nutrition consumed = per-100g value * grams / 100
  function computeConsumed(per100, grams) {
    return (per100 * grams) / 100;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function fmt(n) {
    return Number.isInteger(n) ? String(n) : String(round1(n));
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);

  const tabs = document.querySelectorAll(".tab");
  const sections = document.querySelectorAll(".section");

  const datePicker = $("date-picker");
  const dateDisplay = $("date-display");
  const dateWeekday = $("date-weekday");
  const dateFull = $("date-full");
  const todayChip = $("today-chip");
  const jumpTodayBtn = $("jump-today");
  const themeToggle = $("theme-toggle");
  const themeIcon = $("theme-icon");

  const statCalories = $("stat-calories");
  const statProtein = $("stat-protein");
  const statCount = $("stat-count");
  const statRemaining = $("stat-remaining");
  const statRemainingLabel = $("stat-remaining-label");
  const statCalSub = $("stat-cal-sub");
  const statProtSub = $("stat-prot-sub");
  const statCountSub = $("stat-count-sub");
  const statRemainingSub = $("stat-remaining-sub");

  const progressFill = $("progress-fill");
  const progressText = $("progress-text");
  const progressNote = $("progress-note");
  const progressWrap = $("progress-bar-wrap");
  const proteinFill = $("protein-progress-fill");
  const proteinText = $("protein-progress-text");
  const proteinWrap = $("protein-bar-wrap");

  const goalForm = $("goal-form");
  const goalCaloriesInput = $("goal-calories");
  const goalProteinInput = $("goal-protein");
  const proteinSummary = $("protein-summary");

  const mealLog = $("meal-log");
  const emptyLog = $("empty-log");
  const logDateLabel = $("log-date-label");
  const emptyAddBtn = $("empty-add-btn");

  const foodForm = $("food-form");
  const formHeading = $("form-heading");
  const foodSearch = $("food-search");
  const comboClear = $("combo-clear");
  const suggestionsList = $("food-suggestions");
  const foodName = $("food-name");
  const mealType = $("meal-type");
  const quantityInput = $("quantity");
  const cal100Input = $("cal100");
  const prot100Input = $("prot100");
  const servingPreview = $("serving-preview");
  const servingPreviewText = $("serving-preview-text");
  const addDateNote = $("add-date-note");
  const submitBtn = $("submit-btn");
  const cancelEditBtn = $("cancel-edit-btn");

  // ---------- Toasts ----------
  function showToast(message, type) {
    const container = $("toast-container");
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "error" : "success"}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s ease";
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }

  // ---------- Tabs ----------
  function activateTab(tabId) {
    tabs.forEach((t) => {
      const isActive = t.id === tabId;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) {
        sections.forEach((s) => s.classList.toggle("active", s.id === t.dataset.target));
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.id);
      // Leaving the Add Food tab cancels any in-progress edit cleanly.
      if (tab.id === "tab-dashboard" && editingId) cancelEdit(false);
    });
  });

  // ---------- Theme (light / dark) ----------
  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.dataset.theme = "dark";
      themeIcon.textContent = "☀️";
      themeToggle.setAttribute("aria-label", "Switch to light mode");
    } else {
      delete document.documentElement.dataset.theme;
      themeIcon.textContent = "🌙";
      themeToggle.setAttribute("aria-label", "Switch to dark mode");
    }
  }

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  themeToggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(STORE_THEME, next); } catch (_) {}
  });

  // Sync the toggle icon with whatever the pre-paint <head> script applied.
  applyTheme(currentTheme());

  // ---------- Date navigation ----------
  function toDateObj(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function relativeDayLabel(key) {
    const today = toDateObj(todayKey());
    const diffDays = Math.round((toDateObj(key) - today) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === -1) return "Yesterday";
    if (diffDays === 1) return "Tomorrow";
    return toDateObj(key).toLocaleDateString(undefined, { weekday: "long" });
  }

  function setDate(key) {
    selectedDate = key;
    datePicker.value = key;
    const isToday = key === todayKey();
    dateWeekday.textContent = relativeDayLabel(key);
    dateFull.textContent = toDateObj(key).toLocaleDateString(undefined, {
      day: "numeric", month: "long", year: "numeric",
    });
    todayChip.hidden = isToday;
    jumpTodayBtn.hidden = isToday;
    logDateLabel.textContent = isToday ? "— today" : `— ${friendlyDate(key)}`;
    updateAddDateNote();
    render();
  }

  function updateAddDateNote() {
    const isToday = selectedDate === todayKey();
    if (editingId) {
      addDateNote.textContent = `Editing an entry from ${editingDate === todayKey() ? "today" : friendlyDate(editingDate)}.`;
    } else {
      addDateNote.textContent = isToday
        ? "Entries will be added to today's log."
        : `Note: you are viewing ${friendlyDate(selectedDate)}. Entries will be added to that date.`;
    }
  }

  function friendlyDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, {
      weekday: "short", year: "numeric", month: "short", day: "numeric",
    });
  }

  function shiftDate(days) {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    setDate(toKey(dt));
  }

  $("prev-day").addEventListener("click", () => shiftDate(-1));
  $("next-day").addEventListener("click", () => shiftDate(1));
  jumpTodayBtn.addEventListener("click", () => setDate(todayKey()));
  datePicker.addEventListener("change", () => {
    if (datePicker.value) setDate(datePicker.value);
  });

  // Clicking the big date opens the native calendar picker.
  dateDisplay.addEventListener("click", () => {
    if (typeof datePicker.showPicker === "function") {
      try { datePicker.showPicker(); return; } catch (_) {}
    }
    // Fallback for browsers without showPicker support.
    datePicker.style.pointerEvents = "auto";
    datePicker.focus();
    datePicker.click();
    datePicker.style.pointerEvents = "";
  });

  // ---------- Searchable food combobox ----------
  function filterFoods(query) {
    const q = query.trim().toLowerCase();
    if (!q) return FOOD_DB.map((food, i) => ({ food, i }));
    return FOOD_DB
      .map((food, i) => ({ food, i }))
      .filter(({ food }) => food.name.toLowerCase().includes(q));
  }

  function renderSuggestions() {
    const query = foodSearch.value;
    const matches = filterFoods(query);
    activeSuggestion = -1;
    suggestionsList.innerHTML = "";

    matches.forEach(({ food, i }) => {
      const li = document.createElement("li");
      li.className = "suggestion";
      li.setAttribute("role", "option");
      li.dataset.index = String(i);
      li.innerHTML = `
        <span class="sug-name">${escapeHTML(food.name)}</span>
        <span class="sug-vals">${fmt(food.cal)} kcal · ${fmt(food.prot)} g protein / 100 g</span>`;
      suggestionsList.appendChild(li);
    });

    if (matches.length === 0) {
      const none = document.createElement("li");
      none.className = "suggestion no-results";
      none.textContent = "No match in the database";
      suggestionsList.appendChild(none);
    }

    // Always offer the custom-entry escape hatch.
    const custom = document.createElement("li");
    custom.className = "suggestion custom-option";
    custom.setAttribute("role", "option");
    custom.dataset.custom = "1";
    custom.innerHTML = `<span class="sug-name">✏️ Enter “${escapeHTML(query.trim() || "a custom food")}” manually</span>`;
    suggestionsList.appendChild(custom);

    openSuggestions();
  }

  function openSuggestions() {
    suggestionsList.hidden = false;
    foodSearch.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    suggestionsList.hidden = true;
    foodSearch.setAttribute("aria-expanded", "false");
    activeSuggestion = -1;
  }

  function selectableSuggestions() {
    return Array.from(suggestionsList.querySelectorAll(".suggestion[role='option']"));
  }

  function highlightSuggestion(idx) {
    const items = selectableSuggestions();
    items.forEach((el, i) => el.classList.toggle("active", i === idx));
    if (items[idx]) items[idx].scrollIntoView({ block: "nearest" });
    activeSuggestion = idx;
  }

  function chooseSuggestion(el) {
    if (el.dataset.custom === "1") {
      // Custom food: keep whatever the user typed as the starting name.
      const typed = foodSearch.value.trim();
      if (typed) foodName.value = typed;
      closeSuggestions();
      foodName.focus();
      updatePreview();
      return;
    }
    const food = FOOD_DB[Number(el.dataset.index)];
    if (!food) return;
    foodName.value = food.name;
    cal100Input.value = String(food.cal);
    prot100Input.value = String(food.prot);
    foodSearch.value = food.name;
    comboClear.hidden = false;
    closeSuggestions();
    quantityInput.focus();
    updatePreview();
  }

  foodSearch.addEventListener("input", () => {
    comboClear.hidden = foodSearch.value === "";
    renderSuggestions();
  });

  foodSearch.addEventListener("focus", renderSuggestions);

  foodSearch.addEventListener("keydown", (e) => {
    const items = selectableSuggestions();
    if (suggestionsList.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      renderSuggestions();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightSuggestion(Math.min(activeSuggestion + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightSuggestion(Math.max(activeSuggestion - 1, 0));
    } else if (e.key === "Enter") {
      // Enter inside the search box selects, it never submits the form by accident.
      e.preventDefault();
      if (!suggestionsList.hidden && activeSuggestion >= 0 && items[activeSuggestion]) {
        chooseSuggestion(items[activeSuggestion]);
      } else if (!suggestionsList.hidden && items.length === 2 && items[0].dataset.index) {
        // Exactly one database match (+ custom row): pick it.
        chooseSuggestion(items[0]);
      }
    } else if (e.key === "Escape") {
      closeSuggestions();
    }
  });

  suggestionsList.addEventListener("mousedown", (e) => {
    // mousedown (not click) so it fires before the input's blur.
    const el = e.target.closest(".suggestion[role='option']");
    if (el) {
      e.preventDefault();
      chooseSuggestion(el);
    }
  });

  comboClear.addEventListener("click", () => {
    foodSearch.value = "";
    comboClear.hidden = true;
    closeSuggestions();
    foodSearch.focus();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".combo-field")) closeSuggestions();
  });

  // ---------- Live serving preview ----------
  function updatePreview() {
    const grams = Number(quantityInput.value);
    const cal = Number(cal100Input.value);
    const prot = Number(prot100Input.value);
    if (grams > 0 && Number.isFinite(cal) && cal >= 0 && Number.isFinite(prot) && prot >= 0 &&
        cal100Input.value !== "" && prot100Input.value !== "") {
      const c = round1(computeConsumed(cal, grams));
      const p = round1(computeConsumed(prot, grams));
      servingPreviewText.textContent = `${fmt(grams)} g = ${fmt(c)} kcal and ${fmt(p)} g protein`;
      servingPreview.hidden = false;
    } else {
      servingPreview.hidden = true;
    }
  }

  [quantityInput, cal100Input, prot100Input].forEach((el) =>
    el.addEventListener("input", updatePreview)
  );

  // ---------- Form validation (shared by add + edit) ----------
  function validateFoodForm() {
    const name = foodName.value.trim();
    const meal = mealType.value;
    const grams = Number(quantityInput.value);
    const cal100 = Number(cal100Input.value);
    const prot100 = Number(prot100Input.value);

    if (!name) {
      showToast("Please enter a food name.", "error");
      foodName.focus();
      return null;
    }
    if (!MEAL_TYPES.includes(meal)) {
      showToast("Please choose a valid meal type.", "error");
      return null;
    }
    if (!Number.isFinite(grams) || grams <= 0 || quantityInput.value === "") {
      showToast("Quantity must be a positive number of grams.", "error");
      quantityInput.focus();
      return null;
    }
    if (!Number.isFinite(cal100) || cal100 < 0 || cal100Input.value === "") {
      showToast("Calories per 100 g must be 0 or more.", "error");
      cal100Input.focus();
      return null;
    }
    if (!Number.isFinite(prot100) || prot100 < 0 || prot100Input.value === "") {
      showToast("Protein per 100 g must be 0 or more.", "error");
      prot100Input.focus();
      return null;
    }
    if (cal100 > 900) {
      showToast("Calories per 100 g looks too high (max ~900 kcal for pure fat).", "error");
      cal100Input.focus();
      return null;
    }
    if (prot100 > 100) {
      showToast("Protein per 100 g cannot exceed 100 g.", "error");
      prot100Input.focus();
      return null;
    }

    return { name, meal, grams, cal100, prot100 };
  }

  function resetFoodForm() {
    foodForm.reset();
    foodSearch.value = "";
    comboClear.hidden = true;
    closeSuggestions();
    servingPreview.hidden = true;
  }

  // ---------- Edit mode ----------
  function startEdit(id) {
    const list = getDayEntries(selectedDate);
    const entry = list.find((en) => en.id === id);
    if (!entry) {
      showToast("Could not find that entry anymore.", "error");
      render();
      return;
    }

    editingId = id;
    editingDate = selectedDate;

    foodName.value = entry.name;
    mealType.value = entry.meal;
    quantityInput.value = String(entry.grams);
    cal100Input.value = String(entry.cal100);
    prot100Input.value = String(entry.prot100);
    foodSearch.value = "";
    comboClear.hidden = true;

    formHeading.textContent = "Edit food entry";
    submitBtn.textContent = "Save changes";
    cancelEditBtn.hidden = false;
    updateAddDateNote();
    updatePreview();
    activateTab("tab-add");
    render(); // highlight the entry being edited
    foodName.focus();
  }

  function cancelEdit(showMessage) {
    editingId = null;
    editingDate = null;
    formHeading.textContent = "Add a food";
    submitBtn.textContent = "Add Meal";
    cancelEditBtn.hidden = true;
    resetFoodForm();
    updateAddDateNote();
    render();
    if (showMessage) showToast("Editing cancelled.", "success");
  }

  cancelEditBtn.addEventListener("click", () => cancelEdit(true));

  // ---------- Add / save food ----------
  foodForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const values = validateFoodForm();
    if (!values) return;

    const computed = {
      calories: round1(computeConsumed(values.cal100, values.grams)),
      protein: round1(computeConsumed(values.prot100, values.grams)),
    };

    if (editingId) {
      // Update the existing entry in place (same id, same date).
      const dateKey = editingDate;
      const list = getDayEntries(dateKey);
      const idx = list.findIndex((en) => en.id === editingId);
      if (idx === -1) {
        showToast("That entry no longer exists — saving as a new one instead.", "error");
      } else {
        list[idx] = { ...list[idx], ...values, ...computed };
        if (!setDayEntries(dateKey, list)) return;
        showToast(`Updated ${values.name} — ${fmt(computed.calories)} kcal, ${fmt(computed.protein)} g protein.`, "success");
        cancelEdit(false);
        activateTab("tab-dashboard");
        return;
      }
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ...values,
      ...computed,
    };

    const list = getDayEntries(selectedDate);
    list.push(entry);
    if (!setDayEntries(selectedDate, list)) return;

    showToast(`Added ${values.name} — ${fmt(entry.calories)} kcal, ${fmt(entry.protein)} g protein. ✅`, "success");
    resetFoodForm();
    render();
  });

  // ---------- Entry actions: edit + delete ----------
  mealLog.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn) {
      startEdit(editBtn.dataset.id);
      return;
    }
    const delBtn = e.target.closest(".delete-btn");
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (editingId === id) cancelEdit(false); // deleting the entry being edited
      const list = getDayEntries(selectedDate).filter((en) => en.id !== id);
      setDayEntries(selectedDate, list);
      showToast("Entry deleted.", "success");
      render();
    }
  });

  // ---------- Empty-state shortcut ----------
  emptyAddBtn.addEventListener("click", () => {
    activateTab("tab-add");
    foodSearch.focus();
  });

  // ---------- Goals ----------
  function fillGoalInputs() {
    const goals = getGoals();
    goalCaloriesInput.value = String(goals.calories);
    goalProteinInput.value = String(goals.protein);
  }

  goalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const cal = Number(goalCaloriesInput.value);
    const prot = Number(goalProteinInput.value);

    if (!Number.isFinite(cal) || cal <= 0 || goalCaloriesInput.value === "") {
      showToast("Calorie target must be a positive number.", "error");
      goalCaloriesInput.focus();
      return;
    }
    if (!Number.isFinite(prot) || prot <= 0 || goalProteinInput.value === "") {
      showToast("Protein target must be a positive number.", "error");
      goalProteinInput.focus();
      return;
    }

    if (saveJSON(STORE_GOALS, { calories: cal, protein: prot })) {
      showToast("Daily targets saved.", "success");
    }
    render();
  });

  // ---------- Render ----------
  function render() {
    const entries = getDayEntries(selectedDate);
    const goals = getGoals();
    const isToday = selectedDate === todayKey();

    const totalCal = round1(entries.reduce((sum, en) => sum + en.calories, 0));
    const totalProt = round1(entries.reduce((sum, en) => sum + en.protein, 0));
    const remaining = round1(goals.calories - totalCal);

    // Stat cards
    statCalories.textContent = fmt(totalCal);
    statProtein.textContent = fmt(totalProt);
    statCount.textContent = String(entries.length);
    statCalSub.textContent = `of ${fmt(goals.calories)} kcal target`;
    statProtSub.textContent = `of ${fmt(goals.protein)} g target`;
    statCountSub.textContent = isToday ? "today" : "on this day";

    if (remaining >= 0) {
      statRemainingLabel.textContent = "Calories remaining";
      statRemaining.textContent = fmt(remaining);
      statRemaining.parentElement.classList.remove("over");
      statRemainingSub.textContent = "until daily target";
    } else {
      statRemainingLabel.textContent = "Calories over target";
      statRemaining.textContent = fmt(Math.abs(remaining));
      statRemaining.parentElement.classList.add("over");
      statRemainingSub.textContent = "above daily target";
    }

    // Calorie progress bar
    const pct = goals.calories > 0 ? (totalCal / goals.calories) * 100 : 0;
    const clamped = Math.max(0, Math.min(100, pct));
    progressFill.style.width = clamped + "%";
    progressFill.classList.toggle("over", pct > 100);
    progressWrap.setAttribute("aria-valuenow", String(Math.round(clamped)));
    progressText.textContent = `${fmt(totalCal)} / ${fmt(goals.calories)} kcal`;

    // Protein progress bar
    const protPct = goals.protein > 0 ? (totalProt / goals.protein) * 100 : 0;
    const protClamped = Math.max(0, Math.min(100, protPct));
    proteinFill.style.width = protClamped + "%";
    proteinWrap.setAttribute("aria-valuenow", String(Math.round(protClamped)));
    proteinText.textContent = `${fmt(totalProt)} / ${fmt(goals.protein)} g`;

    progressNote.textContent =
      pct > 100
        ? `You are ${fmt(Math.abs(remaining))} kcal over your daily calorie target.`
        : `${Math.round(pct)}% of calorie target · ${Math.round(protPct)}% of protein target.`;

    // Protein summary under goals
    proteinSummary.textContent =
      `Protein today: ${fmt(totalProt)} g of ${fmt(goals.protein)} g target` +
      (totalProt >= goals.protein ? " — target reached! 🎉" : ".");

    // Meal log grouped by meal type
    mealLog.innerHTML = "";
    emptyLog.hidden = entries.length > 0;

    MEAL_TYPES.forEach((type) => {
      const group = entries.filter((en) => en.meal === type);
      if (group.length === 0) return;

      const meta = MEAL_META[type];
      const groupCal = round1(group.reduce((s, en) => s + en.calories, 0));

      const wrap = document.createElement("div");
      wrap.className = "meal-group";
      wrap.innerHTML = `
        <h3><span aria-hidden="true">${meta.icon}</span> ${meta.label}
          <span class="muted group-total">· ${fmt(groupCal)} kcal</span>
        </h3>
        <ul>
          ${group
            .map(
              (en) => `
            <li class="meal-entry${en.id === editingId ? " editing" : ""}">
              <div class="entry-main">
                <div class="entry-name">${escapeHTML(en.name)}</div>
                <div class="entry-sub">${fmt(en.grams)} g · ${fmt(en.cal100)} kcal / 100 g · ${fmt(en.prot100)} g protein / 100 g</div>
              </div>
              <div class="entry-stats">
                <span class="entry-cal">${fmt(en.calories)} kcal</span>
                <span class="entry-prot">${fmt(en.protein)} g</span>
                <span class="entry-actions">
                  <button class="entry-btn edit-btn" data-id="${en.id}" title="Edit entry" aria-label="Edit ${escapeHTML(en.name)}">✏️</button>
                  <button class="entry-btn delete-btn" data-id="${en.id}" title="Delete entry" aria-label="Delete ${escapeHTML(en.name)}">🗑️</button>
                </span>
              </div>
            </li>`
            )
            .join("")}
        </ul>`;
      mealLog.appendChild(wrap);
    });
  }

  // ---------- Init ----------
  fillGoalInputs();
  setDate(todayKey());
})();

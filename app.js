// Empty collections define the starter world; saved entries are loaded below.
const defaults = {
      places: [],
      characters: [],
      factions: [],
      items: [],
      timeline: []
    };
    const meta = {
      places: ["Places","Landmarks, regions, and hidden corners of your world.","All places","⌖","Place"],
      characters: ["Characters","Heroes, rivals, and everyone caught in between.","All characters","♙","Character"],
      factions: ["Factions","Orders, kingdoms, and powers shaping the realms.","All factions","⚑","Faction"],
      items: ["Items","Artifacts, tools, treasures, and objects from your world.","All items","✧","Item"],
      timeline: ["Timeline","The moments that changed the course of history.","All events","◷","Event"]
    };
    // Read persisted entries while keeping missing or malformed categories empty.
    let state;
    try {
      const saved = localStorage.getItem("mythos-world-data");
      const savedState = saved ? JSON.parse(saved) : {};
      state = Object.fromEntries(
        Object.keys(defaults).map(key => [key, Array.isArray(savedState[key]) ? savedState[key] : []])
      );
    } catch (error) {
      console.error("Unable to load saved world data.", error);
      state = { ...defaults };
      showToast("Saved data couldn't be loaded; starting with an empty world.");
    }
    // Track which workspace section is currently shown.
    let activeView = "overview";

    // Save world data locally so it remains available after a reload.
    function persist() {
      try {
        localStorage.setItem("mythos-world-data", JSON.stringify(state));
      } catch (error) {
        console.error("Unable to save world data.", error);
        showToast("Couldn't save changes in this browser.");
      }
    }
    // Give the user short-lived feedback after important actions or storage errors.
    function showToast(message) {
      const root = document.getElementById("toast-root");
      root.innerHTML = "";
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      root.append(toast);
      setTimeout(() => toast.remove(), 3000);
    }
    // Keep sidebar badges and dashboard totals synchronized with saved entries.
    function updateCounts() {
      Object.keys(meta).forEach(key => {
        document.querySelector(`[data-count="${key}"]`).textContent = state[key].length;
        const stat = document.querySelector(`[data-stat="${key}"]`);
        if (stat) stat.textContent = state[key].length;
      });
    }
    // Switch between the overview and a searchable category collection.
    function openView(view) {
      activeView = view;
      document.querySelectorAll(".nav button").forEach(button => button.classList.toggle("active", button.dataset.view === view));
      const isOverview = view === "overview";
      document.getElementById("overview-view").hidden = !isOverview;
      document.getElementById("collection-view").hidden = isOverview;
      if (isOverview) return;
      const details = meta[view];
      document.getElementById("collection-eyebrow").textContent = "WORLD INDEX · " + view.toUpperCase();
      document.getElementById("collection-title").textContent = details[0];
      document.getElementById("collection-description").textContent = details[1];
      document.getElementById("list-heading").textContent = details[2];
      document.getElementById("add-entry").innerHTML = `＋ &nbsp; Add ${details[4].toLowerCase()}`;
      document.getElementById("search-input").value = "";
      renderCollection();
    }
    // Build the active collection cards, including an overflow menu for actions.
    function renderCollection() {
      const entries = state[activeView] || [];
      const query = document.getElementById("search-input").value.trim().toLowerCase();
      const filtered = entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.slice(0,4).join(" ").toLowerCase().includes(query));
      const target = document.getElementById("collection");
      target.innerHTML = "";
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "panel empty";
        const category = activeView === "timeline" ? "events" : activeView;
        empty.textContent = query ? "No entries match your search." : `No ${category} yet. Create the first one to begin your world.`;
        target.append(empty);
        return;
      }
      filtered.forEach(({ entry, index: entryIndex }) => {
        const card = document.createElement("article");
        card.className = "panel entry-card";
        const icon = document.createElement("div");
        icon.className = "entry-symbol";
        icon.textContent = entry[1];
        const title = document.createElement("h3");
        title.textContent = entry[0];
        const description = document.createElement("p");
        description.textContent = entry[2];
        const detail = document.createElement("div");
        detail.className = "entry-meta";
        detail.textContent = entry[3];
        card.append(icon, title, description, detail);
        const menu = document.createElement("details");
        menu.className = "entry-menu";
        const menuButton = document.createElement("summary");
        menuButton.textContent = "⋯";
        menuButton.setAttribute("aria-label", `More options for ${entry[0]}`);
        const menuOptions = document.createElement("div");
        menuOptions.className = "entry-menu-options";
        const removeButton = document.createElement("button");
        removeButton.className = "remove-entry";
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
          menu.open = false;
          openDeleteConfirmation(activeView, entryIndex);
        });
        menuOptions.append(removeButton);
        menu.append(menuButton, menuOptions);
        card.append(menu);
        target.append(card);
      });
    }
    // Confirm destructive changes before removing an entry from its category.
    function openDeleteConfirmation(category, entryIndex) {
      const entry = state[category][entryIndex];
      if (!entry) return;

      const type = category === "timeline" ? "event" : meta[category][4].toLowerCase();
      const root = document.getElementById("modal-root");
      root.innerHTML = `<div class="modal-backdrop"><section class="modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><div class="modal-head"><h2 id="delete-title">Remove ${type}?</h2><button class="close" type="button" aria-label="Close">×</button></div><p id="delete-description"></p><div class="modal-actions"><button class="secondary" type="button" id="cancel-delete">Cancel</button><button class="danger-button" type="button" id="confirm-delete">Remove ${type}</button></div></section></div>`;
      root.querySelector("#delete-description").textContent = `"${entry[0]}" will be permanently removed from your world.`;
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-delete").addEventListener("click", closeModal);
      root.querySelector(".modal-backdrop").addEventListener("click", event => {
        if (event.target.classList.contains("modal-backdrop")) closeModal();
      });
      root.querySelector("#confirm-delete").addEventListener("click", () => {
        state[category].splice(entryIndex, 1);
        persist();
        updateCounts();
        closeModal();
        renderCollection();
        showToast(`${type[0].toUpperCase()}${type.slice(1)} removed.`);
      });
      root.querySelector("#cancel-delete").focus();
    }
    // Collect a new entry using fields appropriate to the selected category.
    function openModal(requestedCategory) {
      const category = requestedCategory || (activeView === "overview" ? "places" : activeView);
      const type = meta[category][4];
      const root = document.getElementById("modal-root");
      root.innerHTML = `<div class="modal-backdrop"><form class="modal" id="entry-form"><div class="modal-head"><h2>Create ${type.toLowerCase()}</h2><button class="close" type="button" aria-label="Close">×</button></div>
        <label class="field">Name<input name="name" maxlength="60" required placeholder="Give it a name"></label>
        <label class="field">Description<textarea name="description" maxlength="240" required placeholder="What should the world know?"></textarea></label>
        <label class="field">${category === "timeline" ? "Date · Era" : "Type · Region"}<input name="detail" maxlength="60" placeholder="${category === "timeline" ? "Year 2400 · Third Age" : "e.g. Settlement · Northern Marches"}"></label>
        <div class="modal-actions"><button class="secondary" type="button" id="cancel-entry">Cancel</button><button class="primary" type="submit">Create ${type.toLowerCase()}</button></div></form></div>`;
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-entry").addEventListener("click", closeModal);
      root.querySelector(".modal-backdrop").addEventListener("click", event => { if (event.target.classList.contains("modal-backdrop")) closeModal(); });
      root.querySelector("#entry-form").addEventListener("submit", event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const icons = { places: "✦", characters: "♙", factions: "⚑", items: "✧", timeline: "◷" };
        state[category].unshift([form.get("name").trim(), icons[category], form.get("description").trim(), form.get("detail").trim() || meta[category][4]]);
        persist();
        updateCounts();
        closeModal();
        if (activeView !== "overview") renderCollection();
        showToast(`${type} added to your world.`);
      });
      root.querySelector('input[name="name"]').focus();
    }
    // Clear whichever dialog is currently open.
    function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

    // Connect navigation, creation shortcuts, search, and keyboard dismissal.
    document.querySelectorAll(".nav button").forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
    document.querySelectorAll("[data-open-view]").forEach(button => button.addEventListener("click", () => openView(button.dataset.openView)));
    document.getElementById("quick-add").addEventListener("click", () => openModal());
    document.getElementById("add-entry").addEventListener("click", () => openModal());
    document.getElementById("add-first-place").addEventListener("click", () => openModal("places"));
    document.querySelectorAll("[data-create-category]").forEach(button => {
      button.addEventListener("click", () => openModal(button.dataset.createCategory));
    });
    document.getElementById("search-input").addEventListener("input", renderCollection);
    document.getElementById("focus-search").addEventListener("click", () => {
      if (activeView === "overview") openView("places");
      document.getElementById("search-input").focus();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
    // Set the initial counts from the loaded local world.
    updateCounts();

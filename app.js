// Empty collections define the starter world; saved entries are loaded below.
const defaults = {
      maps: [],
      places: [],
      characters: [],
      factions: [],
      items: [],
      creatures: [],
      monsters: [],
      timeline: []
    };
    const meta = {
      maps: ["Maps","Create maps for your world, then scroll to zoom and drag to explore each one.","All maps","▣","Map"],
      places: ["Places","Landmarks, regions, and hidden corners of your world.","All places","⌖","Place"],
      characters: ["Characters","Heroes, rivals, and everyone caught in between.","All characters","♙","Character"],
      factions: ["Factions","Orders, kingdoms, and powers shaping the realms.","All factions","⚑","Faction"],
      items: ["Items","Artifacts, tools, treasures, and objects from your world.","All items","✧","Item"],
      creatures: ["Creatures","Beasts, wildlife, and wondrous living things across your world.","All creatures","♞","Creature"],
      monsters: ["Monsters","Terrifying foes, legendary threats, and creatures of the dark.","All monsters","☠","Monster"],
      timeline: ["Timeline","The moments that changed the course of history.","All events","◷","Event"]
    };
    const icons = { maps: "▣", places: "✦", characters: "♙", factions: "⚑", items: "✧", creatures: "♞", monsters: "☠", timeline: "◷" };
    // Each world stores its own independent collections.
    const worldStorageKey = "mythos-worlds";
    const legacyStorageKey = "mythos-world-data";
    let worlds = [];
    let activeWorldId;
    let state;
    try {
      const savedWorlds = localStorage.getItem(worldStorageKey);
      if (savedWorlds) {
        const parsedWorlds = JSON.parse(savedWorlds);
        if (!Array.isArray(parsedWorlds.worlds) || typeof parsedWorlds.activeWorldId !== "string") {
          throw new Error("Saved world list has an invalid format.");
        }
        worlds = parsedWorlds.worlds
          .filter(world => world && typeof world.id === "string" && typeof world.name === "string")
          .map(world => ({ id: world.id, name: world.name, data: normalizeData(world.data) }));
        activeWorldId = parsedWorlds.activeWorldId;
      } else {
        // Move existing single-world saves into the new multi-world format.
        const legacySave = localStorage.getItem(legacyStorageKey);
        const legacyData = legacySave ? JSON.parse(legacySave) : defaults;
        const firstWorld = { id: createWorldId(), name: "Untitled World", data: normalizeData(legacyData) };
        worlds = [firstWorld];
        activeWorldId = firstWorld.id;
      }
      if (!worlds.some(world => world.id === activeWorldId)) {
        activeWorldId = worlds[0]?.id;
      }
      if (!worlds.length) {
        const firstWorld = { id: createWorldId(), name: "Untitled World", data: normalizeData(defaults) };
        worlds = [firstWorld];
        activeWorldId = firstWorld.id;
      }
      state = worlds.find(world => world.id === activeWorldId).data;
    } catch (error) {
      console.error("Unable to load saved worlds.", error);
      const firstWorld = { id: createWorldId(), name: "Untitled World", data: normalizeData(defaults) };
      worlds = [firstWorld];
      activeWorldId = firstWorld.id;
      state = firstWorld.data;
      showToast("Saved worlds couldn't be loaded; starting with a new world.");
    }
    // Track which workspace section is currently shown.
    let activeView = "overview";
    let isPlacingMapMarker = false;

    // Normalize stored collections so older saves safely gain newer categories.
    function normalizeData(data) {
      const source = data && typeof data === "object" ? data : {};
      return {
        ...Object.fromEntries(
          Object.keys(defaults).map(key => [
            key,
            Array.isArray(source[key])
              ? source[key].filter(Array.isArray).map(entry => [
                entry[0] || "",
                entry[1] || meta[key][3],
                entry[2] || "",
                entry[3] || meta[key][4],
                typeof entry[4] === "string" ? entry[4] : entry[2] || "",
                Array.isArray(entry[5]) ? entry[5].filter(image => typeof image === "string" && image.startsWith("data:image/")) : [],
                typeof entry[6] === "string" ? entry[6] : "",
                Number.isFinite(entry[7]) && entry[7] >= 0 && entry[7] <= 100 ? entry[7] : null,
                Number.isFinite(entry[8]) && entry[8] >= 0 && entry[8] <= 100 ? entry[8] : null,
                typeof entry[9] === "string" ? entry[9] : createWorldId(),
                key === "maps" && Array.isArray(entry[10])
                  ? entry[10].filter(marker =>
                    marker
                    && typeof marker.placeId === "string"
                    && Number.isFinite(marker.x) && marker.x >= 0 && marker.x <= 100
                    && Number.isFinite(marker.y) && marker.y >= 0 && marker.y <= 100
                  ).map(marker => ({ placeId: marker.placeId, x: marker.x, y: marker.y }))
                  : []
              ])
              : []
          ])
        ),
        mapImage: typeof source.mapImage === "string" && source.mapImage.startsWith("data:image/")
          ? source.mapImage
          : ""
      };
    }

    function createWorldId() {
      return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    // Save every world and the current selection in browser storage.
    function persist() {
      try {
        const currentWorld = worlds.find(world => world.id === activeWorldId);
        if (currentWorld) currentWorld.data = state;
        localStorage.setItem(worldStorageKey, JSON.stringify({ worlds, activeWorldId }));
        return true;
      } catch (error) {
        console.error("Unable to save worlds.", error);
        showToast("Couldn't save changes in this browser.");
        return false;
      }
    }
    async function uploadEntryMapImage(entry, file) {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast(`${file.name} is not an image.`);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast(`${file.name} is larger than the 15 MB upload limit.`);
        return;
      }
      const targetState = state;
      const previousImages = entry[5] || [];
      try {
        const mapImage = await optimizeImage(file);
        if (state !== targetState || !targetState.maps.includes(entry)) {
          showToast("The world changed before the map finished uploading. Please try again.");
          return;
        }
        entry[5] = previousImages.length
          ? [mapImage, ...previousImages.slice(1)]
          : [mapImage];
        if (!persist()) {
          entry[5] = previousImages;
          return;
        }
        renderCollection();
        showToast(`Map image ${previousImages.length ? "updated" : "uploaded"}.`);
      } catch (error) {
        console.error("Unable to upload map image.", error);
        showToast(error.message || "Couldn't upload the map image.");
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

    function renderMap() {
      const map = document.getElementById("world-map");
      const mapContent = document.getElementById("map-content");
      const places = state.places;
      mapContent.style.backgroundImage = state.mapImage
        ? `linear-gradient(#0002, #0002), url("${state.mapImage}")`
        : "";
      mapContent.classList.toggle("has-custom-map-image", Boolean(state.mapImage));
      mapContent.querySelectorAll(".map-marker").forEach(marker => marker.remove());
      const placedPlaces = places
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => Number.isFinite(entry[7]) && Number.isFinite(entry[8]));
      map.querySelector(".map-empty").hidden = placedPlaces.length > 0 || Boolean(state.mapImage);
      document.getElementById("map-image-upload-label").textContent = state.mapImage ? "Change map image" : "Upload map image";
      document.getElementById("remove-map-image").hidden = !state.mapImage;
      document.getElementById("map-help").textContent = places.length
        ? `${placedPlaces.length} marked · ${places.length - placedPlaces.length} not placed`
        : "Add places and mark their locations on your map.";
      const placeButton = document.getElementById("place-on-map");
      placeButton.disabled = places.length === 0;
      placeButton.classList.toggle("active", isPlacingMapMarker);
      placeButton.setAttribute("aria-pressed", String(isPlacingMapMarker));
      placeButton.textContent = isPlacingMapMarker ? "Cancel placement" : "Place on map";
      map.tabIndex = isPlacingMapMarker ? 0 : -1;
      map.setAttribute("aria-label", isPlacingMapMarker
        ? "World map. Use zoom controls to zoom in or out; enlarge and drag to pan. Click or focus and press Enter to choose a location."
        : "World map. Use zoom controls to zoom in or out; enlarge and drag to pan. Choose Place on map, then click to position a place.");
      placedPlaces.forEach(({ entry, index }) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "map-marker";
        marker.style.left = `${entry[7]}%`;
        marker.style.top = `${entry[8]}%`;
        marker.title = entry[0];
        marker.setAttribute("aria-label", `${isPlacingMapMarker ? "Move" : "Open"} ${entry[0]}`);
        const symbol = document.createElement("span");
        symbol.textContent = entry[1];
        marker.append(symbol);
        marker.addEventListener("click", event => {
          event.stopPropagation();
          if (isPlacingMapMarker) {
            openPlacePlacementModal(entry[7], entry[8], index);
          } else {
            openView("places");
            openEntryDetails("places", index);
          }
        });
        mapContent.append(marker);
      });
      map.classList.toggle("placing", isPlacingMapMarker);
    }

    function openPlacePlacementModal(x, y, selectedIndex) {
      const root = document.getElementById("modal-root");
      const options = state.places.map((place, index) =>
        `<option value="${index}">${escapeHtml(place[0])}${Number.isFinite(place[7]) && Number.isFinite(place[8]) ? " (already marked)" : ""}</option>`
      ).join("");
      root.innerHTML = `<div class="modal-backdrop"><form class="modal" id="place-marker-form"><div class="modal-head"><h2>Place on map</h2><button class="close" type="button" aria-label="Close">×</button></div>
        <p class="placement-help">Choose which place to mark at this location.</p>
        <label class="field">Place<select name="place" required>${options}</select></label>
        <div class="modal-actions"><button class="secondary" type="button" id="cancel-marker">Cancel</button><button class="primary" type="submit">Set marker</button></div></form></div>`;
      const form = root.querySelector("#place-marker-form");
      if (Number.isInteger(selectedIndex)) form.elements.place.value = String(selectedIndex);
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-marker").addEventListener("click", closeModal);
      root.querySelector(".modal-backdrop").addEventListener("click", event => {
        if (event.target.classList.contains("modal-backdrop")) closeModal();
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        const place = state.places[Number(form.elements.place.value)];
        if (!place) return;
        const previousX = place[7];
        const previousY = place[8];
        place[7] = x;
        place[8] = y;
        if (!persist()) {
          place[7] = previousX;
          place[8] = previousY;
          return;
        }
        isPlacingMapMarker = false;
        closeModal();
        renderMap();
        showToast(`${place[0]} marked on the map.`);
      });
      form.elements.place.focus();
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[character]);
    }

    // Keep all visible world-name labels and the world picker in sync.
    function renderWorlds() {
      const currentWorld = worlds.find(world => world.id === activeWorldId);
      if (!currentWorld) return;
      document.querySelectorAll("[data-world-name]").forEach(element => {
        element.textContent = currentWorld.name;
      });
      const list = document.getElementById("world-menu-list");
      list.innerHTML = "";
      worlds.forEach(world => {
        const row = document.createElement("div");
        row.className = "world-option-row";
        const option = document.createElement("button");
        option.className = `world-option${world.id === activeWorldId ? " active" : ""}`;
        option.type = "button";
        option.setAttribute("role", "menuitemradio");
        option.textContent = world.name;
        option.setAttribute("aria-checked", String(world.id === activeWorldId));
        option.addEventListener("click", () => switchWorld(world.id));
        const renameButton = document.createElement("button");
        renameButton.className = "world-rename";
        renameButton.type = "button";
        renameButton.textContent = "✎";
        renameButton.setAttribute("aria-label", `Rename ${world.name}`);
        renameButton.setAttribute("role", "menuitem");
        renameButton.addEventListener("click", () => {
          closeWorldMenu();
          openRenameWorldModal(world.id);
        });
        row.append(option, renameButton);
        list.append(row);
      });
    }

    // Switch collections without changing the user's selected workspace section.
    function switchWorld(worldId) {
      const selectedWorld = worlds.find(world => world.id === worldId);
      if (!selectedWorld) return;
      closeExpandedSavedMaps();
      activeWorldId = selectedWorld.id;
      state = selectedWorld.data;
      persist();
      renderWorlds();
      updateCounts();
      isPlacingMapMarker = false;
      renderMap();
      closeWorldMenu();
      if (activeView !== "overview") {
        document.getElementById("entry-detail-view").hidden = true;
        document.getElementById("collection-view").hidden = false;
        document.getElementById("search-input").value = "";
        renderCollection();
      }
    }

    function closeWorldMenu() {
      const switchButton = document.getElementById("world-switch");
      document.getElementById("world-menu").hidden = true;
      switchButton.setAttribute("aria-expanded", "false");
    }

    // Prompt for a name and create a separate, empty world.
    function openCreateWorldModal() {
      const root = document.getElementById("modal-root");
      root.innerHTML = `<div class="modal-backdrop"><form class="modal" id="world-form"><div class="modal-head"><h2>Create a world</h2><button class="close" type="button" aria-label="Close">×</button></div><label class="field">World name<input name="name" maxlength="60" required placeholder="Name your world"></label><div class="modal-actions"><button class="secondary" type="button" id="cancel-world">Cancel</button><button class="primary" type="submit">Create world</button></div></form></div>`;
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-world").addEventListener("click", closeModal);
      const nameInput = root.querySelector('input[name="name"]');
      nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
      root.querySelector(".modal-backdrop").addEventListener("click", event => {
        if (event.target.classList.contains("modal-backdrop")) closeModal();
      });
      root.querySelector("#world-form").addEventListener("submit", event => {
        event.preventDefault();
        const name = new FormData(event.currentTarget).get("name").trim();
        if (!name) {
          nameInput.setCustomValidity("Enter a name for this world.");
          nameInput.reportValidity();
          return;
        }
        const newWorld = { id: createWorldId(), name, data: normalizeData(defaults) };
        worlds.push(newWorld);
        activeWorldId = newWorld.id;
        state = newWorld.data;
        isPlacingMapMarker = false;
        persist();
        renderWorlds();
        updateCounts();
        renderMap();
        closeModal();
        openView("overview");
        showToast(`World "${name}" created.`);
      });
      root.querySelector('input[name="name"]').focus();
    }

    // Rename the selected world without changing its saved collections.
    function openRenameWorldModal(worldId) {
      const world = worlds.find(item => item.id === worldId);
      if (!world) return;
      const root = document.getElementById("modal-root");
      root.innerHTML = `<div class="modal-backdrop"><form class="modal" id="rename-world-form"><div class="modal-head"><h2>Rename world</h2><button class="close" type="button" aria-label="Close">×</button></div><label class="field">World name<input name="name" maxlength="60" required></label><div class="modal-actions"><button class="secondary" type="button" id="cancel-world-rename">Cancel</button><button class="primary" type="submit">Save name</button></div></form></div>`;
      const nameInput = root.querySelector('input[name="name"]');
      nameInput.value = world.name;
      nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-world-rename").addEventListener("click", closeModal);
      root.querySelector(".modal-backdrop").addEventListener("click", event => {
        if (event.target.classList.contains("modal-backdrop")) closeModal();
      });
      root.querySelector("#rename-world-form").addEventListener("submit", event => {
        event.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.setCustomValidity("Enter a name for this world.");
          nameInput.reportValidity();
          return;
        }
        world.name = name;
        persist();
        renderWorlds();
        closeModal();
        showToast(`World renamed to "${name}".`);
      });
      nameInput.focus();
      nameInput.select();
    }
    // Switch between the overview and a searchable category collection.
    function closeExpandedSavedMaps() {
      document.querySelectorAll(".saved-map-viewer.is-expanded").forEach(viewer => {
        viewer.classList.remove("is-expanded");
        const button = viewer.querySelector(".saved-map-expand");
        button.setAttribute("aria-pressed", "false");
        button.textContent = "⛶ Enlarge map";
      });
      document.body.classList.remove("saved-map-expanded");
    }
    function openView(view) {
      closeExpandedSavedMaps();
      activeView = view;
      document.querySelectorAll(".nav button").forEach(button => button.classList.toggle("active", button.dataset.view === view));
      const isOverview = view === "overview";
      document.getElementById("overview-view").hidden = !isOverview;
      document.getElementById("collection-view").hidden = isOverview;
      document.getElementById("entry-detail-view").hidden = true;
      if (isOverview) return;
      const details = meta[view];
      document.getElementById("collection-eyebrow").textContent = "WORLD INDEX · " + view.toUpperCase();
      document.getElementById("collection-title").textContent = details[0];
      document.getElementById("collection-description").textContent = details[1];
      document.getElementById("list-heading").textContent = details[2];
      document.getElementById("add-entry").innerHTML = `＋ &nbsp; Add ${details[4].toLowerCase()}`;
      document.getElementById("search-input").value = "";
      document.getElementById("group-filter").value = "";
      renderCollection();
    }
    // Build the active collection cards, including an overflow menu for actions.
    function renderCollection() {
      const entries = state[activeView] || [];
      const query = document.getElementById("search-input").value.trim().toLowerCase();
      const groupFilter = document.getElementById("group-filter");
      const selectedGroup = groupFilter.value;
      const groups = [...new Set(entries.map(entry => entry[6]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      groupFilter.innerHTML = `<option value="">All groups</option>`;
      groups.forEach(group => {
        const option = document.createElement("option");
        option.value = group;
        option.textContent = group;
        groupFilter.append(option);
      });
      groupFilter.value = groups.includes(selectedGroup) ? selectedGroup : "";
      groupFilter.disabled = groups.length === 0;
      const filtered = entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.slice(0, 4).join(" ").toLowerCase().includes(query)
          && (!groupFilter.value || entry[6] === groupFilter.value));
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
        if (activeView === "maps") {
          renderMapCard(target, entry, entryIndex);
          return;
        }
        const card = document.createElement("article");
        card.className = "panel entry-card";
        const openButton = document.createElement("button");
        openButton.className = "entry-open";
        openButton.type = "button";
        openButton.setAttribute("aria-label", `Open ${meta[activeView][4].toLowerCase()} ${entry[0]}`);
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
        openButton.append(icon, title, description, detail);
        if (entry[6]) {
          const group = document.createElement("span");
          group.className = "tag entry-group";
          group.textContent = entry[6];
          openButton.append(group);
        }
        openButton.addEventListener("click", () => openEntryDetails(activeView, entryIndex));
        card.append(openButton);
        const menu = document.createElement("details");
        menu.className = "entry-menu";
        const menuButton = document.createElement("summary");
        menuButton.textContent = "⋯";
        menuButton.setAttribute("aria-label", `More options for ${entry[0]}`);
        const menuOptions = document.createElement("div");
        menuOptions.className = "entry-menu-options";
        const editButton = document.createElement("button");
        editButton.className = "edit-entry";
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
          menu.open = false;
          openEditEntry(activeView, entryIndex);
        });
        const removeButton = document.createElement("button");
        removeButton.className = "remove-entry";
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
          menu.open = false;
          openDeleteConfirmation(activeView, entryIndex);
        });
        menuOptions.append(editButton, removeButton);
        menu.append(menuButton, menuOptions);
        card.append(menu);
        target.append(card);
      });
    }

    function renderMapCard(target, entry, entryIndex) {
      const card = document.createElement("article");
      card.className = "panel map-entry-card";
      const heading = document.createElement("div");
      heading.className = "map-entry-heading";
      const title = document.createElement("h3");
      title.textContent = entry[0];
      const description = document.createElement("p");
      description.textContent = entry[2] || entry[3];
      heading.append(title, description);

      const menu = document.createElement("details");
      menu.className = "entry-menu";
      const menuButton = document.createElement("summary");
      menuButton.textContent = "⋯";
      menuButton.setAttribute("aria-label", `More options for ${entry[0]}`);
      const menuOptions = document.createElement("div");
      menuOptions.className = "entry-menu-options";
      const editButton = document.createElement("button");
      editButton.className = "edit-entry";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        menu.open = false;
        openEditEntry("maps", entryIndex);
      });
      const removeButton = document.createElement("button");
      removeButton.className = "remove-entry";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        menu.open = false;
        openDeleteConfirmation("maps", entryIndex);
      });
      menuOptions.append(editButton, removeButton);
      menu.append(menuButton, menuOptions);
      card.append(heading, menu);

      const viewer = document.createElement("div");
      viewer.className = "saved-map-viewer";
      viewer.tabIndex = 0;
      viewer.setAttribute("role", "group");
      viewer.setAttribute("aria-label", `${entry[0]} interactive map. Use the mouse wheel to zoom, drag to pan, and place saved places.`);
      const mapContent = document.createElement("div");
      mapContent.className = "saved-map-content";
      const mapImage = entry[5]?.[0];
      let imageElement;
      if (mapImage) {
        imageElement = document.createElement("img");
        imageElement.src = mapImage;
        imageElement.alt = `${entry[0]} map`;
        imageElement.draggable = false;
        mapContent.append(imageElement);
      } else {
        const empty = document.createElement("p");
        empty.className = "saved-map-empty";
        empty.textContent = "Upload a map image to start exploring.";
        mapContent.append(empty);
      }
      viewer.append(mapContent);

      const mapActions = document.createElement("div");
      mapActions.className = "saved-map-actions";
      const placeButton = document.createElement("button");
      placeButton.className = "secondary saved-map-place";
      placeButton.type = "button";
      placeButton.textContent = "Place on map";
      placeButton.disabled = !mapImage || state.places.length === 0;
      placeButton.setAttribute("aria-pressed", "false");
      placeButton.title = !mapImage
        ? "Upload a map image before placing places."
        : state.places.length === 0 ? "Add a place before placing it on this map." : "Choose a place to add to this map.";
      const expandButton = document.createElement("button");
      expandButton.className = "secondary saved-map-expand";
      expandButton.type = "button";
      expandButton.textContent = "⛶ Enlarge map";
      expandButton.setAttribute("aria-pressed", "false");
      mapActions.append(placeButton, expandButton);
      viewer.append(mapActions);

      const zoomControls = document.createElement("div");
      zoomControls.className = "map-zoom-controls";
      zoomControls.setAttribute("role", "group");
      zoomControls.setAttribute("aria-label", `${entry[0]} zoom controls`);
      const zoomIn = document.createElement("button");
      zoomIn.type = "button";
      zoomIn.setAttribute("aria-label", "Zoom in");
      zoomIn.title = "Zoom in";
      zoomIn.textContent = "+";
      const zoomLevel = document.createElement("output");
      zoomLevel.textContent = "100%";
      const zoomOut = document.createElement("button");
      zoomOut.type = "button";
      zoomOut.setAttribute("aria-label", "Zoom out");
      zoomOut.title = "Zoom out";
      zoomOut.textContent = "−";
      zoomControls.append(zoomIn, zoomLevel, zoomOut);
      viewer.append(zoomControls);
      card.append(viewer);

      const uploadLabel = document.createElement("label");
      uploadLabel.className = "secondary map-card-upload";
      const uploadText = document.createElement("span");
      uploadText.textContent = mapImage ? "Change map image" : "Upload map image";
      const uploadInput = document.createElement("input");
      uploadInput.type = "file";
      uploadInput.accept = "image/*";
      uploadInput.setAttribute("aria-label", `${mapImage ? "Change" : "Upload"} image for ${entry[0]}`);
      uploadInput.addEventListener("change", async () => {
        const [file] = uploadInput.files || [];
        uploadInput.value = "";
        await uploadEntryMapImage(entry, file);
      });
      uploadLabel.append(uploadText, uploadInput);
      card.append(uploadLabel);

      let zoom = 1;
      let panX = 0;
      let panY = 0;
      let drag;
      const minZoom = 0.5;
      const maxZoom = 4;
      const zoomStep = 0.25;
      let isPlacingPlace = false;
      let suppressMapClick = false;
      let hasDragged = false;
      const imageFrame = () => {
        const width = mapContent.clientWidth;
        const height = mapContent.clientHeight;
        const aspectRatio = imageElement.naturalWidth / imageElement.naturalHeight;
        const imageWidth = Math.min(width, height * aspectRatio);
        const imageHeight = Math.min(height, width / aspectRatio);
        return {
          left: (width - imageWidth) / 2,
          top: (height - imageHeight) / 2,
          width: imageWidth,
          height: imageHeight
        };
      };
      const renderMarkers = () => {
        mapContent.querySelectorAll(".saved-map-marker").forEach(marker => marker.remove());
        if (!imageElement?.naturalWidth) return;
        const frame = imageFrame();
        (entry[10] || []).forEach(placement => {
          const placeIndex = state.places.findIndex(place => place[9] === placement.placeId);
          if (placeIndex < 0) return;
          const place = state.places[placeIndex];
          const marker = document.createElement("button");
          marker.className = "saved-map-marker";
          marker.type = "button";
          marker.style.left = `${frame.left + frame.width * placement.x / 100}px`;
          marker.style.top = `${frame.top + frame.height * placement.y / 100}px`;
          marker.textContent = place[1];
          marker.title = place[0];
          marker.setAttribute("aria-label", `${place[0]} on ${entry[0]}`);
          marker.addEventListener("click", event => {
            event.stopPropagation();
            if (isPlacingPlace) {
              placeAt(event.clientX, event.clientY);
              return;
            }
            openView("places");
            openEntryDetails("places", placeIndex);
          });
          mapContent.append(marker);
        });
      };
      const placeAt = (clientX, clientY) => {
        if (!imageElement?.naturalWidth) return;
        const bounds = viewer.getBoundingClientRect();
        const localX = (clientX - bounds.left - bounds.width / 2 - panX) / zoom + bounds.width / 2;
        const localY = (clientY - bounds.top - bounds.height / 2 - panY) / zoom + bounds.height / 2;
        const frame = imageFrame();
        if (localX < frame.left || localX > frame.left + frame.width || localY < frame.top || localY > frame.top + frame.height) return;
        const x = ((localX - frame.left) / frame.width) * 100;
        const y = ((localY - frame.top) / frame.height) * 100;
        openMapPlaceModal(entry, x, y);
      };
      placeButton.addEventListener("click", () => {
        if (!state.places.length) {
          showToast("Add a place before placing it on this map.");
          return;
        }
        if (!mapImage) {
          showToast("Upload a map image before placing places.");
          return;
        }
        isPlacingPlace = !isPlacingPlace;
        placeButton.textContent = isPlacingPlace ? "Cancel placement" : "Place on map";
        placeButton.setAttribute("aria-pressed", String(isPlacingPlace));
        viewer.classList.toggle("is-placing", isPlacingPlace);
        if (isPlacingPlace) showToast("Click the map where you want to place it.");
      });
      expandButton.addEventListener("click", () => {
        const isExpanded = viewer.classList.toggle("is-expanded");
        document.body.classList.toggle("saved-map-expanded", isExpanded);
        expandButton.setAttribute("aria-pressed", String(isExpanded));
        expandButton.textContent = isExpanded ? "× Close map" : "⛶ Enlarge map";
        if (isExpanded) viewer.focus();
      });
      viewer.addEventListener("click", event => {
        if (suppressMapClick) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (isPlacingPlace && !event.target.closest(".saved-map-actions, .map-zoom-controls, .saved-map-marker")) {
          placeAt(event.clientX, event.clientY);
        }
      });
      if (imageElement) imageElement.addEventListener("load", renderMarkers);

      const clampPan = () => {
        const bounds = viewer.getBoundingClientRect();
        const maxPanX = Math.max(0, bounds.width * (zoom - 1) / 2);
        const maxPanY = Math.max(0, bounds.height * (zoom - 1) / 2);
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
        mapContent.style.setProperty("--saved-map-pan-x", `${panX}px`);
        mapContent.style.setProperty("--saved-map-pan-y", `${panY}px`);
        renderMarkers();
      };
      const setZoom = value => {
        zoom = Math.max(minZoom, Math.min(maxZoom, value));
        mapContent.style.setProperty("--saved-map-zoom", String(zoom));
        zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
        zoomOut.disabled = !mapImage || zoom <= minZoom;
        zoomIn.disabled = !mapImage || zoom >= maxZoom;
        clampPan();
      };
      zoomIn.addEventListener("click", event => {
        event.stopPropagation();
        setZoom(zoom + zoomStep);
      });
      zoomOut.addEventListener("click", event => {
        event.stopPropagation();
        setZoom(zoom - zoomStep);
      });
      viewer.addEventListener("wheel", event => {
        if (!mapImage || event.target.closest(".map-zoom-controls")) return;
        event.preventDefault();
        setZoom(zoom + (event.deltaY > 0 ? -zoomStep : zoomStep));
      }, { passive: false });
      viewer.addEventListener("dragstart", event => event.preventDefault());
      viewer.addEventListener("pointerdown", event => {
        if (!mapImage || event.button !== 0 || event.target.closest("button, label")) return;
        event.preventDefault();
        hasDragged = false;
        drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX, panY };
        viewer.setPointerCapture(event.pointerId);
      });
      viewer.addEventListener("pointermove", event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (!hasDragged && Math.hypot(deltaX, deltaY) < 4) return;
        hasDragged = true;
        panX = drag.panX + deltaX;
        panY = drag.panY + deltaY;
        clampPan();
        mapContent.classList.add("is-dragging");
      });
      const finishDrag = event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (hasDragged) {
          suppressMapClick = true;
          setTimeout(() => { suppressMapClick = false; }, 0);
        }
        drag = null;
        mapContent.classList.remove("is-dragging");
      };
      viewer.addEventListener("pointerup", finishDrag);
      viewer.addEventListener("pointercancel", finishDrag);
      target.append(card);
      setZoom(1);
      renderMarkers();
    }

    // Show a dedicated page for one place, character, faction, item, or event.
    function openEntryDetails(category, entryIndex) {
      const entry = state[category][entryIndex];
      if (!entry) return;
      document.getElementById("overview-view").hidden = true;
      document.getElementById("collection-view").hidden = true;
      document.getElementById("entry-detail-view").hidden = false;
      document.getElementById("detail-back-label").textContent = meta[category][0];
      document.getElementById("detail-icon").textContent = entry[1];
      document.getElementById("detail-category").textContent = category === "timeline" ? "TIMELINE EVENT" : meta[category][4].toUpperCase();
      document.getElementById("detail-title").textContent = entry[0];
      document.getElementById("detail-meta").textContent = entry[3];
      document.getElementById("long-description").value = entry[4] || entry[2];
      renderEntryImages(entry);
      document.getElementById("edit-detail-entry").onclick = () => openEditEntry(category, entryIndex);
      document.getElementById("save-long-description").onclick = () => {
        const previousDescription = entry[4];
        entry[4] = document.getElementById("long-description").value.trim();
        if (!persist()) {
          entry[4] = previousDescription;
          document.getElementById("long-description").value = previousDescription || entry[2];
          return;
        }
        showToast("Description saved.");
      };
      document.getElementById("image-upload").onchange = event => addEntryImages(entry, event.target.files);
    }

    function openMapPlaceModal(mapEntry, x, y) {
      const root = document.getElementById("modal-root");
      root.innerHTML = `<div class="modal-backdrop"><form class="modal" id="map-place-form"><div class="modal-head"><h2>Place on ${escapeHtml(mapEntry[0])}</h2><button class="close" type="button" aria-label="Close">×</button></div><p class="placement-help">Choose a place to mark at this location.</p><label class="field">Place<select name="place" required></select></label><div class="modal-actions"><button class="secondary" type="button" id="cancel-map-place">Cancel</button><button class="primary" type="submit">Set marker</button></div></form></div>`;
      const form = root.querySelector("#map-place-form");
      const select = form.elements.place;
      state.places.forEach(place => {
        const option = document.createElement("option");
        option.value = place[9];
        option.textContent = place[0];
        if ((mapEntry[10] || []).some(marker => marker.placeId === place[9])) {
          option.textContent += " (already marked)";
        }
        select.append(option);
      });
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-map-place").addEventListener("click", closeModal);
      root.querySelector(".modal-backdrop").addEventListener("click", event => {
        if (event.target.classList.contains("modal-backdrop")) closeModal();
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        const place = state.places.find(item => item[9] === select.value);
        if (!place || !state.maps.includes(mapEntry)) return;
        const previousPlacements = mapEntry[10] || [];
        mapEntry[10] = [
          ...previousPlacements.filter(marker => marker.placeId !== place[9]),
          { placeId: place[9], x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
        ];
        if (!persist()) {
          mapEntry[10] = previousPlacements;
          return;
        }
        closeModal();
        if (activeView === "maps") renderCollection();
        showToast(`${place[0]} placed on ${mapEntry[0]}.`);
      });
      select.focus();
    }

    // Render saved images with per-image removal controls.
    function renderEntryImages(entry) {
      const gallery = document.getElementById("image-gallery");
      gallery.innerHTML = "";
      const images = entry[5] || [];
      if (!images.length) {
        const empty = document.createElement("p");
        empty.className = "gallery-empty";
        empty.textContent = "No images yet. Add images to build a visual reference for this entry.";
        gallery.append(empty);
        return;
      }
      images.forEach((src, index) => {
        const figure = document.createElement("figure");
        figure.className = "image-card";
        const image = document.createElement("img");
        image.src = src;
        image.alt = `Reference image ${index + 1} for ${entry[0]}`;
        const removeButton = document.createElement("button");
        removeButton.className = "remove-image";
        removeButton.type = "button";
        removeButton.textContent = "Remove image";
        removeButton.addEventListener("click", () => {
          const previousImages = entry[5];
          entry[5] = previousImages.filter((_, imageIndex) => imageIndex !== index);
          if (!persist()) {
            entry[5] = previousImages;
            return;
          }
          renderEntryImages(entry);
          showToast("Image removed.");
        });
        figure.append(image, removeButton);
        gallery.append(figure);
      });
    }

    // Compress selected image files before saving them with the entry locally.
    function optimizeImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
        reader.onload = () => {
          const image = new Image();
          image.onerror = () => reject(new Error(`${file.name} isn't a supported image.`));
          image.onload = () => {
            const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) {
              reject(new Error("This browser couldn't prepare the image."));
              return;
            }
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    async function addEntryImages(entry, files) {
      const selectedFiles = Array.from(files || []);
      const imageInput = document.getElementById("image-upload");
      imageInput.value = "";
      if (!selectedFiles.length) return;
      const currentImages = entry[5] || [];
      const remainingSlots = 8 - currentImages.length;
      if (remainingSlots <= 0) {
        showToast("This entry already has the maximum of 8 images.");
        return;
      }
      const filesToAdd = selectedFiles.slice(0, remainingSlots);
      if (filesToAdd.length < selectedFiles.length) {
        showToast("Only 8 images can be saved per entry; extra files were skipped.");
      }
      try {
        const images = [];
        for (const file of filesToAdd) {
          if (!file.type.startsWith("image/")) {
            throw new Error(`${file.name} is not an image.`);
          }
          if (file.size > 15 * 1024 * 1024) {
            throw new Error(`${file.name} is larger than the 15 MB upload limit.`);
          }
          images.push(await optimizeImage(file));
        }
        entry[5] = [...currentImages, ...images];
        if (!persist()) {
          entry[5] = currentImages;
          return;
        }
        renderEntryImages(entry);
        showToast(`${images.length} image${images.length === 1 ? "" : "s"} added.`);
      } catch (error) {
        console.error("Unable to add entry images.", error);
        showToast(error.message || "Couldn't add the selected images.");
      }
    }
    async function uploadMapImage(file) {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast(`${file.name} is not an image.`);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast(`${file.name} is larger than the 15 MB upload limit.`);
        return;
      }
      const targetState = state;
      const previousMapImage = targetState.mapImage;
      try {
        targetState.mapImage = await optimizeImage(file);
        if (!persist()) {
          targetState.mapImage = previousMapImage;
          return;
        }
        if (state === targetState) renderMap();
        showToast("Map image uploaded.");
      } catch (error) {
        targetState.mapImage = previousMapImage;
        console.error("Unable to upload map image.", error);
        showToast(error.message || "Couldn't upload the map image.");
      }
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
        const [removedEntry] = state[category].splice(entryIndex, 1);
        const affectedMaps = category === "places"
          ? state.maps.map(map => ({ map, placements: map[10] || [] }))
          : [];
        affectedMaps.forEach(({ map }) => {
          map[10] = (map[10] || []).filter(marker => marker.placeId !== removedEntry[9]);
        });
        if (!persist()) {
          state[category].splice(entryIndex, 0, removedEntry);
          affectedMaps.forEach(({ map, placements }) => { map[10] = placements; });
          return;
        }
        updateCounts();
        closeModal();
        if (category === "places") renderMap();
        renderCollection();
        showToast(`${type[0].toUpperCase()}${type.slice(1)} removed.`);
      });
      root.querySelector("#cancel-delete").focus();
    }

    // Edit an entry's name, description, and category-specific detail.
    function openEditEntry(category, entryIndex) {
      const entry = state[category][entryIndex];
      if (!entry) return;
      const type = meta[category][4];
      const root = document.getElementById("modal-root");
      root.innerHTML = `<div class="modal-backdrop"><form class="modal" id="edit-entry-form"><div class="modal-head"><h2>Edit ${type.toLowerCase()}</h2><button class="close" type="button" aria-label="Close">×</button></div>
        <label class="field">Name<input name="name" maxlength="60" required></label>
        <label class="field">Description<textarea name="description" maxlength="240" required></textarea></label>
        <label class="field">${category === "timeline" ? "Date · Era" : "Type · Region"}<input name="detail" maxlength="60"></label>
        <label class="field">Icon<input name="icon" maxlength="8" placeholder="Emoji or symbol" aria-describedby="icon-help"><small id="icon-help">Use an emoji or symbol to personalize this entry.</small></label>
        <label class="field">Group<input name="group" maxlength="40" placeholder="e.g. Royal family"></label>
        <div class="modal-actions"><button class="secondary" type="button" id="cancel-edit">Cancel</button><button class="primary" type="submit">Save changes</button></div></form></div>`;
      const form = root.querySelector("#edit-entry-form");
      form.elements.name.value = entry[0];
      form.elements.description.value = entry[2];
      form.elements.detail.value = entry[3];
      form.elements.icon.value = entry[1];
      form.elements.group.value = entry[6] || "";
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-edit").addEventListener("click", closeModal);
      root.querySelector(".modal-backdrop").addEventListener("click", event => {
        if (event.target.classList.contains("modal-backdrop")) closeModal();
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        const previousValues = [entry[0], entry[1], entry[2], entry[3], entry[6]];
        entry[0] = form.elements.name.value.trim();
        entry[2] = form.elements.description.value.trim();
        entry[3] = form.elements.detail.value.trim() || type;
        entry[1] = form.elements.icon.value.trim() || icons[category];
        entry[6] = form.elements.group.value.trim();
        if (!persist()) {
          [entry[0], entry[1], entry[2], entry[3], entry[6]] = previousValues;
          return;
        }
        closeModal();
        if (category === "places") renderMap();
        if (!document.getElementById("entry-detail-view").hidden) {
          openEntryDetails(category, entryIndex);
        } else {
          renderCollection();
        }
        showToast(`${type} updated.`);
      });
      form.elements.name.focus();
      form.elements.name.select();
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
        <label class="field">Icon<input name="icon" maxlength="8" placeholder="Emoji or symbol" aria-describedby="icon-help"><small id="icon-help">Use an emoji or symbol to personalize this entry.</small></label>
        <label class="field">Group<input name="group" maxlength="40" placeholder="e.g. Royal family"></label>
        <div class="modal-actions"><button class="secondary" type="button" id="cancel-entry">Cancel</button><button class="primary" type="submit">Create ${type.toLowerCase()}</button></div></form></div>`;
      root.querySelector('input[name="icon"]').value = icons[category];
      root.querySelector(".close").addEventListener("click", closeModal);
      root.querySelector("#cancel-entry").addEventListener("click", closeModal);
      root.querySelector(".modal-backdrop").addEventListener("click", event => { if (event.target.classList.contains("modal-backdrop")) closeModal(); });
      root.querySelector("#entry-form").addEventListener("submit", event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const summary = form.get("description").trim();
        state[category].unshift([
          form.get("name").trim(),
          form.get("icon").trim() || icons[category],
          summary,
          form.get("detail").trim() || meta[category][4],
          summary,
          [],
          form.get("group").trim(),
          null,
          null,
          createWorldId(),
          []
        ]);
        if (!persist()) {
          state[category].shift();
          return;
        }
        updateCounts();
        closeModal();
        if (category === "places") renderMap();
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
    document.getElementById("map-image-upload").addEventListener("change", async event => {
      const input = event.currentTarget;
      const file = input.files[0];
      input.value = "";
      await uploadMapImage(file);
    });
    document.getElementById("remove-map-image").addEventListener("click", () => {
      const previousMapImage = state.mapImage;
      state.mapImage = "";
      if (!persist()) {
        state.mapImage = previousMapImage;
        return;
      }
      renderMap();
      showToast("Map image removed.");
    });
    document.getElementById("place-on-map").addEventListener("click", () => {
      isPlacingMapMarker = !isPlacingMapMarker;
      renderMap();
      if (isPlacingMapMarker) {
        document.getElementById("world-map").focus();
        showToast("Click the map where you want to place a marker.");
      }
    });
    function placeMapLocationAt(clientX, clientY) {
      const bounds = document.getElementById("map-content").getBoundingClientRect();
      const x = Math.max(5, Math.min(95, ((clientX - bounds.left) / bounds.width) * 100));
      const y = Math.max(8, Math.min(92, ((clientY - bounds.top) / bounds.height) * 100));
      openPlacePlacementModal(x, y);
    }
    function chooseMapLocation(event) {
      if (isPlacingMapMarker) placeMapLocationAt(event.clientX, event.clientY);
    }
    const worldMap = document.getElementById("world-map");
    let mapDrag;
    let suppressMapClick = false;
    worldMap.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest(".map-marker, .map-zoom-controls")) return;
      const currentPanX = Number.parseFloat(mapContent.style.getPropertyValue("--map-pan-x")) || 0;
      const currentPanY = Number.parseFloat(mapContent.style.getPropertyValue("--map-pan-y")) || 0;
      mapDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: currentPanX, panY: currentPanY, moved: false };
      worldMap.setPointerCapture(event.pointerId);
    });
    worldMap.addEventListener("pointermove", event => {
      if (!mapDrag || mapDrag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - mapDrag.startX;
      const deltaY = event.clientY - mapDrag.startY;
      if (!mapDrag.moved && Math.hypot(deltaX, deltaY) < 4) return;
      mapDrag.moved = true;
      mapContent.classList.add("is-dragging");
      const { maxPanX, maxPanY } = getMapPanLimits();
      const panX = Math.max(-maxPanX, Math.min(maxPanX, mapDrag.panX + deltaX));
      const panY = Math.max(-maxPanY, Math.min(maxPanY, mapDrag.panY + deltaY));
      mapContent.style.setProperty("--map-pan-x", `${panX}px`);
      mapContent.style.setProperty("--map-pan-y", `${panY}px`);
    });
    window.addEventListener("resize", clampMapPan);
    function finishMapDrag(event) {
      if (!mapDrag || mapDrag.pointerId !== event.pointerId) return;
      if (mapDrag.moved) {
        suppressMapClick = true;
        setTimeout(() => { suppressMapClick = false; }, 0);
      }
      mapContent.classList.remove("is-dragging");
      mapDrag = null;
    }
    worldMap.addEventListener("pointerup", finishMapDrag);
    worldMap.addEventListener("pointercancel", finishMapDrag);
    worldMap.addEventListener("click", event => {
      if (!suppressMapClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    worldMap.addEventListener("click", chooseMapLocation);
    worldMap.addEventListener("keydown", event => {
      if (event.target !== event.currentTarget || !isPlacingMapMarker || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      const bounds = worldMap.getBoundingClientRect();
      placeMapLocationAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    });
    const mapWrap = document.getElementById("map-wrap");
    const mapExpandButton = document.getElementById("map-expand");
    const mapContent = document.getElementById("map-content");
    const mapZoomLevel = document.getElementById("map-zoom-level");
    const minMapZoom = 0.25;
    const initialMapZoom = 1;
    const maxMapZoom = 3;
    const mapZoomStep = 0.25;
    function getMapZoom() {
      return Number.parseFloat(mapContent.style.getPropertyValue("--map-zoom")) || minMapZoom;
    }
    function getMapPanLimits() {
      const bounds = worldMap.getBoundingClientRect();
      return {
        maxPanX: Math.max(0, bounds.width * (1.6 * getMapZoom() - 1) / 2),
        maxPanY: Math.max(0, bounds.height * (1.6 * getMapZoom() - 1) / 2)
      };
    }
    function clampMapPan() {
      const { maxPanX, maxPanY } = getMapPanLimits();
      const panX = Number.parseFloat(mapContent.style.getPropertyValue("--map-pan-x")) || 0;
      const panY = Number.parseFloat(mapContent.style.getPropertyValue("--map-pan-y")) || 0;
      mapContent.style.setProperty("--map-pan-x", `${Math.max(-maxPanX, Math.min(maxPanX, panX))}px`);
      mapContent.style.setProperty("--map-pan-y", `${Math.max(-maxPanY, Math.min(maxPanY, panY))}px`);
    }
    function setMapExpanded(isExpanded) {
      mapWrap.classList.toggle("is-expanded", isExpanded);
      document.body.classList.toggle("map-expanded", isExpanded);
      mapExpandButton.setAttribute("aria-pressed", String(isExpanded));
      mapExpandButton.textContent = isExpanded ? "× Close map" : "⛶ Enlarge map";
      clampMapPan();
      if (!isExpanded) mapExpandButton.focus();
    }
    function setMapZoom(zoom) {
      const nextZoom = Math.max(minMapZoom, Math.min(maxMapZoom, zoom));
      mapContent.style.setProperty("--map-zoom", String(nextZoom));
      mapZoomLevel.value = `${Math.round(nextZoom * 100)}%`;
      mapZoomLevel.textContent = mapZoomLevel.value;
      document.getElementById("map-zoom-out").disabled = nextZoom <= minMapZoom;
      document.getElementById("map-zoom-in").disabled = nextZoom >= maxMapZoom;
      clampMapPan();
    }
    document.getElementById("map-zoom-in").addEventListener("click", event => {
      event.stopPropagation();
      setMapZoom(getMapZoom() + mapZoomStep);
    });
    document.getElementById("map-zoom-out").addEventListener("click", event => {
      event.stopPropagation();
      setMapZoom(getMapZoom() - mapZoomStep);
    });
    worldMap.addEventListener("wheel", event => {
      if (event.target.closest(".map-marker, .map-zoom-controls")) return;
      event.preventDefault();
      const zoomDirection = event.deltaY > 0 ? -1 : 1;
      setMapZoom(getMapZoom() + zoomDirection * mapZoomStep);
    }, { passive: false });
    setMapZoom(initialMapZoom);
    mapExpandButton.addEventListener("click", () => {
      setMapExpanded(!mapWrap.classList.contains("is-expanded"));
    });
    document.querySelectorAll("[data-create-category]").forEach(button => {
      button.addEventListener("click", () => openModal(button.dataset.createCategory));
    });
    document.getElementById("world-switch").addEventListener("click", () => {
      const menu = document.getElementById("world-menu");
      const isOpening = menu.hidden;
      menu.hidden = !isOpening;
      document.getElementById("world-switch").setAttribute("aria-expanded", String(isOpening));
    });
    document.getElementById("create-world").addEventListener("click", () => {
      closeWorldMenu();
      openCreateWorldModal();
    });
    document.getElementById("search-input").addEventListener("input", renderCollection);
    document.getElementById("group-filter").addEventListener("change", renderCollection);
    document.getElementById("back-to-collection").addEventListener("click", () => openView(activeView));
    document.getElementById("focus-search").addEventListener("click", () => {
      if (activeView === "overview") openView("places");
      document.getElementById("search-input").focus();
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".world-picker")) closeWorldMenu();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeModal();
        closeWorldMenu();
        if (mapWrap.classList.contains("is-expanded")) setMapExpanded(false);
        closeExpandedSavedMaps();
      }
    });
    // Set the initial counts from the loaded local world.
    renderWorlds();
    updateCounts();
    renderMap();

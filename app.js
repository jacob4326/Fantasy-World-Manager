const defaults = {
      places: [
        ["Frostholm","🏔","A quiet mountain settlement at the edge of the known world.","Northern Marches · Settlement"],
        ["Eldergrove","🌳","An ancient forest where the trees remember every name.","Greenveil · Wild region"],
        ["The Sunken Vale","🌫","A mist-shrouded valley swallowed by the earth long ago.","Western Reach · Region"],
        ["Ashen Coast","🌊","Black-sand shores scarred by the fires of a fallen star.","Southern Coast · Coast"],
        ["Thornwatch Keep","🏰","A fortress guarding the only safe pass through the mountains.","Northern Marches · Landmark"],
        ["Meridian","🏛","The shining capital, built where three rivers meet.","Heartlands · City"],
        ["Whispering Isles","⛵","A scattered archipelago said to drift with the tides.","Far Sea · Islands"],
        ["The Glass Desert","☀","A vast expanse of fused sand, bright as a mirror.","Eastern Expanse · Region"]
      ],
      characters: [
        ["Elara Moonwhisper","🧝","An exiled ranger who can hear the voices of old trees.","Ranger · Eldergrove"],
        ["King Aldric Vane","👑","A ruler haunted by the prophecy that crowned him.","Monarch · Meridian"],
        ["Tomas Reed","🗡","A quick-witted courier with a map no one can read.","Scout · Frostholm"],
        ["Sister Maelin","🕯","Keeper of the last unbroken record of the Star Kings.","Archivist · Meridian"],
        ["Bram Coppervein","⚒","A mountain smith whose blades carry a faint blue flame.","Smith · Frostholm"],
        ["Neris Tidecaller","🐚","A navigator who charts the shifting currents around the Isles.","Navigator · Whispering Isles"],
        ["Veyra Ashborn","🔥","A scholar studying the strange glass left by the fallen star.","Scholar · Ashen Coast"],
        ["Old Rowan","🌿","The oldest living guide in Eldergrove, though no one knows their age.","Guide · Eldergrove"],
        ["Captain Sella Marr","⚓","A smuggler captain with friends in every harbor.","Sailor · Ashen Coast"],
        ["Ilyan Farstrider","🏹","A scout who returned from beyond the Glass Desert alone.","Scout · Eastern Expanse"],
        ["The Pale Regent","🎭","A masked envoy whose true allegiance remains a mystery.","Envoy · Unknown"],
        ["Pip Underbough","🍄","A cheerful mapmaker with an unusual talent for finding lost roads.","Cartographer · Meridian"]
      ],
      factions: [
        ["Order of the Veil","🌙","A secretive order sworn to keep the old magic asleep.","Secret society · Neutral"],
        ["The Verdant Court","🍃","Guardians of the living wilds and the ancient pacts.","Druidic circle · Allied"],
        ["Ironbound League","⚒","Merchant princes who control the mountain passes.","Trade league · Opposed"],
        ["Dawnwardens","☀","Oath-bound protectors of the scattered settlements.","Knightly order · Allied"]
      ],
      timeline: [
        ["The First Dawn","🌅","The elder races raise the first cities beneath a waking sun.","Year 0 · Mythic Age"],
        ["Oath of the Verdant Court","🍃","The forest clans bind their fate to the ancient woods.","Year 410 · Green Age"],
        ["Fall of the Star Kings","☄","A burning star ends the reign of the sky-born dynasty.","Year 2187 · Third Age"],
        ["The Shattering","🌋","The western lands fracture; the old roads vanish beneath the sea.","Year 2201 · Third Age"],
        ["The Long Winter","❄","Three harvests fail and the Northern Marches fall silent.","Year 2314 · Third Age"],
        ["Treaty of Three Rivers","🕊","The fractured city-states unite to keep the peace in the Heartlands.","Year 2398 · Third Age"]
      ]
    };
    const meta = {
      places: ["Places","Landmarks, regions, and hidden corners of your world.","All places","⌖","Place"],
      characters: ["Characters","Heroes, rivals, and everyone caught in between.","All characters","♙","Character"],
      factions: ["Factions","Orders, kingdoms, and powers shaping the realms.","All factions","⚑","Faction"],
      timeline: ["Timeline","The moments that changed the course of history.","All events","◷","Event"]
    };
    let state;
    try {
      const saved = localStorage.getItem("mythos-world-data");
      state = saved ? { ...defaults, ...JSON.parse(saved) } : structuredClone(defaults);
    } catch (error) {
      console.error("Unable to load saved world data.", error);
      state = structuredClone(defaults);
      showToast("Saved data couldn't be loaded; using the starter world.");
    }
    let activeView = "overview";

    function persist() {
      try {
        localStorage.setItem("mythos-world-data", JSON.stringify(state));
      } catch (error) {
        console.error("Unable to save world data.", error);
        showToast("Couldn't save changes in this browser.");
      }
    }
    function showToast(message) {
      const root = document.getElementById("toast-root");
      root.innerHTML = "";
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      root.append(toast);
      setTimeout(() => toast.remove(), 3000);
    }
    function updateCounts() {
      Object.keys(meta).forEach(key => {
        document.querySelector(`[data-count="${key}"]`).textContent = state[key].length;
        const stat = document.querySelector(`[data-stat="${key}"]`);
        if (stat) stat.textContent = state[key].length;
      });
    }
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
    function renderCollection() {
      const entries = state[activeView] || [];
      const query = document.getElementById("search-input").value.trim().toLowerCase();
      const filtered = entries.filter(entry => entry.slice(0,4).join(" ").toLowerCase().includes(query));
      const target = document.getElementById("collection");
      target.innerHTML = "";
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "panel empty";
        empty.textContent = query ? "No entries match your search." : "No entries yet. Add the first one to this world.";
        target.append(empty);
        return;
      }
      filtered.forEach(entry => {
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
        target.append(card);
      });
    }
    function openModal() {
      const category = activeView === "overview" ? "places" : activeView;
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
        const icons = { places: "✦", characters: "♙", factions: "⚑", timeline: "◷" };
        state[category].unshift([form.get("name").trim(), icons[category], form.get("description").trim(), form.get("detail").trim() || meta[category][4]]);
        persist();
        updateCounts();
        closeModal();
        if (activeView !== "overview") renderCollection();
        showToast(`${type} added to your world.`);
      });
      root.querySelector('input[name="name"]').focus();
    }
    function closeModal() { document.getElementById("modal-root").innerHTML = ""; }
    document.querySelectorAll(".nav button").forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
    document.querySelectorAll("[data-open-view]").forEach(button => button.addEventListener("click", () => openView(button.dataset.openView)));
    document.getElementById("quick-add").addEventListener("click", openModal);
    document.getElementById("add-entry").addEventListener("click", openModal);
    document.getElementById("search-input").addEventListener("input", renderCollection);
    document.getElementById("focus-search").addEventListener("click", () => {
      if (activeView === "overview") openView("places");
      document.getElementById("search-input").focus();
    });
    document.getElementById("clear-activity").addEventListener("click", () => {
      document.getElementById("activity-list").innerHTML = '<div class="empty">You’re all caught up. New activity will appear here.</div>';
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
    updateCounts();

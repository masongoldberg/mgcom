import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { BREEDS, ASSET_VERSION } from "/apps/canidex/data/breeds.js";

const STORAGE_KEY = "canidex-progress-v1";
const VIEW_HASHES = new Set(["home", "roster"]);

const status = document.getElementById("status");
const logoutButton = document.getElementById("logoutButton");
const searchInput = document.getElementById("searchInput");
const appNav = document.getElementById("appNav");
const hero = document.getElementById("hero");
const rosterGrid = document.getElementById("rosterGrid");
const homePanel = document.getElementById("homePanel");
const activityPanel = document.getElementById("activityPanel");
const counts = document.getElementById("counts");
const resetButton = document.getElementById("resetButton");
const resetButtonRoster = document.getElementById("resetButtonRoster");
const seenOnlyButton = document.getElementById("seenOnlyButton");
const dogUploadInput = document.getElementById("dogUploadInput");
const dogCameraInput = document.getElementById("dogCameraInput");
const cameraDogButton = document.getElementById("cameraDogButton");
const uploadDogButton = document.getElementById("uploadDogButton");
const classifierResult = document.getElementById("classifierResult");
const breedModal = document.getElementById("breedModal");
const breedModalContent = document.getElementById("breedModalContent");
const closeBreedModalButton = document.getElementById("closeBreedModalButton");
const sightingModal = document.getElementById("sightingModal");
const sightingModalContent = document.getElementById("sightingModalContent");
const closeSightingModalButton = document.getElementById("closeSightingModalButton");
const rewardLayer = document.getElementById("rewardLayer");
const rewardContent = document.getElementById("rewardContent");
const dismissRewardButton = document.getElementById("dismissRewardButton");

const authConfig = window.AUTH_CONFIG || {};
const hasConfig = Boolean(authConfig.supabaseUrl && authConfig.supabaseAnonKey);

let progress = loadProgress();
let selectedSlug = "golden-retriever";
let searchQuery = "";
let seenOnly = false;
let currentView = "home";
let isClassifying = false;
let isBreedModalOpen = false;
let rewardState = null;
let sightingDraft = null;
let lastClassifierCapture = null;

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const rawSightings = parsed.sightings || {};
    const normalized = Object.fromEntries(
      Object.entries(rawSightings).map(([slug, value]) => {
        if (Array.isArray(value)) {
          return [slug, value];
        }
        const count = Number(value || 0);
        return [
          slug,
          Array.from({ length: count }, (_item, index) => ({
            id: `migrated-${slug}-${index}`,
            dogName: "",
            notes: "",
            photoDataUrl: "",
            createdAt: new Date(2026, 0, 1).toISOString(),
            migrated: true
          }))
        ];
      })
    );
    return { sightings: normalized };
  } catch (_error) {
    return { sightings: {} };
  }
}

function saveProgress() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function getSightingRecords(slug) {
  return Array.isArray(progress.sightings[slug]) ? progress.sightings[slug] : [];
}

function getSightings(slug) {
  return getSightingRecords(slug).length;
}

function isUnlocked(slug) {
  return getSightings(slug) > 0;
}

function formatBreedId(id) {
  return `K9-${id}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function getRarityClass(rarity) {
  return {
    common: "rarity-common",
    uncommon: "rarity-uncommon",
    rare: "rarity-rare",
    legendary: "rarity-legendary"
  }[String(rarity || "").toLowerCase()] || "rarity-common";
}

function getHashView() {
  const hash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  return VIEW_HASHES.has(hash) ? hash : "home";
}

function syncHashFromView() {
  const nextHash = `#${currentView}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function getFilteredBreeds() {
  const query = searchQuery.trim().toLowerCase();
  return BREEDS.filter((breed) => {
    if (seenOnly && !isUnlocked(breed.slug)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [
      breed.name,
      breed.type,
      breed.habitat,
      breed.temperament,
      breed.coat,
      breed.rarity
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function ensureValidSelection() {
  const filtered = getFilteredBreeds();
  if (!filtered.length) {
    selectedSlug = "";
    return;
  }
  if (!filtered.some((breed) => breed.slug === selectedSlug)) {
    selectedSlug = filtered[0].slug;
  }
}

function selectRelativeBreed(step) {
  const filtered = getFilteredBreeds();
  if (!filtered.length) {
    return;
  }
  const currentIndex = filtered.findIndex((breed) => breed.slug === selectedSlug);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeIndex + step + filtered.length) % filtered.length;
  selectedSlug = filtered[nextIndex].slug;
}

function getSelectedBreed() {
  return BREEDS.find((breed) => breed.slug === selectedSlug) || null;
}

function createBreedSvg(breed, size = 16) {
  const palette = {
    "1": breed.colors.body,
    "2": breed.colors.head,
    "3": breed.colors.accent,
    "4": breed.colors.wing,
    "6": breed.colors.leg
  };
  const rects = [];
  breed.sprite.forEach((row, y) => {
    row.split("").forEach((cell, x) => {
      if (cell === "0") {
        return;
      }
      rects.push(`<rect x="${x * size}" y="${y * size}" width="${size}" height="${size}" fill="${palette[cell] || breed.colors.body}" />`);
    });
  });
  return `<svg viewBox="0 0 256 256" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects.join("")}</svg>`;
}

function createLockedOutlineSvg(breed, size = 16) {
  const rows = breed.sprite.map((row) => row.split("").map((cell) => cell !== "0"));
  const fillRects = [];
  const outlineRects = [];
  rows.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) {
        return;
      }
      const neighbors = [rows[y - 1]?.[x], rows[y + 1]?.[x], rows[y]?.[x - 1], rows[y]?.[x + 1]];
      const edge = neighbors.some((neighbor) => !neighbor);
      const target = edge ? outlineRects : fillRects;
      target.push(`<rect x="${x * size}" y="${y * size}" width="${size}" height="${size}" fill="${edge ? "#425b74" : "#f7f1e8"}" />`);
    });
  });
  return `<svg class="locked-outline" viewBox="0 0 256 256" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${fillRects.join("")}${outlineRects.join("")}</svg>`;
}

function renderBreedMarkup(breed, size = 16, locked = false) {
  const assetSrc = breed.assetPath ? `${breed.assetPath}?v=${ASSET_VERSION}` : "";
  if (locked) {
    if (breed.assetPath) {
      return `<img class="locked-outline" src="${assetSrc}" alt="" style="filter: brightness(0) saturate(100%) invert(96%) sepia(14%) saturate(252%) hue-rotate(319deg) brightness(104%) contrast(95%) drop-shadow(1px 0 0 #425b74) drop-shadow(-1px 0 0 #425b74) drop-shadow(0 1px 0 #425b74) drop-shadow(0 -1px 0 #425b74);">`;
    }
    return createLockedOutlineSvg(breed, size);
  }
  if (breed.assetPath) {
    return `<img class="locked-outline" src="${assetSrc}" alt="${breed.name}">`;
  }
  return createBreedSvg(breed, size);
}

function renderCounts() {
  const unlocked = BREEDS.filter((breed) => isUnlocked(breed.slug)).length;
  const totalSightings = Object.keys(progress.sightings).reduce((sum, slug) => sum + getSightings(slug), 0);
  const remaining = BREEDS.length - unlocked;
  counts.innerHTML = `
    <div class="count"><div class="panel-label">Unlocked</div><div class="count-number">${unlocked}</div><div class="count-copy">${remaining} left to discover</div></div>
    <div class="count"><div class="panel-label">Sightings</div><div class="count-number">${totalSightings}</div><div class="count-copy">saved on this device</div></div>
    <div class="count"><div class="panel-label">Focus</div><div class="count-number">${selectedSlug ? formatBreedId(getSelectedBreed().id) : "---"}</div><div class="count-copy">current breed target</div></div>
  `;
}

function renderRosterGrid() {
  const filtered = getFilteredBreeds();
  if (!filtered.length) {
    rosterGrid.innerHTML = `<div class="empty">No breeds match that search. Try a broader breed group or trait.</div>`;
    return;
  }

  rosterGrid.innerHTML = filtered.map((breed) => {
    const unlocked = isUnlocked(breed.slug);
    return `
      <button class="roster-card ${breed.slug === selectedSlug ? "is-active" : ""} ${unlocked ? "" : "is-locked"}" data-slug="${breed.slug}" type="button">
        <div class="roster-card-top">
          <div class="breed-id">${formatBreedId(breed.id)}</div>
          <div class="roster-tag">${unlocked ? `${getSightings(breed.slug)} seen` : "locked"}</div>
        </div>
        <div class="roster-sprite">${renderBreedMarkup(breed, 5, !unlocked)}</div>
        <div class="roster-name">${unlocked ? breed.name : "Unknown Breed"}</div>
        <div class="meta-stack">
          <div class="roster-meta">${unlocked ? breed.type : "Unseen"}</div>
          ${unlocked ? `<span class="rarity-pill ${getRarityClass(breed.rarity)}">${breed.rarity}</span>` : ""}
        </div>
      </button>
    `;
  }).join("");
}

function formatSightingDate(raw) {
  if (!raw) {
    return "Saved now";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "Saved now";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderSightingList(slug) {
  const records = [...getSightingRecords(slug)].reverse();
  if (!records.length) {
    return `<div class="empty">No saved sighting details yet. Add a sighting to store a photo, dog name, and notes.</div>`;
  }
  return `<div class="sighting-list">${records.map((record) => `
    <article class="sighting-card">
      <div class="sighting-thumb">${record.photoDataUrl ? `<img src="${record.photoDataUrl}" alt="">` : ""}</div>
      <div>
        <div class="sighting-head">
          <div class="sighting-name">${escapeHtml(record.dogName || "Unnamed Dog")}</div>
          <div class="sighting-date">${formatSightingDate(record.createdAt)}</div>
        </div>
        <div class="sighting-note">${escapeHtml(record.notes || "No notes saved for this sighting.")}</div>
      </div>
    </article>
  `).join("")}</div>`;
}

function getRecentSightings(limit = 4) {
  return Object.entries(progress.sightings)
    .flatMap(([slug, records]) => (Array.isArray(records) ? records.map((record) => ({ ...record, slug })) : []))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

function getDetailMarkup() {
  const breed = getSelectedBreed();
  const unlocked = isUnlocked(breed.slug);
  const sightings = getSightings(breed.slug);
  return `
    <div class="detail-top">
      <div class="panel-label">Breed Entry ${formatBreedId(breed.id)}</div>
      <div class="detail-sprite-frame ${unlocked ? "" : "locked"}">${renderBreedMarkup(breed, 10, !unlocked)}</div>
    </div>
    <div class="detail-name">${unlocked ? breed.name : "Unknown Breed"}</div>
    <div class="detail-subtitle">${unlocked ? breed.type : "Locked until first sighting"}</div>
    <div class="entry-meta-row">
      ${unlocked ? `<span class="rarity-pill ${getRarityClass(breed.rarity)}">${breed.rarity}</span>` : ""}
      <div class="entry-tag">${unlocked ? `${sightings} sighting${sightings === 1 ? "" : "s"}` : "Entry Hidden"}</div>
    </div>
    <div class="detail-grid">
      <div class="meta-row"><div class="meta-label">Habitat</div><div class="meta-value">${unlocked ? breed.habitat : "Classified"}</div></div>
      <div class="meta-row"><div class="meta-label">Temper</div><div class="meta-value">${unlocked ? breed.temperament : "Classified"}</div></div>
      <div class="meta-row"><div class="meta-label">Coat</div><div class="meta-value">${unlocked ? breed.coat : "Classified"}</div></div>
      <div class="meta-row"><div class="meta-label">Entry</div><div class="meta-value">${unlocked ? breed.entry : "Log a sighting to reveal this breed's profile."}</div></div>
    </div>
    ${unlocked ? `<div><div class="panel-label">Saved Sightings</div>${renderSightingList(breed.slug)}</div>` : ""}
    <div class="actions">
      <div class="entry-nav">
        <button class="pixel-btn alt" data-action="prev-breed" type="button">Previous</button>
        <button class="pixel-btn" data-action="next-breed" type="button">Next</button>
      </div>
      <button class="pixel-btn alt" data-action="upload-dog" type="button">Classify Dog Photo</button>
      <button class="pixel-btn" data-action="add-sighting" type="button">${unlocked ? "Add Another Sighting" : "Add Sighting"}</button>
      <button class="pixel-btn alt" data-action="next-locked" type="button">Jump To Next Locked</button>
      <div class="notes">${unlocked ? breed.notes : "Locked breeds appear as silhouette outlines until you log the first sighting."}</div>
    </div>
  `;
}

function getHomePanelMarkup() {
  const breed = getSelectedBreed();
  if (!breed) {
    return `<div class="empty">No breed selected yet. Open the roster to start browsing.</div>`;
  }
  const unlocked = isUnlocked(breed.slug);
  const sightings = getSightings(breed.slug);
  return `
    <div class="home-card">
      <div class="detail-sprite-frame ${unlocked ? "" : "locked"}">${renderBreedMarkup(breed, 10, !unlocked)}</div>
      <div class="actions">
        <div class="panel-label">Featured Breed ${formatBreedId(breed.id)}</div>
        <div class="detail-name">${unlocked ? breed.name : "Unknown Breed"}</div>
        <div class="detail-subtitle">${unlocked ? breed.type : "Unlock by identifying this breed for the first time."}</div>
        <div class="entry-meta-row">
          ${unlocked ? `<span class="rarity-pill ${getRarityClass(breed.rarity)}">${breed.rarity}</span>` : ""}
          <div class="entry-tag">${unlocked ? `${sightings} sighting${sightings === 1 ? "" : "s"}` : "Entry Hidden"}</div>
        </div>
        <div class="home-card-copy">${unlocked ? breed.entry : "Log a first sighting from the camera or roster to reveal the full breed profile."}</div>
        <div class="entry-nav">
          <button class="pixel-btn" data-action="open-roster" type="button">Open Roster</button>
          <button class="pixel-btn alt" data-action="open-next-locked" type="button">Next Locked Breed</button>
        </div>
      </div>
    </div>
  `;
}

function getActivityPanelMarkup() {
  const recent = getRecentSightings(4);
  if (!recent.length) {
    return `
      <div class="panel-label">Recent Sightings</div>
      <div class="activity-empty">Nothing saved yet. New dogs you log will appear here so you can jump back into the dex quickly.</div>
    `;
  }

  return `
    <div class="panel-label">Recent Sightings</div>
    <div class="activity-list">${recent.map((record) => {
      const breed = BREEDS.find((item) => item.slug === record.slug);
      return `
        <button class="activity-item" data-open-slug="${record.slug}" type="button">
          <div class="activity-thumb">${record.photoDataUrl ? `<img src="${record.photoDataUrl}" alt="">` : `<div class="activity-thumb-fill">${breed ? renderBreedMarkup(breed, 6, false) : ""}</div>`}</div>
          <div class="activity-copy">
            <div class="activity-title">${escapeHtml(record.dogName || breed?.name || "Saved sighting")}</div>
            <div class="activity-meta">${escapeHtml(breed?.name || "Breed")} · ${formatSightingDate(record.createdAt)}</div>
          </div>
        </button>
      `;
    }).join("")}</div>
  `;
}

function bindActionButtons(root = document) {
  root.querySelectorAll('[data-action="prev-breed"]').forEach((button) => {
    button.addEventListener("click", () => {
      selectRelativeBreed(-1);
      isBreedModalOpen = true;
      renderApp();
    });
  });
  root.querySelectorAll('[data-action="next-breed"]').forEach((button) => {
    button.addEventListener("click", () => {
      selectRelativeBreed(1);
      isBreedModalOpen = true;
      renderApp();
    });
  });
  root.querySelectorAll('[data-action="upload-dog"]').forEach((button) => {
    button.addEventListener("click", () => dogCameraInput.click());
  });
  root.querySelectorAll('[data-action="open-roster"]').forEach((button) => {
    button.addEventListener("click", () => {
      currentView = "roster";
      renderApp();
    });
  });
  root.querySelectorAll('[data-action="open-next-locked"]').forEach((button) => {
    button.addEventListener("click", () => {
      const nextLocked = BREEDS.find((item) => !isUnlocked(item.slug));
      if (!nextLocked) {
        currentView = "roster";
        renderApp();
        setStatus("Every listed breed is unlocked. Browse the full roster.", "success");
        return;
      }
      selectedSlug = nextLocked.slug;
      currentView = "roster";
      renderApp();
    });
  });
  root.querySelectorAll('[data-action="add-sighting"]').forEach((button) => {
    button.addEventListener("click", () => {
      openSightingModal({ slug: selectedSlug });
    });
  });
  root.querySelectorAll('[data-action="next-locked"]').forEach((button) => {
    button.addEventListener("click", () => {
      const nextLocked = BREEDS.find((item) => !isUnlocked(item.slug));
      if (!nextLocked) {
        setStatus("All listed dog breeds are unlocked.", "success");
        return;
      }
      selectedSlug = nextLocked.slug;
      isBreedModalOpen = true;
      renderApp();
    });
  });
}

function renderHomePanel() {
  homePanel.innerHTML = getHomePanelMarkup();
  bindActionButtons(homePanel);
  activityPanel.innerHTML = getActivityPanelMarkup();
  activityPanel.querySelectorAll("[data-open-slug]").forEach((button) => {
    button.addEventListener("click", () => openBreedModal(button.dataset.openSlug));
  });
}

function renderBreedModal() {
  if (!selectedSlug) {
    breedModalContent.innerHTML = `<div class="empty">Pick a breed entry to inspect it.</div>`;
  } else {
    breedModalContent.innerHTML = getDetailMarkup();
    bindActionButtons(breedModalContent);
  }
  breedModal.classList.toggle("is-open", isBreedModalOpen);
  breedModal.setAttribute("aria-hidden", String(!isBreedModalOpen));
}

function renderReward() {
  if (!rewardState) {
    rewardLayer.classList.remove("is-open");
    rewardLayer.setAttribute("aria-hidden", "true");
    rewardContent.innerHTML = "";
    syncBodyModalState();
    return;
  }

  rewardContent.innerHTML = `
    <div class="reward-kicker">New Breed Unlocked</div>
    <div class="reward-name">${escapeHtml(rewardState.name)}</div>
    <div class="reward-tag">${formatBreedId(rewardState.id)} added to your Canidex</div>
    <div class="reward-sprite">${renderBreedMarkup(rewardState, 10, false)}</div>
    <div class="reward-copy">First sighting confirmed. The roster just expanded, and this entry is now fully revealed.</div>
  `;
  rewardLayer.classList.add("is-open");
  rewardLayer.setAttribute("aria-hidden", "false");
  syncBodyModalState();
}

function dismissReward() {
  const deferredDraft = sightingDraft?.deferUntilReward ? { ...sightingDraft, deferUntilReward: false } : null;
  rewardState = null;
  renderReward();
  if (deferredDraft) {
    sightingDraft = deferredDraft;
    renderSightingModal();
  }
}

function renderSightingModal() {
  if (!sightingDraft || sightingDraft.deferUntilReward) {
    sightingModal.classList.remove("is-open");
    sightingModal.setAttribute("aria-hidden", "true");
    if (!sightingDraft) {
      sightingModalContent.innerHTML = "";
    }
    syncBodyModalState();
    return;
  }

  const breed = BREEDS.find((item) => item.slug === sightingDraft.slug);
  sightingModalContent.innerHTML = `
    <div class="sighting-form">
      <div class="field-label">${breed ? `${breed.name} ${formatBreedId(breed.id)}` : "Selected Breed"}</div>
      <div class="field-copy">Save an optional photo, the dog's name, and any notes for this individual sighting. This data stays on this device.</div>
      <input class="file-input" id="sightingPhotoInput" type="file" accept="image/*" capture="environment">
      ${sightingDraft.photoDataUrl ? `<div class="sighting-preview"><img src="${sightingDraft.photoDataUrl}" alt=""></div>` : ""}
      <div class="entry-nav">
        <button class="pixel-btn alt" id="pickSightingPhotoButton" type="button">${sightingDraft.photoDataUrl ? "Change Photo" : "Add Photo"}</button>
        <button class="pixel-btn" id="saveSightingButton" type="button">Save Sighting</button>
      </div>
      <div>
        <div class="field-label">Dog Name</div>
        <input class="form-input" id="dogNameInput" type="text" maxlength="60" placeholder="Optional name" value="${escapeHtml(sightingDraft.dogName || "")}">
      </div>
      <div>
        <div class="field-label">Notes</div>
        <textarea class="form-textarea" id="sightingNotesInput" maxlength="500" placeholder="Optional notes about this dog or sighting">${escapeHtml(sightingDraft.notes || "")}</textarea>
      </div>
    </div>
  `;

  const sightingPhotoInput = document.getElementById("sightingPhotoInput");
  const pickSightingPhotoButton = document.getElementById("pickSightingPhotoButton");
  const saveSightingButton = document.getElementById("saveSightingButton");
  const dogNameInput = document.getElementById("dogNameInput");
  const sightingNotesInput = document.getElementById("sightingNotesInput");

  pickSightingPhotoButton.addEventListener("click", () => sightingPhotoInput.click());
  sightingPhotoInput.addEventListener("change", async () => {
    const [file] = sightingPhotoInput.files || [];
    if (!file) {
      return;
    }
    sightingDraft.photoDataUrl = await fileToStoredPhoto(file);
    sightingDraft.dogName = dogNameInput.value;
    sightingDraft.notes = sightingNotesInput.value;
    renderSightingModal();
  });
  saveSightingButton.addEventListener("click", () => {
    sightingDraft.dogName = dogNameInput.value.trim();
    sightingDraft.notes = sightingNotesInput.value.trim();
    saveSightingDraft();
  });

  sightingModal.classList.add("is-open");
  sightingModal.setAttribute("aria-hidden", "false");
  syncBodyModalState();
}

function syncBodyModalState() {
  const open = isBreedModalOpen || Boolean(sightingDraft) || Boolean(rewardState);
  document.body.classList.toggle("modal-open", open);
}

function openBreedModal(slug = selectedSlug) {
  if (slug) {
    selectedSlug = slug;
  }
  currentView = "roster";
  isBreedModalOpen = true;
  renderApp();
}

function closeBreedModal() {
  isBreedModalOpen = false;
  renderBreedModal();
  syncBodyModalState();
}

function openSightingModal({ slug, photoDataUrl = "", dogName = "", notes = "", provider = "", label = "" }) {
  sightingDraft = {
    slug,
    photoDataUrl,
    dogName,
    notes,
    provider,
    label,
    deferUntilReward: false,
    skipRewardOnSave: false
  };
  renderSightingModal();
}

function closeSightingModal() {
  sightingDraft = null;
  renderSightingModal();
}

async function fileToStoredPhoto(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read sighting photo."));
    reader.readAsDataURL(file);
  });
  return resizeDataUrl(dataUrl, 720, 0.82);
}

async function resizeDataUrl(dataUrl, maxDimension = 720, quality = 0.82) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function saveSightingDraft() {
  if (!sightingDraft?.slug) {
    return;
  }

  const breed = BREEDS.find((item) => item.slug === sightingDraft.slug);
  const firstUnlock = !isUnlocked(sightingDraft.slug);
  const existing = getSightingRecords(sightingDraft.slug);
  const record = {
    id: `${sightingDraft.slug}-${Date.now()}`,
    dogName: sightingDraft.dogName || "",
    notes: sightingDraft.notes || "",
    photoDataUrl: sightingDraft.photoDataUrl || "",
    createdAt: new Date().toISOString(),
    provider: sightingDraft.provider || "",
    label: sightingDraft.label || ""
  };

  progress.sightings[sightingDraft.slug] = [...existing, record];
  saveProgress();
  selectedSlug = sightingDraft.slug;
  currentView = "roster";
  isBreedModalOpen = true;
  if (firstUnlock && breed && !sightingDraft.skipRewardOnSave) {
    rewardState = breed;
  }
  closeSightingModal();
  renderApp();
  setStatus(`${breed?.name || "Breed"} sighting saved. Total sightings: ${getSightings(selectedSlug)}.`, "success");
}

function renderViews() {
  const views = {
    home: document.getElementById("homeView"),
    roster: document.getElementById("rosterView")
  };
  Object.entries(views).forEach(([name, element]) => element.classList.toggle("is-active", name === currentView));
  hero.hidden = currentView !== "home";
  appNav.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === currentView);
  });
  syncHashFromView();
}

function renderClassifierResult(result) {
  if (!result) {
    classifierResult.hidden = true;
    classifierResult.innerHTML = "";
    return;
  }
  const confidence = typeof result.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "Unknown confidence";
  const predictions = Array.isArray(result.predictions) ? result.predictions : [];
  classifierResult.hidden = false;
  classifierResult.innerHTML = `
    <div class="classifier-result-head">
      <div>
        <div class="panel-label">Latest Match</div>
        <div class="classifier-result-name">${escapeHtml(result.name)}</div>
      </div>
      <div class="classifier-confidence">${confidence}</div>
    </div>
    <div class="classifier-result-copy">Matched from classifier label "${escapeHtml(result.label)}". If this looks wrong, choose the closest breed below or open the roster manually.</div>
    ${predictions.length ? `<div class="prediction-list">${predictions.map((item) => `
      <button class="prediction-chip ${item.slug ? "" : "is-disabled"}" data-prediction-slug="${escapeHtml(item.slug || "")}" type="button" ${item.slug ? "" : "disabled"}>
        <span>${escapeHtml(item.name || item.label)}</span>
        <span>${item.slug ? `${Math.round(Number(item.score || 0) * 100)}%` : "No roster match"}</span>
      </button>
    `).join("")}</div>` : ""}
    <button class="utility-btn classifier-manual" id="manualPickerButton" type="button">Choose Breed Manually</button>
  `;
  classifierResult.querySelectorAll("[data-prediction-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      const slug = button.dataset.predictionSlug;
      if (!slug) {
        return;
      }
      selectedSlug = slug;
      openSightingModal({
        slug,
        photoDataUrl: lastClassifierCapture?.photoDataUrl || "",
        provider: lastClassifierCapture?.provider || "",
        label: button.textContent || ""
      });
      currentView = "roster";
      isBreedModalOpen = true;
      renderApp();
      setStatus("Manual breed choice opened. Save the sighting when it looks right.", "success");
    });
  });
  document.getElementById("manualPickerButton")?.addEventListener("click", () => {
    currentView = "roster";
    renderApp();
    setStatus("Pick the breed from the roster, then save the sighting manually.", "success");
  });
}

function setClassifierBusy(busy) {
  isClassifying = busy;
  uploadDogButton.disabled = busy;
  cameraDogButton.disabled = busy;
  uploadDogButton.textContent = busy ? "Classifying..." : "Upload Dog Photo";
  cameraDogButton.textContent = busy ? "Classifying..." : "Take Dog Photo";
}

async function classifyUploadedDog(file) {
  if (!file || isClassifying) {
    return;
  }

  setClassifierBusy(true);
  setStatus(`Classifying ${file.name}...`, "success");

  try {
    const storedPhoto = await fileToStoredPhoto(file);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const imageBase64 = window.btoa(binary);

    const response = await fetch("/api/classify-dog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        imageBase64
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Classification failed.");
    }

    if (!payload.matched?.slug) {
      const fallbackPredictions = (payload.predictions || []).map((item) => {
        const slug = item.slug || "";
        const breed = BREEDS.find((candidate) => candidate.slug === slug);
        return {
          slug,
          label: item.label,
          name: breed?.name || item.label,
          score: Number(item.score || 0)
        };
      });
      renderClassifierResult({
        name: "No exact roster match",
        label: payload.predictions?.[0]?.label || "Unknown result",
        confidence: payload.predictions?.[0]?.score,
        predictions: fallbackPredictions
      });
      setStatus("The classifier could not map this dog cleanly. Choose the closest breed manually.", "error");
      return;
    }

    const matchedBreed = BREEDS.find((breed) => breed.slug === payload.matched.slug);
    if (!matchedBreed) {
      renderClassifierResult(null);
      setStatus(`Matched "${payload.matched.label}" but that breed is not in Canidex yet.`, "error");
      return;
    }

    lastClassifierCapture = {
      photoDataUrl: storedPhoto,
      provider: payload.provider || "",
      label: payload.matched.label || ""
    };

    selectedSlug = matchedBreed.slug;
    currentView = "roster";
    isBreedModalOpen = true;
    const firstUnlock = !isUnlocked(matchedBreed.slug);
    openSightingModal({
      slug: matchedBreed.slug,
      photoDataUrl: storedPhoto,
      provider: payload.provider || "",
      label: payload.matched.label || ""
    });
    if (sightingDraft) {
      sightingDraft.skipRewardOnSave = firstUnlock;
      sightingDraft.deferUntilReward = firstUnlock;
    }
    if (firstUnlock) {
      rewardState = matchedBreed;
      renderApp();
    } else {
      renderApp();
    }
    renderClassifierResult({
      name: matchedBreed.name,
      label: payload.matched.label,
      confidence: payload.matched.confidence,
      predictions: (payload.predictions || []).map((item) => {
        const slug = item.slug || "";
        const breed = BREEDS.find((candidate) => candidate.slug === slug);
        return {
          slug,
          label: item.label,
          name: breed?.name || item.label,
          score: Number(item.score || 0)
        };
      }).filter((item) => item.slug)
    });
    setStatus(firstUnlock
      ? `${matchedBreed.name} identified. New breed unlocked.`
      : `${matchedBreed.name} identified. Save this sighting to add the photo, dog name, and notes.`,
    "success");
  } catch (error) {
    renderClassifierResult(null);
    setStatus(error instanceof Error ? error.message : "Classification failed.", "error");
  } finally {
    setClassifierBusy(false);
    dogUploadInput.value = "";
    dogCameraInput.value = "";
  }
}

function renderApp() {
  ensureValidSelection();
  renderCounts();
  renderRosterGrid();
  renderHomePanel();
  renderViews();
  renderBreedModal();
  renderSightingModal();
  renderReward();
  seenOnlyButton.setAttribute("aria-pressed", String(seenOnly));
  seenOnlyButton.textContent = `Seen Only: ${seenOnly ? "On" : "Off"}`;
  rosterGrid.querySelectorAll("[data-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      openBreedModal(button.dataset.slug);
    });
  });
}

function resetProgress() {
  const confirmed = window.confirm("Reset all local Canidex progress and saved sightings on this device?");
  if (!confirmed) {
    return;
  }
  progress = { sightings: {} };
  saveProgress();
  selectedSlug = "golden-retriever";
  isBreedModalOpen = false;
  rewardState = null;
  sightingDraft = null;
  lastClassifierCapture = null;
  renderApp();
  setStatus("Local Canidex progress reset.", "success");
}

if (!hasConfig) {
  setStatus("Auth is not configured for this environment.", "error");
  throw new Error("Missing Supabase config");
}

const supabase = createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  if (!data.session?.user) {
    window.location.replace("/?message=denied");
    return;
  }
  document.body.classList.remove("page-hidden");
  currentView = getHashView();
  renderApp();
  setStatus("Canidex online. Add sightings to unlock dog breeds.", "success");
}

searchInput.addEventListener("input", (event) => {
  searchQuery = event.target.value;
  currentView = "roster";
  renderApp();
});
seenOnlyButton.addEventListener("click", () => {
  seenOnly = !seenOnly;
  currentView = "roster";
  renderApp();
});
resetButton.addEventListener("click", resetProgress);
resetButtonRoster.addEventListener("click", resetProgress);
cameraDogButton.addEventListener("click", () => dogCameraInput.click());
uploadDogButton.addEventListener("click", () => dogUploadInput.click());
dogCameraInput.addEventListener("change", () => {
  const [file] = dogCameraInput.files || [];
  void classifyUploadedDog(file);
});
dogUploadInput.addEventListener("change", () => {
  const [file] = dogUploadInput.files || [];
  void classifyUploadedDog(file);
});
appNav.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    if (currentView !== "roster") {
      isBreedModalOpen = false;
    }
    renderApp();
  });
});
closeBreedModalButton.addEventListener("click", closeBreedModal);
breedModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.action === "close-breed-modal") {
    closeBreedModal();
  }
});
closeSightingModalButton.addEventListener("click", closeSightingModal);
sightingModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.action === "close-sighting-modal") {
    closeSightingModal();
  }
});
dismissRewardButton.addEventListener("click", dismissReward);
rewardLayer.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.action === "dismiss-reward") {
    dismissReward();
  }
});
window.addEventListener("hashchange", () => {
  const nextView = getHashView();
  if (nextView !== currentView) {
    currentView = nextView;
    if (currentView !== "roster") {
      isBreedModalOpen = false;
    }
    renderApp();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (rewardState) {
    dismissReward();
    return;
  }
  if (sightingDraft) {
    closeSightingModal();
    return;
  }
  if (isBreedModalOpen) {
    closeBreedModal();
  }
});
logoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  window.location.replace("/");
});
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) {
    window.location.replace("/?message=denied");
  }
});

await requireSession();

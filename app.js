// ── Tab navigation ──
function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
}

// ── Saved places ──
let savedPlaces = JSON.parse(localStorage.getItem('mm_saved') || '[]');

// True while cloud data is being applied locally — suppresses the push hook
// so a pull doesn't immediately echo back as a push.
let cloudApplying = false;

function savePlaces() {
  localStorage.setItem('mm_saved', JSON.stringify(savedPlaces));
  const count = savedPlaces.length;
  const badge = document.getElementById('savedCount');
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
  if (!cloudApplying && window.mmCloudPush) window.mmCloudPush();
}

function saveRestaurant(r) {
  if (savedPlaces.find(p => p.id === r.id)) return;
  savedPlaces.push({ ...r, note: '', savedAt: Date.now(), visitedAt: null });
  savePlaces();
  renderSaved();
  document.querySelectorAll(`[data-save-id="${r.id}"]`).forEach(btn => {
    btn.classList.add('saved');
    btn.innerHTML = '<i class="ti ti-heart-filled" aria-hidden="true"></i> Saved';
  });
}

function removePlace(id) {
  savedPlaces = savedPlaces.filter(p => p.id !== id);
  savePlaces();
  renderSaved();
}

function updateNote(id, note) {
  const p = savedPlaces.find(p => p.id === id);
  if (p) { p.note = note; savePlaces(); }
}

function markVisited(id) {
  const p = savedPlaces.find(p => p.id === id);
  if (p) { p.visitedAt = Date.now(); savePlaces(); renderSaved(); }
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderSaved() {
  const area = document.getElementById('savedArea');
  if (!savedPlaces.length) {
    area.innerHTML = `<div class="empty-state"><i class="ti ti-heart empty-icon" aria-hidden="true"></i><div class="empty-title">No saved places yet</div><div class="empty-sub">Find a restaurant and save it here with notes</div></div>`;
    return;
  }
  area.innerHTML = savedPlaces.slice().reverse().map(r => `
    <div class="saved-card">
      <div class="saved-card-header">
        <div class="r-icon">${cuisineIcon(r.cuisine)}</div>
        <div class="r-meta">
          <div class="r-name">${r.name}</div>
          <div class="r-sub">
            ${r.rating ? `<span class="r-stars">${'★'.repeat(Math.floor(r.rating))}</span><span>${r.rating.toFixed(1)}</span><span>·</span>` : ''}
            <span>${r.cuisine}</span>
          </div>
          <div class="r-address">${r.address}</div>
        </div>
        <button class="saved-remove-btn" onclick="removePlace('${r.id}')" aria-label="Remove">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>
      <div class="saved-note-row">
        <input class="saved-note-input" type="text" placeholder="Add a note (e.g. white pizza no garlic ✓, call ahead)..."
          value="${r.note || ''}" oninput="updateNote('${r.id}', this.value)">
      </div>
      <div class="saved-meta-row">
        <span class="saved-meta-date">Saved: ${formatDate(r.savedAt)}</span>
        ${r.visitedAt ? `<span class="saved-meta-date">Last visited: ${formatDate(r.visitedAt)}</span>` : ''}
        <button class="saved-visited-btn" onclick="markVisited('${r.id}')">
          <i class="ti ti-calendar-check" aria-hidden="true"></i> Mark visited today
        </button>
      </div>
    </div>`).join('');
}

// ── Export saved places ──
function exportSaved() {
  if (!savedPlaces.length) return;
  const lines = savedPlaces.slice().reverse().map(r => {
    const dishes = (r.aiDishes || []).map(d => `  • ${d.dish} — ${d.note}`).join('\n');
    return [
      r.name,
      r.cuisine,
      r.address,
      r.phone ? `Phone: ${r.phone}` : '',
      r.note ? `Note: ${r.note}` : '',
      `Saved: ${formatDate(r.savedAt)}`,
      r.visitedAt ? `Last visited: ${formatDate(r.visitedAt)}` : '',
      dishes ? `Dishes:\n${dishes}` : '',
    ].filter(Boolean).join('\n');
  });
  const text = lines.join('\n\n---\n\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('exportBtn');
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
}

// ── Diet profile (improvement #2) ──
const DEFAULT_RESTRICTIONS = [
  { id: 'garlic', label: 'Garlic', active: true },
  { id: 'onion', label: 'Onions', active: true },
  { id: 'meat', label: 'Meat or fish', active: true },
  { id: 'seeds', label: 'Seeds of any kind', active: true },
  { id: 'rennet', label: 'Animal rennet in cheese', active: true },
  { id: 'gravy', label: 'Gravy', active: true },
  { id: 'grains', label: 'Whole grains or bran', active: true },
];

// The foods this diner CAN eat — drives dish matching. Each has an optional
// "note" telling the kitchen what to confirm. Fully editable per user.
const DEFAULT_SAFE_FOODS = [
  { id: 'sf_mozz', label: 'Mozzarella (rennet-free)', note: 'confirm cheese is rennet-free', active: true },
  { id: 'sf_ricotta', label: 'Ricotta', note: '', active: true },
  { id: 'sf_farmer', label: "Farmer's cheese", note: '', active: true },
  { id: 'sf_whitepizza', label: 'White pizza', note: 'no garlic in dough or topping', active: true },
  { id: 'sf_passata', label: 'Pasta with passata', note: 'plain strained tomato, no garlic or onion', active: true },
  { id: 'sf_pierogi', label: 'Pierogi (potato & cheese)', note: 'no onion in filling or topping', active: true },
  { id: 'sf_dosa', label: 'Plain dosa', note: 'no garlic/onion in batter or chutney', active: true },
  { id: 'sf_dal', label: 'Masoor dal (red lentils)', note: 'no onion or garlic', active: true },
  { id: 'sf_mash', label: 'Mashed potatoes', note: 'milk only, no gravy, no onion/garlic', active: true },
  { id: 'sf_potcass', label: 'Potato casserole', note: 'no onion or garlic', active: true },
  { id: 'sf_tofu', label: 'Plain baked or steamed tofu', note: 'no garlic/onion marinade', active: true },
  { id: 'sf_eggs', label: 'Eggs (as part of a dish)', note: 'no onion or garlic', active: true },
  { id: 'sf_rice', label: 'Plain white rice', note: '', active: true },
  { id: 'sf_pasta', label: 'White flour pasta', note: '', active: true },
  { id: 'sf_sourdough', label: 'Sourdough bread', note: 'no seeds', active: true },
];

let dietProfile = null;
let cardEditMode = false;

function loadProfile() {
  const stored = localStorage.getItem('mm_profile');
  if (stored) {
    try { dietProfile = JSON.parse(stored); } catch { dietProfile = null; }
  }
  if (!dietProfile) {
    dietProfile = {
      restrictions: DEFAULT_RESTRICTIONS.map(r => ({ ...r })),
      safeFoods: DEFAULT_SAFE_FOODS.map(r => ({ ...r })),
    };
    saveProfile();
  }
  // Migration: profiles saved before safe-foods editing existed
  if (!Array.isArray(dietProfile.safeFoods)) {
    dietProfile.safeFoods = DEFAULT_SAFE_FOODS.map(r => ({ ...r }));
    saveProfile();
  }
}

function saveProfile() {
  localStorage.setItem('mm_profile', JSON.stringify(dietProfile));
  if (!cloudApplying && window.mmCloudPush) window.mmCloudPush();
}

// ── Cloud sync bridge (used by auth.js) ──
// Function declarations so they land on window for the auth module.
function mmGetCloudSnapshot() {
  return { profile: dietProfile, savedPlaces };
}

function mmApplyCloudData(data) {
  cloudApplying = true;
  try {
    if (data?.profile && Array.isArray(data.profile.restrictions)) {
      dietProfile = data.profile;
      if (!Array.isArray(dietProfile.safeFoods)) dietProfile.safeFoods = [];
      saveProfile();
    }
    if (Array.isArray(data?.savedPlaces)) {
      savedPlaces = data.savedPlaces;
      savePlaces();
    }
  } finally {
    cloudApplying = false;
  }
  renderDietCard();
  updateSidebarNote();
  renderSaved();
}

function getActiveRestrictions() {
  return dietProfile.restrictions.filter(r => r.active);
}

function toggleRestriction(id) {
  const r = dietProfile.restrictions.find(r => r.id === id);
  if (r) { r.active = !r.active; saveProfile(); renderDietCard(); updateSidebarNote(); }
}

function addRestriction() {
  const input = document.getElementById('newRestrictionInput');
  if (!input) return;
  const label = input.value.trim();
  if (!label) return;
  const id = 'custom_' + Date.now();
  dietProfile.restrictions.push({ id, label, active: true, custom: true });
  saveProfile();
  input.value = '';
  renderDietCard();
  updateSidebarNote();
}

function removeCustomRestriction(id) {
  dietProfile.restrictions = dietProfile.restrictions.filter(r => r.id !== id);
  saveProfile();
  renderDietCard();
  updateSidebarNote();
}

// ── Safe foods (things this diner CAN eat) ──
function getActiveSafeFoods() {
  return (dietProfile.safeFoods || []).filter(f => f.active);
}

function toggleSafeFood(id) {
  const f = dietProfile.safeFoods.find(f => f.id === id);
  if (f) { f.active = !f.active; saveProfile(); renderDietCard(); }
}

function addSafeFood() {
  const input = document.getElementById('newSafeFoodInput');
  if (!input) return;
  const label = input.value.trim();
  if (!label) return;
  dietProfile.safeFoods.push({ id: 'sf_custom_' + Date.now(), label, note: '', active: true, custom: true });
  saveProfile();
  input.value = '';
  renderDietCard();
}

function removeSafeFood(id) {
  dietProfile.safeFoods = dietProfile.safeFoods.filter(f => f.id !== id);
  saveProfile();
  renderDietCard();
}

// A plain-language "ask the kitchen" line built from the active restrictions
function askKitchenLine() {
  const active = getActiveRestrictions().map(r => r.label.toLowerCase());
  if (!active.length) return 'Can you tell me how this dish is prepared? I have some dietary needs.';
  return `Can this dish be prepared without ${listPhrase(active)}? I have a medical dietary need.`;
}

// Joins ["a","b","c"] -> "a, b, or c"
function listPhrase(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

function toggleEditMode() {
  cardEditMode = !cardEditMode;
  renderDietCard();
}

function updateSidebarNote() {
  const el = document.getElementById('sidebarNote');
  if (!el) return;
  const active = getActiveRestrictions();
  if (!active.length) {
    el.innerHTML = '<i class="ti ti-leaf" aria-hidden="true"></i> No active dietary restrictions.';
    return;
  }
  el.innerHTML = `<i class="ti ti-leaf" aria-hidden="true"></i> Can't eat: ${active.map(r => r.label.toLowerCase()).join(', ')}.`;
}

function renderDietCard() {
  const container = document.getElementById('dietCard');
  if (!container) return;

  const active = dietProfile.restrictions.filter(r => r.active);
  const inactive = dietProfile.restrictions.filter(r => !r.active);
  const safeActive = (dietProfile.safeFoods || []).filter(f => f.active);
  const safeInactive = (dietProfile.safeFoods || []).filter(f => !f.active);
  const askLine = askKitchenLine();

  if (cardEditMode) {
    container.innerHTML = `
      <div class="diet-card">
        <div class="diet-card-header">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div class="diet-card-title">My dietary needs</div>
              <div class="diet-card-sub">Please read before taking my order</div>
            </div>
            <button class="diet-edit-btn" onclick="toggleEditMode()" style="color:#94a3b8">
              <i class="ti ti-check" aria-hidden="true"></i> Done
            </button>
          </div>
        </div>

        <div class="diet-section">
          <div class="diet-section-label safe">
            <i class="ti ti-circle-check" aria-hidden="true"></i> I can safely eat
            <span style="margin-left:6px;font-size:9px;opacity:0.7;font-weight:400;letter-spacing:0">(click to disable)</span>
          </div>
          <div class="diet-items">
            ${safeActive.map(f => `
              <span class="diet-item safe diet-item-editable" onclick="toggleSafeFood('${f.id}')" title="${f.note ? f.note.replace(/"/g, '&quot;') : 'Click to disable'}">
                ${f.label}<span class="diet-item-remove" onclick="event.stopPropagation();removeSafeFood('${f.id}')" title="Remove">×</span>
              </span>`).join('')}
            ${!safeActive.length ? '<span style="font-size:12px;color:#9CA3AF">No safe foods yet — add what you can eat below</span>' : ''}
          </div>
          ${safeInactive.length ? `
          <div style="margin-top:10px">
            <div style="font-size:10px;color:#9CA3AF;margin-bottom:6px">Disabled — click to re-enable:</div>
            <div class="diet-items">
              ${safeInactive.map(f => `
                <span class="diet-item diet-item-inactive" onclick="toggleSafeFood('${f.id}')" title="Click to re-enable">
                  + ${f.label}<span class="diet-item-remove" onclick="event.stopPropagation();removeSafeFood('${f.id}')" title="Remove">×</span>
                </span>`).join('')}
            </div>
          </div>` : ''}
          <div class="diet-add-row">
            <input class="diet-add-input" id="newSafeFoodInput" type="text" placeholder="Add a food you can eat..." onkeydown="if(event.key==='Enter')addSafeFood()">
            <button class="diet-add-btn" onclick="addSafeFood()"><i class="ti ti-plus" aria-hidden="true"></i> Add</button>
          </div>
        </div>

        <div class="diet-section">
          <div class="diet-section-label avoid">
            <i class="ti ti-circle-x" aria-hidden="true"></i> I cannot eat
            <span style="margin-left:6px;font-size:9px;opacity:0.7;font-weight:400;letter-spacing:0">(click to disable)</span>
          </div>
          <div class="diet-items">
            ${active.map(r => `
              <span class="diet-item avoid diet-item-editable" onclick="toggleRestriction('${r.id}')" title="Click to disable">
                ${r.label}${r.custom ? `<span class="diet-item-remove" onclick="event.stopPropagation();removeCustomRestriction('${r.id}')" title="Remove">×</span>` : ''}
              </span>`).join('')}
          </div>
          ${inactive.length ? `
          <div style="margin-top:10px">
            <div style="font-size:10px;color:#9CA3AF;margin-bottom:6px">Disabled — click to re-enable:</div>
            <div class="diet-items">
              ${inactive.map(r => `
                <span class="diet-item avoid diet-item-inactive" onclick="toggleRestriction('${r.id}')" title="Click to re-enable">
                  + ${r.label}${r.custom ? `<span class="diet-item-remove" onclick="event.stopPropagation();removeCustomRestriction('${r.id}')" title="Remove">×</span>` : ''}
                </span>`).join('')}
            </div>
          </div>` : ''}
          <div class="diet-add-row">
            <input class="diet-add-input" id="newRestrictionInput" type="text" placeholder="Add restriction..." onkeydown="if(event.key==='Enter')addRestriction()">
            <button class="diet-add-btn" onclick="addRestriction()"><i class="ti ti-plus" aria-hidden="true"></i> Add</button>
          </div>
        </div>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="diet-card">
        <div class="diet-card-header">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div class="diet-card-title">My dietary needs</div>
              <div class="diet-card-sub">Please read before taking my order</div>
            </div>
            <button class="diet-edit-btn" onclick="toggleEditMode()" style="color:#94a3b8">
              <i class="ti ti-pencil" aria-hidden="true"></i> Edit
            </button>
          </div>
        </div>

        <div class="diet-section diet-section-safe-prominent">
          <div class="diet-section-label safe">
            <i class="ti ti-circle-check" aria-hidden="true"></i> I can safely eat — suggest one of these
          </div>
          <div class="diet-items">
            ${safeActive.map(f => `<span class="diet-item safe"${f.note ? ` title="${f.note.replace(/"/g, '&quot;')}"` : ''}>${f.label}${f.note ? ` <span style="opacity:0.7;font-weight:400">— ${f.note}</span>` : ''}</span>`).join('')}
            ${!safeActive.length ? '<span style="font-size:12px;color:#9CA3AF">No safe foods added yet — tap Edit to add what you can eat</span>' : ''}
          </div>
        </div>

        <div class="diet-section">
          <div class="diet-section-label avoid">
            <i class="ti ti-circle-x" aria-hidden="true"></i> I cannot eat
          </div>
          <div class="diet-items">
            ${active.map(r => `<span class="diet-item avoid">${r.label}</span>`).join('')}
            ${!active.length ? '<span style="font-size:12px;color:#9CA3AF">No active restrictions</span>' : ''}
          </div>
        </div>

        <div class="diet-section">
          <div class="diet-section-label ask">
            <i class="ti ti-help-circle" aria-hidden="true"></i> Please ask the kitchen
          </div>
          <div class="ask-box">
            "${askLine}"
          </div>
        </div>
      </div>`;
  }
}

// ── Diet card actions ──
function printCard() { window.print(); }

function copyCard() {
  const active = getActiveRestrictions();
  const safe = getActiveSafeFoods();
  const text = `MY DIETARY NEEDS — Please read before taking my order

I CANNOT EAT:
${active.length ? active.map(r => `• ${r.label}`).join('\n') : '• (none listed)'}

PLEASE ASK THE KITCHEN:
"${askKitchenLine()}"

I CAN SAFELY EAT:
${safe.length ? safe.map(f => `• ${f.label}${f.note ? ` (${f.note})` : ''}`).join('\n') : '• (none listed yet)'}`;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('[onclick="copyCard()"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
}

// Client-side fallback for when the AI matcher is unavailable (e.g. no
// Anthropic key). Instead of guessing cuisine-specific dishes, we surface the
// user's OWN safe-food list so the suggestions always reflect their profile.
function getSafeDishes(cuisine) {
  const safe = getActiveSafeFoods();
  if (safe.length) {
    return safe.slice(0, 6).map(f => ({
      dish: f.label,
      note: f.note ? `Ask: ${f.note}` : 'Ask if this is available and how it\'s prepared',
    }));
  }
  return [{ dish: 'Ask the kitchen', note: askKitchenLine() }];
}

// ── Restaurant search ──
const SAFE_CUISINES = ['south indian', 'indian', 'italian', 'eastern european', 'polish', 'ukrainian', 'japanese', 'vegetarian', 'vegan'];
let allResults = [];
let activeFilter = 'all';
let currentCoords = null;

function cuisineIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('south indian') || t.includes('dosa')) return '🥘';
  if (t.includes('indian')) return '🍛';
  if (t.includes('italian') || t.includes('pizza') || t.includes('pasta')) return '🍕';
  if (t.includes('polish') || t.includes('eastern european') || t.includes('ukrainian')) return '🥟';
  if (t.includes('japanese') || t.includes('sushi')) return '🍱';
  if (t.includes('vegetarian') || t.includes('vegan')) return '🥗';
  if (t.includes('mediterranean')) return '🫒';
  if (t.includes('cafe') || t.includes('coffee')) return '☕';
  return '🍽️';
}

function isSafeCuisine(cuisine) {
  const c = (cuisine || '').toLowerCase();
  return SAFE_CUISINES.some(s => c.includes(s));
}

function distanceMiles(userCoords, loc) {
  if (!userCoords || !loc) return 9999;
  const R = 3958.8;
  const dLat = (loc.latitude - userCoords.lat) * Math.PI / 180;
  const dLon = (loc.longitude - userCoords.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(userCoords.lat * Math.PI/180) * Math.cos(loc.latitude * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function distanceText(userCoords, loc) {
  if (!userCoords || !loc) return '';
  const miles = distanceMiles(userCoords, loc);
  return miles < 0.1 ? 'nearby' : `${miles.toFixed(1)} mi`;
}

function setFilter(btn, cuisine) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = cuisine;
  renderResults(allResults);
}

// ── Price label (improvement #8) ──
function priceLabel(level) {
  const map = {
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  };
  return map[level] || '';
}

// ── GPS banner (improvement #7) ──
function offerGpsBanner() {
  const area = document.getElementById('resultsArea');
  let banner = area.querySelector('.gps-banner');
  if (banner) return; // already shown
  banner = document.createElement('div');
  banner.className = 'gps-banner';
  banner.innerHTML = `<span>Distances are from the zip/city center —</span>
    <button class="gps-use-btn" onclick="useGpsForDistances()">Use my GPS for exact distances</button>
    <button class="gps-dismiss-btn" onclick="dismissGpsBanner()" aria-label="Dismiss">×</button>`;
  const header = area.querySelector('.results-header');
  if (header) {
    area.insertBefore(banner, header);
  } else {
    area.prepend(banner);
  }
}

function dismissGpsBanner() {
  const banner = document.querySelector('.gps-banner');
  if (banner) banner.remove();
}

function useGpsForDistances() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    dismissGpsBanner();
    renderResults(allResults);
  });
}

// Global restaurant lookup — avoids embedding JSON in HTML attributes
window.__rmap = {};

function renderResults(restaurants) {
  const area = document.getElementById('resultsArea');
  if (!restaurants.length) {
    area.innerHTML = `<div class="empty-state"><i class="ti ti-circle-x empty-icon" aria-hidden="true"></i><div class="empty-title">No restaurants found</div><div class="empty-sub">Try a different location</div></div>`;
    return;
  }

  // Broader filter aliases — Google often labels restaurants more generically
  const FILTER_ALIASES = {
    'south indian': c => c.includes('south indian') || c.includes('indian'),
    'italian':      c => c.includes('italian') || c.includes('pizza'),
    'eastern european': c => c.includes('eastern european') || c.includes('polish') || c.includes('ukrainian'),
    'japanese':     c => c.includes('japanese') || c.includes('sushi') || c.includes('ramen'),
  };

  let filtered = restaurants;
  if (activeFilter !== 'all') {
    const matchFn = FILTER_ALIASES[activeFilter] || (c => c.includes(activeFilter));
    filtered = restaurants.filter(r => matchFn((r.cuisine || '').toLowerCase()));
  }

  // Sort by distance (closest first); fall back to rating if no coords
  filtered.sort((a, b) => {
    if (currentCoords) {
      const da = distanceMiles(currentCoords, a.location);
      const db = distanceMiles(currentCoords, b.location);
      return da - db;
    }
    return (b.rating || 0) - (a.rating || 0);
  });

  let widenedNotice = '';
  if (!filtered.length && activeFilter !== 'all') {
    // Auto-widen: show all results rather than a dead end
    filtered = restaurants.slice().sort((a, b) => {
      if (currentCoords) return distanceMiles(currentCoords, a.location) - distanceMiles(currentCoords, b.location);
      return (b.rating || 0) - (a.rating || 0);
    });
    widenedNotice = `<div class="filter-widened-notice"><i class="ti ti-info-circle" aria-hidden="true"></i> No "${activeFilter}" restaurants found nearby — showing all ${filtered.length} results instead</div>`;
  }

  const savedIds = new Set(savedPlaces.map(p => p.id));

  // Store in global map so onclick can reference by ID
  filtered.forEach(r => { window.__rmap[r.id] = r; });

  // Today's weekday index for opening hours (Google: Mon=0 ... Sun=6)
  const day = new Date().getDay();
  const todayIdx = day === 0 ? 6 : day - 1;

  area.innerHTML = `<div class="results-header">${filtered.length} restaurant${filtered.length === 1 ? '' : 's'} found — sorted by distance</div>${widenedNotice}` +
    filtered.map(r => {
      const safe = isSafeCuisine(r.cuisine);
      const dist = distanceText(currentCoords, r.location);
      const isSaved = savedIds.has(r.id);
      // Distinguish: null = AI not run (use local), [] = AI found nothing safe, [...] = AI suggestions
      const aiExplicitlyEmpty = r.aiDishes !== null && r.aiDishes !== undefined && r.aiDishes.length === 0;
      const safeDishes = (r.aiDishes && r.aiDishes.length) ? r.aiDishes : (aiExplicitlyEmpty ? [] : getSafeDishes(r.cuisine));
      const eid = r.id.replace(/"/g, '');

      // Opening hours badge
      let openBadge = '';
      if (r.openNow === true) {
        openBadge = '<span class="r-open-badge">Open now</span>';
      } else if (r.openNow === false) {
        openBadge = '<span class="r-closed-badge">Closed</span>';
      }

      // Today's hours text
      let todayHours = '';
      if (r.weekdayHours && r.weekdayHours[todayIdx]) {
        todayHours = `<div class="r-hours">${r.weekdayHours[todayIdx]}</div>`;
      }

      // Price label
      const price = r.priceLevel ? priceLabel(r.priceLevel) : '';

      return `<div class="r-card${safe ? ' r-card-safe' : ''}">
        <div class="r-card-header">
          <div class="r-icon" id="photo-${eid}">${cuisineIcon(r.cuisine)}</div>
          <div class="r-meta">
            <div class="r-name">${r.name}</div>
            <div class="r-sub">
              ${r.rating ? `<span class="r-stars">${'★'.repeat(Math.floor(r.rating))}</span><span>${r.rating.toFixed(1)}</span><span>·</span>` : ''}
              <span>${r.cuisine}</span>
              ${price ? `<span>·</span><span class="r-price">${price}</span>` : ''}
              ${dist ? `<span>·</span><span>${dist}</span>` : ''}
            </div>
          </div>
          ${safe ? `<span class="safe-badge">Safe cuisine</span>` : ''}
        </div>

        <div class="r-details">
          ${openBadge || todayHours ? `<div class="r-detail-row" style="gap:8px">${openBadge}${todayHours}</div>` : ''}
          ${r.address ? `<div class="r-detail-row"><i class="ti ti-map-pin" aria-hidden="true"></i><span>${r.address}</span></div>` : ''}
          ${r.mapsUrl ? `<div class="r-detail-row"><i class="ti ti-external-link" aria-hidden="true"></i><a href="${r.mapsUrl}" target="_blank" rel="noopener">View on Google Maps</a></div>` : ''}
        </div>

        <div class="r-safe-dishes">
          <div class="r-safe-dishes-label"><i class="ti ti-phone-call" aria-hidden="true"></i> Ask about these dishes${(r.aiDishes && r.aiDishes.length) ? ' <span style="font-size:9px;font-weight:400;opacity:0.7;letter-spacing:0">· AI matched</span>' : ''}</div>
          <div class="r-call-warning"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Always call ahead — nothing can be assumed safe without kitchen confirmation</div>
          ${aiExplicitlyEmpty
            ? `<div class="r-no-dishes"><i class="ti ti-circle-x" aria-hidden="true"></i> Nothing from your safe list is likely on this menu — still worth calling to ask if they can accommodate you</div>`
            : safeDishes.map(d => `<div class="r-dish-row"><span class="r-dish-name">${d.dish}</span><span class="r-dish-note">${d.note}</span></div>`).join('')}
        </div>

        <div class="r-actions">
          ${r.phone ? `<a class="r-phone-primary" href="tel:${r.phone}"><i class="ti ti-phone-call" aria-hidden="true"></i> Call ${r.phone}</a>` : ''}
          <div class="r-card-btns">
            <button class="r-action-btn r-callscript-btn" onclick="showCallScript('${eid}')">
              <i class="ti ti-script" aria-hidden="true"></i> Call script
            </button>
            <button class="r-save-btn ${isSaved ? 'saved' : ''}" data-save-id="${eid}" onclick="saveRestaurant(window.__rmap['${eid}'])">
              <i class="ti ti-${isSaved ? 'heart-filled' : 'heart'}" aria-hidden="true"></i> ${isSaved ? 'Saved' : 'Save'}
            </button>
            <button class="r-action-btn" id="share-${eid}" onclick="shareRestaurant('${eid}', this)">
              <i class="ti ti-share" aria-hidden="true"></i> Share
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

  // Load photos after DOM is set
  filtered.forEach(r => {
    if (!r.photoName) return;
    const eid = r.id.replace(/"/g, '');
    fetch(`/api/photo?name=${encodeURIComponent(r.photoName)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.url) return;
        const el = document.getElementById(`photo-${eid}`);
        if (el) {
          el.style.backgroundImage = `url(${data.url})`;
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.textContent = '';
        }
      }).catch(() => {});
  });
}

// ── Call-ahead script ──
function showCallScript(eid) {
  const r = window.__rmap[eid];
  if (!r) return;
  const active = getActiveRestrictions();
  const restrictionList = active.map(r => r.label.toLowerCase()).join(', ');
  const dishes = (r.aiDishes || []).slice(0, 3).map(d => `  • ${d.dish}`).join('\n');
  const cannotLine = restrictionList
    ? `I have dietary restrictions and cannot eat: ${restrictionList}.`
    : `I have some dietary restrictions I'd like to check on.`;
  const script = `Hi, I have a question about dietary accommodations before I visit ${r.name}.

${cannotLine}
${dishes ? `\nBased on your menu, I was hoping to order:\n${dishes}\n\nWould the kitchen be able to prepare those without the ingredients I mentioned?` : '\nCould you tell me which dishes on your menu could be prepared without those ingredients?'}

Thank you so much — I really appreciate it.`;

  document.getElementById('scriptText').textContent = script;
  document.getElementById('scriptModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('scriptModal').style.display = 'none';
}

function copyScript() {
  const text = document.getElementById('scriptText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.modal-copy-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
}

// ── Share restaurant ──
function shareRestaurant(eid, btn) {
  const r = window.__rmap[eid];
  if (!r) return;
  const dishes = (r.aiDishes || []).slice(0, 4).map(d => `  • ${d.dish} — ${d.note}`).join('\n');
  const active = getActiveRestrictions();
  const text = `${r.name}
${r.address}${r.phone ? '\n' + r.phone : ''}${r.mapsUrl ? '\n' + r.mapsUrl : ''}

Likely safe to order:
${dishes || '  • Ask which dishes can be made to fit my diet'}

${active.length ? `Tell them: cannot eat ${active.map(r => r.label.toLowerCase()).join(', ')}.` : ''}`;

  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
  });
}

function useMyLocation() {
  if (!navigator.geolocation) return;
  const input = document.getElementById('locationInput');
  input.value = 'Detecting location…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      input.value = 'Current location';
      runSearch();
    },
    () => { input.value = ''; }
  );
}

async function runSearch() {
  const loc = document.getElementById('locationInput').value.trim();
  if (!loc) return;
  const radiusKm = document.getElementById('radiusSelect')?.value || '16';
  if (loc !== 'Current location') localStorage.setItem('mm_last_location', loc);
  const area = document.getElementById('resultsArea');
  area.innerHTML = `<div class="empty-state"><i class="ti ti-loader empty-icon spinning" aria-hidden="true"></i><div class="empty-title">Searching…</div></div>`;
  try {
    const activeRestrictions = getActiveRestrictions().map(r => r.label).join(',');
    // Send the user's safe foods (label + kitchen note) so the matcher only
    // suggests dishes this specific diner can actually eat.
    const safeFoods = getActiveSafeFoods().map(f => f.note ? `${f.label} (${f.note})` : f.label).join('|');
    const profileParam = `&restrictions=${encodeURIComponent(activeRestrictions)}&safe=${encodeURIComponent(safeFoods)}`;
    const params = currentCoords && loc === 'Current location'
      ? `lat=${currentCoords.lat}&lng=${currentCoords.lng}&radius=${radiusKm}${profileParam}`
      : `location=${encodeURIComponent(loc)}&radius=${radiusKm}${profileParam}`;
    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    if (data.coords) currentCoords = data.coords;
    allResults = data.restaurants;
    renderResults(allResults);
    // Show GPS banner if searched by zip/city (not current location)
    if (loc !== 'Current location') {
      offerGpsBanner();
    }
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><i class="ti ti-alert-circle empty-icon" aria-hidden="true"></i><div class="empty-title">Search failed</div><div class="empty-sub">${err.message}</div></div>`;
  }
}

// ── Init ──
loadProfile();
renderDietCard();
updateSidebarNote();
savePlaces();
renderSaved();
// Restore last searched location
const lastLoc = localStorage.getItem('mm_last_location');
if (lastLoc) document.getElementById('locationInput').value = lastLoc;

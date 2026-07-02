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
let isFirstRun = false;

function loadProfile() {
  const stored = localStorage.getItem('mm_profile');
  if (stored) {
    try { dietProfile = JSON.parse(stored); } catch { dietProfile = null; }
  }
  if (!dietProfile) {
    // New user: start EMPTY and run onboarding — they choose what they CAN
    // eat rather than inheriting someone else's diet. Not saved yet, so a
    // reload before finishing re-offers setup.
    dietProfile = { restrictions: [], safeFoods: [] };
    isFirstRun = true;
  }
  // Migration: profiles saved before safe-foods editing existed (these are
  // pre-existing users of the original diet, so seed their original foods).
  if (!Array.isArray(dietProfile.safeFoods)) {
    dietProfile.safeFoods = DEFAULT_SAFE_FOODS.map(r => ({ ...r }));
    saveProfile();
  }
}

function saveProfile() {
  localStorage.setItem('mm_profile', JSON.stringify(dietProfile));
  if (!cloudApplying && window.mmCloudPush) window.mmCloudPush();
  scheduleCuisineRefresh();
}

// ── Personalized cuisines ──
// Derived from the user's typed can-eat list (Claude via /api/cuisines,
// keyword fallback offline). Drives the search filter buttons, the "Safe
// cuisine" badge, and the diet card's "best cuisine types" section.
let cuisineTimer = null;

function scheduleCuisineRefresh() {
  clearTimeout(cuisineTimer);
  cuisineTimer = setTimeout(refreshCuisines, 1500);
}

async function refreshCuisines() {
  if (isFirstRun) return; // don't persist anything before onboarding finishes
  const foods = getActiveSafeFoods().map(f => f.label);
  const from = foods.join('|');
  if (from === (dietProfile.cuisinesFrom || '')) return; // up to date
  if (!foods.length) {
    dietProfile.cuisines = [];
    dietProfile.cuisinesFrom = '';
    saveProfile();
    renderCuisineFilters();
    if (!cardEditMode) renderDietCard();
    return;
  }
  let list = null;
  try {
    const res = await fetch('/api/cuisines', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ foods, restrictions: getActiveRestrictions().map(r => r.label) }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.cuisines) && data.cuisines.length) list = data.cuisines;
    }
  } catch { /* offline / local dev — fall through */ }
  if (!list) list = localCuisineGuess(foods);
  dietProfile.cuisines = list.slice(0, 6);
  dietProfile.cuisinesFrom = from;
  saveProfile();
  renderCuisineFilters();
  if (!cardEditMode) renderDietCard();
}

// Keyword fallback when the AI endpoint is unreachable.
const CUISINE_KEYWORDS = [
  [/pizza|pasta|mozzarella|ricotta|risotto|lasagn|passata/i, ['Italian', 'Pizza']],
  [/dosa|idli|dal\b|paneer|naan|roti|biryani|curry/i, ['South Indian', 'Indian']],
  [/sushi|ramen|miso|teriyaki|tempura|edamame/i, ['Japanese', 'Sushi']],
  [/pierogi|schnitzel|goulash|borscht|kielbasa/i, ['Eastern European']],
  [/taco|burrito|quesadilla|enchilada|fajita/i, ['Mexican']],
  [/pho\b|banh/i, ['Vietnamese']],
  [/pad thai|thai/i, ['Thai']],
  [/hummus|falafel|pita|gyro|halloumi|shawarma/i, ['Mediterranean', 'Middle Eastern']],
  [/dumpling|lo mein|fried rice|wonton|chow/i, ['Chinese']],
  [/burger|tenders|fries|grilled cheese|mac and cheese|mac n|steak|eggs|pancake|waffle|sandwich|toast|bacon|nuggets/i, ['American', 'Diner']],
  [/tofu/i, ['Japanese', 'Vegetarian']],
  [/rice/i, ['Chinese', 'Japanese']],
];

function localCuisineGuess(foods) {
  const text = foods.join(' \n ');
  const out = [];
  for (const [re, cuisines] of CUISINE_KEYWORDS) {
    if (re.test(text)) for (const c of cuisines) if (!out.includes(c)) out.push(c);
    if (out.length >= 6) break;
  }
  return out.length ? out.slice(0, 6) : ['American', 'Diner'];
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
  // Signed in from the onboarding welcome and the account already has a
  // diet card? Setup is done — close the wizard.
  const ob = document.getElementById('onboarding');
  if (ob && ob.style.display !== 'none' &&
      (getActiveSafeFoods().length || getActiveRestrictions().length)) {
    isFirstRun = false;
    ob.style.display = 'none';
  }
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
  // Lead with what the user CAN eat — that's the whole idea of the tool.
  const safe = getActiveSafeFoods();
  const active = getActiveRestrictions();
  if (safe.length) {
    const shown = safe.slice(0, 3).map(f => f.label.toLowerCase());
    const more = safe.length - shown.length;
    el.innerHTML = `<i class="ti ti-leaf" aria-hidden="true"></i> Eats: ${shown.join(', ')}${more > 0 ? ` +${more} more` : ''}.`;
  } else if (active.length) {
    el.innerHTML = `<i class="ti ti-leaf" aria-hidden="true"></i> Can't eat: ${active.map(r => r.label.toLowerCase()).join(', ')}.`;
  } else {
    el.innerHTML = '<i class="ti ti-leaf" aria-hidden="true"></i> No diet set up yet — open the Diet card and add what you eat.';
  }
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
            <div style="display:flex;gap:6px">
              <button class="diet-edit-btn" onclick="startOnboarding(true)" style="color:#94a3b8" title="Re-run guided setup with your current picks">
                <i class="ti ti-refresh" aria-hidden="true"></i> Restart setup
              </button>
              <button class="diet-edit-btn" onclick="toggleEditMode()" style="color:#94a3b8">
                <i class="ti ti-check" aria-hidden="true"></i> Done
              </button>
            </div>
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

        ${(dietProfile.cuisines || []).length ? `
        <div class="diet-section">
          <div class="diet-section-label info">
            <i class="ti ti-info-circle" aria-hidden="true"></i> Best cuisine types for me
          </div>
          <div class="cuisine-tags">
            ${dietProfile.cuisines.map(c => `<span class="cuisine-tag">${escAttr(c)}</span>`).join('')}
          </div>
        </div>` : ''}
      </div>`;
  }
}

// ── Diet card actions ──
function printCard() { window.print(); }

function copyCard() {
  const active = getActiveRestrictions();
  const safe = getActiveSafeFoods();
  const text = `MY DIETARY NEEDS — Please read before taking my order

I CAN SAFELY EAT — please suggest one of these:
${safe.length ? safe.map(f => `• ${f.label}${f.note ? ` (${f.note})` : ''}`).join('\n') : '• (not listed yet — please ask me)'}

THE ONE RULE — nothing I order can contain:
${active.length ? active.map(r => `• ${r.label}`).join('\n') : '• (no restrictions listed)'}

IF UNSURE, PLEASE ASK THE KITCHEN:
"${askKitchenLine()}"`;

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

// ── First-run onboarding ──
// Can-eat-first setup: new users type ANY foods they eat — free entry, no
// preset list, because everyone's safe foods are personal. Hard no's get
// common-allergen chips (that set IS standard) plus free entry. Chips use
// event delegation + data attributes so user-typed labels with quotes
// can't break inline handlers.
const OB_RESTRICT_SUGGESTIONS = [
  'Garlic', 'Onions', 'Gluten', 'Dairy', 'Peanuts', 'Tree nuts', 'Shellfish', 'Fish', 'Eggs', 'Soy', 'Sesame or seeds', 'Meat', 'Pork', 'Spicy food', 'Mushrooms', 'Tomatoes', 'Raw vegetables', 'Sauces or gravies', 'Animal rennet in cheese', 'Whole grains or bran',
];

const obState = { step: 0, safe: new Set(), restrict: new Set() };

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function startOnboarding(prefill = false) {
  if (prefill) {
    // "Restart setup" from the diet card: begin from the current profile.
    obState.safe = new Set(getActiveSafeFoods().map(f => f.label));
    obState.restrict = new Set(getActiveRestrictions().map(r => r.label));
    obState.step = 1;
  } else {
    obState.step = 0;
  }
  document.getElementById('onboarding').style.display = 'flex';
  obRender();
}

function obChipRow(kind, items, selected) {
  return items.map(label => {
    const sel = selected.has(label);
    return `
    <button class="ob-chip ob-chip-${kind}${sel ? ' sel' : ''}" data-ob-kind="${kind}" data-ob-toggle="${escAttr(label)}" title="${sel ? 'Tap to remove' : 'Tap to add'}">
      ${sel && kind === 'restrict' ? '<i class="ti ti-check" aria-hidden="true"></i> ' : ''}${escAttr(label)}${sel && kind === 'safe' ? ' <span class="ob-chip-x" aria-hidden="true">×</span>' : ''}
    </button>`;
  }).join('');
}

function obRender() {
  const el = document.getElementById('onboarding');
  const { step, safe, restrict } = obState;
  const dots = [0, 1, 2, 3].map(i => `<span class="ob-dot${i === step ? ' on' : ''}"></span>`).join('');
  let body = '', footer = '';

  if (step === 0) {
    body = `
      <div class="ob-hero"><i class="ti ti-tools-kitchen-2" aria-hidden="true"></i></div>
      <div class="ob-title">Welcome to Menu<em>Match</em></div>
      <p class="ob-lead">Eating out with food issues is stressful. MenuMatch flips the script: tell us what you <strong>can</strong> eat, and we'll find restaurants — and specific dishes — that fit.</p>
      <p class="ob-lead-sub">Setup takes about a minute. Everything can be changed later.</p>
      ${window.mmCloudSignIn ? `
      <div class="ob-signin-row">
        <span>Already used MenuMatch?</span>
        <button class="ob-signin-btn" data-ob-action="signin">
          <i class="ti ti-brand-google" aria-hidden="true"></i> Sign in to restore your diet card
        </button>
      </div>` : ''}`;
    footer = `
      <button class="ob-skip" data-ob-action="skip">Skip for now</button>
      <button class="ob-next" data-ob-action="next">Let's set it up <i class="ti ti-arrow-right" aria-hidden="true"></i></button>`;
  } else if (step === 1) {
    // Free entry — YOUR foods, not a preset list. Enter or commas add fast.
    const mine = [...safe];
    body = `
      <div class="ob-title-sm">What do you eat?</div>
      <p class="ob-lead">Type anything you're comfortable ordering — favorite dishes, safe staples, exact preparations. This list powers your restaurant matches, and there are no wrong answers.</p>
      <div class="ob-add-row ob-main-add">
        <input class="ob-add-input" id="obSafeInput" type="text" placeholder='Try "chicken tenders, white rice, cheese quesadilla"...' data-ob-enter="safe">
        <button class="ob-add-btn" data-ob-action="addSafe"><i class="ti ti-plus" aria-hidden="true"></i> Add</button>
      </div>
      <div class="ob-hint">Press Enter to add — commas add several at once. Tap a food to remove it.</div>
      ${mine.length
        ? `<div class="ob-cat">Your foods (${mine.length})</div><div class="ob-chips">${obChipRow('safe', mine, safe)}</div>`
        : `<div class="ob-empty-list"><i class="ti ti-salad" aria-hidden="true"></i> Nothing yet — add your first food above.</div>`}`;
    footer = `
      <button class="ob-back" data-ob-action="back"><i class="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
      <span class="ob-count">${safe.size} added</span>
      <button class="ob-next" data-ob-action="next">Next <i class="ti ti-arrow-right" aria-hidden="true"></i></button>`;
  } else if (step === 2) {
    const suggested = new Set(OB_RESTRICT_SUGGESTIONS);
    const custom = [...restrict].filter(l => !suggested.has(l));
    body = `
      <div class="ob-title-sm">Anything that can never be in your food?</div>
      <p class="ob-lead">Allergies, intolerances, hard no's. This becomes <strong>the one rule</strong> every suggested dish must follow.</p>
      <div class="ob-chips">${obChipRow('restrict', OB_RESTRICT_SUGGESTIONS, restrict)}</div>
      ${custom.length ? `<div class="ob-cat">Your additions</div><div class="ob-chips">${obChipRow('restrict', custom, restrict)}</div>` : ''}
      <div class="ob-add-row">
        <input class="ob-add-input" id="obRestrictInput" type="text" placeholder="Add another..." data-ob-enter="restrict">
        <button class="ob-add-btn" data-ob-action="addRestrict"><i class="ti ti-plus" aria-hidden="true"></i> Add</button>
      </div>`;
    footer = `
      <button class="ob-back" data-ob-action="back"><i class="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
      <span class="ob-count">${restrict.size} selected</span>
      <button class="ob-next" data-ob-action="next">Next <i class="ti ti-arrow-right" aria-hidden="true"></i></button>`;
  } else {
    body = `
      <div class="ob-hero ob-hero-done"><i class="ti ti-checks" aria-hidden="true"></i></div>
      <div class="ob-title-sm" style="text-align:center">Your diet card is ready</div>
      <div class="ob-summary">
        <div class="ob-sum-block">
          <div class="ob-sum-label safe"><i class="ti ti-circle-check" aria-hidden="true"></i> Can eat (${safe.size})</div>
          <div class="ob-sum-text">${safe.size ? [...safe].slice(0, 8).map(escAttr).join(' · ') + (safe.size > 8 ? ` · +${safe.size - 8} more` : '') : '<em>None yet — you can add these any time</em>'}</div>
        </div>
        <div class="ob-sum-block">
          <div class="ob-sum-label avoid"><i class="ti ti-circle-x" aria-hidden="true"></i> Never (${restrict.size})</div>
          <div class="ob-sum-text">${restrict.size ? [...restrict].map(escAttr).join(' · ') : '<em>None listed</em>'}</div>
        </div>
      </div>
      <p class="ob-lead-sub" style="text-align:center">You can edit everything later from the Diet card tab.</p>`;
    footer = `
      <button class="ob-back" data-ob-action="back"><i class="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
      <button class="ob-next" data-ob-action="finish"><i class="ti ti-id-badge" aria-hidden="true"></i> Build my diet card</button>`;
  }

  el.innerHTML = `
    <div class="ob-card">
      <div class="ob-progress">${dots}</div>
      <div class="ob-body">${body}</div>
      <div class="ob-footer">${footer}</div>
    </div>`;

  // Typing is the primary interaction on the can-eat step — keep focus there.
  if (step === 1) {
    const input = document.getElementById('obSafeInput');
    if (input) input.focus();
  }
}

function obAdd(kind) {
  const inputId = kind === 'safe' ? 'obSafeInput' : 'obRestrictInput';
  const input = document.getElementById(inputId);
  if (!input) return;
  // Commas add several foods at once ("pizza, fries, plain rice").
  const labels = input.value.split(',').map(s => s.trim()).filter(Boolean);
  if (!labels.length) return;
  labels.forEach(l => obState[kind].add(l));
  obRender();
  const again = document.getElementById(inputId);
  if (again) again.focus();
}

function obFinish() {
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  // Preserve kitchen notes for foods that survive a "Restart setup".
  const prevNotes = Object.fromEntries((dietProfile.safeFoods || []).map(f => [f.label, f.note]));
  dietProfile = {
    safeFoods: [...obState.safe].map(l => ({ id: 'sf_' + slug(l), label: l, note: prevNotes[l] || '', active: true, custom: true })),
    restrictions: [...obState.restrict].map(l => ({ id: 'r_' + slug(l), label: l, active: true, custom: true })),
  };
  isFirstRun = false;
  saveProfile();
  renderDietCard();
  updateSidebarNote();
  document.getElementById('onboarding').style.display = 'none';
}

function obSkip() {
  isFirstRun = false;
  saveProfile(); // persist the empty profile so onboarding doesn't re-trigger
  renderDietCard();
  updateSidebarNote();
  document.getElementById('onboarding').style.display = 'none';
}

function obHandleClick(e) {
  const chip = e.target.closest('[data-ob-toggle]');
  if (chip) {
    const set = obState[chip.dataset.obKind];
    const label = chip.dataset.obToggle;
    if (set.has(label)) set.delete(label); else set.add(label);
    obRender();
    return;
  }
  const btn = e.target.closest('[data-ob-action]');
  if (!btn) return;
  const action = btn.dataset.obAction;
  if (action === 'next') { obState.step = Math.min(3, obState.step + 1); obRender(); }
  else if (action === 'back') { obState.step = Math.max(0, obState.step - 1); obRender(); }
  else if (action === 'skip') obSkip();
  else if (action === 'signin') { if (window.mmCloudSignIn) window.mmCloudSignIn(); }
  else if (action === 'finish') obFinish();
  else if (action === 'addSafe') obAdd('safe');
  else if (action === 'addRestrict') obAdd('restrict');
}

function obHandleKey(e) {
  if (e.key !== 'Enter') return;
  const t = e.target.closest ? e.target.closest('[data-ob-enter]') : null;
  if (t) obAdd(t.dataset.obEnter);
}

// ── Restaurant search ──
let allResults = [];
let activeFilter = 'all';
let currentCoords = null;

// Cuisine labels that should count as a match for each filter/profile
// cuisine (restaurant labels come from cuisineLabel() in api/search.js).
const CUISINE_MATCH_ALIASES = {
  'italian': ['italian', 'pizza'],
  'pizza': ['pizza', 'italian'],
  'japanese': ['japanese', 'sushi', 'ramen'],
  'sushi': ['sushi', 'japanese'],
  'ramen': ['ramen', 'japanese'],
  'indian': ['indian', 'south indian'],
  'south indian': ['south indian', 'indian'],
  'american': ['american', 'diner', 'burgers', 'breakfast'],
  'diner': ['diner', 'american', 'breakfast'],
  'burgers': ['burgers', 'american'],
  'eastern european': ['eastern european', 'polish', 'ukrainian'],
  'mediterranean': ['mediterranean', 'greek', 'middle eastern'],
  'greek': ['greek', 'mediterranean'],
  'middle eastern': ['middle eastern', 'mediterranean'],
  'breakfast & brunch': ['breakfast', 'brunch', 'diner', 'café'],
  'deli / sandwiches': ['deli', 'sandwich'],
};

function cuisineMatches(filterLabel, restaurantCuisine) {
  const f = (filterLabel || '').toLowerCase();
  const c = (restaurantCuisine || '').toLowerCase();
  const keys = CUISINE_MATCH_ALIASES[f] || [f];
  return keys.some(k => c.includes(k));
}

// A restaurant is a "good fit" when its cuisine matches one of the
// profile-derived cuisines — personal, not hardcoded.
function isSafeCuisine(cuisine) {
  return ((dietProfile && dietProfile.cuisines) || []).some(pc => cuisineMatches(pc, cuisine));
}

function renderCuisineFilters() {
  const row = document.getElementById('cuisineFilterRow');
  if (!row) return;
  const cuisines = (dietProfile && dietProfile.cuisines) || [];
  // If the active filter no longer exists (profile changed), fall back.
  if (activeFilter !== 'all' && !cuisines.some(c => c.toLowerCase() === activeFilter)) {
    activeFilter = 'all';
  }
  row.innerHTML = `<span class="filter-label">Filter:</span>
    <button class="filter-btn${activeFilter === 'all' ? ' active' : ''}" data-cuisine="all">All</button>
    ${cuisines.map(c => `<button class="filter-btn${activeFilter === c.toLowerCase() ? ' active' : ''}" data-cuisine="${escAttr(c.toLowerCase())}">${escAttr(c)}</button>`).join('')}
    ${cuisines.length ? '<span class="filter-hint">— your best-fit cuisines</span>' : '<span class="filter-hint">— add foods to your diet card to get cuisine suggestions</span>'}`;
}

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

  let filtered = restaurants;
  if (activeFilter !== 'all') {
    // Alias-aware matching against the profile-derived filter labels.
    filtered = restaurants.filter(r => cuisineMatches(activeFilter, r.cuisine));
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
          ${safe ? `<span class="safe-badge">Good fit for you</span>` : ''}
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
  const restrictionList = active.map(x => x.label.toLowerCase()).join(', ');
  // Lead with what the diner CAN eat: prefer dishes matched to this
  // restaurant, fall back to the profile's own safe foods.
  const fromAi = (r.aiDishes || []).slice(0, 3).map(d => `  • ${d.dish}`);
  const fromProfile = getActiveSafeFoods().slice(0, 3).map(f => `  • ${f.label}`);
  const hopes = fromAi.length ? fromAi : fromProfile;
  const script = `Hi! I'm hoping to visit ${r.name}, and I wanted to check whether the kitchen could make something I can eat.
${hopes.length ? `\nDishes like these usually work well for me:\n${hopes.join('\n')}\n` : ''}${restrictionList ? `\nThe one rule: nothing I order can contain ${restrictionList}.\n` : ''}
Would the kitchen be able to prepare one of those — or suggest something else on your menu that fits?

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
  const aiDishes = (r.aiDishes || []).slice(0, 4).map(d => `  • ${d.dish} — ${d.note}`).join('\n');
  const profileDishes = getActiveSafeFoods().slice(0, 4).map(f => `  • ${f.label}${f.note ? ` — ${f.note}` : ''}`).join('\n');
  const dishes = aiDishes || profileDishes;
  const active = getActiveRestrictions();
  const text = `${r.name}
${r.address}${r.phone ? '\n' + r.phone : ''}${r.mapsUrl ? '\n' + r.mapsUrl : ''}

Things I can likely order here:
${dishes || '  • Ask which dishes can be made to fit my diet'}

${active.length ? `The one rule: nothing can contain ${active.map(r => r.label.toLowerCase()).join(', ')}.` : ''}`;

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
renderCuisineFilters();
// Filter buttons are re-rendered from the profile — delegate clicks.
const filterRow = document.getElementById('cuisineFilterRow');
if (filterRow) {
  filterRow.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (btn) setFilter(btn, btn.dataset.cuisine);
  });
}
// Restore last searched location
const lastLoc = localStorage.getItem('mm_last_location');
if (lastLoc) document.getElementById('locationInput').value = lastLoc;
// Onboarding: delegated events (labels are user-typed — no inline handlers)
const obEl = document.getElementById('onboarding');
if (obEl) {
  obEl.addEventListener('click', obHandleClick);
  obEl.addEventListener('keydown', obHandleKey);
}
if (isFirstRun) startOnboarding();
// Existing users may predate derived cuisines — compute on load if stale.
scheduleCuisineRefresh();

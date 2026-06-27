// ── Tab navigation ──
function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
}

// ── Saved places ──
let savedPlaces = JSON.parse(localStorage.getItem('mm_saved') || '[]');

function savePlaces() {
  localStorage.setItem('mm_saved', JSON.stringify(savedPlaces));
  const count = savedPlaces.length;
  const badge = document.getElementById('savedCount');
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
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

let dietProfile = null;
let cardEditMode = false;

function loadProfile() {
  const stored = localStorage.getItem('mm_profile');
  if (stored) {
    try { dietProfile = JSON.parse(stored); } catch { dietProfile = null; }
  }
  if (!dietProfile) {
    dietProfile = { restrictions: DEFAULT_RESTRICTIONS.map(r => ({ ...r })) };
    saveProfile();
  }
}

function saveProfile() {
  localStorage.setItem('mm_profile', JSON.stringify(dietProfile));
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
  el.innerHTML = `<i class="ti ti-leaf" aria-hidden="true"></i> Profile: vegetarian, ${active.map(r => r.label.toLowerCase()).join(', ')}.`;
}

function renderDietCard() {
  const container = document.getElementById('dietCard');
  if (!container) return;

  const active = dietProfile.restrictions.filter(r => r.active);
  const inactive = dietProfile.restrictions.filter(r => !r.active);

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
            "Can this dish be prepared <strong>without garlic or onion</strong>? I have a medical intolerance."
          </div>
        </div>

        <div class="diet-section">
          <div class="diet-section-label safe">
            <i class="ti ti-circle-check" aria-hidden="true"></i> I can safely eat
          </div>
          <div class="safe-grid">
            <div class="safe-category">
              <div class="safe-cat-label">Cheese</div>
              <ul>
                <li>Mozzarella (rennet-free)</li>
                <li>Ricotta</li>
                <li>Farmer's cheese</li>
                <li>Some cheddar or Swiss</li>
                <li>Parmesan — only if labelled vegetarian</li>
              </ul>
            </div>
            <div class="safe-category">
              <div class="safe-cat-label">Dishes</div>
              <ul>
                <li>White pizza (no garlic)</li>
                <li>Pasta with passata sauce</li>
                <li>Pierogi — potato &amp; cheese</li>
                <li>Plain dosa (South Indian)</li>
                <li>Masoor dal — without onion/garlic</li>
                <li>Mashed potatoes (with milk, no gravy)</li>
                <li>Potato casserole</li>
                <li>Baked plain tofu</li>
                <li>Eggs (as part of a dish)</li>
              </ul>
            </div>
            <div class="safe-category">
              <div class="safe-cat-label">Staples</div>
              <ul>
                <li>White rice</li>
                <li>White flour pasta</li>
                <li>Sourdough bread (no seeds)</li>
                <li>Passata (strained tomato)</li>
                <li>Milk</li>
                <li>Plain tofu</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="diet-section">
          <div class="diet-section-label info">
            <i class="ti ti-info-circle" aria-hidden="true"></i> Best cuisine types
          </div>
          <div class="cuisine-tags">
            <span class="cuisine-tag">South Indian</span>
            <span class="cuisine-tag">Italian</span>
            <span class="cuisine-tag">Eastern European</span>
            <span class="cuisine-tag">Japanese (plain tofu/rice)</span>
          </div>
        </div>
      </div>`;
  }
}

// ── Diet card actions ──
function printCard() { window.print(); }

function copyCard() {
  const active = getActiveRestrictions();
  const text = `MY DIETARY NEEDS — Please read before taking my order

I CANNOT EAT:
${active.map(r => `• ${r.label}`).join('\n')}

PLEASE ASK THE KITCHEN:
"Can this dish be prepared without garlic or onion? I have a medical intolerance."

I CAN SAFELY EAT:
Cheese: Mozzarella (rennet-free), Ricotta, Farmer's cheese, some Cheddar or Swiss, Parmesan only if labelled vegetarian
Dishes: White pizza (no garlic), Pasta with passata sauce, Pierogi (potato & cheese), Plain dosa, Masoor dal without onion/garlic, Mashed potatoes with milk (no gravy), Potato casserole, Plain baked tofu, Eggs as part of a dish
Staples: White rice, White flour pasta, Sourdough bread (no seeds), Passata, Milk

BEST CUISINES: South Indian, Italian, Eastern European, Japanese`;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('[onclick="copyCard()"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
}

// ── Safe dish suggestions by cuisine ──
const CUISINE_SAFE_DISHES = [
  {
    keywords: ['south indian', 'dosa', 'idli', 'udupi'],
    dishes: [
      { dish: 'Plain dosa', note: 'Ask: no onion or garlic in batter or filling' },
      { dish: 'Masoor dal (split red lentils)', note: 'Ask: prepared without onion or garlic' },
      { dish: 'Idli with plain sambar', note: 'Ask: sambar without onion or garlic' },
      { dish: 'Steamed white rice', note: 'Safe as-is' },
    ]
  },
  {
    keywords: ['indian', 'curry', 'tandoor', 'punjabi', 'bengali'],
    dishes: [
      { dish: 'Plain basmati rice', note: 'Safe as-is' },
      { dish: 'Dal (split red lentils)', note: 'Ask: no onion or garlic' },
      { dish: 'Paneer dishes', note: 'Ask: no onion or garlic, confirm rennet-free cheese' },
      { dish: 'Plain naan or roti', note: 'Ask: no seeds, no garlic butter' },
    ]
  },
  {
    keywords: ['italian', 'pizza', 'pasta', 'trattoria', 'osteria', 'pizzeria', 'ristorante'],
    dishes: [
      { dish: 'White pizza (pizza bianca)', note: 'Ask: no garlic in dough or topping' },
      { dish: 'Pasta with passata', note: 'Ask: plain strained tomato sauce, no garlic or onion' },
      { dish: 'Ricotta dishes', note: 'Ask: no garlic' },
      { dish: 'Mozzarella (rennet-free)', note: 'Confirm rennet-free with kitchen' },
      { dish: 'Parmesan — only if labelled vegetarian', note: 'Ask staff to confirm no animal rennet' },
    ]
  },
  {
    keywords: ['eastern european', 'polish', 'ukrainian', 'pierogi', 'polish', 'slavic'],
    dishes: [
      { dish: 'Pierogi (potato & farmer\'s cheese)', note: 'Ask: no onion in filling or topping' },
      { dish: 'Mashed potatoes', note: 'Ask: with milk only, no gravy or onion' },
      { dish: 'Potato casserole', note: 'Ask: no onion or garlic' },
    ]
  },
  {
    keywords: ['japanese', 'sushi', 'ramen', 'izakaya', 'tempura'],
    dishes: [
      { dish: 'Steamed white rice', note: 'Safe as-is' },
      { dish: 'Plain baked or steamed tofu', note: 'Ask: no garlic or onion in marinade' },
      { dish: 'Edamame', note: 'Safe as-is' },
      { dish: 'Miso soup', note: 'Ask: no onion, confirm vegetarian dashi' },
    ]
  },
  {
    keywords: ['mediterranean', 'greek', 'levantine', 'middle eastern'],
    dishes: [
      { dish: 'White rice dishes', note: 'Ask: no garlic or onion' },
      { dish: 'Halloumi', note: 'Confirm vegetarian rennet with kitchen' },
      { dish: 'Plain flatbread (no seeds)', note: 'Ask: no sesame seeds' },
    ]
  },
  {
    keywords: ['vegetarian', 'vegan', 'plant-based'],
    dishes: [
      { dish: 'Rice or pasta dishes', note: 'Ask: no garlic or onion in preparation' },
      { dish: 'Tofu dishes', note: 'Ask: plain preparation, no garlic or onion' },
      { dish: 'Egg dishes', note: 'Fine as part of a dish' },
    ]
  },
  {
    keywords: ['american', 'diner', 'cafe', 'coffee', 'grill', 'bistro', 'restaurant', 'bar', 'pub', 'tavern', 'kitchen', 'eatery', 'food', 'brewery', 'winery', 'farm', 'market', 'bakery', 'brasserie', 'steakhouse', 'seafood', 'brunch'],
    dishes: [
      { dish: 'Mashed potatoes', note: 'Ask: with milk only, no gravy, no onion or garlic' },
      { dish: 'Scrambled or fried eggs', note: 'Ask: no onion or garlic' },
      { dish: 'White rice (if available)', note: 'Ask: plain, no seasoning with garlic or onion' },
      { dish: 'Plain cheese pizza (if available)', note: 'Ask: rennet-free mozzarella, no garlic' },
    ]
  },
];

// Always shown at the bottom of every card
const UNIVERSAL_TIPS = [
  { dish: 'Always ask', note: '"Can this be prepared without garlic or onion? I have a medical intolerance."' },
  { dish: 'Cheese check', note: 'Ask: "Is the cheese made without animal rennet?" (mozzarella & ricotta usually safe)' },
];

function getSafeDishes(cuisine) {
  const c = (cuisine || '').toLowerCase();
  for (const group of CUISINE_SAFE_DISHES) {
    if (group.keywords.some(k => c.includes(k))) {
      return [...group.dishes, ...UNIVERSAL_TIPS];
    }
  }
  // Generic fallback — always show actual dish suggestions, not just tips
  const generic = CUISINE_SAFE_DISHES[CUISINE_SAFE_DISHES.length - 1];
  return [...generic.dishes, ...UNIVERSAL_TIPS];
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

  let filtered = restaurants;
  if (activeFilter !== 'all') {
    filtered = restaurants.filter(r => (r.cuisine || '').toLowerCase().includes(activeFilter));
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

  if (!filtered.length) {
    area.innerHTML = `<div class="results-header">0 results for this filter — <button onclick="setFilter(document.querySelector('[data-cuisine=all]'), 'all')" style="background:none;border:none;color:var(--amber);cursor:pointer;font-size:12px;">show all</button></div>`;
    return;
  }

  const savedIds = new Set(savedPlaces.map(p => p.id));

  // Store in global map so onclick can reference by ID
  filtered.forEach(r => { window.__rmap[r.id] = r; });

  // Today's weekday index for opening hours (Google: Mon=0 ... Sun=6)
  const day = new Date().getDay();
  const todayIdx = day === 0 ? 6 : day - 1;

  area.innerHTML = `<div class="results-header">${filtered.length} restaurant${filtered.length === 1 ? '' : 's'} found — sorted by distance</div>` +
    filtered.map(r => {
      const safe = isSafeCuisine(r.cuisine);
      const dist = distanceText(currentCoords, r.location);
      const isSaved = savedIds.has(r.id);
      const safeDishes = r.aiDishes || getSafeDishes(r.cuisine);
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
          ${r.phone ? `<div class="r-detail-row"><i class="ti ti-phone" aria-hidden="true"></i><a href="tel:${r.phone}">${r.phone}</a></div>` : ''}
          ${r.mapsUrl ? `<div class="r-detail-row"><i class="ti ti-external-link" aria-hidden="true"></i><a href="${r.mapsUrl}" target="_blank" rel="noopener">View on Google Maps</a></div>` : ''}
        </div>

        <div class="r-safe-dishes">
          <div class="r-safe-dishes-label"><i class="ti ti-circle-check" aria-hidden="true"></i> Likely safe to order${r.aiDishes ? ' <span style="font-size:9px;font-weight:400;opacity:0.7;letter-spacing:0">· AI suggestions</span>' : ''}</div>
          ${safeDishes.map(d => `<div class="r-dish-row"><span class="r-dish-name">${d.dish}</span><span class="r-dish-note">${d.note}</span></div>`).join('')}
        </div>

        ${r.aiDishes ? `<div class="r-ai-note">Suggestions based on cuisine type — always confirm with staff</div>` : ''}

        <div class="r-actions">
          <div class="r-card-btns">
            <button class="r-save-btn ${isSaved ? 'saved' : ''}" data-save-id="${eid}" onclick="saveRestaurant(window.__rmap['${eid}'])">
              <i class="ti ti-${isSaved ? 'heart-filled' : 'heart'}" aria-hidden="true"></i> ${isSaved ? 'Saved' : 'Save'}
            </button>
            <button class="r-action-btn" onclick="showCallScript('${eid}')">
              <i class="ti ti-phone" aria-hidden="true"></i> Call script
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
  const script = `Hi, I have a question about dietary accommodations before we visit ${r.name}.

My guest has dietary restrictions and cannot eat: ${restrictionList}.

She also needs cheese made without animal rennet. Mozzarella and ricotta are usually fine, but we'd need to confirm for anything else like parmesan or cheddar.
${dishes ? `\nBased on your menu, we were hoping to order:\n${dishes}\n\nWould the kitchen be able to prepare those without the ingredients I mentioned?` : '\nCould you tell us which dishes on your menu could be prepared without those ingredients?'}

Thank you so much — we really appreciate it.`;

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
${dishes || '  • Ask about plain dishes without garlic or onion'}

Tell them: vegetarian, cannot eat ${active.map(r => r.label.toLowerCase()).join(', ')}.`;

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
    const restrictionsParam = `&restrictions=${encodeURIComponent(activeRestrictions)}`;
    const params = currentCoords && loc === 'Current location'
      ? `lat=${currentCoords.lat}&lng=${currentCoords.lng}&radius=${radiusKm}${restrictionsParam}`
      : `location=${encodeURIComponent(loc)}&radius=${radiusKm}${restrictionsParam}`;
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

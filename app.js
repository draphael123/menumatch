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
  savedPlaces.push({ ...r, note: '', savedAt: Date.now() });
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
    </div>`).join('');
}

// ── Diet card actions ──
function printCard() { window.print(); }

function copyCard() {
  const text = `MY DIETARY NEEDS — Please read before taking my order

I CANNOT EAT:
• Garlic or onions (medical intolerance)
• Meat or fish (vegetarian)
• Seeds of any kind
• Cheese made with animal rennet
• Gravy
• Whole grains or bran

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
const CUISINE_SAFE_DISHES = {
  'south indian': [
    { dish: 'Plain dosa', note: 'Ask: no onion or garlic in batter or filling' },
    { dish: 'Masoor dal', note: 'Ask: prepared without onion or garlic' },
    { dish: 'Idli with plain sambar', note: 'Ask: sambar without onion or garlic' },
    { dish: 'Plain rice', note: 'Safe as-is' },
  ],
  'indian': [
    { dish: 'Plain basmati rice', note: 'Safe as-is' },
    { dish: 'Dal (split red lentils)', note: 'Ask: no onion or garlic' },
    { dish: 'Paneer dishes', note: 'Ask: no onion or garlic, check rennet-free' },
  ],
  'italian': [
    { dish: 'White pizza (bianca)', note: 'Ask: no garlic in the dough or topping' },
    { dish: 'Pasta with passata', note: 'Ask: plain tomato sauce, no garlic or onion' },
    { dish: 'Ricotta dishes', note: 'Ask: no garlic' },
    { dish: 'Mozzarella (rennet-free)', note: 'Confirm rennet-free with kitchen' },
  ],
  'eastern european': [
    { dish: 'Pierogi (potato & cheese)', note: 'Ask: farmer\'s cheese filling, no onion' },
    { dish: 'Mashed potatoes', note: 'Ask: with milk only, no gravy or onion' },
    { dish: 'Potato casserole', note: 'Ask: no onion or garlic' },
  ],
  'polish': [
    { dish: 'Pierogi ruskie', note: 'Ask: potato & cheese filling, no onion topping' },
    { dish: 'Potato pancakes', note: 'Ask: no onion' },
  ],
  'ukrainian': [
    { dish: 'Varenyky (potato & cheese)', note: 'Ask: no onion in filling or topping' },
  ],
  'japanese': [
    { dish: 'Steamed white rice', note: 'Safe as-is' },
    { dish: 'Plain baked or steamed tofu', note: 'Ask: no garlic or onion in marinade' },
    { dish: 'Miso soup', note: 'Ask: no onion, confirm vegetarian dashi' },
    { dish: 'Edamame', note: 'Safe as-is' },
  ],
  'vegetarian': [
    { dish: 'Check menu for rice, pasta, or egg dishes', note: 'Ask: no garlic or onion in preparation' },
  ],
  'vegan': [
    { dish: 'Plain rice or tofu dishes', note: 'Ask: no garlic or onion' },
  ],
  'mediterranean': [
    { dish: 'White rice dishes', note: 'Ask: no garlic or onion' },
    { dish: 'Halloumi (check rennet-free)', note: 'Confirm vegetarian rennet' },
  ],
};

function getSafeDishes(cuisine) {
  const c = (cuisine || '').toLowerCase();
  for (const [key, dishes] of Object.entries(CUISINE_SAFE_DISHES)) {
    if (c.includes(key)) return dishes;
  }
  return [];
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

function distanceText(userCoords, loc) {
  if (!userCoords || !loc) return '';
  const R = 3958.8;
  const dLat = (loc.latitude - userCoords.lat) * Math.PI / 180;
  const dLon = (loc.longitude - userCoords.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(userCoords.lat * Math.PI/180) * Math.cos(loc.latitude * Math.PI/180) * Math.sin(dLon/2)**2;
  const miles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return miles < 0.1 ? 'nearby' : `${miles.toFixed(1)} mi`;
}

function setFilter(btn, cuisine) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = cuisine;
  renderResults(allResults);
}

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

  // Sort: safe cuisines first, then by rating
  filtered.sort((a, b) => {
    const aS = isSafeCuisine(a.cuisine) ? 1 : 0;
    const bS = isSafeCuisine(b.cuisine) ? 1 : 0;
    if (bS !== aS) return bS - aS;
    return (b.rating || 0) - (a.rating || 0);
  });

  if (!filtered.length) {
    area.innerHTML = `<div class="results-header">0 results for this filter — <button onclick="setFilter(document.querySelector('[data-cuisine=all]'), 'all')" style="background:none;border:none;color:var(--amber);cursor:pointer;font-size:12px;">show all</button></div>`;
    return;
  }

  const savedIds = new Set(savedPlaces.map(p => p.id));

  area.innerHTML = `<div class="results-header">${filtered.length} restaurant${filtered.length === 1 ? '' : 's'} found — safe cuisines shown first</div>` +
    filtered.map(r => {
      const safe = isSafeCuisine(r.cuisine);
      const dist = distanceText(currentCoords, r.location);
      const isSaved = savedIds.has(r.id);
      const safeDishes = getSafeDishes(r.cuisine);
      const rJson = JSON.stringify(r).replace(/'/g, "&#39;");

      return `<div class="r-card${safe ? ' r-card-safe' : ''}">
        <div class="r-card-header">
          <div class="r-icon">${cuisineIcon(r.cuisine)}</div>
          <div class="r-meta">
            <div class="r-name">${r.name}</div>
            <div class="r-sub">
              ${r.rating ? `<span class="r-stars">${'★'.repeat(Math.floor(r.rating))}</span><span>${r.rating.toFixed(1)}</span><span>·</span>` : ''}
              <span>${r.cuisine}</span>
              ${dist ? `<span>·</span><span>${dist}</span>` : ''}
            </div>
          </div>
          ${safe ? `<span class="safe-badge">Safe cuisine</span>` : ''}
        </div>

        <div class="r-details">
          ${r.address ? `<div class="r-detail-row"><i class="ti ti-map-pin" aria-hidden="true"></i><span>${r.address}</span></div>` : ''}
          ${r.phone ? `<div class="r-detail-row"><i class="ti ti-phone" aria-hidden="true"></i><a href="tel:${r.phone}">${r.phone}</a></div>` : ''}
          ${r.mapsUrl ? `<div class="r-detail-row"><i class="ti ti-external-link" aria-hidden="true"></i><a href="${r.mapsUrl}" target="_blank" rel="noopener">View menu on Google Maps</a></div>` : ''}
        </div>

        ${safeDishes.length ? `
        <div class="r-safe-dishes">
          <div class="r-safe-dishes-label"><i class="ti ti-circle-check" aria-hidden="true"></i> Likely safe to order</div>
          ${safeDishes.map(d => `
            <div class="r-dish-row">
              <span class="r-dish-name">${d.dish}</span>
              <span class="r-dish-note">${d.note}</span>
            </div>`).join('')}
        </div>` : ''}

        <div class="r-actions">
          <button class="r-save-btn ${isSaved ? 'saved' : ''}" data-save-id="${r.id}" onclick='saveRestaurant(${rJson})'>
            <i class="ti ti-${isSaved ? 'heart-filled' : 'heart'}" aria-hidden="true"></i> ${isSaved ? 'Saved' : 'Save place'}
          </button>
        </div>
      </div>`;
    }).join('');
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
  const area = document.getElementById('resultsArea');
  area.innerHTML = `<div class="empty-state"><i class="ti ti-loader empty-icon spinning" aria-hidden="true"></i><div class="empty-title">Searching…</div></div>`;
  try {
    const params = currentCoords && loc === 'Current location'
      ? `lat=${currentCoords.lat}&lng=${currentCoords.lng}`
      : `location=${encodeURIComponent(loc)}`;
    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    if (data.coords) currentCoords = data.coords;
    allResults = data.restaurants;
    renderResults(allResults);
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><i class="ti ti-alert-circle empty-icon" aria-hidden="true"></i><div class="empty-title">Search failed</div><div class="empty-sub">${err.message}</div></div>`;
  }
}

// ── Init ──
savePlaces();
renderSaved();

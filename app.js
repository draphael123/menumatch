let foods = JSON.parse(localStorage.getItem('mm_foods') || '["chicken","salmon","rice","broccoli"]');

function saveFoods() {
  localStorage.setItem('mm_foods', JSON.stringify(foods));
}

function renderTags() {
  const container = document.getElementById('foodTags');
  container.innerHTML = foods.map((f, i) =>
    `<span class="food-tag">${f}<button onclick="removeFood(${i})" aria-label="Remove ${f}"><i class="ti ti-x" aria-hidden="true" style="font-size:11px"></i></button></span>`
  ).join('');
  document.getElementById('foodCount').textContent = foods.length
    ? `${foods.length} food${foods.length === 1 ? '' : 's'} in your list`
    : 'Add foods above to start matching';
}

function addFood() {
  const input = document.getElementById('foodInput');
  const val = input.value.trim().toLowerCase();
  if (val && !foods.includes(val) && foods.length < 20) {
    foods.push(val);
    saveFoods();
    renderTags();
  }
  input.value = '';
  input.focus();
}

function removeFood(i) {
  foods.splice(i, 1);
  saveFoods();
  renderTags();
}

document.getElementById('foodInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addFood();
});

function cuisineIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('sushi') || t.includes('japanese')) return '🍱';
  if (t.includes('pizza') || t.includes('italian')) return '🍕';
  if (t.includes('burger') || t.includes('american')) return '🍔';
  if (t.includes('taco') || t.includes('mexican')) return '🌮';
  if (t.includes('chinese') || t.includes('asian') || t.includes('wok')) return '🥡';
  if (t.includes('indian') || t.includes('curry')) return '🍛';
  if (t.includes('seafood') || t.includes('fish')) return '🐟';
  if (t.includes('bbq') || t.includes('grill')) return '🥩';
  if (t.includes('cafe') || t.includes('coffee')) return '☕';
  if (t.includes('thai')) return '🍜';
  if (t.includes('mediterranean') || t.includes('greek')) return '🥗';
  return '🍽️';
}

function distanceText(userCoords, restaurantLocation) {
  if (!userCoords || !restaurantLocation) return '';
  const R = 3958.8;
  const dLat = (restaurantLocation.latitude - userCoords.lat) * Math.PI / 180;
  const dLon = (restaurantLocation.longitude - userCoords.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(userCoords.lat * Math.PI/180) * Math.cos(restaurantLocation.latitude * Math.PI/180) * Math.sin(dLon/2)**2;
  const miles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return miles < 0.1 ? 'nearby' : `${miles.toFixed(1)} mi`;
}

function matchCuisine(cuisine) {
  if (!foods.length) return { matchedFoods: [], pct: 0 };
  const cl = cuisine.toLowerCase();
  const matchedFoods = foods.filter(f => cl.includes(f));
  return {
    matchedFoods,
    pct: Math.round(matchedFoods.length / foods.length * 100)
  };
}

function pillClass(pct) {
  if (pct >= 50) return 'match-high';
  if (pct >= 25) return 'match-mid';
  if (pct > 0)   return 'match-low';
  return 'match-none';
}

function renderResults(restaurants, userCoords) {
  const area = document.getElementById('resultsArea');
  if (!restaurants.length) {
    area.innerHTML = '<div class="empty-state"><i class="ti ti-circle-x empty-icon" aria-hidden="true"></i><div class="empty-title">No restaurants found nearby</div><div class="empty-sub">Try a different location or zoom out</div></div>';
    return;
  }

  const noFoods = !foods.length;
  const scored = restaurants.map(r => {
    const { matchedFoods: mf, pct } = matchCuisine(r.cuisine);
    return { ...r, matchedFoods: mf, pct };
  });
  scored.sort((a, b) => b.pct - a.pct || (b.rating || 0) - (a.rating || 0));

  const headerEl = `<div class="results-header">${scored.length} restaurants found near you${noFoods ? ' — add foods to see matches' : ''}</div>`;

  const cards = scored.map((r, idx) => {
    const { matchedFoods: mf, pct } = r;
    const pillLabel = noFoods
      ? 'Add foods to match'
      : (mf.length ? `Serves ${mf.join(', ')}` : 'No direct matches');
    const pc = noFoods ? 'match-none' : pillClass(pct);
    const stars = r.rating ? `${'★'.repeat(Math.floor(r.rating))}${'☆'.repeat(5 - Math.floor(r.rating))}` : '';
    const dist = distanceText(userCoords, r.location);
    const icon = cuisineIcon(r.cuisine);

    return `<div class="r-card" id="card${idx}">
      <div class="r-card-header">
        <div class="r-icon">${icon}</div>
        <div class="r-meta">
          <div class="r-name">${r.name}</div>
          <div class="r-sub">
            ${r.rating ? `<span class="r-stars">${stars}</span><span>${r.rating.toFixed(1)}</span><span>·</span>` : ''}
            <span>${r.cuisine}</span>
            ${dist ? `<span>·</span><span>${dist}</span>` : ''}
            ${r.ratingCount ? `<span>·</span><span>${r.ratingCount.toLocaleString()} reviews</span>` : ''}
          </div>
          <div class="r-address">${r.address}</div>
        </div>
        <span class="match-pill ${pc}">${pillLabel}</span>
      </div>
    </div>`;
  }).join('');

  area.innerHTML = headerEl + cards;
}

let currentCoords = null;

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
    () => { input.value = ''; input.placeholder = 'Enter a location…'; }
  );
}

async function runSearch() {
  const loc = document.getElementById('locationInput').value.trim();
  if (!loc) return;

  const area = document.getElementById('resultsArea');
  area.innerHTML = `<div class="empty-state"><i class="ti ti-loader empty-icon spinning" aria-hidden="true"></i><div class="empty-title">Searching restaurants…</div></div>`;

  try {
    const params = currentCoords && loc === 'Current location'
      ? `lat=${currentCoords.lat}&lng=${currentCoords.lng}`
      : `location=${encodeURIComponent(loc)}`;

    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Search failed');

    if (data.coords) currentCoords = data.coords;
    renderResults(data.restaurants, currentCoords);
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><i class="ti ti-alert-circle empty-icon" aria-hidden="true"></i><div class="empty-title">Search failed</div><div class="empty-sub">${err.message}</div></div>`;
  }
}

renderTags();

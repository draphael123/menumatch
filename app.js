const MOCK_RESTAURANTS = [
  {
    name: "Coral Reef Grill", icon: "🐟", cuisine: "Seafood", rating: 4.7, dist: "0.3 mi",
    dishes: ["Grilled Salmon with Lemon Butter", "Salmon Rice Bowl", "Tuna Steak with Steamed Broccoli", "Shrimp Pasta", "Lobster Bisque", "Caesar Salad", "Pan-Seared Cod with Rice Pilaf", "Steamed Broccoli Side"]
  },
  {
    name: "Verde Kitchen", icon: "🥗", cuisine: "Mediterranean", rating: 4.5, dist: "0.6 mi",
    dishes: ["Chicken Souvlaki Plate", "Grilled Chicken over Rice", "Falafel Bowl", "Lemon Herb Salmon", "Spanakopita", "Greek Salad", "Steamed Vegetables", "Rice Pilaf", "Broccoli Hummus Wrap"]
  },
  {
    name: "Dragon Bowl", icon: "🍜", cuisine: "Asian Fusion", rating: 4.3, dist: "0.8 mi",
    dishes: ["Chicken Stir Fry with Broccoli", "Salmon Teriyaki Bowl", "Steamed Rice", "Beef Bulgogi", "Shrimp Fried Rice", "Tofu Broccoli Bowl", "Duck Confit", "Noodle Soup", "Edamame"]
  },
  {
    name: "The Burger Barn", icon: "🍔", cuisine: "American", rating: 4.1, dist: "1.1 mi",
    dishes: ["Classic Cheeseburger", "Bacon Burger", "Chicken Sandwich", "Grilled Chicken Wrap", "Loaded Fries", "Onion Rings", "Buffalo Wings", "Mac & Cheese", "Milkshakes"]
  },
  {
    name: "Mamma Rosa", icon: "🍝", cuisine: "Italian", rating: 4.8, dist: "1.4 mi",
    dishes: ["Spaghetti Bolognese", "Chicken Parmigiana", "Grilled Salmon Fettuccine", "Risotto", "Broccoli Rabe Pasta", "Caesar Salad", "Beef Lasagna", "Tiramisu", "Garlic Bread"]
  },
  {
    name: "Taco Loco", icon: "🌮", cuisine: "Mexican", rating: 4.2, dist: "1.6 mi",
    dishes: ["Chicken Tacos", "Beef Burrito", "Rice and Beans", "Grilled Chicken Quesadilla", "Fish Tacos with Rice", "Shrimp Tacos", "Guacamole", "Elote", "Carnitas Bowl"]
  },
  {
    name: "Sakura Sushi", icon: "🍱", cuisine: "Japanese", rating: 4.9, dist: "2.0 mi",
    dishes: ["Salmon Nigiri", "Tuna Sashimi", "Chicken Teriyaki Bento", "Salmon Roll", "Avocado Rice Bowl", "Miso Soup", "Edamame", "Chicken Gyoza", "Tempura Shrimp", "Steamed Rice"]
  },
  {
    name: "Farm & Fire", icon: "🥩", cuisine: "American BBQ", rating: 4.4, dist: "2.3 mi",
    dishes: ["Smoked Brisket", "BBQ Chicken Plate", "Pulled Pork Sandwich", "Grilled Salmon", "Cornbread", "Collard Greens", "Baked Beans", "Mac & Cheese", "Sweet Potato Fries"]
  }
];

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

function matchDishes(dishes) {
  if (!foods.length) return { matched: [], matchedFoods: [], pct: 0 };
  const matched = [];
  const matchedFoods = new Set();
  dishes.forEach(dish => {
    const dl = dish.toLowerCase();
    const hits = foods.filter(f => dl.includes(f));
    if (hits.length) {
      matched.push({ dish, foods: hits });
      hits.forEach(h => matchedFoods.add(h));
    }
  });
  return {
    matched,
    matchedFoods: [...matchedFoods],
    pct: foods.length ? Math.round(matchedFoods.size / foods.length * 100) : 0
  };
}

function pillClass(pct) {
  if (pct >= 50) return 'match-high';
  if (pct >= 25) return 'match-mid';
  if (pct > 0)   return 'match-low';
  return 'match-none';
}

function toggleDishes(idx) {
  const el = document.getElementById('dishes' + idx);
  const icon = document.getElementById('expIcon' + idx);
  const opening = el.style.display === 'none';
  el.style.display = opening ? 'flex' : 'none';
  icon.style.transform = opening ? 'rotate(180deg)' : '';
}

function renderResults(restaurants) {
  const area = document.getElementById('resultsArea');
  if (!restaurants.length) {
    area.innerHTML = '<div class="empty-state"><i class="ti ti-circle-x empty-icon" aria-hidden="true"></i><div class="empty-title">No restaurants found</div></div>';
    return;
  }

  const noFoods = !foods.length;
  const scored = restaurants.map(r => {
    const m = matchDishes(r.dishes);
    return { ...r, ...m };
  });
  scored.sort((a, b) => b.pct - a.pct);

  const headerEl = `<div class="results-header">${scored.length} restaurants found${noFoods ? ' — add foods to see matches' : ''}</div>`;

  const cards = scored.map((r, idx) => {
    const { matched, matchedFoods: mf, pct } = r;
    const pillLabel = noFoods
      ? 'Add foods to match'
      : (mf.length ? `${mf.length}/${foods.length} foods matched` : 'No matches');
    const pc = noFoods ? 'match-none' : pillClass(pct);

    const unmatchedDishes = r.dishes.filter(d => !matched.find(m => m.dish === d));

    return `<div class="r-card" id="card${idx}">
      <div class="r-card-header">
        <div class="r-icon">${r.icon}</div>
        <div class="r-meta">
          <div class="r-name">${r.name}</div>
          <div class="r-sub">
            <span class="r-stars">${'★'.repeat(Math.floor(r.rating))}${'☆'.repeat(5 - Math.floor(r.rating))}</span>
            <span>${r.rating}</span><span>·</span><span>${r.cuisine}</span><span>·</span><span>${r.dist}</span>
          </div>
        </div>
        <span class="match-pill ${pc}">${pillLabel}</span>
      </div>
      ${mf.length ? `<div class="r-matched-foods">${mf.map(f => `<span class="matched-food"><i class="ti ti-check" aria-hidden="true" style="font-size:10px"></i>${f}</span>`).join('')}</div>` : ''}
      <button class="r-expand-btn" onclick="toggleDishes(${idx})" id="expBtn${idx}">
        <i class="ti ti-chevron-down" aria-hidden="true" id="expIcon${idx}"></i>
        ${matched.length ? `View ${matched.length} matching dish${matched.length === 1 ? '' : 'es'}` : `View all ${r.dishes.length} dishes`}
      </button>
      <div class="r-dishes" id="dishes${idx}" style="display:none">
        ${matched.map(m => `
          <div class="dish-row dish-match">
            <i class="ti ti-check" aria-hidden="true" style="font-size:12px;color:#3B6D11;flex-shrink:0"></i>
            <span>${m.dish}</span>
            ${m.foods.map(f => `<span class="dish-tag">${f}</span>`).join('')}
          </div>`).join('')}
        ${matched.length && unmatchedDishes.length ? '<hr class="dish-divider">' : ''}
        ${unmatchedDishes.map(d => `
          <div class="dish-row" style="opacity:0.5">
            <i class="ti ti-minus" aria-hidden="true" style="font-size:11px;flex-shrink:0"></i>
            ${d}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  area.innerHTML = headerEl + cards;
}

function useMyLocation() {
  if (!navigator.geolocation) return;
  const input = document.getElementById('locationInput');
  input.value = 'Detecting location…';
  navigator.geolocation.getCurrentPosition(
    () => { input.value = 'Current location'; runSearch(); },
    () => { input.value = 'Miami, FL'; }
  );
}

function runSearch() {
  const loc = document.getElementById('locationInput').value.trim();
  if (!loc) return;
  const area = document.getElementById('resultsArea');
  area.innerHTML = `<div class="empty-state"><i class="ti ti-loader empty-icon spinning" aria-hidden="true"></i><div class="empty-title">Searching restaurants…</div></div>`;
  setTimeout(() => renderResults(MOCK_RESTAURANTS), 800);
}

renderTags();

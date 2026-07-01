const FIELD_MASK = 'places.id,places.displayName,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.nationalPhoneNumber,places.googleMapsUri,places.photos.name,places.regularOpeningHours.openNow,places.regularOpeningHours.weekdayDescriptions,places.priceLevel';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { location, lat, lng, radius, restrictions, safe } = req.query;
  const radiusMeters = Math.min(Math.max(parseInt(radius || '16') * 1000, 1000), 50000);
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) return res.status(500).json({ error: 'API key not configured' });
  if (!location && !(lat && lng)) return res.status(400).json({ error: 'location or lat/lng required' });

  try {
    let coords = null;

    if (lat && lng) {
      coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({
          includedTypes: ['restaurant', 'cafe', 'meal_takeaway'],
          maxResultCount: 20,
          locationRestriction: {
            circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: radiusMeters }
          }
        })
      });
      const data = await placesRes.json();
      if (!placesRes.ok) return res.status(500).json({ error: data.error?.message || 'Places API error' });
      const restaurants = mapPlaces(data.places);
      return res.json({ restaurants: await enrichWithSuggestions(restaurants, restrictions, safe), coords });

    } else {
      // For US zip codes, resolve to lat/lng via free public API (no key needed), then nearbySearch
      const isZip = /^\d{5}$/.test(location.trim());
      if (isZip) {
        const zipRes = await fetch(`https://api.zippopotam.us/us/${location.trim()}`);
        if (zipRes.ok) {
          const zipData = await zipRes.json();
          const place = zipData.places?.[0];
          if (place) {
            coords = { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
            const placesRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
              body: JSON.stringify({
                includedTypes: ['restaurant', 'cafe', 'meal_takeaway'],
                maxResultCount: 20,
                locationRestriction: { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: radiusMeters } }
              })
            });
            const data = await placesRes.json();
            if (!placesRes.ok) return res.status(500).json({ error: data.error?.message || 'Places API error' });
            const rNearby = mapPlaces(data.places);
            return res.json({ restaurants: await enrichWithSuggestions(rNearby, restrictions, safe), coords });
          }
        }
      }

      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({ textQuery: `restaurants near ${location}`, maxResultCount: 20, regionCode: 'US', languageCode: 'en' })
      });
      const data = await placesRes.json();
      if (!placesRes.ok) return res.status(500).json({ error: data.error?.message || 'Places API error' });
      const restaurants = mapPlaces(data.places);
      if (restaurants.length && data.places[0]?.location) {
        coords = { lat: data.places[0].location.latitude, lng: data.places[0].location.longitude };
      }
      return res.json({ restaurants: await enrichWithSuggestions(restaurants, restrictions, safe), coords });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Builds the SAFE FOODS / CANNOT EAT block from the user's own profile.
// `safe` is a "|"-separated list of foods (each optionally "Label (kitchen note)")
// and `restrictions` is a comma-separated list of things they can't eat.
function buildProfileBlock(restrictions, safe) {
  const safeItems = (safe || '')
    .split('|').map(s => s.trim()).filter(Boolean);
  const cannotItems = (restrictions || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const safeBlock = safeItems.length
    ? `SAFE FOODS — the ONLY things this diner can eat:\n${safeItems.map(s => `• ${s}`).join('\n')}`
    : `SAFE FOODS: The diner has not listed specific safe foods. Suggest plain, simple dishes that clearly avoid every item in the CANNOT EAT list, and tell them to confirm with the kitchen.`;

  const cannotBlock = cannotItems.length
    ? `\n\nABSOLUTELY CANNOT EAT (must be avoided):\n${cannotItems.map(s => `• ${s}`).join('\n')}`
    : '';

  return `${safeBlock}${cannotBlock}`;
}

async function enrichWithSuggestions(restaurants, restrictions, safe) {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey || !restaurants.length) return restaurants;

  try {
    const list = restaurants.map(r => `${r.id}|||${r.name}|||${r.cuisine}`).join('\n');
    const hasSafeList = !!(safe && safe.trim());
    const prompt = `${buildProfileBlock(restrictions, safe)}

CRITICAL INSTRUCTION: ${hasSafeList
      ? 'You may ONLY suggest dishes from the SAFE FOODS list above.'
      : 'Only suggest plain dishes that clearly avoid every item in the CANNOT EAT list.'} Never suggest anything containing an item from the CANNOT EAT list. If nothing suitable is likely on this restaurant's menu, respond with an empty dishes array for that restaurant.

For each restaurant below, look at the cuisine type and identify which suitable items (if any) are likely to appear on their menu. Suggest 1–3 matching items ONLY. Every suggestion must include a note telling the diner what to confirm with the kitchen.

Respond ONLY with valid JSON:
{"suggestions":[{"id":"...","dishes":[{"dish":"...","note":"Call ahead to confirm: ..."}]}]}

Restaurants (id|||name|||cuisine):
${list}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiRes.ok) return restaurants;

    const aiData = await aiRes.json();
    const raw = aiData.content?.[0]?.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return restaurants;

    const { suggestions } = JSON.parse(jsonMatch[0]);
    const byId = Object.fromEntries(suggestions.map(s => [s.id, s.dishes]));

    return restaurants.map((r, i) => ({
      ...r,
      aiDishes: byId[r.id] || null
    }));
  } catch {
    return restaurants;
  }
}

// Maps Google place type strings to readable food labels
function cuisineLabel(primaryType, types = []) {
  const all = [primaryType, ...types].map(t => (t || '').toLowerCase().replace(/_/g, ' '));
  const checks = [
    [['pizza'], 'Pizza'],
    [['sushi'], 'Sushi'],
    [['ramen'], 'Ramen'],
    [['japanese'], 'Japanese'],
    [['south indian', 'dosa', 'idli'], 'South Indian'],
    [['indian'], 'Indian'],
    [['italian'], 'Italian'],
    [['chinese'], 'Chinese'],
    [['mexican', 'taco', 'burrito'], 'Mexican'],
    [['thai'], 'Thai'],
    [['vietnamese'], 'Vietnamese'],
    [['korean'], 'Korean'],
    [['mediterranean'], 'Mediterranean'],
    [['greek'], 'Greek'],
    [['middle eastern', 'lebanese', 'falafel'], 'Middle Eastern'],
    [['polish', 'ukrainian', 'eastern european', 'pierogi'], 'Eastern European'],
    [['vegetarian', 'vegan', 'plant based'], 'Vegetarian'],
    [['seafood', 'fish'], 'Seafood'],
    [['steakhouse', 'steak'], 'Steakhouse'],
    [['burger', 'hamburger'], 'Burgers'],
    [['sandwich', 'deli', 'sub'], 'Deli / Sandwiches'],
    [['breakfast', 'brunch'], 'Breakfast & Brunch'],
    [['bakery', 'pastry'], 'Bakery'],
    [['coffee', 'cafe', 'espresso'], 'Café'],
    [['ice cream', 'dessert'], 'Desserts'],
    [['brewery', 'brew pub', 'brewpub'], 'Brewery'],
    [['bar', 'pub', 'tavern'], 'Bar & Pub'],
    [['farm', 'farm to table'], 'Farm-to-Table'],
    [['american'], 'American'],
    [['diner'], 'Diner'],
    [['restaurant', 'meal takeaway', 'meal delivery', 'food'], 'Restaurant'],
  ];
  for (const [keywords, label] of checks) {
    if (all.some(a => keywords.some(k => a.includes(k)))) return label;
  }
  return primaryType || 'Restaurant';
}

function mapPlaces(places = []) {
  return places.map(p => ({
    id: p.id,
    name: p.displayName?.text || 'Unknown',
    cuisine: cuisineLabel(p.primaryTypeDisplayName?.text, p.types),
    rating: p.rating || null,
    ratingCount: p.userRatingCount || 0,
    address: p.formattedAddress || '',
    phone: p.nationalPhoneNumber || null,
    mapsUrl: p.googleMapsUri || null,
    location: p.location,
    photoName: p.photos?.[0]?.name || null,
    openNow: p.regularOpeningHours?.openNow ?? null,
    weekdayHours: p.regularOpeningHours?.weekdayDescriptions || null,
    priceLevel: p.priceLevel || null,
  }));
}

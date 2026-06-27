const FIELD_MASK = 'places.id,places.displayName,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.nationalPhoneNumber,places.googleMapsUri,places.photos.name';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { location, lat, lng, radius } = req.query;
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
      return res.json({ restaurants: await enrichWithSuggestions(restaurants), coords });

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
            return res.json({ restaurants: await enrichWithSuggestions(rNearby), coords });
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
      return res.json({ restaurants: await enrichWithSuggestions(restaurants), coords });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Dietary context sent to Claude for every suggestion request
const DIET_CONTEXT = `The diner is: vegetarian (no meat or fish), cannot eat garlic or onion (medical intolerance — not a preference), needs rennet-free cheese only (mozzarella and ricotta are fine; ask about cheddar/parmesan), no seeds of any kind, no whole grains or bran, no gravy.`;

async function enrichWithSuggestions(restaurants) {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey || !restaurants.length) return restaurants;

  try {
    // Cap at 10 to stay within Vercel's 10s function timeout
    const toEnrich = restaurants.slice(0, 10);
    const list = toEnrich.map(r => `${r.id}|||${r.name}|||${r.cuisine}`).join('\n');
    const prompt = `${DIET_CONTEXT}

For each restaurant below, suggest 2–4 specific menu items that are LIKELY to appear on their menu AND would be safe for this diner. Be specific to what that restaurant type actually serves — don't suggest "mashed potatoes" at a sushi restaurant. If nothing is clearly safe, say so briefly.

Respond ONLY with valid JSON in this exact shape:
{"suggestions":[{"id":"...","dishes":[{"dish":"...","note":"..."}]}]}

The "note" should be a short instruction to give the server (e.g. "Ask: no garlic, confirm rennet-free cheese").

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
        max_tokens: 2048,
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
      aiDishes: i < 10 ? (byId[r.id] || null) : null
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
    _rawPlace: Object.keys(p),
  }));
}

const FIELD_MASK = 'places.id,places.displayName,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.nationalPhoneNumber,places.googleMapsUri';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { location, lat, lng } = req.query;
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
            circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: 2000 }
          }
        })
      });
      const data = await placesRes.json();
      if (!placesRes.ok) return res.status(500).json({ error: data.error?.message || 'Places API error' });
      return res.json({ restaurants: mapPlaces(data.places), coords });

    } else {
      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({ textQuery: `restaurants near ${location}`, maxResultCount: 20 })
      });
      const data = await placesRes.json();
      if (!placesRes.ok) return res.status(500).json({ error: data.error?.message || 'Places API error' });
      const restaurants = mapPlaces(data.places);
      if (restaurants.length && data.places[0]?.location) {
        coords = { lat: data.places[0].location.latitude, lng: data.places[0].location.longitude };
      }
      return res.json({ restaurants, coords });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function mapPlaces(places = []) {
  return places.map(p => ({
    id: p.id,
    name: p.displayName?.text || 'Unknown',
    cuisine: p.primaryTypeDisplayName?.text || 'Restaurant',
    rating: p.rating || null,
    ratingCount: p.userRatingCount || 0,
    address: p.formattedAddress || '',
    phone: p.nationalPhoneNumber || null,
    mapsUrl: p.googleMapsUri || null,
    location: p.location
  }));
}

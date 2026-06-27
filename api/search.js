export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { location, lat, lng } = req.query;
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) return res.status(500).json({ error: 'API key not configured' });
  if (!location && !(lat && lng)) return res.status(400).json({ error: 'location or lat/lng required' });

  try {
    let coordinates;

    if (lat && lng) {
      coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
    } else {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${key}`
      );
      const geoData = await geoRes.json();
      if (!geoData.results?.length) return res.status(404).json({ error: 'Location not found' });
      coordinates = geoData.results[0].geometry.location;
    }

    const placesRes = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.photos'
        },
        body: JSON.stringify({
          includedTypes: ['restaurant', 'food', 'cafe', 'meal_takeaway', 'meal_delivery'],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude: coordinates.lat, longitude: coordinates.lng },
              radius: 2000
            }
          }
        })
      }
    );

    const placesData = await placesRes.json();
    if (!placesRes.ok) return res.status(500).json({ error: placesData.error?.message || 'Places API error' });

    const restaurants = (placesData.places || []).map(p => ({
      id: p.id,
      name: p.displayName?.text || 'Unknown',
      cuisine: p.primaryTypeDisplayName?.text || 'Restaurant',
      rating: p.rating || null,
      ratingCount: p.userRatingCount || 0,
      address: p.formattedAddress || '',
      location: p.location,
      photoRef: p.photos?.[0]?.name || null
    }));

    res.json({ restaurants, coords: coordinates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

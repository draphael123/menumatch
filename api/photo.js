export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name required' });

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) return res.status(500).json({ error: 'API key not configured' });

  try {
    // Google returns a redirect to a CDN URL — follow it and return the CDN URL to the client
    const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=400&skipHttpRedirect=true&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ error: 'photo not found' });
    const data = await r.json();
    const photoUri = data.photoUri;
    if (!photoUri) return res.status(404).json({ error: 'no photoUri' });
    // Cache for 24h
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({ url: photoUri });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

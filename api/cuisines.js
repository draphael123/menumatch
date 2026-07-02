// Derives the cuisine types where this diner is most likely to eat well,
// from their typed can-eat list. Called by the client whenever the safe-food
// list changes; the result is stored in the profile and drives the search
// filters + "Safe cuisine" badge.

// Must stay in sync with the labels cuisineLabel() (api/search.js) can emit,
// so the client can match filters against restaurant cards.
const CUISINE_VOCAB = [
  'Pizza', 'Italian', 'Sushi', 'Ramen', 'Japanese', 'South Indian', 'Indian',
  'Chinese', 'Mexican', 'Thai', 'Vietnamese', 'Korean', 'Mediterranean',
  'Greek', 'Middle Eastern', 'Eastern European', 'Vegetarian', 'Seafood',
  'Steakhouse', 'Burgers', 'Deli / Sandwiches', 'Breakfast & Brunch',
  'Bakery', 'Café', 'American', 'Diner',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { foods, restrictions } = req.body || {};
  if (!Array.isArray(foods) || !foods.length) {
    return res.status(400).json({ error: 'foods array required' });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI not configured' });

  // Cap sizes — this is user-typed input.
  const foodList = foods.slice(0, 60).map(f => String(f).slice(0, 80));
  const cannotList = (Array.isArray(restrictions) ? restrictions : []).slice(0, 40).map(r => String(r).slice(0, 80));

  try {
    const prompt = `A diner can eat ONLY these foods:
${foodList.map(f => `• ${f}`).join('\n')}
${cannotList.length ? `\nThey can never have: ${cannotList.join(', ')}.` : ''}

From this EXACT list of cuisine types, choose the 3 to 6 where this diner is MOST likely to find dishes they can order (best matches first):
${CUISINE_VOCAB.join(', ')}

Respond ONLY with valid JSON: {"cuisines":["...", "..."]}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!aiRes.ok) return res.status(502).json({ error: 'AI request failed' });

    const aiData = await aiRes.json();
    const raw = aiData.content?.[0]?.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'unparseable AI response' });

    const { cuisines } = JSON.parse(jsonMatch[0]);
    const valid = (Array.isArray(cuisines) ? cuisines : [])
      .filter(c => CUISINE_VOCAB.includes(c))
      .slice(0, 6);
    if (!valid.length) return res.status(502).json({ error: 'no valid cuisines' });

    // Same inputs → same answer; let the CDN absorb repeat calls for a day.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
    return res.json({ cuisines: valid });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

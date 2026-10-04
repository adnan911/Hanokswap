const { Redis } = require('@upstash/redis');

const CACHE_TTL_SECONDS = 10;
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;
const memCache = new Map();

async function getCached(key) {
  if (redis) {
    try {
      const val = await redis.get(`upbit-cache:${key}`);
      return val ? (typeof val === 'string' ? JSON.parse(val) : val) : null;
    } catch {
      // fallback to memory cache
    }
  }
  const entry = memCache.get(key);
  return entry && entry.expiresAt > Date.now() ? entry.data : null;
}

async function setCached(key, data) {
  if (redis) {
    try {
      await redis.set(`upbit-cache:${key}`, JSON.stringify(data), { ex: CACHE_TTL_SECONDS });
      return;
    } catch {
      // fallback to memory cache
    }
  }
  memCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 });
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawMarkets = req.query?.markets || (req.url ? new URL(req.url, 'http://localhost').searchParams.get('markets') : null) || 'KRW-BTC,KRW-ETH,KRW-USDT';
    
    // Sanitize market input (only alphanumeric, commas, hyphens, and underscores)
    const sanitizedMarkets = String(rawMarkets)
      .split(',')
      .map(m => m.trim().toUpperCase())
      .filter(m => /^[A-Z0-9\-_]+$/.test(m))
      .join(',');

    if (!sanitizedMarkets) {
      return res.status(400).json({ error: 'Invalid market format' });
    }

    // Check cache
    const cachedData = await getCached(sanitizedMarkets);
    if (cachedData) {
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
      return res.status(200).json(cachedData);
    }

    const upbitRes = await fetch(`https://api.upbit.com/v1/ticker?markets=${sanitizedMarkets}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HanokSwap/1.0',
      },
    });

    if (!upbitRes.ok) {
      const errText = await upbitRes.text().catch(() => '');
      console.warn(`Upbit API returned ${upbitRes.status}: ${errText}`);
      return res.status(upbitRes.status).json({ error: `Upbit API error: ${upbitRes.statusText}` });
    }

    const data = await upbitRes.json();
    await setCached(sanitizedMarkets, data);

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Upbit proxy error:', error);
    return res.status(500).json({ error: 'Internal server error fetching Upbit data' });
  }
};


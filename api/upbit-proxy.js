module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const markets = req.query.markets || 'KRW-BTC,KRW-ETH,KRW-USDT';
    const upbitRes = await fetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HanokSwap-Giwa/1.0',
      },
    });

    if (!upbitRes.ok) {
      return res.status(upbitRes.status).json({ error: 'Failed to fetch Upbit tickers' });
    }

    const data = await upbitRes.json();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Upbit proxy error:', error);
    return res.status(500).json({ error: 'Internal server error fetching Upbit data' });
  }
};

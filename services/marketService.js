const axios = require('axios');

async function getMarketData(year, make, model, trim) {
  const apiKey = process.env.MARKETCHECK_API_KEY;

  if (!apiKey) {
    return {
      available: false,
      message: 'Market data requires a Marketcheck API key (set MARKETCHECK_API_KEY in .env)'
    };
  }

  try {
    const params = {
      api_key: apiKey,
      year,
      make,
      model,
      rows: 20,
      start: 0,
      country: 'US',
      fields: 'id,price,miles,year,make,model,trim,dealer_name,city,state,vdp_url'
    };
    if (trim) params.trim = trim;

    const resp = await axios.get('https://mc-api.marketcheck.com/v2/search/car/active', {
      params,
      timeout: 12000
    });

    const listings = resp.data?.listings || [];

    if (listings.length === 0) {
      return { available: true, stats: null, sampleListings: [], message: 'No active listings found for this vehicle' };
    }

    const prices    = listings.map(l => l.price).filter(p => p > 0);
    const mileages  = listings.map(l => l.miles).filter(m => m > 0);
    const sortedPrices = [...prices].sort((a, b) => a - b);

    const stats = {
      listingCount: listings.length,
      priceRange: prices.length > 0 ? {
        min:    Math.min(...prices),
        max:    Math.max(...prices),
        avg:    Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        median: sortedPrices[Math.floor(sortedPrices.length / 2)]
      } : null,
      mileageAvg: mileages.length > 0
        ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length)
        : null
    };

    return {
      available: true,
      stats,
      sampleListings: listings.slice(0, 5).map(l => ({
        price:      l.price,
        miles:      l.miles,
        city:       l.city,
        state:      l.state,
        dealerName: l.dealer_name,
        url:        l.vdp_url
      }))
    };
  } catch (err) {
    console.error('Market API error:', err.message);
    if (err.response?.status === 401) return { available: false, message: 'Invalid Marketcheck API key' };
    if (err.response?.status === 429) return { available: false, message: 'Market API rate limit reached — try again later' };
    return { available: false, message: 'Market data temporarily unavailable' };
  }
}

module.exports = { getMarketData };

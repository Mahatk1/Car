const express = require('express');
const router = express.Router();
const { decodeVin, getRecalls, getComplaints } = require('../services/nhtsaService');
const { getMarketData }        = require('../services/marketService');
const { getVehicleImages }     = require('../services/imageService');
const { generateVehicleSummary } = require('../services/aiService');
const { getCachedVin, saveVinLookup, getRecentLookups } = require('../db/database');

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

function validateVin(vin) {
  if (!vin) return 'VIN is required';
  if (vin.length !== 17) return `VIN must be exactly 17 characters (got ${vin.length})`;
  if (!VIN_RE.test(vin)) return 'VIN contains invalid characters (I, O, Q are not permitted in VINs)';
  return null;
}

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    features: {
      database:   !!process.env.DATABASE_URL,
      ai:         !!process.env.ANTHROPIC_API_KEY,
      marketData: !!process.env.MARKETCHECK_API_KEY,
      images:     !!process.env.UNSPLASH_ACCESS_KEY
    }
  });
});

router.post('/vin/lookup', async (req, res) => {
  const vin = req.body?.vin?.trim().toUpperCase().replace(/[\s-]/g, '');

  const validationError = validateVin(vin);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    // Serve from cache if fresh (< 24 h)
    const cached = await getCachedVin(vin).catch(() => null);
    if (cached) {
      return res.json({
        vin,
        cached:     true,
        cachedAt:   cached.updated_at,
        vinData:    cached.vin_data,
        recalls:    cached.recalls_data,
        complaints: cached.complaints_data,
        marketData: cached.market_data,
        images:     cached.images_data,
        aiSummary:  cached.ai_summary
          ? { available: true, summary: cached.ai_summary }
          : null
      });
    }

    // Decode VIN
    let vinData;
    try {
      vinData = await decodeVin(vin);
    } catch (err) {
      return res.status(422).json({ error: `VIN decode failed: ${err.message}` });
    }

    if (!vinData.make && !vinData.model) {
      return res.status(422).json({
        error: 'Could not identify this vehicle. Please verify the VIN.',
        vinData
      });
    }

    // Fetch everything in parallel
    const [recalls, complaints, marketData, images] = await Promise.all([
      getRecalls(vinData.make, vinData.model, vinData.year),
      getComplaints(vinData.make, vinData.model, vinData.year),
      getMarketData(vinData.year, vinData.make, vinData.model, vinData.trim),
      getVehicleImages(vinData.year, vinData.make, vinData.model, vinData.trim)
    ]);

    const aiSummary = await generateVehicleSummary({ vin, vinData, recalls, complaints, marketData });

    // Persist to cache (non-blocking)
    saveVinLookup(vin, {
      vinData,
      recalls,
      complaints,
      marketData,
      images,
      aiSummary: aiSummary?.summary || null
    }).catch(err => console.error('Cache write error:', err.message));

    res.json({ vin, cached: false, vinData, recalls, complaints, marketData, images, aiSummary });

  } catch (err) {
    console.error('VIN lookup error:', err);
    res.status(500).json({ error: err.message || 'Lookup failed — please try again' });
  }
});

router.get('/vin/recent', async (req, res) => {
  try {
    const recent = await getRecentLookups(12);
    res.json({ recent });
  } catch (err) {
    res.status(500).json({ error: 'Could not load recent lookups' });
  }
});

module.exports = router;

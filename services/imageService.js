const axios = require('axios');

async function getVehicleImages(year, make, model, trim) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return {
      available: false,
      message: 'Vehicle images require an Unsplash API key (set UNSPLASH_ACCESS_KEY in .env)'
    };
  }

  const search = async (query) => {
    const resp = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query, per_page: 6, orientation: 'landscape', content_filter: 'high' },
      headers: { Authorization: `Client-ID ${accessKey}` },
      timeout: 10000
    });
    return resp.data?.results || [];
  };

  try {
    let photos = await search([year, make, model, trim].filter(Boolean).join(' '));
    let broadSearch = false;

    if (photos.length === 0) {
      photos = await search(`${make} ${model} car`);
      broadSearch = true;
    }

    if (photos.length === 0) {
      return { available: false, message: 'No images found for this vehicle' };
    }

    return {
      available: true,
      broadSearch,
      images: photos.map(p => ({
        url:            p.urls.regular,
        thumbUrl:       p.urls.thumb,
        altDescription: p.alt_description,
        photographer:   p.user.name,
        photographerUrl: p.user.links.html,
        unsplashUrl:    p.links.html
      }))
    };
  } catch (err) {
    console.error('Image API error:', err.message);
    return { available: false, message: 'Images temporarily unavailable' };
  }
}

module.exports = { getVehicleImages };

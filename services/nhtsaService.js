const axios = require('axios');

const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const NHTSA_BASE = 'https://api.nhtsa.gov';

const EMPTY_VALUES = new Set(['', 'Not Applicable', 'null', 'N/A', 'None', 'Unknown']);

function extract(results, variableName) {
  const field = results.find(r => r.Variable === variableName);
  const val = field?.Value?.trim();
  return val && !EMPTY_VALUES.has(val) ? val : null;
}

async function decodeVin(vin) {
  const response = await axios.get(`${VPIC_BASE}/decodevin/${vin}?format=json`, {
    timeout: 12000
  });

  const results = response.data?.Results;
  if (!results?.length) throw new Error('No data returned from NHTSA VIN decoder');

  const errorCode = extract(results, 'Error Code');
  if (errorCode && errorCode !== '0') {
    const errorText = extract(results, 'Error Text');
    throw new Error(errorText || 'VIN decode failed');
  }

  const cylinders    = extract(results, 'Engine Number of Cylinders');
  const displacement = extract(results, 'Displacement (L)');
  const config       = extract(results, 'Engine Configuration');
  const fuelType     = extract(results, 'Fuel Type - Primary');

  let engine = null;
  if (displacement || cylinders) {
    const parts = [];
    if (displacement) parts.push(`${parseFloat(displacement).toFixed(1)}L`);
    if (cylinders)    parts.push(`${cylinders}-Cyl`);
    if (config)       parts.push(config);
    if (fuelType)     parts.push(fuelType);
    engine = parts.join(' ');
  }

  const txStyle  = extract(results, 'Transmission Style');
  const txSpeeds = extract(results, 'Transmission Speeds');
  const transmission = txStyle
    ? (txSpeeds ? `${txSpeeds}-Speed ${txStyle}` : txStyle)
    : null;

  return {
    year:             extract(results, 'Model Year'),
    make:             extract(results, 'Make'),
    model:            extract(results, 'Model'),
    trim:             extract(results, 'Trim') || extract(results, 'Series'),
    series:           extract(results, 'Series'),
    bodyType:         extract(results, 'Body Class'),
    vehicleType:      extract(results, 'Vehicle Type'),
    doors:            extract(results, 'Doors'),
    drivetrain:       extract(results, 'Drive Type'),
    engine,
    engineCylinders:  cylinders,
    engineDisplacement: displacement,
    fuelType,
    transmission,
    manufacturer:     extract(results, 'Manufacturer Name'),
    plantCountry:     extract(results, 'Plant Country'),
    plantCity:        extract(results, 'Plant City'),
    plantState:       extract(results, 'Plant State'),
    gvwr:             extract(results, 'Gross Vehicle Weight Rating From'),
    abs:              extract(results, 'Anti-Brake System (ABS)'),
    steeringSide:     extract(results, 'Steering Location'),
    errorCode,
    errorText:        extract(results, 'Error Text')
  };
}

async function getRecalls(make, model, year) {
  if (!make || !model || !year) return [];
  try {
    const resp = await axios.get(`${NHTSA_BASE}/recalls/recallsByVehicle`, {
      params: { make, model, modelYear: year },
      timeout: 12000
    });
    const items = resp.data?.results || [];
    return items.map(r => ({
      campaignNumber:   r.NHTSACampaignNumber,
      reportDate:       r.ReportReceivedDate,
      component:        r.Component,
      summary:          r.Summary,
      consequence:      r.Consequence,
      remedy:           r.Remedy,
      notes:            r.Notes,
      manufacturer:     r.Manufacturer,
      affectedCount:    r.PotentialNumbersAffected
    }));
  } catch (err) {
    console.error('Recalls fetch error:', err.message);
    return null;
  }
}

async function getComplaints(make, model, year) {
  if (!make || !model || !year) return null;
  try {
    const resp = await axios.get(`${NHTSA_BASE}/complaints/complaintsByVehicle`, {
      params: { make, model, modelYear: year },
      timeout: 12000
    });
    const items = resp.data?.results || [];

    const byComponent = {};
    let crashes = 0, fires = 0, injuries = 0, deaths = 0;

    items.forEach(c => {
      const comp = c.components || 'Unknown';
      byComponent[comp] = (byComponent[comp] || 0) + 1;
      if (c.crash)              crashes++;
      if (c.fire)               fires++;
      injuries += c.numberOfInjuries || 0;
      deaths   += c.numberOfDeaths   || 0;
    });

    return {
      total: items.length,
      crashes,
      fires,
      injuries,
      deaths,
      byComponent,
      recent: items.slice(0, 5).map(c => ({
        odiNumber:   c.odiNumber,
        dateFiled:   c.dateComplaintFiled,
        components:  c.components,
        summary:     c.summary?.substring(0, 250),
        crash:       c.crash,
        fire:        c.fire,
        injuries:    c.numberOfInjuries,
        deaths:      c.numberOfDeaths
      }))
    };
  } catch (err) {
    console.error('Complaints fetch error:', err.message);
    return null;
  }
}

module.exports = { decodeVin, getRecalls, getComplaints };

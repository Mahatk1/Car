const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const SYSTEM_PROMPT = `You are an expert automotive analyst and consumer advisor. You analyze vehicle data from official NHTSA sources and market data to provide honest, factual vehicle purchase assessments.

Your analysis must:
1. Be based strictly on the data provided — never fabricate or assume missing information
2. Clearly call out red flags: salvage/rebuilt/flood titles, open safety recalls (especially airbags, brakes, steering, fuel system), high complaint volume, crash/fire/fatality reports, price significantly below market, high mileage for age, VIN decode errors
3. Note positives: clean history, low complaints, priced fairly
4. End with one of these exact verdicts on its own line: GOOD BUY | PROCEED WITH CAUTION | AVOID
5. Be concise — aim for 200-300 words total

Format:
- Brief overview (1-2 sentences)
- **Red Flags** section (bullet list, or "None identified")
- **Positives** section (bullet list)
- **Verdict:** GOOD BUY / PROCEED WITH CAUTION / AVOID — one sentence of reasoning`;

async function generateVehicleSummary({ vin, vinData, recalls, complaints, marketData }) {
  const client = getClient();
  if (!client) {
    return { available: false, message: 'AI summary requires an Anthropic API key (set ANTHROPIC_API_KEY in .env)' };
  }

  const recallText = recalls === null
    ? 'Recall data: unavailable (API error)'
    : recalls.length === 0
      ? 'Recalls: None on record'
      : `Open recalls (${recalls.length}):\n${recalls.map(r => `  • [${r.campaignNumber}] ${r.component}: ${r.summary?.substring(0, 180)}`).join('\n')}`;

  let complaintText = 'Complaint data: unavailable';
  if (complaints !== null) {
    const flags = [];
    if (complaints.crashes  > 0) flags.push(`${complaints.crashes} crash report(s)`);
    if (complaints.fires    > 0) flags.push(`${complaints.fires} fire report(s)`);
    if (complaints.injuries > 0) flags.push(`${complaints.injuries} injur(ies)`);
    if (complaints.deaths   > 0) flags.push(`${complaints.deaths} death(s)`);
    const topComponents = Object.entries(complaints.byComponent || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ');
    complaintText = `Complaints: ${complaints.total} total${flags.length ? ' — ⚠️ ' + flags.join(', ') : ''}${topComponents ? '\n  Top issues: ' + topComponents : ''}`;
  }

  const marketText = !marketData?.available
    ? `Market data: ${marketData?.message || 'not available'}`
    : marketData.stats?.priceRange
      ? `Market: ${marketData.stats.listingCount} listings — avg $${marketData.stats.priceRange.avg?.toLocaleString()}, range $${marketData.stats.priceRange.min?.toLocaleString()}–$${marketData.stats.priceRange.max?.toLocaleString()}${marketData.stats.mileageAvg ? `, avg mileage ${marketData.stats.mileageAvg?.toLocaleString()}` : ''}`
      : 'Market data: no pricing found';

  const prompt = `Analyze this vehicle for a potential buyer and provide a buying recommendation.

VIN: ${vin}
Year/Make/Model: ${vinData.year} ${vinData.make} ${vinData.model}
Trim/Series: ${vinData.trim || 'Not specified'}
Body Type: ${vinData.bodyType || 'Not specified'}
Engine: ${vinData.engine || 'Not specified'}
Drivetrain: ${vinData.drivetrain || 'Not specified'}
Transmission: ${vinData.transmission || 'Not specified'}
Fuel: ${vinData.fuelType || 'Not specified'}
Manufactured in: ${[vinData.plantCity, vinData.plantState, vinData.plantCountry].filter(Boolean).join(', ') || 'Not specified'}
VIN decode status: ${!vinData.errorCode || vinData.errorCode === '0' ? 'Valid' : `⚠️ Error ${vinData.errorCode}: ${vinData.errorText}`}

${recallText}

${complaintText}

${marketText}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      available: true,
      summary: response.content[0].text,
      usage: {
        inputTokens:        response.usage.input_tokens,
        outputTokens:       response.usage.output_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens,
        cacheReadTokens:    response.usage.cache_read_input_tokens
      }
    };
  } catch (err) {
    console.error('AI summary error:', err.message);
    return { available: false, message: 'AI analysis failed — please try again' };
  }
}

module.exports = { generateVehicleSummary };

# VIN Research Assistant

A full-stack web app that lets you enter any 17-character VIN and instantly get a complete vehicle report — specs, open recalls, safety complaints, market pricing, vehicle images, and an AI-powered buying recommendation.

All data comes from **official public APIs only**. No scraping, no paywalls bypassed, no stolen data.

---

## Features

- **VIN Decoder** — Year, make, model, trim, engine, body type, transmission, drivetrain, manufacturer, assembly plant
- **Open Recalls** — Live data from the NHTSA Recalls API with urgency highlighting
- **Safety Complaints** — Crash, fire, injury, and fatality counts by component from NHTSA
- **Market Pricing** — Average price, price range, and sample listings (requires Marketcheck API key)
- **Vehicle Images** — Photo gallery sourced via Unsplash API (requires Unsplash key)
- **AI Buying Summary** — Red flags, positives, and a GOOD BUY / PROCEED WITH CAUTION / AVOID verdict powered by Claude AI
- **Result Caching** — PostgreSQL caches lookups for 24 hours to reduce API calls
- **Recent Lookups** — Browse previously searched VINs
- **Mobile Friendly** — Responsive dark UI, works on all screen sizes

---

## Data Sources

| Source | Purpose | Cost |
|--------|---------|------|
| [NHTSA VIN Decoder](https://vpic.nhtsa.dot.gov/api/) | Decode VIN specs | Free, no key |
| [NHTSA Recalls API](https://api.nhtsa.gov/recalls/) | Open safety recalls | Free, no key |
| [NHTSA Complaints API](https://api.nhtsa.gov/complaints/) | Safety complaint history | Free, no key |
| [Marketcheck API](https://www.marketcheck.com/api) | Live market listings & pricing | Free tier available |
| [Unsplash API](https://unsplash.com/developers) | Vehicle photos | Free tier (50 req/hr) |
| [Anthropic Claude](https://console.anthropic.com) | AI buying analysis | Pay-per-use |

---

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework)
- **APIs:** NHTSA (free), Marketcheck (optional), Unsplash (optional), Anthropic (optional)

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [PostgreSQL](https://www.postgresql.org/) v13 or higher
- npm

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Mahatk1/Car.git
cd Car
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

```bash
createdb vin_research
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Required
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/vin_research

# Optional — enables AI buying summary
ANTHROPIC_API_KEY=sk-ant-...

# Optional — enables live market pricing
MARKETCHECK_API_KEY=...

# Optional — enables vehicle photo gallery
UNSPLASH_ACCESS_KEY=...
```

> **Note:** The app runs fine without the optional keys. Those sections will display "Not Available" instead of erroring out.

### 5. Start the app

```bash
npm start
```

Visit [http://localhost:3000](http://localhost:3000)

For development with auto-reload:

```bash
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `ANTHROPIC_API_KEY` | No | Enables AI buying analysis via Claude |
| `MARKETCHECK_API_KEY` | No | Enables live market listings and pricing |
| `UNSPLASH_ACCESS_KEY` | No | Enables vehicle photo gallery |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/vin/lookup` | Decode a VIN and fetch all data |
| `GET` | `/api/vin/recent` | List 12 most recent lookups |
| `GET` | `/api/health` | Server health and feature status |

### Example request

```bash
curl -X POST http://localhost:3000/api/vin/lookup \
  -H "Content-Type: application/json" \
  -d '{"vin": "1HGCP26789A160824"}'
```

---

## Project Structure

```
├── server.js               # Express app entry point
├── routes/
│   └── api.js              # All API route handlers
├── services/
│   ├── nhtsaService.js     # NHTSA VIN decode, recalls, complaints
│   ├── marketService.js    # Marketcheck market listings
│   ├── imageService.js     # Unsplash vehicle images
│   └── aiService.js        # Anthropic Claude AI summary
├── db/
│   ├── database.js         # PostgreSQL pool and query helpers
│   └── schema.sql          # Database schema
├── public/
│   ├── index.html          # Frontend HTML
│   ├── css/styles.css      # Styles
│   └── js/app.js           # Frontend JavaScript
├── .env.example            # Example environment file
└── package.json
```

---

## Legal & Compliance

This app uses **only legal, official, and licensed data sources**:

- NHTSA APIs are free US government public data
- Marketcheck and Unsplash are licensed commercial APIs used with proper API keys
- No web scraping, no paywall bypassing, no use of Carfax/AutoCheck data
- Missing data is displayed as "Not Available" — nothing is fabricated

---

## License

MIT

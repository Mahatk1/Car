/* ── VIN Validation ──────────────────────────────────── */
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

const TRANSLITERATE = {
  A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,
  J:1,K:2,L:3,M:4,N:5,P:7,R:9,
  S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,
  0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9
};
const WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

function checkVinDigit(vin) {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const v = TRANSLITERATE[vin[i]];
    if (v === undefined) return false;
    sum += v * WEIGHTS[i];
  }
  const rem = sum % 11;
  const cd  = vin[8];
  return rem === 10 ? cd === 'X' : cd === String(rem);
}

function validateVin(raw) {
  const vin = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!vin) return { ok: false, msg: '' };
  if (vin.length < 17) return { ok: false, msg: `${vin.length}/17 characters entered` };
  if (vin.length > 17) return { ok: false, msg: 'VIN must be exactly 17 characters' };
  if (!VIN_RE.test(vin)) {
    const bad = [...vin].filter(c => !/[A-HJ-NPR-Z0-9]/.test(c));
    return { ok: false, msg: `Invalid character(s): ${[...new Set(bad)].join(', ')} — I, O, Q not allowed` };
  }
  if (!checkVinDigit(vin)) return { ok: true, warn: true, msg: '⚠ Check digit mismatch — VIN may be incorrect', vin };
  return { ok: true, msg: '✓ Valid VIN format', vin };
}

/* ── DOM Helpers ─────────────────────────────────────── */
const $  = id => document.getElementById(id);
const na = v  => (v == null || v === '') ? '<span class="na">Not Available</span>' : escHtml(v);

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function formatUSD(n) {
  if (!n) return 'N/A';
  return '$' + Number(n).toLocaleString('en-US');
}

function formatNum(n) {
  if (n == null) return 'N/A';
  return Number(n).toLocaleString('en-US');
}

/* ── VIN Input Logic ─────────────────────────────────── */
const vinInput    = $('vinInput');
const charCounter = $('charCounter');
const vinStatus   = $('vinStatus');

vinInput.addEventListener('input', () => {
  const raw = vinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vinInput.value !== raw) vinInput.value = raw;

  const len = raw.length;
  charCounter.textContent = `${len} / 17`;

  vinStatus.className = 'vin-status';
  vinInput.classList.remove('valid', 'invalid');

  if (!raw) { vinStatus.textContent = ''; return; }

  const v = validateVin(raw);
  vinStatus.textContent = v.msg;

  if (len === 17) {
    if (v.ok && !v.warn) {
      vinInput.classList.add('valid');
      vinStatus.classList.add('ok');
    } else if (v.ok && v.warn) {
      vinInput.classList.add('invalid');
      vinStatus.classList.add('warn');
    } else {
      vinInput.classList.add('invalid');
      vinStatus.classList.add('error');
    }
  }
});

/* ── Form Submit ─────────────────────────────────────── */
$('vinForm').addEventListener('submit', async e => {
  e.preventDefault();
  const raw = vinInput.value.trim().toUpperCase().replace(/[\s-]/g, '');

  const v = validateVin(raw);
  if (!v.ok && !v.warn) {
    vinStatus.textContent = v.msg || 'Please enter a valid 17-character VIN';
    vinStatus.className   = 'vin-status error';
    return;
  }

  await lookupVin(v.vin || raw);
});

/* ── API Lookup ──────────────────────────────────────── */
async function lookupVin(vin) {
  setLoading(true);
  hideError();
  hideResults();

  try {
    const resp = await fetch('/api/vin/lookup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ vin })
    });

    const data = await resp.json();

    if (!resp.ok) {
      showError(data.error || 'Lookup failed — please try again.');
      return;
    }

    renderResults(data);
    setTimeout(() => $('results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  } catch (err) {
    showError('Network error — please check your connection and try again.');
  } finally {
    setLoading(false);
  }
}

/* ── Loading State ───────────────────────────────────── */
function setLoading(on) {
  const btn = $('searchBtn');
  btn.disabled = on;
  btn.classList.toggle('loading', on);
  vinInput.disabled = on;
}

function hideResults() { $('results').classList.add('hidden'); }

function showError(msg) {
  $('errorMessage').textContent = msg;
  $('errorBanner').classList.remove('hidden');
}

function hideError() { $('errorBanner').classList.add('hidden'); }

$('errorClose').addEventListener('click', hideError);

/* ── Main Render ─────────────────────────────────────── */
function renderResults(data) {
  const { vin, cached, cachedAt, vinData, recalls, complaints, marketData, images, aiSummary } = data;

  $('resultsVin').textContent = vin;

  const metaEl = $('resultsMeta');
  if (cached && cachedAt) {
    const d = new Date(cachedAt);
    metaEl.innerHTML = `<span class="cached-pill">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      Cached ${d.toLocaleDateString()}
    </span>`;
  } else {
    metaEl.innerHTML = `<span style="color:var(--text-faint);font-size:.8rem">Live data</span>`;
  }

  renderVehicleOverview(vinData);
  renderRecalls(recalls);
  renderComplaints(complaints);
  renderMarketData(marketData);
  renderImages(images, vinData);
  renderAiSummary(aiSummary);

  $('results').classList.remove('hidden');
}

/* ── Vehicle Overview ────────────────────────────────── */
function renderVehicleOverview(d) {
  const year  = d.year  || '';
  const make  = d.make  || '';
  const model = d.model || '';
  const trim  = d.trim  || '';

  const headline = [year, make, model, trim].filter(Boolean).join(' ');
  $('vehicleHeadline').innerHTML = `<span class="year">${escHtml(year)}</span> ${escHtml([make, model, trim].filter(Boolean).join(' '))}`;
  if (!headline) $('vehicleHeadline').innerHTML = '<span class="na">Unknown Vehicle</span>';

  const specs = [
    ['Year',         d.year],
    ['Make',         d.make],
    ['Model',        d.model],
    ['Trim / Series',d.trim],
    ['Body Type',    d.bodyType],
    ['Vehicle Type', d.vehicleType],
    ['Engine',       d.engine],
    ['Fuel Type',    d.fuelType],
    ['Drivetrain',   d.drivetrain],
    ['Transmission', d.transmission],
    ['Doors',        d.doors],
    ['Manufacturer', d.manufacturer],
    ['Assembly',     [d.plantCity, d.plantState, d.plantCountry].filter(Boolean).join(', ') || null],
    ['GVWR',         d.gvwr],
    ['ABS',          d.abs],
    ['Steering',     d.steeringSide]
  ];

  $('specsGrid').innerHTML = specs.map(([label, val]) => `
    <div class="spec-item">
      <div class="spec-label">${escHtml(label)}</div>
      <div class="spec-value ${!val ? 'na' : ''}">${val ? escHtml(val) : 'Not Available'}</div>
    </div>`).join('');

  if (d.errorCode && d.errorCode !== '0') {
    const warning = document.createElement('div');
    warning.className = 'red-flag-item';
    warning.style.marginBottom = '16px';
    warning.innerHTML = `<span class="icon">⚠</span> <span><strong>VIN Decode Warning:</strong> ${escHtml(d.errorText || 'Error code ' + d.errorCode)} — some data may be incomplete or inaccurate.</span>`;
    $('card-overview').querySelector('.card-body').prepend(warning);
  }
}

/* ── Recalls ─────────────────────────────────────────── */
const URGENT_COMPONENTS = /brake|airbag|fuel|fire|steering|engine|seat|seatbelt|child/i;

function renderRecalls(recalls) {
  const badge = $('recallBadge');
  const body  = $('recallBody');

  if (recalls === null) {
    badge.innerHTML = pill('gray', '? Unknown');
    body.innerHTML  = noData('Recall data could not be retrieved from NHTSA — try again later.');
    return;
  }

  if (recalls.length === 0) {
    badge.innerHTML = pill('green', '✓ None Found');
    body.innerHTML  = noData('No open recalls found for this vehicle on NHTSA records.', true);
    return;
  }

  badge.innerHTML = pill(recalls.length > 0 ? 'red' : 'green', `${recalls.length} Open Recall${recalls.length !== 1 ? 's' : ''}`);

  body.innerHTML = `<ul class="recall-list">${recalls.map(r => {
    const urgent = URGENT_COMPONENTS.test(r.component || '');
    return `<li class="recall-item ${urgent ? 'urgent' : ''}">
      <div class="recall-component">${escHtml(r.component || 'Unknown Component')}</div>
      <div class="recall-summary">${escHtml(r.summary || 'No summary available')}</div>
      <div class="recall-meta">
        ${r.campaignNumber ? `<span>Campaign #${escHtml(r.campaignNumber)}</span>` : ''}
        ${r.reportDate     ? `<span>${new Date(r.reportDate).toLocaleDateString()}</span>` : ''}
        ${r.affectedCount  ? `<span>~${formatNum(r.affectedCount)} vehicles</span>` : ''}
      </div>
      ${r.remedy ? `<div style="margin-top:6px;font-size:.78rem;color:var(--green);">Remedy: ${escHtml(r.remedy.substring(0,200))}</div>` : ''}
    </li>`;
  }).join('')}</ul>`;
}

/* ── Complaints ──────────────────────────────────────── */
function renderComplaints(c) {
  const body = $('complaintsBody');

  if (!c) {
    body.innerHTML = noData('Complaint data could not be retrieved from NHTSA.');
    return;
  }

  const hasSevere = c.crashes > 0 || c.fires > 0 || c.deaths > 0;

  body.innerHTML = `
    <div class="complaints-summary">
      <div class="stat-box ${c.total > 50 ? 'danger' : ''}">
        <div class="stat-value">${formatNum(c.total)}</div>
        <div class="stat-label-sm">Total Complaints</div>
      </div>
      <div class="stat-box ${c.crashes > 0 ? 'danger' : ''}">
        <div class="stat-value">${c.crashes || 0}</div>
        <div class="stat-label-sm">Crash Reports</div>
      </div>
      <div class="stat-box ${c.fires > 0 ? 'danger' : ''}">
        <div class="stat-value">${c.fires || 0}</div>
        <div class="stat-label-sm">Fire Reports</div>
      </div>
      <div class="stat-box ${c.deaths > 0 ? 'danger' : ''}">
        <div class="stat-value">${c.deaths || 0}</div>
        <div class="stat-label-sm">Fatalities</div>
      </div>
    </div>

    ${hasSevere ? `<div class="red-flag-item" style="margin-bottom:14px">
      <span class="icon">⚠</span>
      <span>Complaints include serious incidents (crashes, fires, or fatalities). Investigate thoroughly before purchase.</span>
    </div>` : ''}

    ${c.total === 0 ? noData('No safety complaints on file with NHTSA.', true) : ''}

    ${Object.keys(c.byComponent || {}).length > 0 ? `
      <div style="margin-top:2px">
        <div class="spec-label" style="margin-bottom:8px">Top Reported Components</div>
        ${Object.entries(c.byComponent)
          .sort(([,a],[,b]) => b - a)
          .slice(0, 8)
          .map(([k, v]) => `<div class="component-row">
            <span class="component-name">${escHtml(k)}</span>
            <span class="component-count">${v}</span>
          </div>`).join('')}
      </div>` : ''}`;
}

/* ── Market Data ─────────────────────────────────────── */
function renderMarketData(m) {
  const body = $('marketBody');

  if (!m || !m.available) {
    body.innerHTML = noData(m?.message || 'Market data not available. Add a MARKETCHECK_API_KEY to enable live pricing.');
    return;
  }

  if (!m.stats) {
    body.innerHTML = noData(m.message || 'No active listings found for this vehicle.');
    return;
  }

  const { stats, sampleListings } = m;
  const pr = stats.priceRange;

  body.innerHTML = `
    ${pr ? `<div class="market-price-hero">
      <div class="market-price-label">Average Asking Price</div>
      <div class="market-price-value">${formatUSD(pr.avg)}</div>
      <div class="market-price-range">Range: ${formatUSD(pr.min)} – ${formatUSD(pr.max)} &nbsp;|&nbsp; Median: ${formatUSD(pr.median)}</div>
    </div>` : ''}

    <div class="market-stats-row">
      <div class="spec-item market-stat">
        <div class="spec-label">Active Listings</div>
        <div class="spec-value">${stats.listingCount}</div>
      </div>
      ${stats.mileageAvg ? `<div class="spec-item market-stat">
        <div class="spec-label">Avg Mileage</div>
        <div class="spec-value">${formatNum(stats.mileageAvg)} mi</div>
      </div>` : ''}
    </div>

    ${sampleListings?.length ? `
      <div class="spec-label" style="margin-bottom:8px">Sample Listings</div>
      <ul class="market-listings">
        ${sampleListings.map(l => `<li class="listing-item">
          <span class="listing-price">${formatUSD(l.price)}</span>
          <span class="listing-detail">${[l.miles ? formatNum(l.miles) + ' mi' : null, l.city, l.state].filter(Boolean).join(' • ')}</span>
          ${l.url ? `<a class="listing-link" href="${escHtml(l.url)}" target="_blank" rel="noopener">View →</a>` : ''}
        </li>`).join('')}
      </ul>` : ''}

    <p style="font-size:.73rem;color:var(--text-faint);margin-top:12px">Powered by Marketcheck. Prices reflect current market listings and may vary.</p>`;
}

/* ── Images ──────────────────────────────────────────── */
function renderImages(images, vinData) {
  const card = $('card-images');
  const grid = $('imagesGrid');
  const note = $('imagesNote');

  if (!images || !images.available || !images.images?.length) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  if (images.broadSearch) {
    note.textContent = 'Representative images — not the exact vehicle';
  }

  grid.innerHTML = images.images.map(img => `
    <div class="image-item" onclick="window.open('${escHtml(img.unsplashUrl)}','_blank','noopener')">
      <img src="${escHtml(img.thumbUrl)}"
           data-src="${escHtml(img.url)}"
           alt="${escHtml(img.altDescription || 'Vehicle image')}"
           loading="lazy">
      <div class="image-credit">
        Photo by <a href="${escHtml(img.photographerUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escHtml(img.photographer)}</a> on Unsplash
      </div>
    </div>`).join('');

  // Lazy-load full images
  const imgs = grid.querySelectorAll('img[data-src]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.src = e.target.dataset.src; io.unobserve(e.target); } });
  }, { rootMargin: '200px' });
  imgs.forEach(i => io.observe(i));
}

/* ── AI Summary ──────────────────────────────────────── */
function renderAiSummary(ai) {
  const body    = $('aiBody');
  const verdict = $('verdictBadge');

  if (!ai || !ai.available) {
    body.innerHTML = noData(ai?.message || 'AI analysis not available. Add an ANTHROPIC_API_KEY to enable buying recommendations.');
    verdict.classList.add('hidden');
    return;
  }

  // Detect verdict
  const text = ai.summary || '';
  let cls = null, label = null;

  if (/\bAVOID\b/i.test(text)) {
    cls = 'avoid'; label = 'Avoid';
  } else if (/PROCEED\s+WITH\s+CAUTION/i.test(text) || /\bCAUTION\b/i.test(text)) {
    cls = 'caution'; label = 'Proceed with Caution';
  } else if (/GOOD\s+BUY/i.test(text)) {
    cls = 'good'; label = 'Good Buy';
  }

  if (cls) {
    verdict.className  = `verdict-badge ${cls}`;
    verdict.innerHTML  = `<span class="verdict-dot"></span>${escHtml(label)}`;
    verdict.classList.remove('hidden');
  } else {
    verdict.classList.add('hidden');
  }

  // Render markdown-lite: bold, bullet points, sections
  body.innerHTML = `<div class="ai-body">${markdownLite(text)}</div>`;
  body.className = 'card-body';
}

function markdownLite(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,4}\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[hul])(.)/gm, '$1')
    .replace(/\n/g, '<br>')
    .replace(/^(.)/,'<p>$1')
    .replace(/(.)$/,'$1</p>');
}

/* ── Shared UI Helpers ───────────────────────────────── */
function pill(cls, text) {
  return `<span class="status-pill ${cls}">${escHtml(text)}</span>`;
}

function noData(msg, isGood = false) {
  const icon = isGood ? '✓' : 'ℹ';
  return `<div class="no-data-msg">
    <span style="color:${isGood ? 'var(--green)' : 'var(--text-muted)'}">${icon}</span>
    <span>${escHtml(msg)}</span>
  </div>`;
}

/* ── Recent Lookups Modal ────────────────────────────── */
$('recentBtn').addEventListener('click', async () => {
  $('recentModal').classList.remove('hidden');
  $('recentBody').innerHTML = '<div class="loading-placeholder">Loading…</div>';

  try {
    const resp = await fetch('/api/vin/recent');
    const data = await resp.json();
    const items = data.recent || [];

    if (!items.length) {
      $('recentBody').innerHTML = '<div class="loading-placeholder">No lookups yet.</div>';
      return;
    }

    $('recentBody').innerHTML = `<ul class="recent-list">${items.map(r => `
      <li class="recent-item" data-vin="${escHtml(r.vin)}" onclick="loadRecentVin(this)">
        <div>
          <div class="recent-vehicle">${escHtml([r.year, r.make, r.model].filter(Boolean).join(' ') || 'Unknown Vehicle')}</div>
          <div class="recent-vin">${escHtml(r.vin)}</div>
        </div>
        <div class="recent-count">${r.lookup_count}× looked up</div>
      </li>`).join('')}
    </ul>`;
  } catch {
    $('recentBody').innerHTML = '<div class="loading-placeholder">Failed to load recent lookups.</div>';
  }
});

function loadRecentVin(el) {
  const vin = el.getAttribute('data-vin');
  vinInput.value = vin;
  closeModal();
  vinInput.dispatchEvent(new Event('input'));
  lookupVin(vin);
}

function closeModal() { $('recentModal').classList.add('hidden'); }
$('modalClose').addEventListener('click', closeModal);
$('modalBackdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const dns = require('dns').promises;

const app = express();
const PORT = process.env.PORT || 3002;

// The single ticker this app tracks. One place to change if it ever needs to.
const SYMBOL = process.env.STOCK_SYMBOL || 'IBM';

// Serve static files from the root or a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------------
// Tiny in-memory TTL cache with stale-on-error: Yahoo rate-limits
// aggressively, so every visitor must NOT trigger a fresh upstream
// request. If a refresh fails and we still hold an expired value,
// serve that — stale beats a 500.
// ------------------------------------------------------------------
const cache = new Map(); // key -> { value, expires }
async function withCache(key, ttlMs, fn) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { value, expires: now + ttlMs });
    return value;
  } catch (e) {
    if (hit) return hit.value; // stale beats failure
    throw e;
  }
}

// Fetch + parse a Yahoo Finance chart URL (fetchHtml is defined below and hoisted).
async function yahooChart(query) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${query}`;
  const body = await fetchHtml(url, 0, 'application/json');
  if (body.trim().startsWith('<')) {
    throw new Error('Yahoo Finance returned HTML instead of JSON (rate limited or blocked)');
  }
  const json = JSON.parse(body);
  if (!json.chart || !json.chart.result || !json.chart.result[0]) {
    throw new Error('Invalid response structure from Yahoo Finance');
  }
  return json.chart.result[0];
}

// Fetch USD to EUR Exchange Rate from open.er-api.com (cached: the feed updates daily)
function getExchangeRate() {
  return withCache('fx_usd_eur', 60 * 60 * 1000, async () => {
    const json = JSON.parse(await fetchHtml('https://open.er-api.com/v6/latest/USD', 0, 'application/json'));
    if (json && json.rates && json.rates.EUR) return json.rates.EUR;
    throw new Error('no EUR rate in response');
  }).catch(() => 0.92); // Reasonable fallback
}

// Current stock quote (cached 60 s — plenty "live" for a salary tool).
function getStockPrice() {
  return withCache(`quote_${SYMBOL}`, 60 * 1000, async () => {
    const result = await yahooChart(SYMBOL);
    return {
      price: result.meta.regularMarketPrice,
      previousClose: result.meta.previousClose
    };
  });
}

// Endpoint to get historical stock prices (monthly averages over the last N months)
app.get('/api/stock/historical', async (req, res) => {
  const months = parseInt(req.query.months) || 12;

  try {
    // Monthly averages barely change — cache the whole series per month count.
    const recentMonths = await withCache(`hist_${SYMBOL}_${months}`, 6 * 60 * 60 * 1000, async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - (months + 1));

      const period1 = Math.floor(startDate.getTime() / 1000);
      const period2 = Math.floor(endDate.getTime() / 1000);

      // For long ranges use Yahoo's native monthly bars: daily data over decades is huge and
      // Yahoo silently coarsens the granularity anyway. IBM data reaches back to 1962-01.
      const interval = months > 119 ? '1mo' : '1d';
      const result = await yahooChart(`${SYMBOL}?period1=${period1}&period2=${period2}&interval=${interval}`);
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0].close;

      // Group by month and calculate averages
      const monthlyPrices = {};
      for (let i = 0; i < timestamps.length; i++) {
        const date = new Date(timestamps[i] * 1000);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyPrices[monthKey]) {
          monthlyPrices[monthKey] = [];
        }
        if (prices[i] !== null) {
          monthlyPrices[monthKey].push(prices[i]);
        }
      }

      const monthlyAverages = [];
      for (const month of Object.keys(monthlyPrices).sort()) {
        const pricesInMonth = monthlyPrices[month];
        monthlyAverages.push({
          month: month,
          averagePrice: pricesInMonth.reduce((sum, p) => sum + p, 0) / pricesInMonth.length
        });
      }

      // Take only the last N months
      return monthlyAverages.slice(-months);
    });

    res.json({
      success: true,
      months: recentMonths,
      exchangeRate: await getExchangeRate(),
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch historical data',
      error: error.message
    });
  }
});

// Clamp + hour-align a client-supplied unix range so equivalent requests share one
// cache entry (the frontend passes period2 = Date.now(), unique on every reload —
// hour granularity is irrelevant for daily/monthly bars).
function normalizeRange(req) {
  const period1 = parseInt(req.query.period1);
  let period2 = parseInt(req.query.period2);
  if (!period1 || !period2) return null;
  period2 = Math.min(period2, Math.floor(Date.now() / 1000));
  period2 = Math.floor(period2 / 3600) * 3600;
  return { period1, period2 };
}

// Endpoint to get historical stock prices for a specific date range
app.get('/api/stock/historical-range', async (req, res) => {
  const range = normalizeRange(req);
  if (!range) {
    return res.status(400).json({
      success: false,
      message: 'Missing period1 or period2 parameters'
    });
  }

  try {
    const priceData = await withCache(`range_${SYMBOL}_${range.period1}_${range.period2}`, 6 * 60 * 60 * 1000, async () => {
      const result = await yahooChart(`${SYMBOL}?period1=${range.period1}&period2=${range.period2}&interval=1d`);
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0].close;

      // Build array of {timestamp, price}
      const data = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (prices[i] !== null) {
          data.push({
            timestamp: timestamps[i] * 1000, // Convert to milliseconds
            price: prices[i]
          });
        }
      }
      return data;
    });

    res.json({
      success: true,
      prices: priceData,
      count: priceData.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch historical data',
      error: error.message
    });
  }
});

// Endpoint to get historical USD/EUR exchange rates for a specific date range
app.get('/api/forex/historical-range', async (req, res) => {
  const range = normalizeRange(req);
  if (!range) {
    return res.status(400).json({
      success: false,
      message: 'Missing period1 or period2 parameters'
    });
  }

  try {
    const priceData = await withCache(`fxrange_${range.period1}_${range.period2}`, 6 * 60 * 60 * 1000, async () => {
      const fxInterval = (range.period2 - range.period1) > 10 * 365.25 * 86400 ? '1mo' : '1d';
      const result = await yahooChart(`USDEUR=X?period1=${range.period1}&period2=${range.period2}&interval=${fxInterval}`);
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0].close;

      const data = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (prices[i] !== null && prices[i] !== undefined) {
          data.push({
            timestamp: timestamps[i] * 1000,
            rate: prices[i]
          });
        }
      }
      return data;
    });

    res.json({
      success: true,
      rates: priceData,
      count: priceData.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch historical forex data',
      error: error.message
    });
  }
});

// Endpoint to get current stock price (for portfolio module)
app.get('/api/stock/current', async (req, res) => {
  try {
    const exchangeRate = await getExchangeRate();
    const stockData = await getStockPrice();

    res.json({
      success: true,
      price: stockData.price,
      previousClose: stockData.previousClose,
      exchangeRate: exchangeRate,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current stock price',
      error: error.message
    });
  }
});

// Endpoint to get current stock price in EUR and USD (legacy)
app.get('/api/stock', async (req, res) => {
  try {
    const exchangeRate = await getExchangeRate();
    const stockData = await getStockPrice();

    const usdPrice = stockData.price;
    const eurPrice = parseFloat((usdPrice * exchangeRate).toFixed(2));
    const previousCloseUSD = stockData.previousClose;
    const previousCloseEUR = parseFloat((previousCloseUSD * exchangeRate).toFixed(2));
    
    res.json({
      success: true,
      usdPrice,
      eurPrice,
      previousCloseUSD,
      previousCloseEUR,
      exchangeRate,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching stock data:', error.message);
    res.status(500).json({
      success: false,
      message: 'Could not fetch live stock price',
      error: error.message,
      // Provide fallback values if live API fails
      usdPrice: 175.40,
      eurPrice: 161.20,
      exchangeRate: 0.919,
      fallback: true
    });
  }
});

// ============================================================
// Amazon product goal extraction (for the goal tracker)
// ============================================================
const AMAZON_HOST = /(^|\.)amazon\.(de|com|co\.uk|fr|it|es|nl|se|pl|com\.be|com\.tr|ca|com\.mx|co\.jp|in|com\.au|ae|sa|eg)$/i;

// Self-hosted SearXNG instance (reachable only inside the deployment network). JSON output must be
// enabled in the instance's settings.yml (search.formats: [html, json]). Overridable via env.
const SEARXNG_URL = (process.env.SEARXNG_URL || 'http://192.168.178.157:8084').replace(/\/+$/, '');

// SSRF guard for URLs we fetch on behalf of the user (pasted links + search-result pages).
// Requires http(s) and rejects hosts that resolve to loopback/private/link-local ranges.
function isPrivateIp(ip) {
  if (ip.includes(':')) { // IPv6
    const a = ip.toLowerCase();
    return a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80') || a.startsWith('::ffff:127.') || a === '::';
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => Number.isNaN(n))) return true; // treat unparsable as unsafe
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) ||           // link-local
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) // CGNAT
  );
}

// Validates the URL and returns it together with the resolved address, so the
// caller can PIN the connection to exactly the IP that was checked (otherwise a
// DNS-rebinding host could pass the check and then resolve to a private IP for
// the actual request).
async function assertSafeUrl(targetUrl) {
  let u;
  try { u = new URL(targetUrl); } catch { throw new Error('Ungültiger Link.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Nur http/https erlaubt.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  // IP literal → check directly; hostname → resolve and check every address.
  if (/^[0-9.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new Error('Private Adressen sind nicht erlaubt.');
    return { u, address: host, family: host.includes(':') ? 6 : 4 };
  }
  if (/^localhost$|\.local$/i.test(host)) throw new Error('Private Hosts sind nicht erlaubt.');
  const addrs = await dns.lookup(host, { all: true });
  if (addrs.length === 0) throw new Error('Host nicht auflösbar.');
  if (addrs.some(a => isPrivateIp(a.address))) throw new Error('Host löst auf eine private Adresse auf.');
  return { u, address: addrs[0].address, family: addrs[0].family };
}

// Fetch a URL with Node https (no shell -> no command injection), following redirects,
// and transparently decompressing gzip/deflate/br responses.
//
// guard=true is for URLs that came from a user or from search results: EVERY hop
// (including each redirect target — a hostile page can 302 to an internal address)
// is validated by assertSafeUrl and the socket connects to the exact IP that was
// validated. guard=false is for server-side constructed URLs (Yahoo, SearXNG).
async function fetchHtml(targetUrl, redirects = 0, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', guard = false) {
  if (redirects > 5) throw new Error('Too many redirects');

  let u;
  let pinned = null; // { address, family } from assertSafeUrl when guarded
  if (guard) {
    const safe = await assertSafeUrl(targetUrl);
    u = safe.u;
    pinned = { address: safe.address, family: safe.family };
  } else {
    try { u = new URL(targetUrl); } catch { throw new Error('Invalid URL'); }
  }

  return new Promise((resolve, reject) => {
    const transport = u.protocol === 'http:' ? http : https;
    const options = {
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': accept,
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    };
    if (pinned) {
      // Pin the connection to the address we validated (TLS SNI/Host still use the hostname).
      options.lookup = (hostname, opts, cb) => {
        if (opts && opts.all) return cb(null, [{ address: pinned.address, family: pinned.family }]);
        cb(null, pinned.address, pinned.family);
      };
    }
    const reqObj = transport.get(options, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        resp.resume();
        const next = new URL(resp.headers.location, targetUrl).href;
        return resolve(fetchHtml(next, redirects + 1, accept, guard));
      }
      let stream = resp;
      const enc = (resp.headers['content-encoding'] || '').toLowerCase();
      try {
        if (enc === 'gzip') stream = resp.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = resp.pipe(zlib.createInflate());
        else if (enc === 'br') stream = resp.pipe(zlib.createBrotliDecompress());
      } catch (e) { /* fall back to raw */ }
      const chunks = [];
      let total = 0;
      stream.on('data', (c) => {
        total += c.length;
        if (total > 8 * 1024 * 1024) { resp.destroy(); return; } // 8MB cap
        chunks.push(c);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
    reqObj.on('error', reject);
    reqObj.setTimeout(15000, () => reqObj.destroy(new Error('Timeout')));
  });
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&euro;/g, '€').replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function metaContent(html, prop) {
  const res = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
  ];
  for (const re of res) { const m = re.exec(html); if (m && m[1]) return decodeEntities(m[1]); }
  return null;
}

function parseMoney(raw) {
  if (!raw) return null;
  raw = decodeEntities(String(raw)).trim();
  let currency = null;
  if (/€|EUR/i.test(raw)) currency = 'EUR';
  else if (/\$|USD/i.test(raw)) currency = 'USD';
  else if (/£|GBP/i.test(raw)) currency = 'GBP';
  const s = raw.replace(/[^0-9.,]/g, '');
  if (!s) return null;

  // Find the last '.' or ',' — for prices that is the decimal separator IF it's followed by
  // 1–2 digits (a thousands group is always 3). Everything before it (any other '.'/',') is
  // thousands grouping. If 3+ trailing digits, all separators are thousands groupings.
  // Handles: 3.546,20 (de) · 3,546.20 (en) · 3.546.20 · 35.462 · 1.234.567,89 · 1299 · 3546.2
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let num;
  if (lastSep === -1) {
    num = s;
  } else {
    const decimals = s.length - lastSep - 1;
    if (decimals >= 1 && decimals <= 2) {
      num = s.slice(0, lastSep).replace(/[.,]/g, '') + '.' + s.slice(lastSep + 1);
    } else {
      num = s.replace(/[.,]/g, '');
    }
  }
  const amount = parseFloat(num);
  if (!isFinite(amount) || amount <= 0) return null;
  return { amount, currency };
}

// Approx EUR conversion for currencies the frontend can't convert (USD/GBP are left native so the
// frontend can apply the live USD rate). Prevents e.g. a 35462 SEK listing showing as "35462 €".
const EUR_PER = { SEK: 0.088, DKK: 0.134, NOK: 0.086, CHF: 1.04, PLN: 0.23, CZK: 0.040, HUF: 0.0025, RON: 0.20, BGN: 0.51, JPY: 0.0060, CAD: 0.67, AUD: 0.60 };
function normalizeCurrency(price) {
  if (!price) return null;
  const cur = price.currency;
  if (!cur || cur === 'EUR' || cur === 'USD' || cur === 'GBP') return { amount: price.amount, currency: cur || null };
  const rate = EUR_PER[cur.toUpperCase()];
  if (rate) return { amount: price.amount * rate, currency: 'EUR', originalCurrency: cur };
  return { amount: price.amount, currency: cur }; // unknown currency → pass through (frontend warns)
}

function extractPrice(html) {
  let m = /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/.exec(html);
  if (m) {
    const cur = /"currencyCode"\s*:\s*"([A-Z]{3})"/.exec(html);
    return { amount: parseFloat(m[1]), currency: cur ? cur[1] : null };
  }
  const offscreen = [...html.matchAll(/class="a-offscreen">\s*([^<]+?)\s*<\/span>/gi)].map(x => x[1]);
  for (const raw of offscreen) { const p = parseMoney(raw); if (p) return p; }
  // Prefer a QUOTED price string ("975.00"); unquoted integers are often cents (e.g. 97500)
  // or analytics values that would come out 100× too large.
  m = /"price"\s*:\s*"([0-9][0-9.,]*)"/.exec(html);
  if (m) { const p = parseMoney(m[1]); if (p) return p; }
  m = /"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/.exec(html); // last resort: unquoted decimal
  if (m) { const p = parseMoney(m[1]); if (p) return p; }
  return null;
}

// Walk a parsed JSON-LD value (object/array/@graph) looking for a schema.org Product/Offer.
function findProductInJsonLd(node, acc) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => findProductInJsonLd(n, acc)); return; }
  if (node['@graph']) findProductInJsonLd(node['@graph'], acc);
  const types = [].concat(node['@type'] || []).map(t => String(t).toLowerCase());
  if (types.includes('product')) {
    if (!acc.title && node.name) acc.title = decodeEntities(String(node.name));
    const img = Array.isArray(node.image) ? node.image[0] : (node.image && node.image.url) || node.image;
    if (!acc.image && img) acc.image = decodeEntities(String(img));
  }
  // Offer (may be nested under offers, or standalone). parseMoney handles both spec ("1299.00")
  // and localized ("1.299,00") number strings.
  const offers = [].concat(node.offers || (types.includes('offer') ? node : []));
  for (const o of offers) {
    if (!o || typeof o !== 'object') continue;
    let parsed = null;
    let cur = o.priceCurrency || null;
    const direct = o.price ?? o.lowPrice;
    if (direct != null) {
      parsed = parseMoney(String(direct));
    } else if (o.priceSpecification) {
      // priceSpecification can be a single object OR an array (e.g. current sale price + list
      // price). Pick the LOWEST valid price — that's what the customer actually pays.
      for (const s of [].concat(o.priceSpecification)) {
        if (!s || typeof s !== 'object' || s.price == null) continue;
        const pm = parseMoney(String(s.price));
        if (pm && (!parsed || pm.amount < parsed.amount)) { parsed = pm; cur = s.priceCurrency || cur; }
      }
    }
    if (!acc.price && parsed) acc.price = { amount: parsed.amount, currency: cur || parsed.currency || null };
  }
  // Recurse into nested objects (offers already handled, but products can nest).
  for (const k of Object.keys(node)) {
    if (k === 'offers' || k === '@graph') continue;
    if (node[k] && typeof node[k] === 'object') findProductInJsonLd(node[k], acc);
  }
}

function extractJsonLd(html) {
  const acc = {};
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let raw = b[1].trim();
    try { findProductInJsonLd(JSON.parse(raw), acc); }
    catch {
      // Some sites concatenate multiple objects or include trailing junk; try a lenient first-object parse.
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { findProductInJsonLd(JSON.parse(m[0]), acc); } catch { /* ignore */ } }
    }
    if (acc.title && acc.image && acc.price) break;
  }
  return acc;
}

// Extract {title, image, price:{amount,currency}} from a product page (any shop).
// Order of trust: schema.org JSON-LD → Open Graph → Amazon-specific DOM fallbacks.
function extractProduct(html, host) {
  const ld = extractJsonLd(html);

  let title = ld.title || metaContent(html, 'og:title');
  if (!title) { const t = /<title[^>]*>([^<]+)<\/title>/i.exec(html); if (t) title = decodeEntities(t[1]); }
  if (!title) { const t = /id="productTitle"[^>]*>\s*([^<]+?)\s*</i.exec(html); if (t) title = decodeEntities(t[1]); }
  if (title && AMAZON_HOST.test(host || '')) {
    title = title.replace(/^Amazon\.[a-z.]+\s*[:\-]\s*/i, '').replace(/\s*[:\-]\s*Amazon\.[a-z.]+.*$/i, '').trim();
  }

  let image = ld.image || metaContent(html, 'og:image');
  if (!image) { const im = /id="landingImage"[^>]*\sdata-old-hires="([^"]+)"/i.exec(html) || /id="landingImage"[^>]*\ssrc="([^"]+)"/i.exec(html); if (im) image = decodeEntities(im[1]); }
  if (!image) { const im = /data-a-dynamic-image=["']\{(?:&quot;|")(https:\/\/[^"&]+?)(?:&quot;|")/i.exec(html); if (im) image = decodeEntities(im[1]); }
  if (!image) { const im = /"hiRes"\s*:\s*"(https:\/\/[^"]+\.jpg)"/i.exec(html) || /"large"\s*:\s*"(https:\/\/[^"]+\.jpg)"/i.exec(html); if (im) image = im[1]; }

  const price = ld.price || extractPrice(html);
  return { title: title || null, image: image || null, price: price || null };
}

app.get('/api/product', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, message: 'Kein Link angegeben.' });
  }
  let u;
  try { ({ u } = await assertSafeUrl(url)); }
  catch (e) { return res.status(400).json({ success: false, message: e.message }); }
  const host = u.hostname;
  try {
    const html = await fetchHtml(url, 0, undefined, true); // guarded: user-supplied URL
    if (!html) throw new Error('Leere Antwort');

    const { title, image, price } = extractProduct(html, host);
    const blocked = !price && /Bot Check|automated access|Geben Sie die Zeichen|To discuss automated access|api-services-support@amazon/i.test(html);
    const norm = normalizeCurrency(price);

    res.json({
      success: !!(title || image || price) && !blocked,
      blocked,
      title: title || null,
      image: image || null,
      price: norm ? Math.round(norm.amount * 100) / 100 : null,
      currency: norm ? (norm.currency || null) : null,
      originalCurrency: norm && norm.originalCurrency || null,
      host
    });
  } catch (e) {
    res.status(502).json({ success: false, message: 'Konnte die Produktseite nicht laden: ' + e.message });
  }
});

// Query the self-hosted SearXNG instance and return parsed JSON results.
async function searxng(query, category) {
  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&language=de` +
    (category ? `&categories=${encodeURIComponent(category)}` : '');
  const body = await fetchHtml(url, 0, 'application/json,text/html;q=0.9,*/*;q=0.8');
  try { return JSON.parse(body); } catch { throw new Error('SearXNG lieferte kein gültiges JSON (ist format=json aktiviert?)'); }
}

// Free-text goal resolver: SearXNG finds candidate product pages + an image, then the
// deterministic extractor pulls a trustworthy price/image from the best candidate page.
app.get('/api/resolve-goal', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ success: false, message: 'Kein Suchbegriff angegeben.' });

  let general, images;
  try {
    [general, images] = await Promise.all([
      searxng(q, 'general'),
      searxng(q, 'images').catch(() => null) // image search is a nice-to-have
    ]);
  } catch (e) {
    return res.status(502).json({ success: false, message: 'SearXNG nicht erreichbar: ' + e.message });
  }

  const results = (general && Array.isArray(general.results)) ? general.results : [];
  // Candidate product pages: skip non-shop noise (encyclopedias, video, social).
  const skip = /(^|\.)(wikipedia|wikimedia|youtube|youtu\.be|reddit|facebook|instagram|twitter|x|pinterest|tiktok)\.|google\.[a-z.]+\/search/i;
  const candidates = [];
  for (const r of results) {
    if (!r || !r.url || skip.test(r.url)) continue;
    candidates.push(r);
    if (candidates.length >= 4) break;
  }

  // Extract from each candidate, then pick the BEST — preferring EUR-priced German shops so a
  // foreign-currency listing (e.g. 35462 SEK) can't masquerade as €35462.
  const cands = [];
  for (const c of candidates) {
    try {
      const html = await fetchHtml(c.url, 0, undefined, true); // guarded: URL from search results
      const p = extractProduct(html, new URL(c.url).hostname);
      cands.push({ ...p, url: c.url, host: new URL(c.url).hostname });
    } catch { /* skip this candidate */ }
    // Stop early once we have a confident EUR hit with an image.
    if (cands.some(x => x.price && (x.price.currency === 'EUR' || !x.price.currency) && x.image)) break;
  }

  const priceScore = (x) => {
    if (!x.price) return 0;
    const cur = x.price.currency;
    if (cur === 'EUR') return 4;
    if (!cur && /\.(de|at)$/i.test(x.host)) return 3; // German/Austrian shop, unlabelled → assume EUR
    if (!cur) return 2;
    if (EUR_PER[String(cur).toUpperCase()]) return 1.5; // exotic but convertible
    return 1;                                            // USD/GBP (frontend converts)
  };
  const priced = cands.filter(x => x.price).sort((a, b) => priceScore(b) - priceScore(a) || ((b.image ? 1 : 0) - (a.image ? 1 : 0)));
  const best = priced[0] || cands.find(x => x.image) || cands[0] || {};

  const price = best.price ? normalizeCurrency(best.price) : null;
  const sourceUrl = best.url || (candidates[0] && candidates[0].url) || null;

  // Image: chosen candidate → any candidate → SearXNG image search.
  let image = best.image || (cands.find(x => x.image) || {}).image || null;
  if (!image && images && Array.isArray(images.results)) {
    const img = images.results.find(r => r && (r.img_src || r.thumbnail_src || r.thumbnail));
    if (img) image = img.img_src || img.thumbnail_src || img.thumbnail;
  }

  // Name: a descriptive extracted title, else the user's query (which reads best as a goal name
  // and avoids picking up a bare variant label like "Light Grey").
  const cand = best.title && best.title.replace(/\s+/g, ' ').trim();
  const title = (cand && cand.length >= 12 && /\s/.test(cand)) ? cand : q;

  res.json({
    success: !!(title || image || price),
    title,
    image: image || null,
    price: price ? Math.round(price.amount * 100) / 100 : null,
    currency: price ? (price.currency || 'EUR') : null,
    originalCurrency: price && price.originalCurrency || null,
    sourceUrl,
    query: q
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
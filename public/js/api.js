// Thin wrappers over the backend JSON endpoints. Each returns parsed JSON (or the
// rejected fetch/parse promise). Centralizes the /api/* URLs in one place.

async function getJson(url) {
  const response = await fetch(url);
  return response.json();
}

// Current IBM quote in EUR + USD (legacy endpoint with fallback fields).
export const fetchStock = () => getJson('/api/stock');

// Current IBM price + USD/EUR rate (portfolio module).
export const fetchCurrentStock = () => getJson('/api/stock/current');

// Monthly average IBM prices over the last N months.
export const fetchHistorical = (months) => getJson(`/api/stock/historical?months=${months}`);

// Daily IBM closes for a unix-second range.
export const fetchHistoricalRange = (period1, period2) =>
  getJson(`/api/stock/historical-range?period1=${period1}&period2=${period2}`);

// Daily USD→EUR rates for a unix-second range.
export const fetchForexRange = (period1, period2) =>
  getJson(`/api/forex/historical-range?period1=${period1}&period2=${period2}`);

// Resolve a pasted product link → { title, image, price, ... }.
export const fetchProduct = (url) => getJson(`/api/product?url=${encodeURIComponent(url)}`);

// Resolve a free-text goal via SearXNG → { title, image, price, sourceUrl, ... }.
export const fetchResolveGoal = (q) => getJson(`/api/resolve-goal?q=${encodeURIComponent(q)}`);

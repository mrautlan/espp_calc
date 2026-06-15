// Pure formatting / parsing helpers. No DOM access, no app state.

// Escape a string for safe interpolation into innerHTML. Use for any text that
// originates OUTSIDE the app — e.g. product titles scraped from arbitrary shop
// pages in the goal tracker, which the backend HTML-decodes before returning.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Parse a number written in German (1.234,56) or plain (1234.56) notation.
// Returns 0 when the input can't be parsed.
export function parseGermanNumber(str) {
  if (!str) return 0;
  let clean = String(str).replace(/\s+/g, '');
  if (clean.includes('.') && clean.includes(',')) {
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(/,/g, '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(/,/g, '.');
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      clean = clean.replace(/\./g, '');
    }
  }
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

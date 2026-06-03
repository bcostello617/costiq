export function formatCurrency(value, compact = false) {
  if (value == null || isNaN(value)) return '—';
  if (compact && Math.abs(value) >= 1e6) {
    return '$' + (value / 1e6).toFixed(1) + 'M';
  }
  if (compact && Math.abs(value) >= 1e3) {
    return '$' + (value / 1e3).toFixed(0) + 'K';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPSF(value) {
  if (value == null || isNaN(value)) return '—';
  return '$' + value.toFixed(1);
}

export function formatPercent(value, decimals = 1) {
  if (value == null || isNaN(value)) return '—';
  return value.toFixed(decimals) + '%';
}

export function calcCostPerUnit(totalCost, unitCount) {
  if (!unitCount || !totalCost) return 0;
  return totalCost / unitCount;
}

export function calcCostPerSF(totalCost, grossSF) {
  if (!grossSF || !totalCost) return 0;
  return totalCost / grossSF;
}

export function calcDensity(unitCount, acres) {
  if (!acres || !unitCount) return 0;
  return unitCount / acres;
}

export function calcDuration(startDate, completionDate) {
  if (!startDate || !completionDate) return 0;
  const start = new Date(startDate);
  const end = new Date(completionDate);
  const diffMs = end - start;
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44)); // months
}

export function getPercentile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower]);
}

export function getMedian(values) {
  return getPercentile(values, 50);
}

export function getAverage(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];
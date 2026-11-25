function isValidDateString(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidTimeString(val) {
  if (typeof val !== 'string') return false;
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(val.trim());
}

function parseNonNegativeMoney(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = typeof val === 'number' ? val : (typeof val === 'string' && val.trim() !== '' ? Number(val.trim()) : NaN);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function countWorkingDays(startDateStr, endDateStr) {
  if (!isValidDateString(startDateStr) || !isValidDateString(endDateStr)) return 0;
  if (startDateStr > endDateStr) return 0;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const curr = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  let count = 0;
  while (curr <= end) {
    const dow = curr.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return count;
}

module.exports = {
  isValidDateString,
  isValidTimeString,
  parseNonNegativeMoney,
  countWorkingDays
};

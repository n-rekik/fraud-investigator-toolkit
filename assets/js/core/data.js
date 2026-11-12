// Shared helpers used by every analytic.
// Pure functions only: no DOM, no network. They run the same way in the
// browser and in Node (for the automated tests in /tests).

// ---------- Numbers ----------

/**
 * Turn a cell into a number. Handles "1,234.56", "1.234,56", "€ 1 234",
 * "(500.00)" for negatives, and real numbers. Returns null when it cannot.
 */
export function parseAmount(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/-$/.test(s)) { negative = true; s = s.slice(0, -1); }
  s = s.replace(/[^\d.,\-]/g, '');
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // "1,234" or "1,234,567" = thousands; "12,5" or "1234,56" = decimal.
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.');
  } else if (lastDot > -1 && /^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, ''); // "1.234.567"
  }
  if ((s.match(/\./g) || []).length > 1) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Round to cents so 0.1 + 0.2 style float noise does not break matching. */
export const cents = (n) => Math.round(n * 100);

// ---------- Dates ----------

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/**
 * Turn a cell into a Date (local time). `order` is 'DMY' (default, 31/12/2026)
 * or 'MDY' (12/31/2026). Also reads ISO dates, Excel serial numbers and
 * "12 Mar 2026". A time part ("14:05" or "2:05 PM") is kept when present.
 */
export function parseDate(value, order = 'DMY') {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return excelSerialToDate(value);
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToDate(Number(s));

  const time = parseTime(s);
  let y, m, d;
  let match;
  if ((match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    [, y, m, d] = match.map(Number);
  } else if ((match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let a = Number(match[1]), b = Number(match[2]);
    y = Number(match[3]);
    if (y < 100) y += 2000;
    if (a > 12) { d = a; m = b; }
    else if (b > 12) { m = a; d = b; }
    else if (order === 'MDY') { m = a; d = b; }
    else { d = a; m = b; }
  } else if ((match = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[A-Za-z]*[ -,]*(\d{4})/))) {
    d = Number(match[1]); m = (MONTHS[match[2].toLowerCase()] ?? -1) + 1; y = Number(match[3]);
  } else if ((match = s.match(/^([A-Za-z]{3})[A-Za-z]* (\d{1,2}),? (\d{4})/))) {
    m = (MONTHS[match[1].toLowerCase()] ?? -1) + 1; d = Number(match[2]); y = Number(match[3]);
  } else {
    return null;
  }
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900)) return null;
  const date = new Date(y, m - 1, d, time ? time.h : 0, time ? time.min : 0, time ? time.sec : 0);
  if (date.getMonth() !== m - 1) return null; // e.g. 31 February
  date._hasTime = Boolean(time);
  return date;
}

function parseTime(s) {
  const m = s.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3] || 0);
  if (m[4]) {
    const pm = m[4].toLowerCase() === 'pm';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return { h, min, sec };
}

function excelSerialToDate(serial) {
  if (!(serial > 59 && serial < 2958466)) return null;
  const days = Math.floor(serial);
  const fraction = serial - days;
  const date = new Date(1899, 11, 30 + days);
  if (fraction > 0) {
    const seconds = Math.round(fraction * 86400);
    date.setHours(Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60);
    date._hasTime = true;
  }
  return date;
}

/** Read an optional separate time column ("23:47", "11:47 PM", Excel fraction). */
export function parseTimeOfDay(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return { h: value.getHours(), min: value.getMinutes() };
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const s = Math.round(value * 86400);
    return { h: Math.floor(s / 3600), min: Math.floor((s % 3600) / 60) };
  }
  return parseTime(' ' + String(value).trim());
}

export function formatDate(date) {
  if (!date) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function formatDateTime(date) {
  if (!date) return '';
  const p = (n) => String(n).padStart(2, '0');
  return date._hasTime ? `${formatDate(date)} ${p(date.getHours())}:${p(date.getMinutes())}` : formatDate(date);
}

export const DAY_MS = 86400000;
export const daysBetween = (a, b) => Math.round(Math.abs(dayStart(a) - dayStart(b)) / DAY_MS);
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// ---------- Text ----------

const COMPANY_SUFFIXES = new Set([
  'ltd', 'limited', 'llc', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'plc',
  'bv', 'nv', 'gmbh', 'ag', 'sa', 'sas', 'sarl', 'srl', 'spa', 'ab', 'as', 'oy', 'pty', 'pte',
  'fze', 'fzco', 'fzc', 'fzllc', 'llp', 'lp', 'the', 'and', 'group', 'holding', 'holdings',
]);

/** Lower-case, strip accents and punctuation, collapse spaces. */
export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Company name without legal suffixes: "ACME Limited" and "Acme Ltd." -> "acme". */
export function normalizeCompany(value) {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const kept = words.filter((w) => !COMPANY_SUFFIXES.has(w));
  return (kept.length ? kept : words).join(' ');
}

/** Reference numbers: upper-case, letters and digits only, no leading zeros. */
export function normalizeRef(value) {
  if (value === null || value === undefined) return '';
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]*)0+(?=\d)/, '$1');
}

/** Bank accounts / IBANs: letters and digits only, upper-case. */
export const normalizeBank = (v) => (v === null || v === undefined ? '' : String(v).toUpperCase().replace(/[^A-Z0-9]/g, ''));

/** Phone numbers: digits only, last 9 digits (ignores country code and leading 0). */
export function normalizePhone(value) {
  const digits = value === null || value === undefined ? '' : String(value).replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-9) : '';
}

export const normalizeEmail = (v) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase());

const ADDRESS_WORDS = {
  street: 'st', str: 'st', straat: 'st', strasse: 'st', road: 'rd', avenue: 'ave', av: 'ave',
  boulevard: 'blvd', drive: 'dr', lane: 'ln', place: 'pl', square: 'sq', building: 'bldg',
  floor: 'fl', suite: 'ste', apartment: 'apt', number: 'no', nr: 'no', court: 'ct', highway: 'hwy',
};

export function normalizeAddress(value) {
  return normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .map((w) => ADDRESS_WORDS[w] || w)
    .join(' ');
}

// ---------- Similarity ----------

/** Levenshtein edit distance. */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** True when b is a with two neighbouring characters swapped ("7781" / "7718" style typos count as 1 swap). */
export function isTransposition(a, b) {
  if (a.length !== b.length || a === b) return false;
  const diff = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

/** 0..1 similarity between two strings (1 = identical). */
export function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

/** Name similarity that ignores word order and legal suffixes. */
export function nameSimilarity(a, b) {
  const x = normalizeCompany(a);
  const y = normalizeCompany(b);
  if (!x || !y) return 0;
  const sorted = (s) => s.split(' ').sort().join(' ');
  return Math.max(similarity(x, y), similarity(sorted(x), sorted(y)), similarity(x.replace(/ /g, ''), y.replace(/ /g, '')));
}

// ---------- Rows and fields ----------

/**
 * Build a reader for one dataset. `mapping` maps field keys to column names.
 * reader.get(row, 'amount') -> raw value; reader.has('amount') -> mapped?
 */
export function fieldReader(mapping) {
  return {
    has: (key) => Boolean(mapping && mapping[key]),
    get: (row, key) => (mapping && mapping[key] ? row[mapping[key]] : undefined),
    column: (key) => (mapping ? mapping[key] : undefined),
  };
}

/** Split an options text box ("a, b; c") into a clean list. */
export const splitList = (text) =>
  String(text ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

export const sum = (values) => values.reduce((t, v) => t + v, 0);

/** Group items by key. Returns a Map key -> array. */
export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (key === null || key === undefined || key === '') continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

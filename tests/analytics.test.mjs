// Automated checks. Run with:  node --test
// They load the sample files and confirm each test finds the red flags that
// were planted on purpose (see sample-data/README.md), and nothing absurd.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  parseAmount, parseDate, normalizeRef, normalizeCompany, nameSimilarity, normalizePhone, normalizeAddress, isTransposition,
} from '../assets/js/core/data.js';
import benford, { leadingDigits } from '../assets/js/analytics/benford.js';
import duplicates from '../assets/js/analytics/duplicate-payments.js';
import vendorEmployee from '../assets/js/analytics/vendor-employee.js';
import journals from '../assets/js/analytics/journal-entries.js';
import ALL from '../assets/js/analytics/index.js';

const require = createRequire(import.meta.url);
const Papa = require('../assets/vendor/papaparse.min.js');

function load(file) {
  const text = readFileSync(new URL(`../sample-data/${file}`, import.meta.url), 'utf8');
  const rows = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' }).data;
  rows.forEach((r, i) => Object.defineProperty(r, '__row', { value: i + 2 }));
  return rows;
}

/** Map columns the way the page does for the sample files: by exact header. */
function input(test, datasetKey, file, extra = {}) {
  const ds = test.datasets.find((d) => d.key === datasetKey);
  const rows = load(file);
  const columns = Object.keys(rows[0]);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const mapping = {};
  for (const f of ds.fields) {
    const hit = columns.find((c) => [f.label, ...(f.aliases || [])].map(norm).includes(norm(c)) && !Object.values(mapping).includes(c));
    if (hit) mapping[f.key] = hit;
  }
  return { rows, mapping: { ...mapping, ...extra }, dateOrder: 'DMY' };
}
const defaults = (t) => Object.fromEntries(t.options.map((o) => [o.key, o.default]));

// ---------- Helpers ----------
test('parseAmount reads common formats', () => {
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('€ 4.999,00'), 4999);
  assert.equal(parseAmount('(500.00)'), -500);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('1,234'), 1234);
  assert.equal(parseAmount('-75'), -75);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('n/a'), null);
});

test('parseDate reads ISO, day-first, month-first and times', () => {
  const iso = parseDate('2026-03-29 23:47');
  assert.equal(iso.getDate(), 29);
  assert.equal(iso.getHours(), 23);
  assert.equal(parseDate('03/04/2026', 'DMY').getMonth(), 3);
  assert.equal(parseDate('03/04/2026', 'MDY').getMonth(), 2);
  assert.equal(parseDate('31/12/2026', 'MDY').getMonth(), 11); // unambiguous wins
  assert.equal(parseDate('12 Mar 2026').getMonth(), 2);
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate(46111).getFullYear(), 2026); // Excel serial
});

test('normalisers and matching helpers', () => {
  assert.equal(normalizeRef('INV-004471'), 'INV4471');
  assert.equal(normalizeCompany('ACME Limited'), normalizeCompany('Acme Ltd.'));
  assert.ok(nameSimilarity('Acme Ltd', 'ACME Limited') > 0.95);
  assert.equal(normalizePhone('+31 6 1234 5678'), normalizePhone('06-12345678'));
  assert.equal(normalizeAddress('45 Willow Road'), normalizeAddress('45 Willow Rd.'));
  assert.ok(isTransposition('PO7781', 'PO7718'));
  assert.equal(leadingDigits(4987.12, 2), 49);
  assert.equal(leadingDigits(0.0123, 1), 1);
  assert.equal(leadingDigits(99.99, 2), 99);
  assert.equal(leadingDigits(0.1 + 0.2, 1), 3);
});

test('every test follows the module contract', () => {
  const ids = new Set();
  for (const t of ALL) {
    assert.ok(t.id && !ids.has(t.id), `unique id: ${t.id}`);
    ids.add(t.id);
    for (const k of ['name', 'category', 'summary']) assert.equal(typeof t[k], 'string', `${t.id}.${k}`);
    assert.ok(Array.isArray(t.datasets) && t.datasets.length, `${t.id}.datasets`);
    for (const d of t.datasets) {
      assert.ok(d.key && d.label && Array.isArray(d.fields), `${t.id} dataset shape`);
      assert.ok(d.fields.some((f) => f.required), `${t.id}.${d.key} has a required field`);
      if (d.sample) readFileSync(new URL(`../${d.sample}`, import.meta.url));
    }
    assert.equal(typeof t.run, 'function');
  }
});

// ---------- Benford ----------
test("Benford's Law finds the planted spike just under 5,000", () => {
  const r = benford.run({ data: input(benford, 'data', 'benford-ap-payments.csv') }, defaults(benford));
  const spikes = r.sections[1].table.rows.map((x) => x.digit);
  assert.ok(spikes.slice(0, 2).includes(49) || spikes.slice(0, 2).includes(48), `top spikes: ${spikes}`);
  const byVendor = r.sections.find((s) => s.title.startsWith('Spike transactions by'));
  assert.equal(byVendor.table.rows[0].group, 'Brightline Consulting');
  assert.equal(r.summary[0].value, '3,140');
});

// ---------- Duplicates ----------
test('Duplicate payments finds every planted pair', () => {
  const r = duplicates.run({ data: input(duplicates, 'data', 'duplicate-payments-invoices.csv') }, defaults(duplicates));
  const pairs = r.sections[1].table.rows;
  const has = (test, a, b) => pairs.some((p) => p.test === test && [p.invoiceA, p.invoiceB].sort().join() === [a, b].sort().join());
  assert.ok(has(1, 'CE-88120', 'CE-88120'), 'exact duplicate');
  assert.ok(has(1, 'INV-4471', 'INV4471'), 'formatting duplicate');
  assert.ok(has(2, 'PO 7781', 'PO 7718'), 'swapped digits');
  assert.ok(has(2, 'QE-20391', 'QE-20891'), 'one character');
  assert.ok(has(3, 'A-5512', '5512'), 'second vendor record');
  assert.ok(has(4, 'MT-1190', 'MT-1204'), 'close dates');
  assert.ok(!pairs.some((p) => p.invoiceA.startsWith('RENT') && p.invoiceB.startsWith('RENT')), 'monthly rent is not flagged');
  assert.ok(!pairs.some((p) => [p.invoiceA, p.invoiceB].includes('CN-88120')), 'credit note excluded');
  assert.ok(pairs.length < 15, `few false positives (got ${pairs.length})`);
});

// ---------- Vendor–employee ----------
test('Vendor–employee match finds the planted links', () => {
  const r = vendorEmployee.run({
    vendors: input(vendorEmployee, 'vendors', 'vendor-master.csv'),
    employees: input(vendorEmployee, 'employees', 'employee-master.csv'),
  }, defaults(vendorEmployee));
  const rows = r.sections[0].table.rows;
  const find = (vendorId) => rows.find((x) => x.vendorId === vendorId);
  assert.equal(find('V3011')?.risk, 'HIGH');
  assert.match(find('V3011').matched, /Bank account/);
  assert.equal(find('V3026')?.risk, 'MEDIUM');
  assert.match(find('V3026').matched, /Address/);
  assert.match(find('V3041')?.matched ?? '', /Phone/);
  assert.match(find('V3056')?.matched ?? '', /Email/);
  assert.equal(find('V3071')?.risk, 'LOW');
  assert.match(find('V3089')?.matched ?? '', /Bank account, Address|Address, Bank account/);
  assert.ok(rows.filter((x) => x.risk !== 'LOW').length <= 6, 'no false HIGH/MEDIUM matches');
});

// ---------- Journal entries ----------
test('Journal entry testing ranks the planted entries at the top', () => {
  const opts = { ...defaults(journals), revenuePrefix: '4', normalPrefixes: '10, 11' };
  const r = journals.run({ data: input(journals, 'data', 'journal-entries.csv') }, opts);
  const top = r.sections[1].table.rows;
  const sunday = top.find((e) => e.user === 'admin01');
  assert.ok(sunday && sunday.score >= 5, `Sunday-night entry score ${sunday?.score}`);
  const topside = top.find((e) => e.why.includes('Reversed by'));
  assert.ok(topside && topside.score >= 4, 'quarter-end entry reversed next month');
  assert.ok(top.slice(0, 4).some((e) => e.user === 'admin01'));
  assert.equal(r.sections[4].table.rows.length, 1, 'one unbalanced entry');
  assert.equal(r.summary[2].value, 'No', 'file does not balance because of the planted entry');
  assert.ok(!top.some((e) => e.user === 'batch_sap'), 'automated entries are not tested');
});

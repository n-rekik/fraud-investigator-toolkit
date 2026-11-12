import { parseAmount, fieldReader } from '../core/data.js';

// Benford's Law: in many natural sets of amounts the leading digit is 1 about
// 30.1% of the time and 9 only about 4.6%. Invented numbers rarely follow this.
// Method and conformity thresholds follow Mark Nigrini, "Benford's Law" (2012).

const FIRST_DIGIT_MAD = [
  [0.006, 'Close conformity', 'good'],
  [0.012, 'Acceptable conformity', 'good'],
  [0.015, 'Marginally acceptable', 'warn'],
  [Infinity, 'Nonconformity', 'bad'],
];
const FIRST_TWO_MAD = [
  [0.0012, 'Close conformity', 'good'],
  [0.0018, 'Acceptable conformity', 'good'],
  [0.0022, 'Marginally acceptable', 'warn'],
  [Infinity, 'Nonconformity', 'bad'],
];

export const expectedFirst = (d) => Math.log10(1 + 1 / d);

/**
 * Leading digits of a positive amount, read from its value in cents so float
 * noise cannot change them: leadingDigits(4987.12, 2) -> 49, (7.30, 2) -> 73.
 */
export function leadingDigits(amount, count) {
  if (!(amount > 0)) return null;
  const digits = String(Math.round(amount * 100));
  if (digits === '0' || digits.length < count) return null;
  return Number(digits.slice(0, count));
}

/** Nigrini's z-statistic with continuity correction. */
export function zStat(actual, expected, n) {
  const diff = Math.abs(actual - expected);
  const correction = 1 / (2 * n);
  const numerator = diff > correction ? diff - correction : diff;
  return numerator / Math.sqrt((expected * (1 - expected)) / n);
}

function digitTest(amounts, digits, low, high, expectedFn) {
  const counts = new Map();
  let n = 0;
  for (const a of amounts) {
    const d = leadingDigits(a.value, digits);
    if (d === null) continue;
    n++;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  const rows = [];
  let madTotal = 0;
  for (let d = low; d <= high; d++) {
    const count = counts.get(d) || 0;
    const expected = expectedFn(d);
    const actual = n ? count / n : 0;
    const z = n ? zStat(actual, expected, n) : 0;
    madTotal += Math.abs(actual - expected);
    rows.push({ digit: d, count, expectedCount: Math.round(expected * n), expected, actual, difference: actual - expected, z, flag: z > 1.96 && actual > expected ? 'Above expected' : z > 1.96 ? 'Below expected' : '' });
  }
  return { n, rows, mad: madTotal / (high - low + 1) };
}

const verdict = (mad, table) => table.find(([limit]) => mad < limit);

export default {
  id: 'benford',
  name: "Benford's Law",
  category: 'Any amounts',
  summary: 'Flags sets of amounts that look invented, by comparing how often each leading digit appears with what Benford\'s Law predicts.',
  guide: 'guides/01-benfords-law.md',
  datasets: [
    {
      key: 'data',
      label: 'Transactions',
      help: 'One row per transaction: general ledger, accounts payable, expenses or sales. Use at least 1,000 rows.',
      sample: 'sample-data/benford-ap-payments.csv',
      fields: [
        { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'value', 'net amount', 'gross amount', 'invoice amount', 'payment amount', 'total', 'amount eur', 'amount usd', 'local amount'] },
        { key: 'group', label: 'Group by (vendor, employee or account)', aliases: ['vendor', 'vendor name', 'supplier', 'supplier name', 'employee', 'account', 'cost centre', 'cost center'] },
        { key: 'reference', label: 'Reference (invoice or document number)', aliases: ['invoice', 'invoice number', 'invoice no', 'document', 'document number', 'reference', 'doc no'] },
      ],
    },
  ],
  options: [
    { key: 'minAmount', label: 'Ignore amounts below', type: 'number', default: 10, help: 'Very small amounts distort the test. Nigrini suggests 10.' },
    { key: 'useAbsolute', label: 'Include negative amounts (as positive values)', type: 'checkbox', default: false },
  ],

  run(inputs, options = {}) {
    const { rows, mapping } = inputs.data;
    const f = fieldReader(mapping);
    const minAmount = Number(options.minAmount ?? 10);
    const notes = [];

    let blank = 0, negative = 0, small = 0;
    const amounts = [];
    for (const row of rows) {
      let value = parseAmount(f.get(row, 'amount'));
      if (value === null || value === 0) { blank++; continue; }
      if (value < 0) {
        if (!options.useAbsolute) { negative++; continue; }
        value = -value;
      }
      if (value < minAmount) { small++; continue; }
      amounts.push({ value, row });
    }
    const excludedText = `${blank} blank or zero, ${negative} negative, ${small} below ${minAmount}`;
    if (amounts.length < 1000) notes.push(`Only ${amounts.length} amounts were tested. Benford results are unreliable below about 1,000; treat any flag with extra care.`);
    notes.push('A deviation is a reason to look, not proof. Approval limits, fixed prices and recurring payments often explain a spike.');

    const first = digitTest(amounts, 1, 1, 9, expectedFirst);
    const firstTwo = digitTest(amounts, 2, 10, 99, (d) => Math.log10(1 + 1 / d));
    const v1 = verdict(first.mad, FIRST_DIGIT_MAD);
    const v2 = verdict(firstTwo.mad, FIRST_TWO_MAD);

    // Biggest spikes in the first-two-digits test drive the drill-down.
    const spikes = firstTwo.rows
      .filter((r) => r.flag === 'Above expected')
      .sort((a, b) => b.z - a.z)
      .slice(0, 10);
    const topThree = new Set(spikes.slice(0, 3).map((s) => s.digit));
    const drill = amounts
      .filter((a) => topThree.has(leadingDigits(a.value, 2)))
      .sort((a, b) => b.value - a.value);

    const sections = [
      {
        title: 'First digit test',
        description: 'Share of amounts starting with each digit: actual against Benford\'s expected share.',
        chart: {
          kind: 'bars',
          format: 'percent',
          labels: first.rows.map((r) => String(r.digit)),
          series: [
            { name: 'Expected (Benford)', values: first.rows.map((r) => r.expected), tone: 'muted' },
            { name: 'Actual', values: first.rows.map((r) => r.actual), tone: 'accent' },
          ],
        },
        table: {
          columns: [
            { key: 'digit', label: 'First digit', type: 'text' },
            { key: 'count', label: 'Count', type: 'number' },
            { key: 'expected', label: 'Expected %', type: 'percent' },
            { key: 'actual', label: 'Actual %', type: 'percent' },
            { key: 'z', label: 'Z-statistic', type: 'decimal' },
            { key: 'flag', label: 'Result', type: 'flag' },
          ],
          rows: first.rows,
        },
      },
      {
        title: 'Biggest spikes in the first two digits',
        description: 'Two-digit combinations (10 to 99) that appear significantly more often than expected (z above 1.96). A spike just below an approval limit, such as 49 for €4,900–€4,999, is a classic sign of splitting.',
        table: {
          columns: [
            { key: 'digit', label: 'First two digits', type: 'text' },
            { key: 'count', label: 'Count', type: 'number' },
            { key: 'expectedCount', label: 'Expected count', type: 'number' },
            { key: 'expected', label: 'Expected %', type: 'percent' },
            { key: 'actual', label: 'Actual %', type: 'percent' },
            { key: 'z', label: 'Z-statistic', type: 'decimal' },
          ],
          rows: spikes,
          empty: 'No two-digit combination is significantly above expectation.',
        },
      },
    ];

    if (drill.length) {
      sections.push({
        title: 'Transactions behind the top 3 spikes',
        description: `Amounts starting with ${[...topThree].join(', ')}, largest first. Pull the supporting documents for these.`,
        table: {
          columns: [
            { key: 'row', label: 'Row', type: 'number' },
            { key: 'digits', label: 'First two digits', type: 'text' },
            { key: 'amount', label: 'Amount', type: 'money' },
            ...(f.has('group') ? [{ key: 'group', label: f.column('group'), type: 'text' }] : []),
            ...(f.has('reference') ? [{ key: 'reference', label: f.column('reference'), type: 'text' }] : []),
          ],
          rows: drill.map((a) => ({
            row: a.row.__row,
            digits: String(leadingDigits(a.value, 2)),
            amount: a.value,
            group: f.get(a.row, 'group') ?? '',
            reference: f.get(a.row, 'reference') ?? '',
          })),
        },
      });

      if (f.has('group')) {
        const byGroup = new Map();
        for (const a of drill) {
          const key = String(f.get(a.row, 'group') ?? '(blank)');
          const g = byGroup.get(key) || { group: key, count: 0, total: 0 };
          g.count++;
          g.total += a.value;
          byGroup.set(key, g);
        }
        sections.push({
          title: `Spike transactions by ${f.column('group')}`,
          description: 'Where the spike transactions concentrate. One name with many of them deserves a closer look.',
          table: {
            columns: [
              { key: 'group', label: f.column('group'), type: 'text' },
              { key: 'count', label: 'Transactions', type: 'number' },
              { key: 'total', label: 'Total amount', type: 'money' },
            ],
            rows: [...byGroup.values()].sort((a, b) => b.count - a.count || b.total - a.total),
          },
        });
      }
    }

    return {
      summary: [
        { label: 'Amounts tested', value: amounts.length.toLocaleString('en-GB'), hint: `Excluded: ${excludedText}` },
        { label: 'First digit result', value: v1[1], tone: v1[2], hint: `MAD ${first.mad.toFixed(4)}` },
        { label: 'First two digits result', value: v2[1], tone: v2[2], hint: `MAD ${firstTwo.mad.toFixed(4)}` },
        { label: 'Significant spikes', value: String(spikes.length), tone: spikes.length ? 'warn' : 'good', hint: 'Two-digit combinations above expectation' },
      ],
      notes,
      sections,
    };
  },
};

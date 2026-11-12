import {
  parseAmount, parseDate, formatDate, cents, daysBetween, fieldReader,
  normalizeRef, normalizeCompany, nameSimilarity, isTransposition, editDistance, groupBy,
} from '../core/data.js';

// Finds invoices that may have been paid twice, including near-matches that an
// exact-match test misses (INV-4471 / INV4471, ACME Ltd / Acme Limited).

const TESTS = {
  1: 'Exact: same vendor, invoice number and amount',
  2: 'Same vendor and amount, invoice numbers nearly identical',
  3: 'Same amount and invoice date, similar vendor names',
  4: 'Same vendor and amount, invoice dates close together',
};

/** Classify one pair of invoices. Returns { test, score, reason } or null. */
export function comparePair(a, b, { windowDays = 14, nameThreshold = 0.85, recurring = false } = {}) {
  if (a.amountCents !== b.amountCents) return null;
  const sameVendor = a.vendorKey && a.vendorKey === b.vendorKey;
  const bothInvoices = a.invoice && b.invoice;

  if (sameVendor && bothInvoices && a.invoice === b.invoice) {
    return { test: 1, score: 100, reason: a.invoiceRaw === b.invoiceRaw ? 'Identical invoice number' : `"${a.invoiceRaw}" and "${b.invoiceRaw}" are the same after removing spaces, dashes and leading zeros` };
  }
  // A vendor that bills the same amount every month (rent, subscriptions) numbers its
  // invoices in sequence: RENT-01, RENT-02. Those only count as near-matches when the
  // dates are also close.
  const farApart = a.date && b.date && daysBetween(a.date, b.date) > windowDays;
  if (sameVendor && bothInvoices && a.invoice.length >= 4 && !(recurring && farApart)) {
    if (isTransposition(a.invoice, b.invoice)) return { test: 2, score: 92, reason: 'Two digits swapped in the invoice number' };
    if (editDistance(a.invoice, b.invoice) === 1) return { test: 2, score: 90, reason: 'Invoice numbers differ by one character' };
    if (a.invoice.length >= 5 && (a.invoice.endsWith(b.invoice) || b.invoice.endsWith(a.invoice))) return { test: 2, score: 88, reason: 'One invoice number contains the other' };
  }
  if (!sameVendor && a.date && b.date && daysBetween(a.date, b.date) === 0 && a.vendorName && b.vendorName) {
    const sim = nameSimilarity(a.vendorName, b.vendorName);
    if (sim >= nameThreshold) return { test: 3, score: Math.round(70 + 20 * sim), reason: `Vendor names ${Math.round(sim * 100)}% similar` };
  }
  if (sameVendor && a.date && b.date) {
    const gap = daysBetween(a.date, b.date);
    if (gap <= windowDays) return { test: 4, score: Math.max(50, 80 - gap * 2), reason: gap === 0 ? 'Same invoice date' : `Invoice dates ${gap} day${gap === 1 ? '' : 's'} apart` };
  }
  return null;
}

export default {
  id: 'duplicate-payments',
  name: 'Duplicate payments',
  category: 'Accounts payable',
  summary: 'Finds invoices that may have been paid twice, including near-duplicates with typing differences in the invoice number or vendor name.',
  guide: 'guides/02-duplicate-payments.md',
  datasets: [
    {
      key: 'data',
      label: 'Paid invoices',
      help: 'One row per paid invoice. Vendor number or vendor name, and amount, are required. Invoice number and date make the test much stronger.',
      sample: 'sample-data/duplicate-payments-invoices.csv',
      fields: [
        { key: 'vendorId', label: 'Vendor number', aliases: ['vendor id', 'vendor number', 'vendor no', 'supplier id', 'supplier number', 'vendor code', 'creditor', 'creditor number'] },
        { key: 'vendorName', label: 'Vendor name', aliases: ['vendor name', 'vendor', 'supplier name', 'supplier', 'payee', 'beneficiary', 'creditor name'] },
        { key: 'invoice', label: 'Invoice number', aliases: ['invoice number', 'invoice no', 'invoice', 'invoice ref', 'vendor invoice', 'reference', 'invoice id'] },
        { key: 'invoiceDate', label: 'Invoice date', aliases: ['invoice date', 'document date', 'date', 'doc date'] },
        { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'invoice amount', 'gross amount', 'payment amount', 'total', 'value'] },
        { key: 'paymentDate', label: 'Payment date', aliases: ['payment date', 'paid date', 'clearing date', 'value date'] },
        { key: 'document', label: 'Payment or document number', aliases: ['document number', 'payment number', 'payment id', 'doc number', 'voucher', 'voucher number'] },
      ],
    },
  ],
  options: [
    { key: 'windowDays', label: 'Same vendor and amount within (days)', type: 'number', default: 14 },
    { key: 'nameThreshold', label: 'Vendor name similarity for test 3 (%)', type: 'number', default: 85 },
    { key: 'minAmount', label: 'Ignore amounts below', type: 'number', default: 0 },
  ],

  run(inputs, options = {}) {
    const { rows, mapping, dateOrder } = inputs.data;
    const f = fieldReader(mapping);
    if (!f.has('vendorId') && !f.has('vendorName')) throw new Error('Map either the vendor number or the vendor name column.');
    const windowDays = Number(options.windowDays ?? 14);
    const nameThreshold = Number(options.nameThreshold ?? 85) / 100;
    const minAmount = Number(options.minAmount ?? 0);
    const notes = [];

    let skippedCredits = 0, skippedBlank = 0;
    const invoices = [];
    for (const row of rows) {
      const amount = parseAmount(f.get(row, 'amount'));
      if (amount === null || amount === 0) { skippedBlank++; continue; }
      if (amount < 0) { skippedCredits++; continue; }
      if (amount < minAmount) continue;
      const vendorName = String(f.get(row, 'vendorName') ?? '').trim();
      const vendorId = String(f.get(row, 'vendorId') ?? '').trim();
      invoices.push({
        row,
        amount,
        amountCents: cents(amount),
        vendorId,
        vendorName,
        vendorKey: f.has('vendorId') ? normalizeRef(vendorId) : normalizeCompany(vendorName),
        invoiceRaw: String(f.get(row, 'invoice') ?? '').trim(),
        invoice: normalizeRef(f.get(row, 'invoice')),
        date: parseDate(f.get(row, 'invoiceDate'), dateOrder),
        paymentDate: parseDate(f.get(row, 'paymentDate'), dateOrder),
        document: String(f.get(row, 'document') ?? ''),
      });
    }
    if (skippedCredits) notes.push(`${skippedCredits} credit notes or reversals (negative amounts) were excluded.`);
    if (!f.has('invoice')) notes.push('No invoice number column was mapped, so tests 1 and 2 could not run.');
    if (!f.has('invoiceDate')) notes.push('No invoice date column was mapped, so tests 3 and 4 could not run.');

    // Only invoices with the same amount can be duplicates, so compare within amount groups.
    // Vendors that bill the same amount 3 or more times are recurring charges.
    const recurringCount = new Map();
    for (const i of invoices) {
      const k = `${i.vendorKey}|${i.amountCents}`;
      recurringCount.set(k, (recurringCount.get(k) || 0) + 1);
    }
    const isRecurring = (i) => (recurringCount.get(`${i.vendorKey}|${i.amountCents}`) || 0) >= 3;

    const pairs = [];
    let skippedGroups = 0;
    for (const group of groupBy(invoices, (i) => i.amountCents).values()) {
      if (group.length < 2) continue;
      if (group.length > 3000) { skippedGroups++; continue; }
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j];
          // Same payment document listed twice is a data issue, not a duplicate payment.
          if (a.document && a.document === b.document && a.invoiceRaw === b.invoiceRaw) continue;
          const match = comparePair(a, b, { windowDays, nameThreshold, recurring: isRecurring(a) && isRecurring(b) });
          if (match) pairs.push({ a, b, ...match });
        }
      }
    }
    if (skippedGroups) notes.push(`${skippedGroups} amount(s) occur more than 3,000 times and were not compared pair by pair. Check these recurring amounts separately.`);
    const recurringRows = [...recurringCount.entries()].filter(([, n]) => n >= 3).map(([k, n]) => {
      const first = invoices.find((i) => `${i.vendorKey}|${i.amountCents}` === k);
      return { vendor: first.vendorName || first.vendorId, amount: first.amount, count: n, total: first.amount * n };
    }).sort((x, y) => y.total - x.total);
    notes.push('Recurring payments such as rent and subscriptions can appear in test 4. Confirm every real duplicate against the invoice image and the bank statement before asking for a refund.');

    pairs.sort((x, y) => x.test - y.test || y.score - x.score || y.a.amount - x.a.amount);
    const perTest = [1, 2, 3, 4].map((t) => {
      const list = pairs.filter((p) => p.test === t);
      return { test: t, description: TESTS[t], pairs: list.length, atRisk: list.reduce((s, p) => s + p.a.amount, 0) };
    });
    const atRisk = perTest.reduce((s, t) => s + t.atRisk, 0);
    const strong = pairs.filter((p) => p.test <= 2);

    const show = (p) => ({
      test: p.test,
      score: p.score,
      reason: p.reason,
      amount: p.a.amount,
      vendorA: p.a.vendorName || p.a.vendorId,
      vendorB: p.b.vendorName || p.b.vendorId,
      invoiceA: p.a.invoiceRaw,
      invoiceB: p.b.invoiceRaw,
      dateA: formatDate(p.a.date),
      dateB: formatDate(p.b.date),
      rowA: p.a.row.__row,
      rowB: p.b.row.__row,
    });

    return {
      summary: [
        { label: 'Invoices tested', value: invoices.length.toLocaleString('en-GB') },
        { label: 'Possible duplicate pairs', value: pairs.length.toLocaleString('en-GB'), tone: pairs.length ? 'warn' : 'good' },
        { label: 'Strong matches (tests 1–2)', value: strong.length.toLocaleString('en-GB'), tone: strong.length ? 'bad' : 'good' },
        { label: 'Amount at risk', value: atRisk, format: 'money', tone: atRisk ? 'warn' : 'good', hint: 'One side of each pair' },
      ],
      notes,
      sections: [
        {
          title: 'Results by test',
          description: 'Each pair is counted once, under the strongest test it meets.',
          table: {
            columns: [
              { key: 'test', label: 'Test', type: 'number' },
              { key: 'description', label: 'What it checks', type: 'text' },
              { key: 'pairs', label: 'Pairs', type: 'number' },
              { key: 'atRisk', label: 'Amount at risk', type: 'money' },
            ],
            rows: perTest,
          },
        },
        {
          title: 'Possible duplicates',
          description: 'Strongest matches first. Rows refer to your file, counting the header as row 1.',
          table: {
            columns: [
              { key: 'test', label: 'Test', type: 'number' },
              { key: 'score', label: 'Score', type: 'number' },
              { key: 'amount', label: 'Amount', type: 'money' },
              { key: 'vendorA', label: 'Vendor (A)', type: 'text' },
              { key: 'invoiceA', label: 'Invoice (A)', type: 'text' },
              { key: 'dateA', label: 'Date (A)', type: 'date' },
              { key: 'rowA', label: 'Row (A)', type: 'number' },
              { key: 'vendorB', label: 'Vendor (B)', type: 'text' },
              { key: 'invoiceB', label: 'Invoice (B)', type: 'text' },
              { key: 'dateB', label: 'Date (B)', type: 'date' },
              { key: 'rowB', label: 'Row (B)', type: 'number' },
              { key: 'reason', label: 'Why it was flagged', type: 'text', wide: true },
            ],
            rows: pairs.map(show),
            empty: 'No possible duplicates found.',
          },
        },
        {
          title: 'Recurring amounts',
          description: 'Vendors that billed the exact same amount 3 or more times. Usually rent, subscriptions or retainers. Near-identical invoice numbers within these are only flagged when the dates are close, so confirm the number of charges matches the contract.',
          table: {
            columns: [
              { key: 'vendor', label: 'Vendor', type: 'text' },
              { key: 'amount', label: 'Amount', type: 'money' },
              { key: 'count', label: 'Times billed', type: 'number' },
              { key: 'total', label: 'Total', type: 'money' },
            ],
            rows: recurringRows,
            empty: 'No recurring amounts.',
          },
        },
      ],
    };
  },
};

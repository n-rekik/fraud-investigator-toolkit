// TEMPLATE FOR A NEW TEST
// 1. Copy this file to assets/js/analytics/<your-test-id>.js
// 2. Fill in the parts marked TODO
// 3. Add it to assets/js/analytics/index.js
// 4. Add a sample file to sample-data/ and a check to tests/analytics.test.mjs
// Full instructions: docs/adding-a-test.md

import { parseAmount, parseDate, formatDate, fieldReader } from '../core/data.js';

export default {
  id: 'my-test', // TODO: short, lower case, with dashes. Used in the page address (#my-test).
  name: 'My test', // TODO: the name in the menu
  category: 'Accounts payable', // TODO: the area it belongs to
  summary: 'One sentence: what this test finds.', // TODO
  guide: 'guides/NN-my-test.md', // TODO: optional link to a guide

  // The files the test needs. Most tests need one.
  datasets: [
    {
      key: 'data',
      label: 'Transactions', // TODO
      help: 'One row per transaction.', // TODO
      sample: 'sample-data/my-test.csv', // TODO: fake data with planted red flags
      fields: [
        // key: how you read it in run(). aliases: column names the page recognises automatically.
        { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'value', 'total'] },
        { key: 'date', label: 'Date', aliases: ['date', 'posting date', 'invoice date'] },
        { key: 'name', label: 'Vendor or employee', aliases: ['vendor', 'vendor name', 'employee'] },
      ],
    },
  ],

  // Settings the user can change. Types: number, text, checkbox.
  options: [
    { key: 'limit', label: 'Approval limit', type: 'number', default: 5000 },
  ],

  // inputs.data = { rows, mapping, dateOrder }. Each row also has row.__row (its row number in the file).
  // Throw an Error with a plain-English message if the data cannot be tested.
  run(inputs, options = {}) {
    const { rows, mapping, dateOrder } = inputs.data;
    const f = fieldReader(mapping);
    const limit = Number(options.limit ?? 5000);

    const flagged = [];
    for (const row of rows) {
      const amount = parseAmount(f.get(row, 'amount'));
      if (amount === null) continue;
      // TODO: your test logic
      if (amount >= limit * 0.95 && amount < limit) {
        flagged.push({
          row: row.__row,
          date: formatDate(parseDate(f.get(row, 'date'), dateOrder)),
          name: f.get(row, 'name') ?? '',
          amount,
          why: 'Within 5% below the approval limit',
        });
      }
    }

    return {
      // 2 to 4 headline numbers. tone: 'good' | 'warn' | 'bad' (optional). format: 'money' (optional).
      summary: [
        { label: 'Rows tested', value: rows.length.toLocaleString('en-GB') },
        { label: 'Flagged', value: String(flagged.length), tone: flagged.length ? 'warn' : 'good' },
      ],
      // Plain-English cautions shown under the numbers.
      notes: ['A flag is a reason to look, not proof.'],
      // Each section can have a chart, a table, or both.
      // Column types: text, date (never wraps), number, money, percent (0..1), decimal, flag (HIGH/MEDIUM/LOW tag).
      // Add wide: true to a long text column, such as the reason a row was flagged.
      sections: [
        {
          title: 'Flagged transactions',
          description: 'What this table shows and what to do next.',
          table: {
            columns: [
              { key: 'row', label: 'Row', type: 'number' },
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'amount', label: 'Amount', type: 'money' },
              { key: 'why', label: 'Why it was flagged', type: 'text', wide: true },
            ],
            rows: flagged,
            empty: 'Nothing was flagged.',
          },
        },
      ],
    };
  },
};

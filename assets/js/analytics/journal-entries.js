import {
  parseAmount, parseDate, parseTimeOfDay, formatDate, formatDateTime, fieldReader,
  splitList, cents, DAY_MS, normalizeText,
} from '../core/data.js';

// Tests every journal entry for signs of management override, the way
// auditing standards (ISA 240, AS 2401) ask: outside hours, at period end,
// round amounts, odd descriptions, unusual users and accounts, and reversals.

export const TESTS = [
  { id: 'offHours', label: 'Outside working hours, weekend or holiday' },
  { id: 'periodEnd', label: 'Posted at period end' },
  { id: 'round', label: 'Round amount' },
  { id: 'description', label: 'Blank or suspicious description' },
  { id: 'user', label: 'Rare or senior user' },
  { id: 'pair', label: 'Unusual account combination' },
  { id: 'suspense', label: 'Suspense or clearing account' },
  { id: 'reversed', label: 'Reversed soon after' },
];

const DEFAULT_KEYWORDS = 'adjust, correction, correct, plug, reclass, per cfo, per ceo, as instructed, as discussed, override, write off, misc, sundry, temp, test, error';

function isPeriodEnd(date, days) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() > lastDay - days || date.getDate() <= days;
}

export default {
  id: 'journal-entries',
  name: 'Journal entry testing',
  category: 'General ledger',
  summary: 'Tests every journal entry for the signs of management override: off-hours and period-end postings, round amounts, odd descriptions, rare users, suspense accounts and quick reversals.',
  guide: 'guides/09-journal-entry-testing.md',
  datasets: [
    {
      key: 'data',
      label: 'Journal entry lines',
      help: 'One row per journal line. Use either one signed amount column, or separate debit and credit columns.',
      sample: 'sample-data/journal-entries.csv',
      fields: [
        { key: 'entry', label: 'Entry (document) number', required: true, aliases: ['entry', 'entry number', 'je number', 'journal number', 'document number', 'doc no', 'journal id', 'je id', 'document'] },
        { key: 'postingDate', label: 'Posting date', required: true, aliases: ['posting date', 'gl date', 'effective date', 'date', 'period date', 'post date'] },
        { key: 'createdAt', label: 'Entered on (date and time)', aliases: ['entered on', 'created at', 'entry date', 'created on', 'timestamp', 'entered date', 'creation date', 'cpu date'] },
        { key: 'createdTime', label: 'Entry time (if in its own column)', aliases: ['entry time', 'time', 'created time', 'entered time', 'cpu time'] },
        { key: 'user', label: 'User', aliases: ['user', 'user id', 'entered by', 'created by', 'posted by', 'username', 'preparer'] },
        { key: 'account', label: 'Account number', required: true, aliases: ['account', 'account number', 'gl account', 'account no', 'gl', 'account code'] },
        { key: 'accountName', label: 'Account name', aliases: ['account name', 'account description', 'gl account name', 'account desc'] },
        { key: 'amount', label: 'Amount (debit +, credit −)', aliases: ['amount', 'signed amount', 'net amount', 'amount lc', 'local amount', 'value'] },
        { key: 'debit', label: 'Debit', aliases: ['debit', 'dr', 'debit amount'] },
        { key: 'credit', label: 'Credit', aliases: ['credit', 'cr', 'credit amount'] },
        { key: 'description', label: 'Description', aliases: ['description', 'text', 'line description', 'narrative', 'memo', 'header text', 'explanation'] },
        { key: 'source', label: 'Source or entry type', aliases: ['source', 'journal source', 'entry type', 'document type', 'je type', 'manual', 'type'] },
      ],
    },
  ],
  options: [
    { key: 'workStart', label: 'Working day starts (hour)', type: 'number', default: 8 },
    { key: 'workEnd', label: 'Working day ends (hour)', type: 'number', default: 18 },
    { key: 'holidays', label: 'Public holidays (dates, comma separated)', type: 'text', default: '', placeholder: '2026-01-01, 2026-12-25' },
    { key: 'periodDays', label: 'Period end window (days each side of month end)', type: 'number', default: 3 },
    { key: 'manualValues', label: 'Source values that mean "manual"', type: 'text', default: 'manual, man, je, gj, sa, general journal', help: 'Only used when the source column is mapped. Leave blank to test every entry.' },
    { key: 'roundTo', label: 'Round amount = a multiple of', type: 'number', default: 1000 },
    { key: 'keywords', label: 'Suspicious words in descriptions', type: 'text', default: DEFAULT_KEYWORDS },
    { key: 'rareUser', label: 'Rare user = fewer entries than', type: 'number', default: 5 },
    { key: 'seniorUsers', label: 'Senior users to flag (user IDs)', type: 'text', default: '', placeholder: 'cfo01, fin.director' },
    { key: 'suspense', label: 'Suspense or clearing accounts (numbers or words)', type: 'text', default: 'suspense, clearing' },
    { key: 'revenuePrefix', label: 'Revenue accounts start with', type: 'text', default: '', placeholder: '4', help: 'Fill in both to run the unusual-combination test.' },
    { key: 'normalPrefixes', label: 'Normal accounts against revenue start with', type: 'text', default: '', placeholder: '11, 12, 10' },
    { key: 'reversalDays', label: 'Reversal window (days)', type: 'number', default: 45 },
  ],

  run(inputs, options = {}) {
    const { rows, mapping, dateOrder } = inputs.data;
    const f = fieldReader(mapping);
    if (!f.has('amount') && !(f.has('debit') || f.has('credit'))) throw new Error('Map either the amount column, or the debit and credit columns.');
    const opt = {
      workStart: Number(options.workStart ?? 8),
      workEnd: Number(options.workEnd ?? 18),
      periodDays: Number(options.periodDays ?? 3),
      roundTo: Number(options.roundTo ?? 1000),
      rareUser: Number(options.rareUser ?? 5),
      reversalDays: Number(options.reversalDays ?? 45),
      holidays: new Set(splitList(options.holidays).map((d) => formatDate(parseDate(d, dateOrder))).filter(Boolean)),
      manual: splitList(options.manualValues ?? 'manual, man, je, gj, sa, general journal').map((s) => s.toLowerCase()),
      keywords: splitList(options.keywords ?? DEFAULT_KEYWORDS).map((s) => normalizeText(s)).filter(Boolean),
      senior: new Set(splitList(options.seniorUsers).map((s) => s.toLowerCase())),
      suspense: splitList(options.suspense ?? 'suspense, clearing').map((s) => s.toLowerCase()),
      revenue: splitList(options.revenuePrefix),
      normal: splitList(options.normalPrefixes),
    };
    const notes = [];

    // 1. Read lines and build entries.
    const entries = new Map();
    let unreadable = 0, totalDebit = 0, totalCredit = 0;
    for (const row of rows) {
      const id = String(f.get(row, 'entry') ?? '').trim();
      let amount = f.has('amount') ? parseAmount(f.get(row, 'amount')) : null;
      if (amount === null && (f.has('debit') || f.has('credit'))) {
        const dr = parseAmount(f.get(row, 'debit')) || 0;
        const cr = parseAmount(f.get(row, 'credit')) || 0;
        amount = dr - Math.abs(cr);
      }
      const posting = parseDate(f.get(row, 'postingDate'), dateOrder);
      if (!id || amount === null || !posting) { unreadable++; continue; }
      if (amount > 0) totalDebit += amount; else totalCredit -= amount;

      let created = parseDate(f.get(row, 'createdAt'), dateOrder);
      const time = parseTimeOfDay(f.get(row, 'createdTime'));
      if (time) {
        created = new Date((created || posting).getTime());
        created.setHours(time.h, time.min, 0, 0);
        created._hasTime = true;
      }
      const e = entries.get(id) || {
        id, lines: [], posting, created: created || null,
        user: String(f.get(row, 'user') ?? '').trim(),
        source: String(f.get(row, 'source') ?? '').trim(),
        descriptions: new Set(),
      };
      e.lines.push({ row, amount, account: String(f.get(row, 'account') ?? '').trim(), accountName: String(f.get(row, 'accountName') ?? '').trim() });
      const d = String(f.get(row, 'description') ?? '').trim();
      e.descriptions.add(d);
      if (!e.created && created) e.created = created;
      entries.set(id, e);
    }
    if (unreadable) notes.push(`${unreadable} lines had no entry number, amount or readable posting date and were left out.`);

    const all = [...entries.values()];
    for (const e of all) {
      e.debit = e.lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
      e.net = e.lines.reduce((s, l) => s + l.amount, 0);
      e.manual = !f.has('source') || !opt.manual.length || opt.manual.includes(e.source.toLowerCase());
    }
    const unbalanced = all.filter((e) => Math.abs(e.net) >= 0.01);

    // Entries per user, across all entries, so "rare" is measured fairly.
    const perUser = new Map();
    for (const e of all) if (e.user) perUser.set(e.user, (perUser.get(e.user) || 0) + 1);

    // Reversals: an entry whose lines are the exact opposite of an earlier one.
    const signature = (e, sign) => e.lines.map((l) => `${l.account}:${cents(l.amount) * sign}`).sort().join('|');
    const bySignature = new Map();
    for (const e of all) {
      const s = signature(e, 1);
      if (!bySignature.has(s)) bySignature.set(s, []);
      bySignature.get(s).push(e);
    }

    // 2. Run the tests on manual entries.
    const tested = all.filter((e) => e.manual);
    const hasTime = tested.some((e) => e.created && e.created._hasTime);
    if (!hasTime) notes.push('No entry time was found, so the outside-hours part of test 1 could not run. Weekends and holidays were still checked.');
    if (!opt.revenue.length || !opt.normal.length) notes.push('The unusual account combination test needs your revenue and normal account prefixes in the options. It was skipped.');
    if (f.has('source')) notes.push(`${tested.length.toLocaleString('en-GB')} of ${all.length.toLocaleString('en-GB')} entries were treated as manual, based on the source column, and tested.`);
    else notes.push('No source column was mapped, so every entry was tested. Automated postings and batch jobs often run at night; confirm which flagged entries are really manual.');

    const isSuspense = (l) => opt.suspense.some((s) => l.account.toLowerCase() === s || l.accountName.toLowerCase().includes(s) || (/^\d+$/.test(s) && l.account.startsWith(s)));
    const startsWithAny = (acct, list) => list.some((p) => acct.startsWith(p));

    for (const e of tested) {
      const flags = {};
      const when = e.created || e.posting;
      const day = when.getDay();
      if (day === 0 || day === 6) flags.offHours = day === 0 ? 'Sunday' : 'Saturday';
      else if (opt.holidays.has(formatDate(when))) flags.offHours = 'Public holiday';
      else if (when._hasTime && (when.getHours() < opt.workStart || when.getHours() >= opt.workEnd)) flags.offHours = `Entered at ${formatDateTime(when).slice(11)}`;

      if (isPeriodEnd(e.posting, opt.periodDays)) flags.periodEnd = 'Within ' + opt.periodDays + ' days of month end';

      if (opt.roundTo > 0 && e.lines.some((l) => Math.abs(l.amount) >= opt.roundTo && cents(Math.abs(l.amount)) % cents(opt.roundTo) === 0)) flags.round = `Multiple of ${opt.roundTo.toLocaleString('en-GB')}`;

      const text = [...e.descriptions].filter(Boolean).join(' ');
      if (!text) flags.description = 'Blank description';
      else {
        const norm = ` ${normalizeText(text)} `;
        const hit = opt.keywords.find((k) => norm.includes(` ${k} `));
        if (hit) flags.description = `Contains "${hit}"`;
      }

      if (e.user && opt.senior.has(e.user.toLowerCase())) flags.user = 'Senior user';
      else if (e.user && (perUser.get(e.user) || 0) < opt.rareUser) flags.user = `User posted only ${perUser.get(e.user)} entr${perUser.get(e.user) === 1 ? 'y' : 'ies'}`;

      if (opt.revenue.length && opt.normal.length) {
        const revenueCredit = e.lines.some((l) => l.amount < 0 && startsWithAny(l.account, opt.revenue));
        const oddDebit = e.lines.find((l) => l.amount > 0 && !startsWithAny(l.account, opt.normal) && !startsWithAny(l.account, opt.revenue));
        if (revenueCredit && oddDebit) flags.pair = `Revenue credited against ${oddDebit.account}`;
      }

      const sus = e.lines.find(isSuspense);
      if (sus) flags.suspense = `Account ${sus.account}${sus.accountName ? ' ' + sus.accountName : ''}`;

      const reversal = (bySignature.get(signature(e, -1)) || []).find((r) => r !== e && r.posting >= e.posting && (r.posting - e.posting) / DAY_MS <= opt.reversalDays);
      if (reversal) flags.reversed = `Reversed by ${reversal.id} on ${formatDate(reversal.posting)}`;

      e.flags = flags;
      e.score = Object.keys(flags).length;
    }

    const flagged = tested.filter((e) => e.score > 0).sort((a, b) => b.score - a.score || b.debit - a.debit);
    const top = flagged.slice(0, 50);

    const testRows = TESTS.map((t, i) => {
      const list = tested.filter((e) => e.flags[t.id]);
      return { test: i + 1, label: t.label, entries: list.length, amount: list.reduce((s, e) => s + e.debit, 0) };
    });

    const userRows = [...perUser.entries()].map(([user, count]) => {
      const mine = tested.filter((e) => e.user === user);
      const hits = mine.filter((e) => e.score > 0);
      return { user, entries: count, flagged: hits.length, share: mine.length ? hits.length / mine.length : 0, high: mine.filter((e) => e.score >= 3).length };
    }).sort((a, b) => b.high - a.high || b.flagged - a.flagged);

    const accountMap = new Map();
    for (const e of flagged) {
      for (const l of e.lines) {
        const a = accountMap.get(l.account) || { account: l.account, name: l.accountName, entries: new Set(), amount: 0 };
        a.entries.add(e.id);
        a.amount += Math.abs(l.amount);
        accountMap.set(l.account, a);
      }
    }
    const accountRows = [...accountMap.values()].map((a) => ({ ...a, entries: a.entries.size })).sort((a, b) => b.entries - a.entries).slice(0, 25);

    const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
    return {
      summary: [
        { label: 'Entries / lines', value: `${all.length.toLocaleString('en-GB')} / ${all.reduce((s, e) => s + e.lines.length, 0).toLocaleString('en-GB')}` },
        { label: 'Total debits', value: totalDebit, format: 'money', hint: `Credits ${totalCredit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: 'File balances', value: balanced ? 'Yes' : 'No', tone: balanced ? 'good' : 'bad', hint: balanced ? 'Agree totals to the trial balance' : `Difference ${(totalDebit - totalCredit).toFixed(2)}` },
        { label: 'Entries failing 3+ tests', value: String(tested.filter((e) => e.score >= 3).length), tone: tested.some((e) => e.score >= 3) ? 'bad' : 'good' },
      ],
      notes,
      sections: [
        {
          title: 'Results by test',
          description: 'Number of tested entries that fail each test. One entry can fail several.',
          table: {
            columns: [
              { key: 'test', label: 'Test', type: 'number' },
              { key: 'label', label: 'What it checks', type: 'text' },
              { key: 'entries', label: 'Entries', type: 'number' },
              { key: 'amount', label: 'Total debits', type: 'money' },
            ],
            rows: testRows,
          },
        },
        {
          title: 'Top 50 entries by score',
          description: 'Score = number of tests failed. Get the supporting documents and approval for each high-score entry.',
          table: {
            columns: [
              { key: 'score', label: 'Score', type: 'number' },
              { key: 'entry', label: 'Entry', type: 'text' },
              { key: 'posting', label: 'Posting date', type: 'date' },
              { key: 'created', label: 'Entered', type: 'date' },
              { key: 'user', label: 'User', type: 'text' },
              { key: 'amount', label: 'Debits', type: 'money' },
              { key: 'accounts', label: 'Accounts', type: 'text' },
              { key: 'why', label: 'Why it was flagged', type: 'text', wide: true },
              { key: 'rows', label: 'Rows', type: 'text' },
            ],
            rows: top.map((e) => ({
              score: e.score,
              entry: e.id,
              posting: formatDate(e.posting),
              created: e.created ? formatDateTime(e.created) : '',
              user: e.user,
              amount: e.debit,
              accounts: [...new Set(e.lines.map((l) => l.account))].join(', '),
              why: TESTS.filter((t) => e.flags[t.id]).map((t) => e.flags[t.id]).join('; '),
              rows: e.lines.map((l) => l.row.__row).join(', '),
            })),
            empty: 'No entry failed any test.',
          },
        },
        {
          title: 'By user',
          description: 'Users with the most high-score entries first.',
          table: {
            columns: [
              { key: 'user', label: 'User', type: 'text' },
              { key: 'entries', label: 'Entries posted', type: 'number' },
              { key: 'flagged', label: 'Flagged', type: 'number' },
              { key: 'share', label: 'Flagged %', type: 'percent' },
              { key: 'high', label: 'Score 3+', type: 'number' },
            ],
            rows: userRows,
            empty: 'No user column was mapped.',
          },
        },
        {
          title: 'Accounts in flagged entries',
          description: 'The 25 accounts that appear in the most flagged entries.',
          table: {
            columns: [
              { key: 'account', label: 'Account', type: 'text' },
              { key: 'name', label: 'Account name', type: 'text' },
              { key: 'entries', label: 'Flagged entries', type: 'number' },
              { key: 'amount', label: 'Amount (absolute)', type: 'money' },
            ],
            rows: accountRows,
          },
        },
        {
          title: 'Entries that do not balance',
          description: 'Debits and credits should net to zero in every entry. An unbalanced entry usually means the export is incomplete.',
          table: {
            columns: [
              { key: 'entry', label: 'Entry', type: 'text' },
              { key: 'net', label: 'Difference', type: 'money' },
              { key: 'lines', label: 'Lines', type: 'number' },
            ],
            rows: unbalanced.map((e) => ({ entry: e.id, net: e.net, lines: e.lines.length })),
            empty: 'Every entry balances.',
          },
        },
      ],
    };
  },
};

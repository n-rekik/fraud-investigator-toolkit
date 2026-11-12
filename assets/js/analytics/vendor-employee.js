import {
  fieldReader, normalizeBank, normalizePhone, normalizeEmail, normalizeAddress,
  normalizeText, normalizeCompany, similarity, parseDate, formatDate,
} from '../core/data.js';

// Compares the vendor master file with the employee master file. A shared bank
// account, address, phone or email can point to a fictitious vendor or an
// undisclosed conflict of interest.

const RISK = { bank: 'HIGH', address: 'MEDIUM', phone: 'MEDIUM', email: 'MEDIUM', name: 'LOW' };
const RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const LABEL = { bank: 'Bank account', address: 'Address', phone: 'Phone', email: 'Email', name: 'Name' };
// Emails that many people share (generic inboxes) are not evidence of a link.
const GENERIC_EMAIL = /^(info|admin|office|accounts|finance|sales|contact|hello|billing|invoices?|ap|ar)@/;

function index(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** House-number + first street word, used to find address candidates quickly. */
function addressBlocks(address) {
  const words = address.split(' ');
  const numbers = words.filter((w) => /\d/.test(w));
  const streetWords = words.filter((w) => !/\d/.test(w) && w.length > 2);
  return numbers.flatMap((n) => streetWords.slice(0, 2).map((s) => `${n}|${s}`));
}

export default {
  id: 'vendor-employee',
  name: 'Vendor–employee match',
  category: 'Accounts payable',
  summary: 'Finds vendors that share a bank account, address, phone number, email or name with an employee.',
  guide: 'guides/03-vendor-employee-match.md',
  datasets: [
    {
      key: 'vendors',
      label: 'Vendor master file',
      help: 'One row per vendor.',
      sample: 'sample-data/vendor-master.csv',
      fields: [
        { key: 'id', label: 'Vendor number', aliases: ['vendor id', 'vendor number', 'vendor no', 'supplier id', 'vendor code', 'id'] },
        { key: 'name', label: 'Vendor name', required: true, aliases: ['vendor name', 'name', 'supplier name', 'vendor', 'supplier'] },
        { key: 'bank', label: 'Bank account / IBAN', aliases: ['iban', 'bank account', 'bank account number', 'account number', 'bank', 'bank details'] },
        { key: 'address', label: 'Address', aliases: ['address', 'street', 'street address', 'address line 1', 'address 1'] },
        { key: 'postcode', label: 'Postcode', aliases: ['postcode', 'post code', 'postal code', 'zip', 'zip code'] },
        { key: 'phone', label: 'Phone', aliases: ['phone', 'telephone', 'phone number', 'mobile', 'tel'] },
        { key: 'email', label: 'Email', aliases: ['email', 'e mail', 'email address'] },
        { key: 'created', label: 'Date created', aliases: ['created', 'created on', 'date created', 'creation date', 'created date'] },
        { key: 'createdBy', label: 'Created by', aliases: ['created by', 'creator', 'user', 'entered by'] },
      ],
    },
    {
      key: 'employees',
      label: 'Employee master file',
      help: 'One row per employee. You need approval from HR and your data protection officer to use this file.',
      sample: 'sample-data/employee-master.csv',
      fields: [
        { key: 'id', label: 'Employee number', aliases: ['employee id', 'employee number', 'employee no', 'personnel number', 'staff id', 'id'] },
        { key: 'name', label: 'Employee name', required: true, aliases: ['employee name', 'name', 'full name', 'employee'] },
        { key: 'bank', label: 'Bank account / IBAN', aliases: ['iban', 'bank account', 'bank account number', 'account number', 'bank'] },
        { key: 'address', label: 'Address', aliases: ['address', 'home address', 'street', 'street address', 'address line 1'] },
        { key: 'postcode', label: 'Postcode', aliases: ['postcode', 'post code', 'postal code', 'zip', 'zip code'] },
        { key: 'phone', label: 'Phone', aliases: ['phone', 'telephone', 'mobile', 'phone number', 'personal phone'] },
        { key: 'email', label: 'Email', aliases: ['email', 'e mail', 'personal email', 'private email'] },
      ],
    },
  ],
  options: [
    { key: 'addressThreshold', label: 'Address similarity needed (%)', type: 'number', default: 90 },
    { key: 'matchSurnames', label: 'Also flag vendor names that contain an employee surname (LOW risk)', type: 'checkbox', default: true },
  ],

  run(inputs, options = {}) {
    const v = fieldReader(inputs.vendors.mapping);
    const e = fieldReader(inputs.employees.mapping);
    const order = inputs.vendors.dateOrder;
    const addressThreshold = Number(options.addressThreshold ?? 90) / 100;
    const notes = [];

    const prep = (rows, f) => rows.map((row) => {
      const postcode = normalizeText(f.get(row, 'postcode')).replace(/ /g, '');
      return {
        row,
        id: String(f.get(row, 'id') ?? ''),
        name: String(f.get(row, 'name') ?? '').trim(),
        bank: normalizeBank(f.get(row, 'bank')),
        address: normalizeAddress(f.get(row, 'address')),
        postcode,
        phone: normalizePhone(f.get(row, 'phone')),
        email: normalizeEmail(f.get(row, 'email')),
        raw: { bank: f.get(row, 'bank'), address: [f.get(row, 'address'), f.get(row, 'postcode')].filter(Boolean).join(', '), phone: f.get(row, 'phone'), email: f.get(row, 'email'), name: f.get(row, 'name') },
      };
    });
    const vendors = prep(inputs.vendors.rows, v);
    const employees = prep(inputs.employees.rows, e);

    const matches = new Map(); // vendorRow|employeeRow -> match
    const add = (vd, emp, field) => {
      const key = `${vd.row.__row}|${emp.row.__row}`;
      const m = matches.get(key) || { vd, emp, fields: new Set() };
      m.fields.add(field);
      matches.set(key, m);
    };

    const exact = (field, ok = () => true) => {
      if (!v.has(field) || !e.has(field)) return;
      const empIndex = index(employees, (x) => (ok(x[field]) ? x[field] : ''));
      for (const vd of vendors) {
        if (!vd[field] || !ok(vd[field])) continue;
        for (const emp of empIndex.get(vd[field]) || []) add(vd, emp, field);
      }
    };
    exact('bank', (b) => b.length >= 8);
    exact('phone');
    exact('email', (m) => m.includes('@') && !GENERIC_EMAIL.test(m));

    if (v.has('address') && e.has('address')) {
      const blocks = new Map();
      for (const emp of employees) {
        for (const b of addressBlocks(emp.address)) {
          if (!blocks.has(b)) blocks.set(b, new Set());
          blocks.get(b).add(emp);
        }
      }
      for (const vd of vendors) {
        if (!vd.address) continue;
        const candidates = new Set();
        for (const b of addressBlocks(vd.address)) for (const emp of blocks.get(b) || []) candidates.add(emp);
        for (const emp of candidates) {
          if (vd.postcode && emp.postcode && vd.postcode !== emp.postcode) continue;
          if (vd.address === emp.address || similarity(vd.address, emp.address) >= addressThreshold) add(vd, emp, 'address');
        }
      }
    } else {
      notes.push('Address was not mapped in both files, so addresses were not compared.');
    }

    if (options.matchSurnames !== false) {
      const surnames = new Map();
      for (const emp of employees) {
        const words = normalizeText(emp.name).split(' ').filter(Boolean);
        const surname = words.length > 1 ? words[words.length - 1] : '';
        if (surname.length < 4) continue;
        if (!surnames.has(surname)) surnames.set(surname, []);
        surnames.get(surname).push(emp);
      }
      for (const vd of vendors) {
        for (const word of new Set(normalizeCompany(vd.name).split(' '))) {
          for (const emp of surnames.get(word) || []) add(vd, emp, 'name');
        }
      }
      notes.push('Name matches (LOW) are noisy: common surnames and family-named businesses create false matches.');
    }
    notes.push('Some matches are legitimate, for example employees reimbursed through the vendor system. Check the conflict-of-interest register before you escalate.');

    const results = [...matches.values()].map(({ vd, emp, fields }) => {
      const list = [...fields];
      const risk = list.map((x) => RISK[x]).sort((a, b) => RANK[b] - RANK[a])[0];
      return {
        risk,
        matched: list.map((x) => LABEL[x]).join(', '),
        vendorId: vd.id,
        vendor: vd.name,
        employeeId: emp.id,
        employee: emp.name,
        vendorValue: list.filter((x) => x !== 'name').map((x) => `${LABEL[x]}: ${vd.raw[x] ?? ''}`).join(' | ') || vd.raw.name,
        employeeValue: list.filter((x) => x !== 'name').map((x) => `${LABEL[x]}: ${emp.raw[x] ?? ''}`).join(' | ') || emp.raw.name,
        created: formatDate(parseDate(v.get(vd.row, 'created'), order)),
        createdBy: v.get(vd.row, 'createdBy') ?? '',
        vendorRow: vd.row.__row,
        employeeRow: emp.row.__row,
      };
    }).sort((a, b) => RANK[b.risk] - RANK[a.risk] || a.vendor.localeCompare(b.vendor));

    const count = (r) => results.filter((x) => x.risk === r).length;
    const columns = [
      { key: 'risk', label: 'Risk', type: 'flag' },
      { key: 'matched', label: 'Matched on', type: 'text' },
      { key: 'vendorId', label: 'Vendor no.', type: 'text' },
      { key: 'vendor', label: 'Vendor', type: 'text' },
      { key: 'employeeId', label: 'Employee no.', type: 'text' },
      { key: 'employee', label: 'Employee', type: 'text' },
      { key: 'vendorValue', label: 'Vendor value', type: 'text', wide: true },
      { key: 'employeeValue', label: 'Employee value', type: 'text', wide: true },
      ...(v.has('created') ? [{ key: 'created', label: 'Vendor created', type: 'date' }] : []),
      ...(v.has('createdBy') ? [{ key: 'createdBy', label: 'Created by', type: 'text' }] : []),
      { key: 'vendorRow', label: 'Vendor row', type: 'number' },
      { key: 'employeeRow', label: 'Employee row', type: 'number' },
    ];

    return {
      summary: [
        { label: 'Vendors / employees compared', value: `${vendors.length.toLocaleString('en-GB')} / ${employees.length.toLocaleString('en-GB')}` },
        { label: 'HIGH (bank account)', value: String(count('HIGH')), tone: count('HIGH') ? 'bad' : 'good' },
        { label: 'MEDIUM (address, phone, email)', value: String(count('MEDIUM')), tone: count('MEDIUM') ? 'warn' : 'good' },
        { label: 'LOW (name only)', value: String(count('LOW')) },
      ],
      notes,
      sections: [
        {
          title: 'Matches',
          description: 'One row per vendor–employee pair, with every field they share. Facts only: a match is not a finding about any person.',
          table: { columns, rows: results, empty: 'No vendor shares details with an employee.' },
        },
      ],
    };
  },
};

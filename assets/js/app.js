// The page: menu, file loading, column mapping, options, results and exports.
// Everything happens in this browser tab. Files are read locally and never sent anywhere.

import TESTS from './analytics/index.js';
import { normalizeText } from './core/data.js';

const REPO = 'https://github.com/n-rekik/fraud-investigator-toolkit';
const PREVIEW_ROWS = 5;
const TABLE_PAGE = 200;

const state = { test: null, inputs: {}, options: {}, results: null };
const $menu = document.getElementById('menu');
const $work = document.getElementById('workspace');

// ---------- Tiny DOM helper (always textContent, never innerHTML, so file content cannot inject code) ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// ---------- Formatting ----------
const fmtMoney = (n) => (typeof n === 'number' ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(n ?? ''));
const fmtNumber = (n) => (typeof n === 'number' ? n.toLocaleString('en-GB') : String(n ?? ''));
const fmtPercent = (n) => (typeof n === 'number' ? `${(n * 100).toFixed(1)}%` : String(n ?? ''));
const fmtDecimal = (n) => (typeof n === 'number' ? n.toFixed(2) : String(n ?? ''));
function formatCell(value, type) {
  if (type === 'money') return fmtMoney(value);
  if (type === 'number') return fmtNumber(value);
  if (type === 'percent') return fmtPercent(value);
  if (type === 'decimal') return fmtDecimal(value);
  return value === null || value === undefined ? '' : String(value);
}
const isNumericType = (t) => ['money', 'number', 'percent', 'decimal'].includes(t);
function flagTag(value) {
  if (!value) return '';
  const v = String(value).toUpperCase();
  const tone = v === 'HIGH' || v.startsWith('ABOVE') ? 'bad' : v === 'MEDIUM' || v.startsWith('BELOW') ? 'warn' : v === 'LOW' ? 'neutral' : 'neutral';
  return h('span', { class: `tag ${tone}`, text: String(value) });
}

// ---------- Reading files ----------
function addRowNumbers(rows) {
  rows.forEach((r, i) => Object.defineProperty(r, '__row', { value: i + 2, enumerable: false }));
  return rows;
}

function parseCsvText(text) {
  const result = window.Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (x) => x.trim() });
  const columns = (result.meta.fields || []).filter((c) => c !== '');
  if (!columns.length) throw new Error('No header row was found. The first row of the file must contain column names.');
  return { columns, rows: addRowNumbers(result.data) };
}

let excelLoader = null;
function loadExcelLibrary() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!excelLoader) {
    excelLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/vendor/exceljs.min.js';
      s.onload = () => resolve(window.ExcelJS);
      s.onerror = () => reject(new Error('The Excel reader could not be loaded.'));
      document.head.append(s);
    });
  }
  return excelLoader;
}

function excelCellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // ExcelJS returns dates as UTC; rebuild them as local dates so the day never shifts.
    const d = new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), v.getUTCHours(), v.getUTCMinutes(), v.getUTCSeconds());
    if (v.getUTCHours() || v.getUTCMinutes()) d._hasTime = true;
    return d;
  }
  if (typeof v === 'object') {
    if ('result' in v) return excelCellValue(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    if ('error' in v) return '';
  }
  return v;
}

async function readWorkbook(buffer) {
  const ExcelJS = await loadExcelLibrary();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets.filter((ws) => ws.state !== 'hidden' && ws.actualRowCount > 0);
}

function readSheet(ws) {
  const values = [];
  ws.eachRow({ includeEmpty: false }, (row) => values.push(row.values.slice(1).map(excelCellValue)));
  if (!values.length) throw new Error('This sheet is empty.');
  const headers = values[0].map((x, i) => String(x ?? '').trim() || `Column ${i + 1}`);
  const seen = new Map();
  const columns = headers.map((c) => {
    const n = (seen.get(c) || 0) + 1;
    seen.set(c, n);
    return n > 1 ? `${c} (${n})` : c;
  });
  const rows = values.slice(1).map((vals) => Object.fromEntries(columns.map((c, i) => [c, vals[i] ?? ''])));
  return { columns, rows: addRowNumbers(rows) };
}

// ---------- Column mapping ----------
function guessMapping(fields, columns) {
  const norm = columns.map((c) => ({ c, n: normalizeText(c) }));
  const used = new Set();
  const mapping = {};
  const candidates = (f) => [f.label, ...(f.aliases || [])].map(normalizeText);
  // Pass 1: exact matches. Pass 2: column name contains an alias.
  for (const pass of [1, 2]) {
    for (const f of fields) {
      if (mapping[f.key]) continue;
      for (const alias of candidates(f)) {
        const hit = norm.find(({ c, n }) => !used.has(c) && (pass === 1 ? n === alias : alias.length > 3 && n.includes(alias)));
        if (hit) { mapping[f.key] = hit.c; used.add(hit.c); break; }
      }
    }
  }
  return mapping;
}

// ---------- Rendering: menu ----------
function renderMenu() {
  $menu.replaceChildren(...TESTS.map((t) => h('button', {
    class: 'test-button', type: 'button', 'aria-current': state.test === t ? 'true' : 'false',
    onclick: () => selectTest(t),
  }, h('span', { class: 'name', text: t.name }), h('span', { class: 'cat', text: t.category }))));
}

function selectTest(test) {
  state.test = test;
  state.inputs = {};
  state.results = null;
  state.options = Object.fromEntries((test.options || []).map((o) => [o.key, o.default]));
  history.replaceState(null, '', `#${test.id}`);
  renderMenu();
  renderWorkspace();
  window.scrollTo({ top: document.getElementById('tests').offsetTop - 8, behavior: 'smooth' });
}

// ---------- Rendering: workspace ----------
function renderWorkspace() {
  const t = state.test;
  $work.replaceChildren(
    h('div', { class: 'card test-head' },
      h('h2', { text: t.name }),
      h('p', { text: t.summary }),
      h('p', { class: 'links' },
        t.guide ? h('a', { href: `${REPO}/blob/main/${t.guide}`, text: 'Read the method and checks for this test' }) : null),
    ),
    h('div', { class: 'card' },
      h('h2', { class: 'step-title' }, h('span', { class: 'step-num', text: '1' }), 'Load your data'),
      h('p', { class: 'muted small', text: 'CSV or Excel (.xlsx). The first row must hold the column names. Try the sample data first to see how the test works.' }),
      ...t.datasets.map(renderDataset),
    ),
    t.options && t.options.length ? renderOptions() : null,
    h('div', { class: 'card' },
      h('h2', { class: 'step-title' }, h('span', { class: 'step-num', text: t.options && t.options.length ? '3' : '2' }), 'Run the test'),
      h('div', { class: 'actions', style: null },
        h('button', { class: 'btn primary', type: 'button', id: 'run', onclick: runTest, disabled: !ready() }, 'Run test'),
        h('span', { class: 'muted small', id: 'run-status', text: ready() ? '' : 'Load every file and map the required columns first.' }),
      ),
    ),
    h('div', { id: 'results' }),
  );
  if (state.results) renderResults();
}

function ready() {
  return state.test.datasets.every((d) => {
    const input = state.inputs[d.key];
    return input && d.fields.filter((f) => f.required).every((f) => input.mapping[f.key]);
  });
}
function refreshRunButton() {
  const btn = document.getElementById('run');
  const status = document.getElementById('run-status');
  if (!btn) return;
  btn.disabled = !ready();
  status.textContent = ready() ? '' : 'Load every file and map the required columns first.';
}

function renderDataset(ds) {
  const input = state.inputs[ds.key];
  const box = h('div', { class: 'dataset', id: `ds-${ds.key}` });
  const fileInput = h('input', { type: 'file', accept: '.csv,.txt,.xlsx', id: `file-${ds.key}`, onchange: (e) => e.target.files[0] && loadFile(ds, e.target.files[0]) });
  const drop = h('div', { class: 'drop' },
    h('label', { for: `file-${ds.key}`, text: 'Choose a file or drop it here' }), fileInput);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadFile(ds, e.dataTransfer.files[0]);
  });

  box.append(
    h('h3', { text: ds.label }),
    ds.help ? h('p', { class: 'muted small', text: ds.help }) : null,
    h('div', { class: 'file-row' }, drop,
      ds.sample ? h('button', { class: 'btn lime', type: 'button', onclick: () => loadSample(ds) }, 'Use sample data') : null),
  );
  if (input && input.error) box.append(h('p', { class: 'error', text: input.error }));
  if (input && input.rows) box.append(...renderLoaded(ds, input));
  return box;
}

function renderLoaded(ds, input) {
  const parts = [h('div', { class: 'loaded', text: `${input.fileName}: ${input.rows.length.toLocaleString('en-GB')} rows, ${input.columns.length} columns loaded.` })];
  if (input.sheets && input.sheets.length > 1) {
    parts.push(h('div', { class: 'field', style: null },
      h('label', { for: `sheet-${ds.key}`, text: 'Sheet' }),
      h('select', { id: `sheet-${ds.key}`, onchange: (e) => useSheet(ds, Number(e.target.value)) },
        ...input.sheets.map((s, i) => h('option', { value: i, selected: i === input.sheetIndex, text: s.name })))));
  }
  const previewRows = input.rows.slice(0, PREVIEW_ROWS);
  parts.push(h('details', {},
    h('summary', { class: 'small', text: 'Preview the first rows' }),
    h('div', { class: 'table-wrap preview' },
      h('table', {},
        h('thead', {}, h('tr', {}, input.columns.map((c) => h('th', { scope: 'col', text: c })))),
        h('tbody', {}, previewRows.map((r) => h('tr', {}, input.columns.map((c) => h('td', { text: cellText(r[c]) })))))))));

  parts.push(h('p', { class: 'small muted', style: null }, h('strong', { text: 'Match your columns. ' }), 'Fields marked * are required. We guessed from your column names; check each one.'));
  const grid = h('div', { class: 'mapping' });
  for (const f of ds.fields) {
    const id = `map-${ds.key}-${f.key}`;
    const select = h('select', { id, onchange: (e) => { input.mapping[f.key] = e.target.value || undefined; field.classList.toggle('unmapped', Boolean(f.required && !e.target.value)); refreshRunButton(); } },
      h('option', { value: '', text: f.required ? '— choose a column —' : '— not in my file —' }),
      ...input.columns.map((c) => h('option', { value: c, selected: input.mapping[f.key] === c, text: c })));
    const field = h('div', { class: `field${f.required && !input.mapping[f.key] ? ' unmapped' : ''}` },
      h('label', { for: id }, f.label, f.required ? h('span', { class: 'req', 'aria-label': 'required', text: ' *' }) : null), select,
      f.help ? h('span', { class: 'help', text: f.help }) : null);
    grid.append(field);
  }
  const orderId = `order-${ds.key}`;
  if (ds.fields.some((f) => /date|created/i.test(f.key))) grid.append(h('div', { class: 'field' },
    h('label', { for: orderId, text: 'Dates in this file are written' }),
    h('select', { id: orderId, onchange: (e) => { input.dateOrder = e.target.value; } },
      h('option', { value: 'DMY', selected: input.dateOrder === 'DMY', text: 'Day first (31/12/2026)' }),
      h('option', { value: 'MDY', selected: input.dateOrder === 'MDY', text: 'Month first (12/31/2026)' })),
    h('span', { class: 'help', text: 'Only matters for dates like 03/04/2026. ISO dates (2026-04-03) always work.' })));
  parts.push(grid);
  return parts;
}

const cellText = (v) => (v instanceof Date ? v.toISOString().slice(0, v._hasTime ? 16 : 10).replace('T', ' ') : v ?? '');

function setInput(ds, data, fileName, extra = {}) {
  state.inputs[ds.key] = { fileName, ...data, ...extra, mapping: guessMapping(ds.fields, data.columns), dateOrder: guessDateOrder(data.rows) };
  state.results = null;
  rerenderDataset(ds);
  document.getElementById('results').replaceChildren();
  refreshRunButton();
}

function guessDateOrder(rows) {
  // If any slash date has a first part above 12, the file is day-first; if a second part is above 12, month-first.
  for (const r of rows.slice(0, 500)) {
    for (const v of Object.values(r)) {
      const m = typeof v === 'string' && v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/);
      if (!m) continue;
      if (Number(m[1]) > 12) return 'DMY';
      if (Number(m[2]) > 12) return 'MDY';
    }
  }
  return 'DMY';
}

function rerenderDataset(ds) {
  const old = document.getElementById(`ds-${ds.key}`);
  if (old) old.replaceWith(renderDataset(ds));
}

async function loadFile(ds, file) {
  try {
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx')) {
      state.inputs[ds.key] = { fileName: file.name, loading: true };
      const sheets = await readWorkbook(await file.arrayBuffer());
      if (!sheets.length) throw new Error('The workbook has no visible sheets with data.');
      setInput(ds, readSheet(sheets[0]), file.name, { sheets, sheetIndex: 0 });
    } else if (name.endsWith('.xls')) {
      throw new Error('Old .xls files are not supported. In Excel, use File > Save As > Excel Workbook (.xlsx) or CSV.');
    } else {
      setInput(ds, parseCsvText(await file.text()), file.name);
    }
  } catch (err) {
    state.inputs[ds.key] = { error: `Could not read ${file.name}: ${err.message}` };
    rerenderDataset(ds);
    refreshRunButton();
  }
}

function useSheet(ds, index) {
  const input = state.inputs[ds.key];
  try {
    setInput(ds, readSheet(input.sheets[index]), input.fileName, { sheets: input.sheets, sheetIndex: index });
  } catch (err) {
    state.inputs[ds.key] = { ...input, error: err.message };
    rerenderDataset(ds);
  }
}

async function loadSample(ds) {
  try {
    const res = await fetch(ds.sample);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setInput(ds, parseCsvText(await res.text()), ds.sample.split('/').pop());
  } catch (err) {
    state.inputs[ds.key] = { error: `The sample file could not be loaded (${err.message}). If you opened index.html straight from your disk, use the online version instead.` };
    rerenderDataset(ds);
  }
}

function renderOptions() {
  const t = state.test;
  const grid = h('div', { class: 'mapping' });
  for (const o of t.options) {
    const id = `opt-${o.key}`;
    if (o.type === 'checkbox') {
      grid.append(h('div', { class: 'field checkbox' },
        h('input', { type: 'checkbox', id, checked: Boolean(state.options[o.key]), onchange: (e) => { state.options[o.key] = e.target.checked; } }),
        h('label', { for: id, text: o.label })));
    } else {
      grid.append(h('div', { class: 'field' },
        h('label', { for: id, text: o.label }),
        h('input', { type: o.type === 'number' ? 'number' : 'text', id, value: state.options[o.key] ?? '', placeholder: o.placeholder, step: o.type === 'number' ? 'any' : null,
          oninput: (e) => { state.options[o.key] = o.type === 'number' ? (e.target.value === '' ? o.default : Number(e.target.value)) : e.target.value; } }),
        o.help ? h('span', { class: 'help', text: o.help }) : null));
    }
  }
  return h('div', { class: 'card' },
    h('h2', { class: 'step-title' }, h('span', { class: 'step-num', text: '2' }), 'Settings'),
    h('details', { class: 'options' }, h('summary', { text: 'Adjust the settings (optional)' }),
      h('p', { class: 'muted small', text: 'The defaults suit most data. Change them to match your organisation, for example your approval limits or working hours.' }), grid));
}

// ---------- Running ----------
async function runTest() {
  const btn = document.getElementById('run');
  const status = document.getElementById('run-status');
  btn.disabled = true;
  btn.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Running…');
  status.textContent = '';
  await new Promise((r) => setTimeout(r, 30)); // let the button repaint before heavy work
  const started = performance.now();
  try {
    state.results = state.test.run(state.inputs, state.options);
    state.results.meta = {
      test: state.test.name,
      ranAt: new Date(),
      seconds: (performance.now() - started) / 1000,
      files: state.test.datasets.map((d) => `${d.label}: ${state.inputs[d.key].fileName} (${state.inputs[d.key].rows.length.toLocaleString('en-GB')} rows)`),
    };
    renderResults();
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    document.getElementById('results').replaceChildren(h('div', { class: 'card' }, h('p', { class: 'error', text: `The test stopped: ${err.message}` })));
  } finally {
    btn.disabled = !ready();
    btn.replaceChildren('Run test');
  }
}

// ---------- Rendering: results ----------
function renderResults() {
  const r = state.results;
  const card = h('div', { class: 'card' });
  card.append(
    h('div', { class: 'results-head' },
      h('div', {},
        h('h2', { class: 'step-title', text: `Results: ${r.meta.test}` }),
        h('p', { class: 'muted small', text: `Run on ${r.meta.ranAt.toLocaleString('en-GB')} in ${r.meta.seconds.toFixed(1)} s. ${r.meta.files.join('. ')}.` })),
      h('div', { class: 'actions no-print' },
        h('button', { class: 'btn', type: 'button', onclick: exportExcel }, 'Download Excel'),
        h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, 'Print or save as PDF'))),
    h('div', { class: 'tiles' }, r.summary.map((s) => h('div', { class: `tile ${s.tone || ''}` },
      h('div', { class: 'label', text: s.label }),
      h('div', { class: 'value', text: s.format === 'money' ? fmtMoney(s.value) : String(s.value) }),
      s.hint ? h('div', { class: 'hint', text: s.hint }) : null))),
    r.notes && r.notes.length ? h('ul', { class: 'notes' }, r.notes.map((n) => h('li', { text: n }))) : null,
    ...r.sections.map(renderSection),
  );
  document.getElementById('results').replaceChildren(card);
}

function renderSection(section, index) {
  const wrap = h('section', { class: 'section', 'aria-labelledby': `sec-${index}` },
    h('h3', { id: `sec-${index}`, text: section.title }),
    section.description ? h('p', { text: section.description }) : null);
  if (section.chart) wrap.append(renderChart(section.chart));
  if (section.table) {
    const t = section.table;
    if (!t.rows.length) {
      wrap.append(h('div', { class: 'table-wrap' }, h('p', { class: 'empty', text: t.empty || 'Nothing to show.' })));
    } else {
      const holder = h('div');
      const draw = (limit) => holder.replaceChildren(...[renderTable(t, limit),
        t.rows.length > limit ? h('div', { class: 'actions no-print' },
          h('p', { class: 'muted small', text: `Showing ${limit.toLocaleString('en-GB')} of ${t.rows.length.toLocaleString('en-GB')} rows.` }),
          h('button', { class: 'btn small', type: 'button', onclick: () => draw(t.rows.length) }, 'Show all rows')) : null].filter(Boolean));
      draw(TABLE_PAGE);
      wrap.append(holder, h('div', { class: 'actions no-print' },
        h('button', { class: 'btn small', type: 'button', onclick: () => exportCsv(section) }, 'Download CSV')));
    }
  }
  return wrap;
}

function renderTable(t, limit) {
  return h('div', { class: 'table-wrap' },
    h('table', {},
      h('thead', {}, h('tr', {}, t.columns.map((c) => h('th', { scope: 'col', class: isNumericType(c.type) ? 'num' : null, text: c.label })))),
      h('tbody', {}, t.rows.slice(0, limit).map((row) => h('tr', {}, t.columns.map((c) => {
        if (c.type === 'flag') return h('td', {}, flagTag(row[c.key]));
        const cls = isNumericType(c.type) ? 'num' : c.type === 'date' ? 'nowrap' : c.wide ? 'wide' : null;
        return h('td', { class: cls, text: formatCell(row[c.key], c.type) });
      }))))));
}

const TONES = { accent: '#141733', muted: '#b8f04c', bad: '#a01c16' };
function renderChart(chart) {
  const W = 720, H = 300, L = 52, R = 12, T = 12, B = 34;
  const max = Math.max(...chart.series.flatMap((s) => s.values), 0) * 1.1 || 1;
  const n = chart.labels.length, k = chart.series.length;
  const band = (W - L - R) / n, barW = Math.min(28, (band * 0.75) / k);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${chart.series.map((s) => s.name).join(' and ')} by ${chart.labels.length} categories` });
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = (max / 1.1) * (i / steps);
    root.append(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#e3e6ee' }));
    const label = svg('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#48506a' });
    label.textContent = chart.format === 'percent' ? `${Math.round(v * 100)}%` : fmtNumber(Math.round(v));
    root.append(label);
  }
  chart.labels.forEach((lab, i) => {
    const x0 = L + band * i + (band - barW * k) / 2;
    chart.series.forEach((s, j) => {
      const v = s.values[i];
      const rect = svg('rect', { x: x0 + j * barW, y: y(v), width: barW - 2, height: Math.max(0, y(0) - y(v)), rx: 3, fill: TONES[s.tone] || TONES.accent });
      const tip = svg('title', {});
      tip.textContent = `${lab} — ${s.name}: ${chart.format === 'percent' ? fmtPercent(v) : fmtNumber(v)}`;
      rect.append(tip);
      root.append(rect);
    });
    const t = svg('text', { x: L + band * i + band / 2, y: H - 12, 'text-anchor': 'middle', 'font-size': 13, fill: '#141a26' });
    t.textContent = lab;
    root.append(t);
  });
  const legend = h('div', { class: 'legend' }, chart.series.map((s) => {
    const item = h('span', { text: s.name });
    item.style.setProperty('--c', TONES[s.tone] || TONES.accent);
    return item;
  }));
  return h('div', { class: 'chart' }, root, legend);
}

// ---------- Exports ----------
function exportValue(v, type) {
  if (typeof v === 'number' && type === 'percent') return Number((v * 100).toFixed(2));
  if (typeof v === 'number' && type === 'decimal') return Number(v.toFixed(4));
  return v ?? '';
}
const fileStem = () => `${state.test.id}-${new Date().toISOString().slice(0, 10)}`;

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(section) {
  const t = section.table;
  const data = t.rows.map((row) => Object.fromEntries(t.columns.map((c) => [c.label + (c.type === 'percent' ? ' (%)' : ''), exportValue(row[c.key], c.type)])));
  // Prefix cells that start with = + - @ so spreadsheet apps never run them as formulas.
  const safe = data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v])));
  const csv = window.Papa.unparse(safe);
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${fileStem()}-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`);
}

async function exportExcel() {
  const r = state.results;
  const ExcelJS = await loadExcelLibrary();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fraud Investigator Toolkit (GreenRocks.ai)';
  const navy = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141733' } };

  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 38 }, { width: 60 }];
  sum.addRow([r.meta.test]).font = { bold: true, size: 16 };
  sum.addRow([`Run on ${r.meta.ranAt.toLocaleString('en-GB')}`]);
  r.meta.files.forEach((f) => sum.addRow([f]));
  sum.addRow([]);
  for (const s of r.summary) sum.addRow([s.label, s.format === 'money' ? fmtMoney(s.value) : String(s.value)]);
  sum.addRow([]);
  if (r.notes.length) {
    sum.addRow(['Notes']).font = { bold: true };
    r.notes.forEach((n) => sum.addRow([n]));
  }
  sum.addRow([]);
  sum.addRow(['Results are leads, not findings. Confirm every flag against source documents.']).font = { italic: true };

  const used = new Set(['Summary']);
  for (const section of r.sections) {
    if (!section.table) continue;
    let name = section.title.replace(/[\\/*?:[\]]/g, '').slice(0, 28);
    while (used.has(name)) name = `${name.slice(0, 26)} ${used.size}`;
    used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    const t = section.table;
    ws.columns = t.columns.map((c) => ({ header: c.label + (c.type === 'percent' ? ' (%)' : ''), key: c.key, width: Math.min(48, Math.max(12, c.label.length + 4)) }));
    t.rows.forEach((row) => ws.addRow(Object.fromEntries(t.columns.map((c) => [c.key, exportValue(row[c.key], c.type)]))));
    t.columns.forEach((c, i) => { if (c.type === 'money') ws.getColumn(i + 1).numFmt = '#,##0.00'; });
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.eachCell((cell) => { cell.fill = navy; });
    if (t.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.columns.length } };
  }
  const buffer = await wb.xlsx.writeBuffer();
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileStem()}.xlsx`);
}

// ---------- Start ----------
renderMenu();
// Fetch the Excel reader in the background, so Excel files also work if the connection drops later.
setTimeout(() => loadExcelLibrary().catch(() => {}), 1500);
selectTest(TESTS.find((t) => `#${t.id}` === location.hash) || TESTS[0]);
window.scrollTo(0, 0);

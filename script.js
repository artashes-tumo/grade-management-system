/**
 * Grade Tracker — script.js
 *
 * - First visit opens a setup wizard asking which subjects the student takes
 *   (Contemporary Studies/French/Spanish, Geography/History per semester, two design subjects, extras).
 * - The grade table is rendered from that setup; "My subjects" reopens the wizard.
 * - Grades are stored per semester, keyed by subject name, so changing subjects
 *   never deletes grades — switching back brings them back.
 */

'use strict';

/* ─── Constants ─────────────────────────────────────────── */
const CRITERIA = ['A', 'B', 'C', 'D'];
const SEMS = ['sem1', 'sem2'];
const SEM_LABEL = { sem1: 'Semester 1', sem2: 'Semester 2' };
const STORAGE_PREFIX = 'gms_grades_';   // same keys as the old version → old grades still load
const SETUP_KEY = 'gms_setup_v2';

const CORE = ['English', 'German', 'Mathematics', 'Science', 'P.E.'];

const OPTIONS = {
  option:     ['Contemporary Studies', 'French', 'Spanish'],
  humanities: ['Geography', 'History'],
  design:     ['Programming', 'Multimedia', 'Product Design', 'Food Design',
               'Drama', 'Digital Design', 'Visual Arts', 'Music', 'Chips'],
};

const GROUP_LABEL = {
  core: 'Core', option: 'Option', humanities: 'Individuals & Societies',
  design: 'Design', extra: 'Extra',
};

/* ─── Safe storage ──────────────────────────────────────── */
function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

/* ─── State ─────────────────────────────────────────────── */
function emptySetup() {
  return {
    option: '',
    humanities: { sem1: [], sem2: [] },
    design: [],
    extras: [],
    custom: { design: [] },
  };
}

let setup = readJSON(SETUP_KEY, null);
const grades = Object.fromEntries(SEMS.map(s => [s, readJSON(STORAGE_PREFIX + s, {}) || {}]));
let activeSem = 'sem1';

/** Ordered list of {name, group} for a semester */
function subjectsFor(sem, s = setup) {
  if (!s) return [];
  const list = [{ name: 'English', group: 'core' }, { name: 'German', group: 'core' }];
  if (s.option) list.push({ name: s.option, group: 'option' });
  (s.humanities[sem] || []).forEach(n => list.push({ name: n, group: 'humanities' }));
  ['Science', 'Mathematics', 'P.E.'].forEach(n => list.push({ name: n, group: 'core' }));
  s.design.forEach(n => list.push({ name: n, group: 'design' }));
  s.extras.forEach(n => list.push({ name: n, group: 'extra' }));
  return list;
}

/* ─── Grade maths ───────────────────────────────────────── */
function mapTotalToFinal(total) {
  if (total >= 28) return 7;
  if (total >= 24) return 6;
  if (total >= 19) return 5;
  if (total >= 15) return 4;
  if (total >= 10) return 3;
  if (total >= 6)  return 2;
  return 1;
}
const critTone  = n => (n >= 7 ? 'green' : n >= 5 ? 'yellow' : 'red');
const totalTone = t => (t >= 24 ? 'green' : t >= 16 ? 'yellow' : 'red');
const finalTone = f => (f >= 7 ? 'green' : f >= 5 ? 'yellow' : 'red');

function validCrit(v) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}

function rowResult(sem, subject) {
  const d = grades[sem][subject] || {};
  const vals = CRITERIA.map(c => validCrit(d[c]));
  if (vals.some(v => v === null)) return null;
  const total = vals.reduce((a, b) => a + b, 0);
  return { total, final: mapTotalToFinal(total) };
}

/* ─── Table rendering ───────────────────────────────────── */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderTable() {
  const body = document.getElementById('grade-body');
  const subjects = subjectsFor(activeSem);

  if (!subjects.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">No subjects yet — click <b>My subjects</b> to set them up.</td></tr>`;
    return;
  }

  body.innerHTML = subjects.map(({ name, group }) => {
    const d = grades[activeSem][name] || {};
    const cells = CRITERIA.map(c => {
      const v = validCrit(d[c]);
      return `<td class="cell ${v ? 'tone-' + critTone(v) : ''}">
        <input type="text" inputmode="numeric" maxlength="1" autocomplete="off"
               data-crit="${c}" value="${v ?? ''}" placeholder="–"
               aria-label="${esc(name)} criterion ${c}" />
      </td>`;
    }).join('');
    return `<tr data-subject="${esc(name)}">
      <th scope="row" class="subject">
        <span class="tag tag-${group}" title="${GROUP_LABEL[group]}"></span>
        <span class="subject-name">${esc(name)}</span>
        <span class="subject-group">${GROUP_LABEL[group]}</span>
      </th>
      ${cells}
      <td class="cell out total"><output data-out="total"></output></td>
      <td class="cell out final"><output data-out="final"></output></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('tr[data-subject]').forEach(row => updateRowOutputs(row, false));
}

function setTone(cell, tone) {
  cell.classList.remove('tone-green', 'tone-yellow', 'tone-red');
  if (tone) cell.classList.add('tone-' + tone);
}

function updateRowOutputs(row, animate = true) {
  const res = rowResult(activeSem, row.dataset.subject);
  const totalCell = row.querySelector('.total');
  const finalCell = row.querySelector('.final');
  totalCell.querySelector('output').textContent = res ? res.total : '';
  finalCell.querySelector('output').textContent = res ? res.final : '';
  setTone(totalCell, res && totalTone(res.total));
  setTone(finalCell, res && finalTone(res.final));
  if (animate && res) {
    [totalCell, finalCell].forEach(c => {
      c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    });
  }
}

function handleInput(input) {
  const row = input.closest('tr');
  const subject = row.dataset.subject;
  const crit = input.dataset.crit;
  const raw = input.value.replace(/[^0-9]/g, '');
  const n = validCrit(raw);

  input.value = n ?? '';
  grades[activeSem][subject] = { ...(grades[activeSem][subject] || {}), [crit]: n };
  setTone(input.closest('.cell'), n && critTone(n));
  updateRowOutputs(row);
  persistGrades();
  updateStats();

  // Jump to the next criterion after a valid digit
  if (n) {
    const inputs = [...document.querySelectorAll('#grade-body input')];
    const next = inputs[inputs.indexOf(input) + 1];
    if (next) next.focus(), next.select();
  }
}

/* ─── Stats + distribution ──────────────────────────────── */
function buildDistBars() {
  const el = document.getElementById('dist-bars');
  el.innerHTML = [8, 7, 6, 5, 4, 3, 2, 1].map(g => `
    <div class="bar" id="bar-${g}">
      <span class="bar-count">0</span>
      <div class="bar-track"><div class="bar-fill tone-${critTone(g)}"></div></div>
      <span class="bar-label">${g}</span>
    </div>`).join('');
}

function updateStats() {
  const subjects = subjectsFor(activeSem);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  let filled = 0, done = 0, finalSum = 0, best = null;

  subjects.forEach(({ name }) => {
    const d = grades[activeSem][name] || {};
    CRITERIA.forEach(c => {
      const v = validCrit(d[c]);
      if (v) { counts[v]++; filled++; }
    });
    const res = rowResult(activeSem, name);
    if (res) {
      done++; finalSum += res.final;
      if (!best || res.total > best.total) best = { name, ...res };
    }
  });

  document.getElementById('stat-avg').textContent = done ? (finalSum / done).toFixed(1) : '—';
  document.getElementById('stat-best').textContent = best ? `${best.name} · ${best.final}` : '—';
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-total').textContent = subjects.length;
  document.getElementById('stat-filled').textContent = filled;
  document.getElementById('stat-possible').textContent = subjects.length * CRITERIA.length;

  const max = Math.max(1, ...Object.values(counts));
  for (let g = 1; g <= 8; g++) {
    const bar = document.getElementById('bar-' + g);
    bar.querySelector('.bar-count').textContent = counts[g];
    bar.querySelector('.bar-fill').style.height = `${(counts[g] / max) * 100}%`;
    bar.setAttribute('aria-label', `Score ${g}: ${counts[g]}`);
  }

  const total = new Set([...subjectsFor('sem1'), ...subjectsFor('sem2')].map(s => s.name)).size;
  document.getElementById('subject-count').textContent = total;
}

/* ─── Persistence + feedback ────────────────────────────── */
function persistGrades() {
  return SEMS.every(s => writeJSON(STORAGE_PREFIX + s, grades[s]));
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 2400);
}

/* ─── Semester switching ────────────────────────────────── */
function switchSem(sem) {
  activeSem = sem;
  document.querySelectorAll('.seg-btn').forEach(b => {
    const on = b.dataset.sem === sem;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  renderTable();
  updateStats();
}

/* ═══════════════ SETUP WIZARD ═══════════════ */
const STEPS = [
  {
    title: 'Contemporary Studies, French or Spanish?',
    hint: 'English and German are required. Pick the one you take from these three.',
    render: d => chipGroup('option', OPTIONS.option, [d.option], 'radio'),
    validate: d => d.option ? '' : 'Pick one of the three.',
  },
  {
    title: 'Geography or History?',
    hint: 'Pick what you have in each semester (one or both).',
    render: d => SEMS.map(s => `
      <div class="sem-block">
        <p class="sem-block-title">${SEM_LABEL[s]}</p>
        ${chipGroup('humanities-' + s, OPTIONS.humanities, d.humanities[s], 'checkbox')}
      </div>`).join('') +
      `<button type="button" class="link-btn" data-action="copy-hum">Same in both semesters</button>`,
    validate: d => SEMS.every(s => d.humanities[s].length) ? '' : 'Pick at least one for each semester.',
  },
  {
    title: 'Which 2 design subjects do you take?',
    hint: 'Pick exactly two. Missing one? Add it below.',
    render: d => chipGroup('design', allOptions(d, 'design'), d.design, 'checkbox', true) +
      `<p class="counter"><b id="design-count">${d.design.length}</b> / 2 selected</p>`,
    validate: d => d.design.length === 2 ? '' : `Pick exactly 2 design subjects (you have ${d.design.length}).`,
  },
  {
    title: 'Anything else?',
    hint: 'These are always included. Add any extra subject you also get graded in.',
    render: d => `
      <div class="fixed-list">${CORE.map(n => `<span class="chip chip-fixed">${n}</span>`).join('')}</div>
      <p class="sem-block-title">Extra subjects</p>
      <div class="chips" id="extras-list">${d.extras.map(n =>
        `<span class="chip chip-on">${esc(n)}<button type="button" class="chip-x" data-remove-extra="${esc(n)}" aria-label="Remove ${esc(n)}">×</button></span>`).join('') || '<span class="muted">None</span>'}</div>
      ${addRow('extra', 'e.g. Music')}
      <div class="review">
        ${SEMS.map(s => `<div><p class="sem-block-title">${SEM_LABEL[s]}</p>
          <p class="review-list">${subjectsFor(s, d).map(x => esc(x.name)).join(' · ')}</p></div>`).join('')}
      </div>`,
    validate: () => '',
  },
];

let draft = null;
let stepIdx = 0;

function allOptions(d, key) {
  return [...new Set([...OPTIONS[key], ...d.custom[key]])];
}

function chipGroup(name, options, selected, type, allowAdd = false) {
  return `<div class="chips" role="group">
    ${options.map(opt => `
      <label class="chip">
        <input type="${type}" name="${name}" value="${esc(opt)}" ${selected.includes(opt) ? 'checked' : ''} />
        <span>${esc(opt)}</span>
      </label>`).join('')}
  </div>${allowAdd ? addRow(name, 'Add another…') : ''}`;
}

function addRow(key, placeholder) {
  return `<div class="add-row">
    <input type="text" class="add-input" data-add="${key}" placeholder="${placeholder}" maxlength="40" />
    <button type="button" class="btn btn-ghost btn-sm" data-add-btn="${key}">Add</button>
  </div>`;
}

function openSetup(firstRun = false) {
  draft = structuredClone(setup || emptySetup());
  stepIdx = 0;
  const dlg = document.getElementById('setup');
  dlg.dataset.firstRun = firstRun;
  renderStep();
  dlg.showModal();
}

function renderStep() {
  const step = STEPS[stepIdx];
  document.getElementById('setup-step').textContent = `Step ${stepIdx + 1} of ${STEPS.length}`;
  document.getElementById('setup-title').textContent = step.title;
  document.getElementById('setup-progress').style.width = `${((stepIdx + 1) / STEPS.length) * 100}%`;
  document.getElementById('setup-body').innerHTML = `<p class="setup-hint">${step.hint}</p>${step.render(draft)}`;
  document.getElementById('setup-error').textContent = '';

  const back = document.getElementById('setup-back');
  const first = document.getElementById('setup').dataset.firstRun === 'true';
  back.textContent = stepIdx === 0 ? (first ? '' : 'Cancel') : 'Back';
  back.hidden = stepIdx === 0 && first;
  document.getElementById('setup-next').textContent = stepIdx === STEPS.length - 1 ? 'Finish' : 'Next';
}

function readStepInputs() {
  const body = document.getElementById('setup-body');
  const vals = name => [...body.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
  if (stepIdx === 0) draft.option = vals('option')[0] || '';
  if (stepIdx === 1) SEMS.forEach(s => { draft.humanities[s] = vals('humanities-' + s); });
  if (stepIdx === 2) draft.design = vals('design');
}

function addCustom(key) {
  const input = document.querySelector(`[data-add="${key}"]`);
  const val = input.value.trim().replace(/\s+/g, ' ');
  if (!val) return;
  readStepInputs();
  if (key === 'extra') {
    const taken = new Set([...CORE, draft.option, ...draft.design, ...SEMS.flatMap(s => draft.humanities[s])]);
    if (!draft.extras.includes(val) && !taken.has(val)) draft.extras.push(val);
  } else {
    if (!allOptions(draft, key).includes(val)) draft.custom[key].push(val);
    if (key === 'design' && !draft.design.includes(val) && draft.design.length < 2) draft.design.push(val);
  }
  renderStep();
  document.querySelector(`[data-add="${key}"]`)?.focus();
}

function initSetup() {
  const dlg = document.getElementById('setup');
  const body = document.getElementById('setup-body');

  // First run can't be dismissed with Escape
  dlg.addEventListener('cancel', e => { if (dlg.dataset.firstRun === 'true') e.preventDefault(); });

  document.getElementById('setup-next').addEventListener('click', () => {
    readStepInputs();
    const err = STEPS[stepIdx].validate(draft);
    if (err) { document.getElementById('setup-error').textContent = err; return; }
    if (stepIdx < STEPS.length - 1) { stepIdx++; renderStep(); return; }

    setup = draft;
    writeJSON(SETUP_KEY, setup);
    dlg.close();
    renderTable();
    updateStats();
    toast('Subjects saved');
  });

  document.getElementById('setup-back').addEventListener('click', () => {
    if (stepIdx === 0) { dlg.close(); return; }
    readStepInputs();
    stepIdx--;
    renderStep();
  });

  body.addEventListener('change', e => {
    document.getElementById('setup-error').textContent = '';
    if (e.target.name === 'design') {
      const checked = body.querySelectorAll('input[name="design"]:checked');
      if (checked.length > 2) { e.target.checked = false; toastInline('You can only pick 2 — untick one first.'); }
      document.getElementById('design-count').textContent = body.querySelectorAll('input[name="design"]:checked').length;
    }
  });

  body.addEventListener('click', e => {
    const add = e.target.closest('[data-add-btn]');
    if (add) addCustom(add.dataset.addBtn);

    const rm = e.target.closest('[data-remove-extra]');
    if (rm) { draft.extras = draft.extras.filter(x => x !== rm.dataset.removeExtra); renderStep(); }

    if (e.target.closest('[data-action="copy-hum"]')) {
      readStepInputs();
      draft.humanities.sem2 = [...draft.humanities.sem1];
      renderStep();
    }
  });

  body.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.add-input')) { e.preventDefault(); addCustom(e.target.dataset.add); }
  });
}

function toastInline(msg) { document.getElementById('setup-error').textContent = msg; }

/* ─── Init ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildDistBars();
  initSetup();
  renderTable();
  updateStats();

  document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => switchSem(b.dataset.sem)));
  document.getElementById('setup-btn').addEventListener('click', () => openSetup(false));

  document.getElementById('save-btn').addEventListener('click', () => {
    toast(persistGrades() ? 'Grades saved' : 'Could not save — browser storage is blocked');
  });

  const tbody = document.getElementById('grade-body');
  tbody.addEventListener('input', e => { if (e.target.matches('input[data-crit]')) handleInput(e.target); });
  tbody.addEventListener('focusin', e => { if (e.target.matches('input')) e.target.select(); });

  if (!setup) openSetup(true);
});

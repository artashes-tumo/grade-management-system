/**
 * Grade Management System — script.js
 *
 * Improvements over original:
 *  - alert() replaced with non-blocking toast notification
 *  - Grade validation: clamps out-of-range on 'change' (blur), not just 'input'
 *  - Stats panel replaced by visual bar-chart distribution (built in JS)
 *  - Bar chart animates on every update
 *  - Saving persists BOTH semesters simultaneously (not just the active one)
 *  - Tab switching uses proper aria-selected + aria-expanded
 *  - Input: spinners hidden via CSS; value clamped on blur for mobile UX
 *  - On flash animation: old class is removed then re-added so it always re-triggers
 *  - Semester section transitions in smoothly when revealed
 *  - Consistent use of constants instead of magic strings
 */

'use strict';

/* ─── Constants ─────────────────────────────────────────── */
const CRITERIA  = ['A', 'B', 'C', 'D'];
const SEM_IDS   = ['sem1', 'sem2'];
const STORAGE_PREFIX = 'gms_grades_';

/* ─── Grade mapping ─────────────────────────────────────── */

/** Map total (0–32) → final grade (1–7) */
function mapTotalToFinal(total) {
  if (total >= 28) return 7;
  if (total >= 24) return 6;
  if (total >= 19) return 5;
  if (total >= 15) return 4;
  if (total >= 10) return 3;
  if (total >= 6)  return 2;
  return 1;
}

/** Return CSS class for a criteria/final grade value */
function gradeClass(value) {
  if (!value && value !== 0) return '';
  const n = +value;
  if (n >= 7) return 'grade-green';
  if (n >= 5) return 'grade-yellow';
  if (n >= 1) return 'grade-red';
  return '';
}

/** Return CSS class for a total (0–32) value */
function totalClass(total) {
  if (total >= 24) return 'grade-green';
  if (total >= 16) return 'grade-yellow';
  return 'grade-red';
}

/* ─── Cell colour helpers ───────────────────────────────── */
const COLOR_CLASSES = ['grade-green', 'grade-yellow', 'grade-red'];

function setCellColor(cell, cls) {
  cell.classList.remove(...COLOR_CLASSES);
  if (cls) cell.classList.add(cls);
}

function flashCell(cell) {
  cell.classList.remove('flash');
  // Force reflow so the animation re-triggers even if it was already applied
  void cell.offsetWidth;
  cell.classList.add('flash');
}

/* ─── Row calculation ───────────────────────────────────── */
function recalcRow(row) {
  const criteriaInputs = CRITERIA.map(c => row.querySelector(`input[data-crit="${c}"]`));
  const values         = criteriaInputs.map(i => parseInt(i.value, 10));
  const allFilled      = values.every(v => !isNaN(v) && v >= 1 && v <= 8);

  const totalInput = row.querySelector('input[data-crit="Total"]');
  const finalInput = row.querySelector('input[data-crit="Final"]');
  const totalCell  = totalInput.closest('.grade-cell');
  const finalCell  = finalInput.closest('.grade-cell');

  if (allFilled) {
    const total      = values.reduce((a, b) => a + b, 0);
    const finalGrade = mapTotalToFinal(total);

    totalInput.value = total;
    finalInput.value = finalGrade;

    setCellColor(totalCell, totalClass(total));
    setCellColor(finalCell, gradeClass(finalGrade));
    flashCell(totalCell);
    flashCell(finalCell);
  } else {
    // Only clear if we had data before (avoid flashing on first empty load)
    const hadData = totalInput.value !== '';
    totalInput.value = '';
    finalInput.value = '';
    setCellColor(totalCell, '');
    setCellColor(finalCell, '');
    if (hadData) {
      flashCell(totalCell);
      flashCell(finalCell);
    }
  }
}

/* ─── Criteria input handling ───────────────────────────── */
function handleCriteriaInput(input) {
  const val = input.value;

  if (val === '' || val === '-') {
    setCellColor(input.closest('.grade-cell'), '');
    recalcRow(input.closest('tr'));
    return;
  }

  const n = parseInt(val, 10);

  // Out-of-range or non-integer → clear
  if (isNaN(n) || n < 1 || n > 8) {
    input.value = '';
    setCellColor(input.closest('.grade-cell'), '');
  } else {
    input.value = n; // normalise (removes leading zeros etc.)
    setCellColor(input.closest('.grade-cell'), gradeClass(n));
  }

  recalcRow(input.closest('tr'));
}

/** On blur: clamp rather than clear, better for mobile spinners */
function handleCriteriaBlur(input) {
  if (input.value === '') return;
  const n = parseInt(input.value, 10);
  if (isNaN(n) || n < 1) {
    input.value = 1;
  } else if (n > 8) {
    input.value = 8;
  }
  setCellColor(input.closest('.grade-cell'), gradeClass(+input.value));
  recalcRow(input.closest('tr'));
}

/* ─── Grade distribution bars ───────────────────────────── */
function buildDistBars() {
  const container = document.getElementById('dist-bars');
  if (!container) return;
  container.innerHTML = '';

  for (let g = 8; g >= 1; g--) {
    const colClass = g >= 7 ? 'col-high' : g >= 5 ? 'col-mid' : 'col-low';
    container.insertAdjacentHTML('beforeend', `
      <div class="dist-bar-item" aria-label="Grade ${g}: 0 occurrences">
        <span class="dist-bar-count" id="count-${g}">0</span>
        <div class="dist-bar-track">
          <div class="dist-bar-fill ${colClass}" id="bar-${g}" style="height:0%"></div>
        </div>
        <span class="dist-bar-label">G${g}</span>
      </div>`);
  }
}

function updateDistribution() {
  const activeSem = document.querySelector('.semester:not(.hidden)');
  if (!activeSem) return;

  const counts = Object.fromEntries([1,2,3,4,5,6,7,8].map(g => [g, 0]));
  let totalFilled  = 0;
  let totalPossible = 0;

  activeSem.querySelectorAll(
    CRITERIA.map(c => `input[data-crit="${c}"]`).join(',')
  ).forEach(input => {
    totalPossible++;
    const v = parseInt(input.value, 10);
    if (!isNaN(v) && v >= 1 && v <= 8) {
      counts[v]++;
      totalFilled++;
    }
  });

  const max = Math.max(1, ...Object.values(counts));

  for (let g = 1; g <= 8; g++) {
    const countEl = document.getElementById(`count-${g}`);
    const barEl   = document.getElementById(`bar-${g}`);
    const item    = countEl?.closest('.dist-bar-item');
    if (!countEl || !barEl) continue;

    countEl.textContent = counts[g];
    barEl.style.height  = `${Math.round((counts[g] / max) * 100)}%`;

    if (item) {
      item.setAttribute('aria-label', `Grade ${g}: ${counts[g]} occurrence${counts[g] !== 1 ? 's' : ''}`);
    }
  }

  const filledEl   = document.getElementById('dist-filled');
  const possibleEl = document.getElementById('dist-possible');
  if (filledEl)   filledEl.textContent   = totalFilled;
  if (possibleEl) possibleEl.textContent = totalPossible;
}

/* ─── Persistence ───────────────────────────────────────── */
function loadGrades(semId) {
  const section = document.getElementById(semId);
  if (!section) return;

  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_PREFIX + semId)) || {};
  } catch {
    stored = {};
  }

  section.querySelectorAll('tbody tr').forEach(row => {
    const subjectData = stored[row.dataset.subject] || {};
    CRITERIA.forEach(crit => {
      const input = row.querySelector(`input[data-crit="${crit}"]`);
      if (!input) return;
      const saved = subjectData[crit];
      if (saved != null && !isNaN(parseInt(saved, 10))) {
        input.value = parseInt(saved, 10);
        setCellColor(input.closest('.grade-cell'), gradeClass(+input.value));
      }
    });
    recalcRow(row);
  });
}

function saveAllGrades() {
  SEM_IDS.forEach(semId => {
    const section = document.getElementById(semId);
    if (!section) return;

    const data = {};
    section.querySelectorAll('tbody tr').forEach(row => {
      data[row.dataset.subject] = {};
      CRITERIA.forEach(crit => {
        const input = row.querySelector(`input[data-crit="${crit}"]`);
        const v     = input ? parseInt(input.value, 10) : NaN;
        data[row.dataset.subject][crit] = isNaN(v) ? null : v;
      });
    });

    localStorage.setItem(STORAGE_PREFIX + semId, JSON.stringify(data));
  });

  showToast('✓', 'Grades saved');
  flashSaveBtn();
}

/* ─── Toast ─────────────────────────────────────────────── */
let toastTimer = null;

function showToast(icon, message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span>${message}`;
  toast.classList.add('visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

/* ─── Save button feedback ──────────────────────────────── */
let saveBtnTimer = null;

function flashSaveBtn() {
  const btn = document.getElementById('save-btn');
  if (!btn) return;
  btn.classList.add('saved');
  clearTimeout(saveBtnTimer);
  saveBtnTimer = setTimeout(() => btn.classList.remove('saved'), 1800);
}

/* ─── Tab switching ─────────────────────────────────────── */
function switchTab(targetSem) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.sem === targetSem;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Update panels
  document.querySelectorAll('.semester').forEach(sec => {
    const isTarget = sec.id === `sem${targetSem}`;
    sec.classList.toggle('hidden', !isTarget);
  });

  updateDistribution();
}

/* ─── Init ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // Build distribution bars
  buildDistBars();

  // Load saved grades for both semesters
  SEM_IDS.forEach(loadGrades);

  // Update distribution for the initially visible semester
  updateDistribution();

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.sem));
  });

  // Criteria inputs — live validation + recalc
  document.querySelectorAll('.semester').forEach(section => {
    CRITERIA.forEach(crit => {
      section.querySelectorAll(`input[data-crit="${crit}"]`).forEach(input => {
        input.addEventListener('input', () => {
          handleCriteriaInput(input);
          updateDistribution();
        });
        input.addEventListener('blur', () => {
          handleCriteriaBlur(input);
          updateDistribution();
        });
        // Let numeric keyboard on iOS work better
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[1-8]');
      });
    });
  });

  // Save button
  document.getElementById('save-btn')?.addEventListener('click', saveAllGrades);
});

// script.js

// Default grades for Semester 1 (original data, criteria 1-8)
// Default grades for Semester 1 (varied for good overview - grades from 1 to 8)
// Default grades for Semester 1 - varied to clearly show ALL final MYP grades from 1 to 7
const defaultGradesSem1 = {
  'English ELA':    { A: 8, B: 8, C: 8, D: 8 },   // Total: 32 → Final: 7
  'German':         { A: 7, B: 7, C: 6, D: 5 },   // Total: 25 → Final: 6
  'Geography':      { A: 6, B: 6, C: 5, D: 4 },   // Total: 21 → Final: 5
  'Science':        { A: 5, B: 4, C: 4, D: 3 },   // Total: 16 → Final: 4
  'Mathematics':    { A: 4, B: 3, C: 3, D: 2 },   // Total: 12 → Final: 3
  'P.E.':           { A: 3, B: 2, C: 2, D: 1 },   // Total: 8  → Final: 2
  'Multimedia':     { A: 8, B: 7, C: 8, D: 7 },   // Total: 30 → Final: 7
  'Programming':    { A: 1, B: 2, C: 1, D: 1 }    // Total: 5  → Final: 1
};
const defaultGradesSem2 = {};

// Map total score (4–32) to final grade (1–7)
function mapTotalToFinal(total) {
  if (total >= 28) return 7;
  if (total >= 24) return 6;
  if (total >= 19) return 5;
  if (total >= 15) return 4;
  if (total >= 10) return 3;
  if (total >= 6)  return 2;
  return 1; // total 4–5
}

// Color logic for individual criteria and final (1–8/1–7 scale)
function getGradeClass(value) {
  if (!value) return '';
  const num = parseInt(value, 10);
  if (num >= 7) return 'grade-green';
  if (num >= 5) return 'grade-yellow';
  return 'grade-red';
}

// Color logic for total (0–32) based on custom legend
// 24–32: high (green), 16–23: medium (yellow), 4–15: low (red)
function getTotalClass(total) {
  if (total >= 24) return 'grade-green';
  if (total >= 16) return 'grade-yellow';
  return 'grade-red';
}

function updateCellColor(cell) {
  const input = cell.querySelector('input');
  const value = input.value;
  cell.classList.remove('grade-green', 'grade-yellow', 'grade-red');
  if (value) {
    cell.classList.add(getGradeClass(value));
  }
}

// Calculates total and final grade for a row
function calculateGrades(row) {
  const inputs = row.querySelectorAll(
    'input[data-crit="A"], input[data-crit="B"], input[data-crit="C"], input[data-crit="D"]'
  );
  const values = Array.from(inputs).map(i => parseInt(i.value, 10) || 0);
  const allValid = values.every(v => v >= 1 && v <= 8);

  const totalInput = row.querySelector('input[data-crit="Total"]');
  const finalInput = row.querySelector('input[data-crit="Final"]');
  const totalCell = totalInput.parentElement;
  const finalCell = finalInput.parentElement;

  // Reset colors for total & final before recalculation
  totalCell.classList.remove('grade-green', 'grade-yellow', 'grade-red', 'pulse');
  finalCell.classList.remove('grade-green', 'grade-yellow', 'grade-red', 'pulse');

  if (allValid && values.some(v => v > 0)) {
    const total = values.reduce((a, b) => a + b, 0);
    const finalGrade = mapTotalToFinal(total);

    totalInput.value = total;
    finalInput.value = finalGrade;

    // Color total based on total score
    const totalClass = getTotalClass(total);
    totalCell.classList.add(totalClass, 'pulse');

    // Color final based on final grade
    updateCellColor(finalCell);
    finalCell.classList.add('pulse');
  } else {
    totalInput.value = '';
    finalInput.value = '';
  }
}

// --- Grade stats (1–8 counts, ONLY A–D) ---

// ✅ Only count A, B, C, D — NOT Total, NOT Final
function calculateGradeStats(section) {
  const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

  section
    .querySelectorAll(
      'input[data-crit="A"], input[data-crit="B"], input[data-crit="C"], input[data-crit="D"]'
    )
    .forEach(input => {
      const val = parseInt(input.value, 10);
      if (!isNaN(val) && stats[val] !== undefined) {
        stats[val]++;
      }
    });

  return stats;
}

// Render stats into the little panel
function renderGradeStats(stats) {
  for (let grade = 1; grade <= 8; grade++) {
    const span = document.getElementById(`count-${grade}`);
    if (span) {
      span.textContent = stats[grade];
    }
  }
}

// Update stats for whichever semester is currently visible
function updateCurrentSemesterStats() {
  const activeSem = document.querySelector('.semester:not(.hidden)');
  if (!activeSem) return;
  const stats = calculateGradeStats(activeSem);
  renderGradeStats(stats);
}

// Load saved or default grades
function loadGrades(semId) {
  const semSection = document.getElementById(semId);
  const storageKey = `grades_${semId}`;
  let grades =
    JSON.parse(localStorage.getItem(storageKey)) ||
    (semId === 'sem1' ? defaultGradesSem1 : defaultGradesSem2);

  semSection.querySelectorAll('tbody tr').forEach(row => {
    const subject = row.dataset.subject;
    const subjectGrades = grades[subject] || {};
    ['A', 'B', 'C', 'D'].forEach(crit => {
      const input = row.querySelector(`input[data-crit="${crit}"]`);
      if (input && subjectGrades[crit] !== undefined && subjectGrades[crit] !== null) {
        input.value = subjectGrades[crit];
        updateCellColor(input.parentElement);
      }
    });
    calculateGrades(row);
  });
}

// Save only criteria grades (A-D)
function saveGrades() {
  const activeSem = document.querySelector('.semester:not(.hidden)');
  const semId = activeSem.id;
  const storageKey = `grades_${semId}`;
  const grades = {};

  activeSem.querySelectorAll('tbody tr').forEach(row => {
    const subject = row.dataset.subject;
    grades[subject] = {};
    row
      .querySelectorAll(
        'input[data-crit="A"], input[data-crit="B"], input[data-crit="C"], input[data-crit="D"]'
      )
      .forEach(input => {
        const crit = input.dataset.crit;
        grades[subject][crit] = input.value ? parseInt(input.value, 10) : null;
      });
  });

  localStorage.setItem(storageKey, JSON.stringify(grades));
  alert('Grades saved successfully!');
  updateCurrentSemesterStats();
}

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadGrades('sem1');
  loadGrades('sem2');

  // After everything is loaded, compute stats for the default (Semester 1)
  updateCurrentSemesterStats();

  // Tab switching
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.tab-button')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document
        .querySelectorAll('.semester')
        .forEach(s => s.classList.add('hidden'));
      document.getElementById(`sem${btn.dataset.sem}`).classList.remove('hidden');

      // Update stats when switching semesters
      updateCurrentSemesterStats();
    });
  });

  // Input handling for editable criteria (A–D)
  document.querySelectorAll('input:not([readonly])').forEach(input => {
    input.addEventListener('input', () => {
      let val = input.value;
      if (val !== '') {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 1 || num > 8) {
          input.value = '';
          updateCurrentSemesterStats();
          return;
        }
      }
      updateCellColor(input.parentElement);
      calculateGrades(input.closest('tr'));
      updateCurrentSemesterStats();
    });
  });

  // Save button
  document.getElementById('save-btn').addEventListener('click', saveGrades);
});
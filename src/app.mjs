import {
  SEMESTERS,
  calculateOverallAverage,
  calculateSemesterAverages,
  calculateSubjectGroupAverages,
  calculateTotalCredits,
  calculateRequiredRemainingAverage,
  describeGoalDifficulty,
} from './grade-calculator.mjs';

const STORAGE_KEY = 'naesin-simulator:v1';
const defaultState = () => ({
  actual: [],
  simulation: [],
  targetAverage: '',
  weighted: true,
  activeSemester: SEMESTERS[0].id,
  recordType: 'actual',
});

let state = loadState();
const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number.isFinite(value) ? value.toFixed(2) : '-';
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.actual) || !Array.isArray(saved.simulation)) return defaultState();
    return { ...defaultState(), ...saved };
  } catch {
    return defaultState();
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function records(type = state.recordType) { return state[type] ?? []; }
function semesterLabel(id) { return SEMESTERS.find((item) => item.id === id)?.label ?? id; }
function showToast(message, tone = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function renderSemesterTabs() {
  $('#semester-tabs').innerHTML = SEMESTERS.map((semester) => `<button class="tab-button ${state.activeSemester === semester.id ? 'active' : ''}" data-semester="${semester.id}">${semester.label}</button>`).join('');
}
function renderTypeTabs() {
  document.querySelectorAll('[data-record-type]').forEach((button) => button.classList.toggle('active', button.dataset.recordType === state.recordType));
  $('#record-type-label').textContent = state.recordType === 'actual' ? '실제 성적 입력' : '예상 성적 시뮬레이션';
}
function renderGradeList() {
  const list = records().filter((record) => record.semesterId === state.activeSemester);
  $('#active-semester-title').textContent = semesterLabel(state.activeSemester);
  $('#entry-count').textContent = `${list.length}개 과목`;
  const container = $('#grade-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state">${semesterLabel(state.activeSemester)}에 등록된 성적이 없습니다. 과목을 추가해 보세요.</div>`;
    return;
  }
  container.innerHTML = list.map((record) => `
    <div class="grade-row" data-id="${record.id}">
      <label><span>과목명</span><input class="subject-input" data-field="subjectName" value="${escapeHtml(record.subjectName)}" placeholder="예: 문학"></label>
      <label><span>교과군</span><select data-field="subjectGroup">${['국어','수학','영어','사회','과학','기타'].map((group) => `<option ${record.subjectGroup === group ? 'selected' : ''}>${group}</option>`).join('')}</select></label>
      <label><span>학점</span><input data-field="credit" type="number" min="0.5" step="0.5" value="${record.credit ?? ''}" placeholder="4"></label>
      <label><span>등급</span><input data-field="gradeValue" type="number" min="1" max="9" step="1" value="${record.gradeValue ?? ''}" placeholder="1~9"></label>
      <label><span>성취도</span><select data-field="achievement"><option value="">-</option>${['A','B','C'].map((value) => `<option ${record.achievement === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <button class="icon-button danger" data-action="delete" aria-label="${escapeHtml(record.subjectName || '과목')} 삭제">삭제</button>
    </div>`).join('');
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
function validRows(type) { return records(type).filter((record) => record.subjectName?.trim() && Number(record.credit) > 0 && Number(record.gradeValue) >= 1 && Number(record.gradeValue) <= 9); }

function renderSummary() {
  const actual = validRows('actual');
  const simulation = validRows('simulation');
  const combined = [...actual, ...simulation];
  const current = calculateOverallAverage(actual, state.weighted);
  const expected = combined.length ? calculateOverallAverage(combined, state.weighted) : null;
  const cards = [
    ['현재 실제 내신', fmt(current), '실제 성적 기준'],
    ['예상 내신', fmt(expected), simulation.length ? '예상 성적 포함' : '예상 성적을 입력해 보세요'],
    ['반영 학점', `${calculateTotalCredits(actual).toFixed(1)}학점`, '실제 성적 기준'],
    ['목표 내신', state.targetAverage ? Number(state.targetAverage).toFixed(2) : '-', '목표를 입력해 보세요'],
  ];
  $('#summary-cards').innerHTML = cards.map(([title, value, note]) => `<article class="summary-card"><span>${title}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
}
function renderSemesterSummary() {
  const averages = calculateSemesterAverages(validRows('actual'), state.weighted);
  $('#semester-summary').innerHTML = averages.map((semester) => {
    const average = semester.average;
    const width = average == null ? 0 : Math.max(0, Math.min(100, (10 - average) * 12.5));
    return `<div class="bar-item"><div><span>${semester.label}</span><strong>${fmt(average)}</strong></div><div class="bar-track"><i style="width:${width}%"></i></div></div>`;
  }).join('');
}
function renderSubjectSummary() {
  const summary = calculateSubjectGroupAverages(validRows('actual'), state.weighted);
  $('#subject-summary').innerHTML = summary.length ? summary.map(({ subjectGroup, average }) => `<div class="subject-summary-item"><span>${subjectGroup}</span><strong>${fmt(average)}</strong></div>`).join('') : '<div class="empty-state">실제 성적을 입력하면 교과별 내신이 표시됩니다.</div>';
}
function renderGoal() {
  const target = Number(state.targetAverage);
  const actual = validRows('actual');
  const expected = validRows('simulation');
  const result = $('#goal-result');
  if (!Number.isFinite(target) || target <= 0 || !actual.length) {
    result.innerHTML = '<p class="muted">현재 내신과 목표 내신을 입력하면 남은 성적에 필요한 평균을 계산합니다.</p>';
    return;
  }
  const required = calculateRequiredRemainingAverage(actual, expected, target, state.weighted);
  if (required == null) {
    result.innerHTML = '<p class="muted">시뮬레이션 성적과 목표 값을 확인해 주세요.</p>';
    return;
  }
  const difficulty = describeGoalDifficulty(required);
  result.innerHTML = `<div class="goal-number">${fmt(required)}</div><div><strong>남은 성적에 필요한 평균 등급</strong><p>${difficulty}</p></div><small>성적 계산을 위한 시뮬레이션이며 대학 합격 가능성을 의미하지 않습니다.</small>`;
}
function render() {
  renderTypeTabs(); renderSemesterTabs(); renderGradeList(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal();
  $('#target-average').value = state.targetAverage;
  $('#weighted-average').checked = Boolean(state.weighted);
}

$('#semester-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-semester]');
  if (!button) return;
  state.activeSemester = button.dataset.semester; saveState(); render();
});
$('#record-type-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-record-type]');
  if (!button) return;
  state.recordType = button.dataset.recordType; saveState(); render();
});
$('#add-grade').addEventListener('click', () => {
  records().push({ id: makeId(), semesterId: state.activeSemester, subjectName: '', subjectGroup: '기타', credit: 4, gradeValue: '', achievement: '' });
  saveState(); render();
  document.querySelector('#grade-list .subject-input')?.focus();
});
$('#grade-list').addEventListener('input', (event) => {
  const row = event.target.closest('[data-id]');
  const field = event.target.dataset.field;
  if (!row || !field) return;
  const record = records().find((item) => item.id === row.dataset.id);
  if (!record) return;
  record[field] = ['credit', 'gradeValue'].includes(field) ? event.target.value : event.target.value;
  saveState(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal();
});
$('#grade-list').addEventListener('change', (event) => event.target.dispatchEvent(new Event('input', { bubbles: true })));
$('#grade-list').addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'delete') return;
  const row = event.target.closest('[data-id]');
  state[state.recordType] = records().filter((item) => item.id !== row.dataset.id);
  saveState(); render();
});
$('#target-average').addEventListener('input', (event) => { state.targetAverage = event.target.value; saveState(); renderSummary(); renderGoal(); });
$('#weighted-toggle').addEventListener('change', (event) => { state.weighted = event.target.checked; saveState(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); });
$('#export-button').addEventListener('click', () => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `naesin-simulator-backup-${stamp}.json`; link.click(); URL.revokeObjectURL(link.href);
  showToast('백업 파일을 내려받았습니다.');
});
$('#import-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.actual) || !Array.isArray(imported.simulation)) throw new Error('형식 오류');
    state = { ...defaultState(), ...imported }; saveState(); render(); showToast('데이터를 불러왔습니다.');
  } catch (error) { console.error(error); showToast('백업 파일 형식을 확인해 주세요.', 'error'); }
  event.target.value = '';
});
$('#reset-button').addEventListener('click', () => {
  if (!confirm('이 브라우저에 저장된 성적 데이터를 모두 삭제할까요?')) return;
  state = defaultState(); saveState(); render(); showToast('저장된 데이터를 초기화했습니다.');
});

render();

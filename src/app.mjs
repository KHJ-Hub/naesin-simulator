import {
  SEMESTERS,
  calculateOverallAverage,
  calculateSemesterAverages,
  calculateSubjectGroupAverages,
  calculateTotalCredits,
  calculateRequiredRemainingAverage,
  describeGoalDifficulty,
} from './grade-calculator.mjs?v=20260914-5level';
import { commonCourses, courseById, coursesForSemester, recordFromCourse } from './course-catalog.mjs?v=20260914-5level';

const STORAGE_KEY = 'naesin-simulator:v1';
const defaultState = () => ({
  actual: commonCourses().map((course) => recordFromCourse(course, makeId())),
  simulation: [],
  student: { name: '', className: '', number: '' },
  targetAverage: '',
  weighted: true,
  activeSemester: SEMESTERS[0].id,
  recordType: 'actual',
  calculated: false,
  simulationCalculated: false,
  goalCalculated: false,
});

function makeId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
let state = loadState();
const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number.isFinite(value) ? value.toFixed(2) : '-';

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.actual) || !Array.isArray(saved.simulation)) return defaultState();
    return normalizeState(saved);
  } catch {
    return defaultState();
  }
}
function normalizeRecord(record = {}) {
  const configured = courseById(record.courseId);
  if (configured) return { ...recordFromCourse(configured, typeof record.id === 'string' && record.id ? record.id : makeId()), gradeValue: record.gradeValue ?? '', achievement: ['A', 'B', 'C'].includes(record.achievement) ? record.achievement : '' };
  return {
    id: typeof record.id === 'string' && record.id ? record.id : makeId(),
    semesterId: SEMESTERS.some((semester) => semester.id === record.semesterId) ? record.semesterId : SEMESTERS[0].id,
    subjectName: String(record.subjectName ?? '').slice(0, 80),
    subjectGroup: ['국어', '수학', '영어', '사회', '과학', '기타'].includes(record.subjectGroup) ? record.subjectGroup : '기타',
    credit: record.credit ?? '', gradeValue: record.gradeValue ?? '',
    achievement: ['A', 'B', 'C'].includes(record.achievement) ? record.achievement : '', requirement: 'legacy', gradingType: 'five-level',
  };
}
function normalizeState(saved = {}) {
  const base = defaultState();
  const savedActual = Array.isArray(saved.actual) ? saved.actual.map(normalizeRecord) : [];
  const commonActual = commonCourses().filter((course) => !savedActual.some((record) => record.courseId === course.id)).map((course) => recordFromCourse(course, makeId()));
  return {
    ...base,
    actual: [...savedActual, ...commonActual],
    simulation: Array.isArray(saved.simulation) ? saved.simulation.map(normalizeRecord) : [],
    student: { name: String(saved.student?.name ?? '').slice(0, 30), className: String(saved.student?.className ?? '').slice(0, 30), number: String(saved.student?.number ?? '').slice(0, 20) },
    targetAverage: String(saved.targetAverage ?? ''), weighted: saved.weighted !== false,
    activeSemester: SEMESTERS.some((semester) => semester.id === saved.activeSemester) ? saved.activeSemester : base.activeSemester,
    recordType: ['actual', 'simulation'].includes(saved.recordType) ? saved.recordType : base.recordType,
    calculated: Boolean(saved.calculated), simulationCalculated: Boolean(saved.simulationCalculated), goalCalculated: Boolean(saved.goalCalculated),
  };
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
      <div class="course-name"><span>과목명</span><strong>${escapeHtml(record.subjectName)}</strong></div>
      <div class="course-meta"><span>${escapeHtml(record.subjectGroup)}</span><small>${escapeHtml(record.credit)}학점</small></div>
      <label><span>등급</span><select data-field="gradeValue" aria-label="${escapeHtml(record.subjectName)} 등급"><option value="">선택</option>${[1,2,3,4,5].map((value) => `<option value="${value}" ${Number(record.gradeValue) === value ? 'selected' : ''}>${value}등급</option>`).join('')}</select></label>
      <label><span>성취도</span><select data-field="achievement"><option value="">-</option>${['A','B','C'].map((value) => `<option ${record.achievement === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      ${record.requirement === 'common' ? '<span class="locked-course">공통</span>' : `<button class="icon-button danger" data-action="delete" aria-label="${escapeHtml(record.subjectName || '과목')} 삭제">삭제</button>`}
    </div>`).join('');
}
function renderCourseSelection() {
  const container = $('#course-selection');
  if (state.recordType === 'actual' && state.activeSemester.startsWith('1-')) { container.innerHTML = '<p class="muted">1학년 공통 과목은 자동으로 생성됩니다.</p>'; return; }
  const used = new Set(records().filter((record) => record.semesterId === state.activeSemester).map((record) => record.courseId));
  const available = coursesForSemester(state.activeSemester).filter((course) => !used.has(course.id));
  container.innerHTML = available.length ? `<label>학교 개설 과목 <select id="course-picker" class="input"><option value="">과목 선택</option>${available.map((course) => `<option value="${course.id}">${escapeHtml(course.subjectName)} · ${course.credit}학점</option>`).join('')}</select></label><button id="add-grade" class="add-button">선택 과목 추가</button>` : '<p class="muted">이 학기에 추가할 학교 개설 과목이 없습니다.</p>';
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
function validRows(type) { return records(type).filter((record) => record.subjectName?.trim() && Number(record.credit) > 0 && Number(record.gradeValue) >= 1 && Number(record.gradeValue) <= 5); }

function renderSummary() {
  const actual = state.calculated ? validRows('actual') : [];
  const simulation = state.calculated && state.simulationCalculated ? validRows('simulation') : [];
  const combined = [...actual, ...simulation];
  const current = calculateOverallAverage(actual, state.weighted);
  const expected = combined.length ? calculateOverallAverage(combined, state.weighted) : null;
  const cards = [
    ['현재 실제 내신', fmt(current), '실제 성적 기준'],
    ['예상 내신', fmt(expected), simulation.length ? '예상 성적 포함' : '예상 성적을 입력해 보세요'],
    ['반영 학점', `${calculateTotalCredits(actual).toFixed(1)}학점`, state.calculated ? `입력 완료 ${actual.length}과목` : '내신 계산 후 표시'],
    ['목표 내신', state.targetAverage ? Number(state.targetAverage).toFixed(2) : '-', '목표를 입력해 보세요'],
  ];
  $('#summary-cards').innerHTML = cards.map(([title, value, note]) => `<article class="summary-card"><span>${title}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
}
function renderSemesterSummary() {
  const averages = calculateSemesterAverages(state.calculated ? validRows('actual') : [], state.weighted);
  $('#semester-summary').innerHTML = averages.map((semester) => {
    const average = semester.average;
    const width = average == null ? 0 : Math.max(0, Math.min(100, (10 - average) * 12.5));
    return `<div class="bar-item"><div><span>${semester.label}</span></div><div class="bar-track"><i class="bar-fill" style="width:${width}%"></i></div><strong>${fmt(average)}</strong></div>`;
  }).join('');
}
function renderSubjectSummary() {
  const summary = calculateSubjectGroupAverages(state.calculated ? validRows('actual') : [], state.weighted);
  const overall = calculateOverallAverage(state.calculated ? validRows('actual') : [], state.weighted);
  const advice = (average) => {
    if (!Number.isFinite(overall)) return '';
    const gap = average - overall;
    if (gap <= -0.45) return '강점'; if (gap <= 0.2) return '유지 권장'; if (gap <= 0.6) return '조금 더 올리면 좋아요'; if (gap <= 1) return '향상 필요'; return '우선 관리 권장';
  };
  $('#subject-summary').innerHTML = summary.length ? summary.map(({ subjectGroup, average }) => `<div class="subject-card"><span>${escapeHtml(subjectGroup)}</span><strong>${fmt(average)}</strong><small>${advice(average)}</small></div>`).join('') : '<div class="empty-state">내신 계산 후 교과별 분석이 표시됩니다.</div>';
}
function goalDetails() {
  const target = Number(state.targetAverage); const actual = validRows('actual'); const expected = records('simulation');
  if (!state.calculated || !state.goalCalculated || !Number.isFinite(target) || target < 1 || target > 5 || !actual.length) return null;
  const required = calculateRequiredRemainingAverage(actual, expected, target, state.weighted);
  return required == null ? null : { required };
}
function renderGoal() {
  const result = $('#goal-result');
  const details = goalDetails();
  if (!details) {
    result.innerHTML = '<p class="muted">내신 계산 후 목표(1.00~5.00)와 남은 과목을 입력하고 목표 시뮬레이션을 눌러 주세요.</p>';
    return;
  }
  const difficulty = describeGoalDifficulty(details.required);
  const actual = validRows('actual'); const remaining = records('simulation');
  const actualCredits = calculateTotalCredits(actual); const remainingCredits = calculateTotalCredits(remaining, false);
  const highest = (actual.reduce((sum, item) => sum + Number(item.gradeValue) * (state.weighted ? Number(item.credit) : 1), 0) + (state.weighted ? remainingCredits : remaining.length)) / (state.weighted ? actualCredits + remainingCredits : actual.length + remaining.length);
  const scenarios = details.required >= 1 && details.required <= 5 ? ['균형형', '초반 집중형', '후반 상승형'].map((name) => `<li><strong>${name}</strong> · 남은 학기 평균 ${fmt(details.required)}등급 기준 · 예상 최종 ${fmt(Number(state.targetAverage))}</li>`).join('') : '';
  result.innerHTML = `<div class="goal-number">${details.required >= 1 && details.required <= 5 ? fmt(details.required) : '-'}</div><div><strong>남은 전체 학기에 필요한 평균 등급</strong><p>${difficulty}</p>${details.required < 1 || details.required > 5 ? `<p>남은 모든 과목을 1등급으로 가정한 최고 가능 최종 내신: <strong>${fmt(highest)}</strong></p>` : `<ul class="scenario-list">${scenarios}</ul>`}</div><small>성적 수치 시뮬레이션이며 대학 합격 가능성을 의미하지 않습니다.</small>`;
}
function reportRows(rows) { return rows.length ? rows.map((record) => `<tr><td>${escapeHtml(semesterLabel(record.semesterId))}</td><td>${escapeHtml(record.subjectName)}</td><td>${escapeHtml(record.subjectGroup)}</td><td>${escapeHtml(record.credit)}</td><td>${escapeHtml(record.gradeValue)}</td><td>${escapeHtml(record.achievement || '-')}</td></tr>`).join('') : '<tr><td colspan="6">입력된 성적이 없습니다.</td></tr>'; }
function renderPrintReport() {
  const actual = validRows('actual'); const simulation = validRows('simulation'); const subjects = calculateSubjectGroupAverages(actual, state.weighted); const semesters = calculateSemesterAverages(actual, state.weighted).filter((item) => item.average != null); const goal = goalDetails();
  $('#print-report').innerHTML = `<div class="print-page"><h1>학생 내신 · 학업 설계 결과표</h1><p class="print-note">성적 계산을 위한 참고 자료이며 대학 합격 가능성을 의미하지 않습니다.</p><dl class="print-student"><div><dt>이름</dt><dd>${escapeHtml(state.student.name || '-')}</dd></div><div><dt>학년·반</dt><dd>${escapeHtml(state.student.className || '-')}</dd></div><div><dt>번호</dt><dd>${escapeHtml(state.student.number || '-')}</dd></div><div><dt>작성일</dt><dd>${new Date().toLocaleDateString('ko-KR')}</dd></div></dl><section><h2>성적 요약</h2><div class="print-summary"><div><span>전체 평균</span><strong>${fmt(calculateOverallAverage(actual, state.weighted))}</strong></div><div><span>반영 학점</span><strong>${calculateTotalCredits(actual).toFixed(1)}학점</strong></div><div><span>목표 내신</span><strong>${state.targetAverage ? fmt(Number(state.targetAverage)) : '-'}</strong></div><div><span>남은 학기 필요 평균</span><strong>${goal ? fmt(goal.required) : '-'}</strong></div></div></section><section><h2>학기별 성적</h2><table><thead><tr><th>학기</th><th>평균 등급</th></tr></thead><tbody>${semesters.length ? semesters.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${fmt(item.average)}</td></tr>`).join('') : '<tr><td colspan="2">입력된 실제 성적이 없습니다.</td></tr>'}</tbody></table></section><section><h2>교과별 평균</h2><table><thead><tr><th>교과군</th><th>평균 등급</th></tr></thead><tbody>${subjects.length ? subjects.map((item) => `<tr><td>${escapeHtml(item.subjectGroup)}</td><td>${fmt(item.average)}</td></tr>`).join('') : '<tr><td colspan="2">입력된 실제 성적이 없습니다.</td></tr>'}</tbody></table></section><section><h2>실제 성적</h2><table><thead><tr><th>학기</th><th>과목</th><th>교과군</th><th>학점</th><th>등급</th><th>성취도</th></tr></thead><tbody>${reportRows(actual)}</tbody></table></section><section><h2>예상 성적 시뮬레이션</h2><p>예상 성적 포함 평균: <strong>${fmt(simulation.length ? calculateOverallAverage([...actual, ...simulation], state.weighted) : null)}</strong></p><table><thead><tr><th>학기</th><th>과목</th><th>교과군</th><th>학점</th><th>등급</th><th>성취도</th></tr></thead><tbody>${reportRows(simulation)}</tbody></table></section></div>`;
}
function render() {
  renderTypeTabs(); renderSemesterTabs(); renderGradeList(); renderCourseSelection(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport();
  $('#target-average').value = state.targetAverage;
  $('#weighted-toggle').checked = Boolean(state.weighted);
  $('#student-name').value = state.student.name; $('#student-class').value = state.student.className; $('#student-number').value = state.student.number;
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
$('#course-selection').addEventListener('click', (event) => {
  if (event.target.id !== 'add-grade') return;
  const course = courseById($('#course-picker')?.value);
  if (!course) { showToast('학교 개설 과목에서 선택해 주세요.', 'error'); return; }
  records().push(recordFromCourse(course, makeId())); state.calculated = false; state.simulationCalculated = false; state.goalCalculated = false; saveState(); render();
});
$('#grade-list').addEventListener('input', (event) => {
  const row = event.target.closest('[data-id]');
  const field = event.target.dataset.field;
  if (!row || !field) return;
  const record = records().find((item) => item.id === row.dataset.id);
  if (!record) return;
  record[field] = ['credit', 'gradeValue'].includes(field) ? event.target.value : event.target.value;
  if (field === 'gradeValue' && event.target.value && (Number(event.target.value) < 1 || Number(event.target.value) > 5)) { record[field] = ''; showToast('등급은 1~5등급만 입력할 수 있어요.', 'error'); }
  state.calculated = false; state.simulationCalculated = false; state.goalCalculated = false; saveState(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport();
});
$('#grade-list').addEventListener('change', (event) => event.target.dispatchEvent(new Event('input', { bubbles: true })));
$('#grade-list').addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'delete') return;
  const row = event.target.closest('[data-id]');
  state[state.recordType] = records().filter((item) => item.id !== row.dataset.id); state.calculated = false; state.simulationCalculated = false; state.goalCalculated = false;
  saveState(); render();
});
$('#calculate-button').addEventListener('click', () => { state.calculated = true; state.goalCalculated = false; saveState(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport(); showToast(`내신 계산을 완료했어요. 아직 등급을 입력하지 않은 과목은 ${records('actual').length - validRows('actual').length}개입니다.`); });
$('#goal-calculate-button').addEventListener('click', () => { state.goalCalculated = true; saveState(); renderGoal(); renderPrintReport(); });
$('#target-average').addEventListener('input', (event) => { state.targetAverage = event.target.value; state.goalCalculated = false; saveState(); renderSummary(); renderGoal(); renderPrintReport(); });
$('#weighted-toggle').addEventListener('change', (event) => { state.weighted = event.target.checked; state.calculated = false; state.goalCalculated = false; saveState(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport(); });
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
    state = normalizeState(imported); saveState(); render(); showToast('데이터를 불러왔습니다.');
  } catch (error) { console.error(error); showToast('백업 파일 형식을 확인해 주세요.', 'error'); }
  event.target.value = '';
});
$('#reset-button').addEventListener('click', () => {
  if (!confirm('이 브라우저에 저장된 성적 데이터를 모두 삭제할까요?')) return;
  state = defaultState(); saveState(); render(); showToast('저장된 데이터를 초기화했습니다.');
});
$('#print-button').addEventListener('click', () => { renderPrintReport(); window.print(); });
document.querySelector('.student-form').addEventListener('input', (event) => { const fields = { 'student-name': 'name', 'student-class': 'className', 'student-number': 'number' }; const field = fields[event.target.id]; if (!field) return; state.student[field] = event.target.value; saveState(); renderPrintReport(); });

render();

import {
  SEMESTERS,
  calculateOverallAverage,
  calculateSemesterAverages,
  calculateSubjectGroupAverages,
  calculateTotalCredits,
  calculateRequiredRemainingAverage,
  describeGoalDifficulty,
  validAverageInput,
} from './grade-calculator.mjs?v=20260914-quickinput3';
import { commonCourses, catalogCourseById as courseById, coursesForSemester } from './course-catalog-store.mjs?v=20260914-teacher-store2';
import { gradingInputs, recordFromCourse } from './course-catalog.mjs?v=20260914-grading-types3';
import { ADMISSION_REFERENCE_DATA, ADMISSION_REFERENCE_SETTINGS, ADMISSION_CONVERSION_NOTICE, admissionComparisonCut, admissionDifference, classifyAdmissionReference, describeAdmissionDifference, filterAdmissionReferences } from './admission-reference.mjs?v=20260915-admission-reference3';
import { admissionInterestKey, normalizeAdmissionInterests, toggleAdmissionInterest } from './admission-reference-store.mjs?v=20260915-admission-interests1';

const STORAGE_KEY = 'naesin-simulator:v1';
const defaultState = () => ({
  actual: commonCourses().map((course) => recordFromCourse(course, makeId())),
  student: { studentId: '', studentName: '' },
  targetAverage: '',
  weighted: true,
  activeSemester: SEMESTERS[0].id,
  calculated: false,
  goalCalculated: false,
  quickAverages: {},
  inputModes: {},
  admissionInterests: [],
  admissionScale: 'converted',
});

function makeId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
let state = loadState();
const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number.isFinite(value) ? value.toFixed(2) : '-';
const admissionFilters = { region: '', university: '', field: '', department: '', admissionType: '', category: '' };

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.actual)) return defaultState();
    const normalized = normalizeState(saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return defaultState();
  }
}
function normalizeRecord(record = {}) {
  const configured = courseById(record.courseId);
  if (configured) {
    const normalized = recordFromCourse(configured, typeof record.id === 'string' && record.id ? record.id : makeId());
    return { ...normalized, gradeValue: ['grade', 'both'].includes(normalized.gradingType) ? record.gradeValue ?? '' : '', achievement: allowedAchievements(normalized).includes(record.achievement) ? record.achievement : '' };
  }
  return {
    id: typeof record.id === 'string' && record.id ? record.id : makeId(),
    semesterId: SEMESTERS.some((semester) => semester.id === record.semesterId) ? record.semesterId : SEMESTERS[0].id,
    subjectName: String(record.subjectName ?? '').slice(0, 80),
    subjectGroup: ['국어', '수학', '영어', '사회', '과학', '기타'].includes(record.subjectGroup) ? record.subjectGroup : '기타',
    credit: record.credit ?? '', gradeValue: record.gradeValue ?? '',
    achievement: ['A', 'B', 'C'].includes(record.achievement) ? record.achievement : '', requirement: 'legacy', gradingType: 'grade', achievementScale: 'none',
  };
}
function allowedAchievements(record) {
  if (record.achievementScale === 'pass') return ['P', 'F'];
  if (record.achievementScale === 'a-e') return ['A', 'B', 'C', 'D', 'E'];
  return ['A', 'B', 'C'];
}
function normalizeState(saved = {}) {
  const base = defaultState();
  const savedActual = Array.isArray(saved.actual) ? saved.actual.map(normalizeRecord) : [];
  const commonActual = commonCourses().filter((course) => !savedActual.some((record) => record.courseId === course.id)).map((course) => recordFromCourse(course, makeId()));
  return {
    ...base,
    actual: [...savedActual, ...commonActual],
    student: { studentId: String(saved.student?.studentId ?? saved.studentId ?? '').replace(/\D/g, '').slice(0, 5), studentName: String(saved.student?.studentName ?? saved.studentName ?? saved.student?.name ?? '').trim().slice(0, 30) },
    targetAverage: String(saved.targetAverage ?? ''), weighted: saved.weighted !== false,
    activeSemester: SEMESTERS.some((semester) => semester.id === saved.activeSemester) ? saved.activeSemester : base.activeSemester,
    calculated: Boolean(saved.calculated), goalCalculated: Boolean(saved.goalCalculated),
    quickAverages: normalizeQuickAverages(saved.quickAverages),
    inputModes: normalizeInputModes(saved.inputModes),
    admissionInterests: normalizeAdmissionInterests(saved.admissionInterests),
    admissionScale: saved.admissionScale === 'original' ? 'original' : 'converted',
  };
}
function normalizeQuickAverages(saved = {}) {
  const result = {};
  SEMESTERS.forEach(({ id }) => {
    const value = Number(saved?.actual?.[id] ?? saved?.[id]);
    if (validAverageInput(value)) result[id] = Number(value.toFixed(2));
  });
  return result;
}
function normalizeInputModes(saved = {}) {
  const result = {};
  SEMESTERS.forEach(({ id }) => { result[id] = saved?.actual?.[id] === 'quick' || saved?.[id] === 'quick' ? 'quick' : 'detailed'; });
  return result;
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function records() { return state.actual; }
function semesterLabel(id) { return SEMESTERS.find((item) => item.id === id)?.label ?? id; }
function quickAverage(semesterId) { return Number(state.quickAverages?.[semesterId]); }
function detailedRows(semesterId) { return records().filter((record) => record.semesterId === semesterId); }
function detailedStatus(semesterId) {
  const rows = detailedRows(semesterId);
  const gradedRows = rows.filter((record) => ['grade', 'both'].includes(record.gradingType));
  const valid = gradedRows.filter((record) => Number(record.gradeValue) >= 1 && Number(record.gradeValue) <= 5);
  return { rows, gradedRows, valid, complete: gradedRows.length > 0 && valid.length === gradedRows.length };
}
function effectiveRecords() {
  const output = [];
  SEMESTERS.forEach(({ id }) => {
    const status = detailedStatus(id);
    const quick = quickAverage(id);
    if (status.complete) output.push(...status.valid);
    else if (Number.isFinite(quick) && quick >= 1 && quick <= 5) output.push({ id: `quick-${id}`, semesterId: id, subjectName: `${semesterLabel(id)} 평균`, subjectGroup: '', credit: 1, gradeValue: quick, source: 'quick' });
    else output.push(...status.valid);
  });
  return output;
}
function usesQuickAverage() { return SEMESTERS.some(({ id }) => !detailedStatus(id).complete && Number.isFinite(quickAverage(id))); }
function completedSemesterIndexes() {
  const completed = SEMESTERS.map(({ id }, index) => (detailedStatus(id).complete || validAverageInput(quickAverage(id)) ? index : -1)).filter((index) => index >= 0);
  return completed;
}
function fallbackRemainingSemesters() {
  const completed = completedSemesterIndexes();
  if (!completed.length) return [];
  const remainingSemesters = SEMESTERS.slice(Math.max(...completed) + 1);
  if (usesQuickAverage()) return remainingSemesters.map(({ id }) => ({ id: `remaining-${id}`, semesterId: id, subjectName: `${semesterLabel(id)} 남은 학기`, subjectGroup: '', credit: 1 }));
  const detailedCourses = remainingSemesters.flatMap(({ id }) => coursesForSemester(id).filter((course) => ['grade', 'both'].includes(course.gradingType)).map((course) => ({ ...recordFromCourse(course, `remaining-${course.id}`), gradeValue: '', subjectName: `${course.subjectName} (남은 학기)` })));
  return detailedCourses.length ? detailedCourses : remainingSemesters.map(({ id }) => ({ id: `remaining-${id}`, semesterId: id, subjectName: `${semesterLabel(id)} 남은 학기`, subjectGroup: '', credit: 1 }));
}
function modeLabel(semesterId) {
  const status = detailedStatus(semesterId);
  const quick = Number.isFinite(quickAverage(semesterId));
  if (status.complete && quick) return '상세 사용 · 간편값은 보관됨';
  if (status.complete) return '상세 입력 사용 중';
  if (quick) return status.gradedRows.length ? '간편 입력 사용 중 · 상세 미완료' : '간편 입력 사용 중';
  return '입력 방식 선택';
}
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
  return;
}
function renderInputMode() {
  const semesterId = state.activeSemester;
  const mode = state.inputModes?.[semesterId] ?? 'detailed';
  $('#input-mode-status').textContent = modeLabel(semesterId);
  $('#semester-input-mode').innerHTML = `<button class="${mode === 'quick' ? 'active' : ''}" data-input-mode="quick">간편 입력</button><button class="${mode === 'detailed' ? 'active' : ''}" data-input-mode="detailed">과목별 상세 입력</button>`;
  const value = Number.isFinite(quickAverage(semesterId)) ? quickAverage(semesterId).toFixed(2) : '';
  $('#quick-entry').hidden = mode !== 'quick';
  $('#quick-entry').innerHTML = mode === 'quick' ? `<label>이 학기 평균 내신 <input id="quick-average" class="input" type="number" min="1" max="5" step="0.01" value="${value}" placeholder="예: 2.14" /></label><p class="muted">1.00~5.00 범위로 입력하면 과목별 입력 없이도 전체 계산과 목표 시뮬레이션에 반영됩니다.</p>` : '';
}
function renderGradeList() {
  const list = records().filter((record) => record.semesterId === state.activeSemester);
  $('#active-semester-title').textContent = semesterLabel(state.activeSemester);
  const mode = state.inputModes?.[state.activeSemester] ?? 'detailed';
  if (mode === 'quick') {
    $('#entry-count').textContent = Number.isFinite(quickAverage(state.activeSemester)) ? '평균 입력 완료' : '평균 미입력';
    $('#grade-list').innerHTML = '<div class="empty-state">간편 입력 중에는 과목별 등급을 입력하지 않습니다. 필요하면 과목별 상세 입력으로 전환하세요.</div>';
    return;
  }
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
      <div class="grade-fields">
        ${gradingInputs(record.gradingType).grade ? `<label class="grade-input"><span>등급</span><select data-field="gradeValue" aria-label="${escapeHtml(record.subjectName)} 등급"><option value="">선택</option>${[1,2,3,4,5].map((value) => `<option value="${value}" ${Number(record.gradeValue) === value ? 'selected' : ''}>${value}등급</option>`).join('')}</select></label>` : ''}
        ${gradingInputs(record.gradingType).achievement || gradingInputs(record.gradingType).passfail ? `<label class="achievement-input"><span>${gradingInputs(record.gradingType).passfail ? '이수 여부' : '성취도'}</span><select data-field="achievement" aria-label="${escapeHtml(record.subjectName)} ${gradingInputs(record.gradingType).passfail ? '이수 여부' : '성취도'}"><option value="">-</option>${allowedAchievements(record).map((value) => `<option value="${value}" ${record.achievement === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>` : ''}
      </div>
      ${record.requirement === 'common' ? '<span class="locked-course">공통</span>' : `<button class="icon-button danger grade-delete" data-action="delete" aria-label="${escapeHtml(record.subjectName || '과목')} 삭제">삭제</button>`}
    </div>`).join('');
}
function renderCourseSelection() {
  const container = $('#course-selection');
  if ((state.inputModes?.[state.activeSemester] ?? 'detailed') === 'quick') { container.innerHTML = ''; return; }
  const used = new Set(records().filter((record) => record.semesterId === state.activeSemester).map((record) => record.courseId));
  const available = coursesForSemester(state.activeSemester).filter((course) => !used.has(course.id));
  const firstGradeNote = state.activeSemester.startsWith('1-') ? '<p class="muted">1학년 공통 과목은 자동 생성되며, 반별 이수 과목은 실제 이수 학기에 맞게 선택하세요.</p>' : '';
  container.innerHTML = available.length ? `${firstGradeNote}<label>학교 개설 과목 <select id="course-picker" class="input"><option value="">과목 선택</option>${available.map((course) => `<option value="${course.id}">${escapeHtml(course.subjectName)} · ${course.credit}학점</option>`).join('')}</select></label><button id="add-grade" class="add-button">선택 과목 추가</button>` : firstGradeNote || '<p class="muted">이 학기에 추가할 학교 개설 과목이 없습니다.</p>';
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
function validRows(type) { return records(type).filter((record) => record.subjectName?.trim() && Number(record.credit) > 0 && Number(record.gradeValue) >= 1 && Number(record.gradeValue) <= 5); }

function renderSummary() {
  const actual = state.calculated ? effectiveRecords() : [];
  const current = calculateOverallAverage(actual, state.weighted);
  const cards = [
    ['현재 실제 내신', fmt(current), '실제 성적 기준'],
    ['반영 학점', `${calculateTotalCredits(actual).toFixed(1)}학점`, state.calculated ? `입력 완료 ${actual.length}항목` : '내신 계산 후 표시'],
    ['입력 학기', `${actual.length ? new Set(actual.map((item) => item.semesterId)).size : 0}개`, '실제 성적 기준'],
    ['목표 내신', state.targetAverage ? Number(state.targetAverage).toFixed(2) : '-', '목표를 입력해 보세요'],
  ];
  $('#summary-cards').innerHTML = cards.map(([title, value, note]) => `<article class="summary-card"><span>${title}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
}
function renderSemesterSummary() {
  const averages = calculateSemesterAverages(state.calculated ? effectiveRecords() : [], state.weighted);
  $('#semester-summary').innerHTML = averages.map((semester) => {
    const average = semester.average;
    const width = average == null ? 0 : Math.max(0, Math.min(100, (10 - average) * 12.5));
    return `<div class="bar-item"><div><span>${semester.label}</span></div><div class="bar-track"><i class="bar-fill" style="width:${width}%"></i></div><strong>${fmt(average)}</strong></div>`;
  }).join('');
}
function renderSubjectSummary() {
  if (usesQuickAverage()) {
    $('#subject-summary').innerHTML = '<div class="empty-state">교과별 분석은 과목별 상세 입력 시 이용할 수 있습니다.</div>';
    return;
  }
  const summary = calculateSubjectGroupAverages(state.calculated ? effectiveRecords() : [], state.weighted);
  const overall = calculateOverallAverage(state.calculated ? effectiveRecords() : [], state.weighted);
  const advice = (average) => {
    if (!Number.isFinite(overall)) return '';
    const gap = average - overall;
    if (gap <= -0.45) return '강점'; if (gap <= 0.2) return '유지 권장'; if (gap <= 0.6) return '조금 더 올리면 좋아요'; if (gap <= 1) return '향상 필요'; return '우선 관리 권장';
  };
  $('#subject-summary').innerHTML = summary.length ? summary.map(({ subjectGroup, average }) => `<div class="subject-card"><span>${escapeHtml(subjectGroup)}</span><strong>${fmt(average)}</strong><small>${advice(average)}</small></div>`).join('') : '<div class="empty-state">내신 계산 후 교과별 분석이 표시됩니다.</div>';
}
function admissionOptions(key, placeholder) {
  const values = [...new Set(ADMISSION_REFERENCE_DATA.map((item) => item[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko'));
  return `<option value="">${placeholder}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
}
function admissionComparison() {
  const current = calculateOverallAverage(state.calculated ? effectiveRecords() : [], state.weighted);
  const target = Number(state.targetAverage);
  const basis = $('input[name="admission-basis"]:checked')?.value ?? 'current';
  if (basis === 'target' && state.goalCalculated && validAverageInput(target)) return { value: target, basis: 'target', label: '목표 내신' };
  return { value: current, basis: 'current', label: '현재 내신' };
}
function admissionResultCard(item, comparison) {
  const scale = state.admissionScale;
  const referenceCut = admissionComparisonCut(item, scale);
  const difference = scale === 'converted' ? admissionDifference(comparison.value, referenceCut) : null;
  const bandKey = scale === 'converted' ? classifyAdmissionReference(comparison.value, referenceCut) : 'original';
  const band = scale === 'converted' ? ADMISSION_REFERENCE_SETTINGS.bands[bandKey] : { label: '9등급제 원본' };
  const key = admissionInterestKey(item);
  const saved = state.admissionInterests.some((interest) => admissionInterestKey(interest) === key);
  const original = `<span>원본 9등급제 <b>${fmt(Number(item.cut70Original ?? item.cut70))}</b></span>`;
  const converted = item.cut70Converted != null ? `<span>5등급제 환산 참고 <b>${fmt(Number(item.cut70Converted))}</b></span>` : '';
  const scoreLine = scale === 'converted' ? converted : original;
  const differenceLine = scale === 'converted' ? `<p class="admission-difference">차이 <b>${difference >= 0 ? '+' : ''}${fmt(difference)}</b><span>${describeAdmissionDifference(difference)}</span></p>` : '<p class="admission-difference">원본 9등급제 값은 5등급제 학생 내신과 직접 비교하지 않습니다.</p>';
  return `<article class="admission-card"><div class="admission-card-heading"><div><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.department)}</span></div><span class="admission-band-label ${bandKey}">${band.label}</span></div><p class="admission-type">${escapeHtml(item.category)} · ${escapeHtml(item.admissionName)}</p><div class="admission-scores"><span class="admission-score-cut">전년도 70% cut ${scoreLine}</span><span class="admission-score-current">${comparison.label} <b>${fmt(comparison.value)}</b></span></div>${differenceLine}<div class="admission-card-actions"><button class="quiet-button admission-save${saved ? ' is-saved' : ''}" data-admission-save="${escapeHtml(key)}" aria-pressed="${saved}">${saved ? '관심 저장 해제' : '관심 대학 저장'}</button></div><details class="admission-card-details"><summary>세부 정보</summary><div class="admission-card-details-body">${item.cut50Original != null ? `<span>50% cut 원본 <b>${fmt(Number(item.cut50Original))}</b></span>` : ''}${item.cut50Converted != null ? `<span>50% cut 환산 참고 <b>${fmt(Number(item.cut50Converted))}</b></span>` : ''}<small>${escapeHtml(item.referenceYear)}학년도 · ${escapeHtml(item.source)}${item.updatedAt ? ` · ${escapeHtml(item.updatedAt)} 갱신` : ''}</small></div></details></article>`;
}
function renderAdmissionInterests() {
  const container = $('#admission-interests');
  if (!state.admissionInterests.length) { container.innerHTML = '<p class="muted">저장한 관심 대학·학과가 없습니다.</p>'; return; }
  container.innerHTML = state.admissionInterests.map((item) => `<article class="interest-item"><div><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.department)} · ${escapeHtml(item.admissionName)}</span><small>${escapeHtml(item.referenceYear)}학년도 · 70% cut ${fmt(item.cut70)} · ${item.comparisonBasis === 'target' ? '목표 내신' : '현재 내신'} ${fmt(item.comparisonScore)}</small></div><button class="icon-button" data-admission-remove="${escapeHtml(admissionInterestKey(item))}">삭제</button></article>`).join('');
}
function renderAdmissionReferences() {
  document.querySelectorAll('input[name="admission-scale"]').forEach((input) => { input.checked = input.value === state.admissionScale; });
  ['region', 'university', 'field', 'department', 'admissionType'].forEach((key) => { const element = $(`#admission-${key === 'admissionType' ? 'type' : key}`); if (element) { element.innerHTML = admissionOptions(key, key === 'region' ? '전체 지역' : key === 'university' ? '전체 대학' : key === 'field' ? '전체 계열' : key === 'department' ? '전체 모집단위' : '전체 전형'); element.value = admissionFilters[key]; } });
  const result = $('#admission-reference-result');
  const comparison = admissionComparison();
  $('#admission-current-score').textContent = Number.isFinite(comparison.value) ? `${comparison.label} ${fmt(comparison.value)}` : '내신 계산 후 이용 가능';
  $('#admission-view-button').disabled = !state.calculated || !Number.isFinite(comparison.value);
  if (!state.calculated || !Number.isFinite(comparison.value)) { result.innerHTML = '<div class="empty-state">내신 계산을 완료하면 현재 내신과 전년도 공개 입시결과를 비교할 수 있습니다.</div>'; renderAdmissionInterests(); return; }
  if (!ADMISSION_REFERENCE_DATA.length) { result.innerHTML = '<div class="empty-state">등록된 전년도 입시결과 데이터가 없습니다.<br /><small>대교협 대입정보포털 어디가의 공개 자료를 확인한 뒤 연도별 데이터 파일에 추가합니다.</small></div>'; renderAdmissionInterests(); return; }
  const filtered = filterAdmissionReferences(ADMISSION_REFERENCE_DATA, admissionFilters).map((item) => ({ item, band: state.admissionScale === 'converted' ? classifyAdmissionReference(comparison.value, admissionComparisonCut(item, 'converted')) : 'original' }));
  const bandKeys = state.admissionScale === 'converted' ? Object.keys(ADMISSION_REFERENCE_SETTINGS.bands) : ['original'];
  result.innerHTML = filtered.length ? bandKeys.map((key) => { const items = filtered.filter((entry) => entry.band === key); const label = key === 'original' ? '9등급제 원본 자료' : ADMISSION_REFERENCE_SETTINGS.bands[key].label; return items.length ? `<section class="admission-band"><h3>${label}</h3><div class="admission-card-grid">${items.map(({ item }) => admissionResultCard(item, comparison)).join('')}</div></section>` : ''; }).join('') : '<div class="empty-state">선택한 조건에 맞는 참고 자료가 없습니다.</div>';
  const notice = document.querySelector('.admission-conversion-notice'); if (notice) notice.textContent = ADMISSION_CONVERSION_NOTICE;
  renderAdmissionInterests();
}
function goalDetails() {
  const target = Number(state.targetAverage); const actual = effectiveRecords(); const remaining = fallbackRemainingSemesters();
  if (!state.calculated || !state.goalCalculated || !Number.isFinite(target) || target < 1 || target > 5 || !actual.length) return null;
  const simple = usesQuickAverage();
  const weighted = !simple;
  const required = calculateRequiredRemainingAverage(actual, remaining, target, weighted);
  return required == null ? null : { required, actual, remaining, simple, weighted };
}
function clampGrade(value) { return Math.max(1, Math.min(5, Number(value))); }
function scenarioTargets(remaining, required, mode) {
  if (!remaining.length) return [];
  if (mode === 'balanced' || remaining.length === 1) return remaining.map((item) => ({ ...item, target: required }));
  const anchorIndex = mode === 'early' ? 0 : remaining.length - 1;
  const anchor = remaining[anchorIndex];
  const totalWeight = remaining.reduce((sum, item) => sum + Number(item.credit), 0);
  const anchorTarget = clampGrade(required + (mode === 'early' ? -0.4 : -0.4));
  const otherWeight = totalWeight - Number(anchor.credit);
  const otherTarget = otherWeight > 0 ? clampGrade((required * totalWeight - anchorTarget * Number(anchor.credit)) / otherWeight) : required;
  return remaining.map((item, index) => ({ ...item, target: index === anchorIndex ? anchorTarget : otherTarget }));
}
function scenarioFinalAverage(actual, targets, weighted) {
  const actualWeight = weighted ? calculateTotalCredits(actual) : actual.length;
  const actualTotal = actual.reduce((sum, item) => sum + Number(item.gradeValue) * (weighted ? Number(item.credit) : 1), 0);
  const remainingWeight = targets.reduce((sum, item) => sum + (weighted ? Number(item.credit) : 1), 0);
  const remainingTotal = targets.reduce((sum, item) => sum + item.target * (weighted ? Number(item.credit) : 1), 0);
  return actualWeight + remainingWeight ? (actualTotal + remainingTotal) / (actualWeight + remainingWeight) : null;
}
function renderGoal() {
  const result = $('#goal-result');
  const details = goalDetails();
  if (!details) {
    result.innerHTML = '<p class="muted">내신 계산 후 목표(1.00~5.00)를 입력하면 남은 학기 기준 필요 평균을 계산합니다.</p>';
    return;
  }
  const difficulty = describeGoalDifficulty(details.required);
  const actual = details.actual; const remaining = details.remaining;
  const actualCredits = calculateTotalCredits(actual); const remainingCredits = calculateTotalCredits(remaining, false);
  const highest = (actual.reduce((sum, item) => sum + Number(item.gradeValue) * (details.weighted ? Number(item.credit) : 1), 0) + (details.weighted ? remainingCredits : remaining.length)) / (details.weighted ? actualCredits + remainingCredits : actual.length + remaining.length);
  const scenarios = details.required >= 1 && details.required <= 5 ? [['balanced', '균형형'], ['early', '초반 집중형'], ['late', '후반 상승형']].map(([mode, name]) => { const targets = scenarioTargets(remaining, details.required, mode); const rows = targets.map((item) => `<div class="scenario-semester"><span>${escapeHtml(semesterLabel(item.semesterId))}</span><strong>${fmt(item.target)}</strong></div>`).join(''); return `<article class="scenario-card"><h4>${name}</h4><div class="scenario-semesters">${rows}</div><p>예상 최종 내신 <strong>${fmt(scenarioFinalAverage(actual, targets, details.weighted))}</strong></p></article>`; }).join('') : '';
  const guidance = details.simple ? '<li>간편 입력 결과는 학기 평균 기준 참고값입니다.</li><li>실제 과목별 학점 입력 시 결과가 달라질 수 있습니다.</li>' : '<li>상세 입력 과목의 실제 학점 가중치로 계산했습니다.</li>';
  const summaryText = details.required >= 1 && details.required <= 5 ? `목표 내신 ${fmt(Number(state.targetAverage))}을 위해 남은 학기 평균 ${fmt(details.required)}가 필요해요.` : difficulty;
  result.innerHTML = `<section class="goal-summary"><span>남은 학기 필요 평균</span><strong>${details.required >= 1 && details.required <= 5 ? `${fmt(details.required)}등급` : '-'}</strong><p>${summaryText}</p>${details.required < 1 || details.required > 5 ? `<small>남은 모든 과목을 1등급으로 가정한 최고 가능 최종 내신: ${fmt(highest)}</small>` : ''}</section>${scenarios ? `<section class="scenario-grid" aria-label="목표 시나리오">${scenarios}</section>` : ''}<aside class="goal-guidance"><strong>안내</strong><ul>${guidance}<li>대학 합격 가능성을 의미하지 않습니다.</li></ul></aside>`;
}
function reportRows(rows) { return rows.length ? rows.map((record) => `<tr><td>${escapeHtml(semesterLabel(record.semesterId))}</td><td>${escapeHtml(record.subjectName)}</td><td>${escapeHtml(record.subjectGroup)}</td><td>${escapeHtml(record.credit)}</td><td>${escapeHtml(record.gradeValue)}</td><td>${escapeHtml(record.achievement || '-')}</td></tr>`).join('') : '<tr><td colspan="6">입력된 성적이 없습니다.</td></tr>'; }
function renderPrintReport() {
  const actual = effectiveRecords(); const quickNotice = usesQuickAverage() ? '<p class="print-note">간편 입력 학기가 포함되어 교과별 평균은 제공하지 않습니다. 교과별 분석은 과목별 상세 입력 시 이용할 수 있습니다.</p>' : ''; const subjects = usesQuickAverage() ? [] : calculateSubjectGroupAverages(actual, state.weighted); const semesters = calculateSemesterAverages(actual, state.weighted).filter((item) => item.average != null); const goal = goalDetails();
  const interests = state.admissionInterests.length ? state.admissionInterests.map((item) => { const converted = item.cut70Converted ?? null; const difference = converted == null || item.comparisonScore == null ? null : admissionDifference(item.comparisonScore, converted); return `<tr><td>${escapeHtml(item.university)}</td><td>${escapeHtml(item.department)}</td><td>${escapeHtml(item.admissionName)}</td><td>${fmt(item.cut70Original ?? item.cut70)}</td><td>${fmt(converted)}</td><td>${fmt(item.comparisonScore)}</td><td>${difference == null ? '-' : `${difference >= 0 ? '+' : ''}${fmt(difference)}`}</td></tr>`; }).join('') : '<tr><td colspan="7">저장한 관심 대학·학과가 없습니다.</td></tr>';
  $('#print-report').innerHTML = `<div class="print-page"><h1>학생 내신 · 학업 설계 결과표</h1><p class="print-note">성적 계산을 위한 참고 자료이며 대학 합격 가능성을 의미하지 않습니다.</p>${quickNotice}<dl class="print-student"><div><dt>학번</dt><dd>${escapeHtml(state.student.studentId || '-')}</dd></div><div><dt>이름</dt><dd>${escapeHtml(state.student.studentName || '-')}</dd></div><div><dt>작성일</dt><dd>${new Date().toLocaleDateString('ko-KR')}</dd></div></dl><section><h2>성적 요약</h2><div class="print-summary"><div><span>전체 평균</span><strong>${fmt(calculateOverallAverage(actual, state.weighted))}</strong></div><div><span>반영 학점</span><strong>${calculateTotalCredits(actual).toFixed(1)}학점</strong></div><div><span>목표 내신</span><strong>${state.targetAverage ? fmt(Number(state.targetAverage)) : '-'}</strong></div><div><span>남은 학기 필요 평균</span><strong>${goal ? fmt(goal.required) : '-'}</strong></div></div></section><section><h2>학기별 성적</h2><table><thead><tr><th>학기</th><th>평균 등급</th></tr></thead><tbody>${semesters.length ? semesters.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${fmt(item.average)}</td></tr>`).join('') : '<tr><td colspan="2">입력된 실제 성적이 없습니다.</td></tr>'}</tbody></table></section><section><h2>교과별 평균</h2><table><thead><tr><th>교과군</th><th>평균 등급</th></tr></thead><tbody>${subjects.length ? subjects.map((item) => `<tr><td>${escapeHtml(item.subjectGroup)}</td><td>${fmt(item.average)}</td></tr>`).join('') : `<tr><td colspan="2">${usesQuickAverage() ? '교과별 분석은 과목별 상세 입력 시 이용할 수 있습니다.' : '입력된 실제 성적이 없습니다.'}</td></tr>`}</tbody></table></section><section><h2>전년도 입시결과 참고 · 관심 대학</h2><p class="print-note">원본 9등급제 cut과 부산교육청 실측분포 기반 5등급제 환산 참고값을 함께 표시합니다. 실제 합격 가능성을 의미하지 않습니다.</p><table><thead><tr><th>대학</th><th>모집단위</th><th>전형</th><th>70% 원본</th><th>70% 환산 참고</th><th>비교 내신</th><th>차이</th></tr></thead><tbody>${interests}</tbody></table></section><section><h2>실제 성적</h2><table><thead><tr><th>학기</th><th>과목</th><th>교과군</th><th>학점</th><th>등급</th><th>성취도</th></tr></thead><tbody>${reportRows(actual)}</tbody></table></section></div>`;
}
function render() {
  renderSemesterTabs(); renderInputMode(); renderGradeList(); renderCourseSelection(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderAdmissionReferences(); renderPrintReport();
  $('#target-average').value = state.targetAverage;
  $('#weighted-toggle').checked = Boolean(state.weighted);
  $('#student-id').value = state.student.studentId; $('#student-name').value = state.student.studentName;
  const validStudentId = /^\d{5}$/.test(state.student.studentId);
  const validStudentName = Boolean(state.student.studentName.trim());
  $('#student-info-error').textContent = !validStudentId && state.student.studentId ? '학번은 숫자 5자리로 입력해주세요.' : '';
  $('#student-info-summary').textContent = validStudentId && validStudentName ? `학번 ${state.student.studentId} · ${state.student.studentName}` : '';
}

$('#semester-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-semester]');
  if (!button) return;
  state.activeSemester = button.dataset.semester; saveState(); render();
});
$('#semester-input-mode').addEventListener('click', (event) => {
  const button = event.target.closest('[data-input-mode]');
  if (!button) return;
  state.inputModes[state.activeSemester] = button.dataset.inputMode;
  saveState(); render();
});
$('#quick-entry').addEventListener('input', (event) => {
  if (event.target.id !== 'quick-average') return;
  const value = Number(event.target.value);
  if (event.target.value === '') delete state.quickAverages[state.activeSemester];
  else if (validAverageInput(value)) state.quickAverages[state.activeSemester] = Number(value.toFixed(2));
  state.calculated = false; state.goalCalculated = false; saveState();
  $('#input-mode-status').textContent = modeLabel(state.activeSemester); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport();
});
$('#course-selection').addEventListener('click', (event) => {
  if (event.target.id !== 'add-grade') return;
  const course = courseById($('#course-picker')?.value);
  if (!course) { showToast('학교 개설 과목에서 선택해 주세요.', 'error'); return; }
  records().push(recordFromCourse(course, makeId())); state.calculated = false; state.goalCalculated = false; saveState(); render();
});
$('#grade-list').addEventListener('input', (event) => {
  const row = event.target.closest('[data-id]');
  const field = event.target.dataset.field;
  if (!row || !field) return;
  const record = records().find((item) => item.id === row.dataset.id);
  if (!record) return;
  record[field] = ['credit', 'gradeValue'].includes(field) ? event.target.value : event.target.value;
  if (field === 'gradeValue' && event.target.value && (Number(event.target.value) < 1 || Number(event.target.value) > 5)) { record[field] = ''; showToast('등급은 1~5등급만 입력할 수 있어요.', 'error'); }
  state.calculated = false; state.goalCalculated = false; saveState(); $('#input-mode-status').textContent = modeLabel(state.activeSemester); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport();
});
$('#grade-list').addEventListener('change', (event) => event.target.dispatchEvent(new Event('input', { bubbles: true })));
$('#grade-list').addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'delete') return;
  const row = event.target.closest('[data-id]');
  state.actual = records().filter((item) => item.id !== row.dataset.id); state.calculated = false; state.goalCalculated = false;
  saveState(); render();
});
$('#calculate-button').addEventListener('click', () => { state.calculated = true; state.goalCalculated = false; saveState(); $('#input-mode-status').textContent = modeLabel(state.activeSemester); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport(); showToast(`내신 계산을 완료했어요. 아직 등급을 입력하지 않은 과목은 ${records().length - validRows().length}개입니다.`); });
$('#goal-calculate-button').addEventListener('click', () => { state.goalCalculated = true; saveState(); renderGoal(); renderPrintReport(); });
$('#target-average').addEventListener('input', (event) => { state.targetAverage = event.target.value; state.goalCalculated = false; saveState(); renderSummary(); renderGoal(); renderPrintReport(); });
$('#weighted-toggle').addEventListener('change', (event) => { state.weighted = event.target.checked; state.calculated = false; state.goalCalculated = false; saveState(); renderSummary(); renderSemesterSummary(); renderSubjectSummary(); renderGoal(); renderPrintReport(); });
document.querySelector('#admission-filters').addEventListener('change', (event) => {
  const map = { 'admission-region': 'region', 'admission-university': 'university', 'admission-field': 'field', 'admission-department': 'department', 'admission-type': 'admissionType', 'admission-category': 'category' };
  const key = map[event.target.id];
  if (!key) return;
  admissionFilters[key] = event.target.value;
  renderAdmissionReferences();
});
$('#admission-view-button').addEventListener('click', () => {
  const result = $('#admission-reference-result');
  renderAdmissionReferences();
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
document.querySelector('#admission-reference-panel').addEventListener('change', (event) => {
  if (event.target.name !== 'admission-basis') return;
  renderAdmissionReferences();
});
document.querySelector('#admission-reference-panel').addEventListener('change', (event) => {
  if (event.target.name !== 'admission-scale') return;
  state.admissionScale = event.target.value === 'original' ? 'original' : 'converted';
  saveState();
  renderAdmissionReferences();
  renderPrintReport();
});
document.querySelector('#admission-reference-panel').addEventListener('click', (event) => {
  const saveButton = event.target.closest('[data-admission-save]');
  const removeButton = event.target.closest('[data-admission-remove]');
  const key = saveButton?.dataset.admissionSave ?? removeButton?.dataset.admissionRemove;
  if (!key) return;
  const item = ADMISSION_REFERENCE_DATA.find((entry) => admissionInterestKey(entry) === key) ?? state.admissionInterests.find((entry) => admissionInterestKey(entry) === key);
  if (!item) return;
  if (saveButton) { const comparison = admissionComparison(); state.admissionInterests = toggleAdmissionInterest(state.admissionInterests, { ...item, comparisonScore: comparison.value, comparisonBasis: comparison.basis }); showToast(state.admissionInterests.some((interest) => admissionInterestKey(interest) === key) ? '관심 대학에 저장했습니다.' : '관심 대학 저장을 해제했습니다.'); }
  else { state.admissionInterests = state.admissionInterests.filter((interest) => admissionInterestKey(interest) !== key); showToast('관심 대학에서 삭제했습니다.'); }
  saveState(); renderAdmissionReferences(); renderPrintReport();
});
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
    if (!Array.isArray(imported.actual)) throw new Error('형식 오류');
    state = normalizeState(imported); saveState(); render(); showToast('데이터를 불러왔습니다.');
  } catch (error) { console.error(error); showToast('백업 파일 형식을 확인해 주세요.', 'error'); }
  event.target.value = '';
});
$('#reset-button').addEventListener('click', () => {
  if (!confirm('이 브라우저에 저장된 성적 데이터를 모두 삭제할까요?')) return;
  state = defaultState(); saveState(); render(); showToast('저장된 데이터를 초기화했습니다.');
});
$('#print-button').addEventListener('click', () => { renderPrintReport(); window.print(); });
document.querySelector('.student-form').addEventListener('input', (event) => {
  if (event.target.id === 'student-id') { state.student.studentId = event.target.value.replace(/\D/g, '').slice(0, 5); event.target.value = state.student.studentId; }
  if (event.target.id === 'student-name') { state.student.studentName = event.target.value.trimStart().replace(/\s+$/g, ''); event.target.value = state.student.studentName; }
  const valid = /^\d{5}$/.test(state.student.studentId) && Boolean(state.student.studentName.trim());
  if (valid) saveState();
  render();
});

render();

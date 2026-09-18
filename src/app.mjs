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
import { commonCourses, catalogCourseById as courseById, coursesForSemester, selectableCoursesForSemester } from './course-catalog-store.mjs?v=20260917-achievement-select1';
import { gradingInputs, recordFromCourse } from './course-catalog.mjs?v=20260914-grading-types3';
import { ADMISSION_REFERENCE_DATA, ADMISSION_CONVERSION_NOTICE, admissionDifference, describeAdmissionDifference, isComparableAdmissionRecord, isStudentRecordComprehensive } from './admission-reference.mjs?v=20260916-academic-fields3';
import { getAdmissionPrimaryReference } from './admission-card-summary.mjs?v=20260917-dual-grade-display1';
import { ADMISSION_ACADEMIC_FIELD_LABELS } from './admission-filter-options.mjs?v=20260917-major-search1';
import {
  ADMISSION_SUBJECT_GROUPS,
  ADMISSION_VIEW_MODES,
  admissionCategoryForViewMode,
  getAdmissionViewFilterOptions,
  increaseAdmissionGroupLimit,
  groupResultsByUniversity,
  normalizeAdmissionViewMode,
  prepareAdmissionResultView,
  reconcileAdmissionViewFilters,
  resetAdmissionGroupLimits,
} from './admission-result-view.mjs?v=20260917-accordion-sort1';
import { admissionInterestKey, normalizeAdmissionInterests, toggleAdmissionInterest } from './admission-reference-store.mjs?v=20260915-admission-interests1';
import { createGoalScenarioSummaries, getRemainingSimulationSemesters } from './goal-simulation.mjs?v=20260917-progressive-scenarios1';
import { buildPrintReportModel, renderPrintReport as renderPrintReportHtml } from './print-report.mjs?v=20260917-counsel-report1';
import { renderAdmissionCardDetails } from './admission-card-details.mjs?v=20260917-conditional-details2';
import {
  ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT,
  ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT,
  createAdmissionAccordionState,
} from './admission-accordion-state.mjs?v=20260917-result-groups1';
import { UNIVERSITY_AUDIT_2026 } from './data/university-audit-2026.mjs?v=20260916-university-master1';
import { createStudentBackup, parseStudentBackup } from './student-backup.mjs?v=20260917-integrated-audit1';
import { getSchoolSettings } from './school-settings.mjs?v=20260917-integrated-audit1';
import { buildGradePositionModel } from './grade-position.mjs?v=20260918-grade-position2';

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
  includeAchievementCourses: false,
});

function makeId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
let state = loadState();
const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number.isFinite(value) ? value.toFixed(2) : '-';
const schoolSettings = getSchoolSettings(localStorage);
const admissionFilters = {
  region: '', university: '', field: '', department: '', admissionName: '',
  schoolRegion: schoolSettings.schoolRegion,
  schoolGender: schoolSettings.schoolGender,
};
let admissionViewMode = null;
let admissionVisibleResultLimits = resetAdmissionGroupLimits();
let admissionExpandedSubjectGroup = ADMISSION_SUBJECT_GROUPS.SIMILAR;
const admissionOpenUniversityKeys = new Set();
const admissionUniversityResultLimits = new Map();
const admissionUniversityGroupLimits = new Map();
const admissionResultGroupExpanded = createAdmissionAccordionState();
const DEPARTMENT_SEARCH_DEBOUNCE_MS = 180;
let departmentSearchTimer = null;

function setupHiddenTeacherEntry({ triggerSelector = '#teacher-entry-trigger', targetUrl = './teacher.html', requiredClicks = 5, intervalMs = 2500 } = {}) {
  const trigger = $(triggerSelector);
  if (!trigger) return;
  let clickCount = 0;
  let resetTimer;
  const activate = () => {
    clickCount += 1;
    clearTimeout(resetTimer);
    if (clickCount >= requiredClicks) {
      window.location.href = targetUrl;
      return;
    }
    resetTimer = window.setTimeout(() => { clickCount = 0; }, intervalMs);
  };
  trigger.addEventListener('click', activate);
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activate();
  });
}

setupHiddenTeacherEntry();

function loadState() {
  // 학생 개인 데이터는 브라우저 저장소에서 읽지 않고 페이지마다 빈 상태로 시작한다.
  return defaultState();
}
function normalizeRecord(record = {}) {
  const configured = courseById(record.courseId);
  if (configured) {
    const normalized = recordFromCourse(configured, typeof record.id === 'string' && record.id ? record.id : makeId());
    return { ...normalized, gradeValue: ['grade', 'both'].includes(normalized.gradingType) ? record.gradeValue ?? '' : '', achievement: allowedAchievements(normalized).includes(record.achievement) ? record.achievement : '' };
  }
  const gradingType = ['grade', 'achievement', 'passfail', 'both'].includes(record.gradingType) ? record.gradingType : 'grade';
  const achievementScale = ['none', 'a-c', 'a-e', 'pass'].includes(record.achievementScale)
    ? record.achievementScale
    : gradingType === 'passfail' ? 'pass' : gradingType === 'achievement' || gradingType === 'both' ? 'a-c' : 'none';
  const normalized = {
    id: typeof record.id === 'string' && record.id ? record.id : makeId(),
    semesterId: SEMESTERS.some((semester) => semester.id === record.semesterId) ? record.semesterId : SEMESTERS[0].id,
    subjectName: String(record.subjectName ?? '').slice(0, 80),
    subjectGroup: String(record.subjectGroup ?? '기타').trim().slice(0, 40) || '기타',
    credit: record.credit ?? '',
    gradeValue: ['grade', 'both'].includes(gradingType) ? record.gradeValue ?? '' : '',
    achievement: '',
    requirement: String(record.requirement ?? 'legacy'),
    gradingType,
    fiveLevelEligible: ['grade', 'both'].includes(gradingType) && record.fiveLevelEligible !== false,
    achievementOnly: gradingType === 'achievement',
    achievementScale,
  };
  normalized.achievement = allowedAchievements(normalized).includes(record.achievement) ? record.achievement : '';
  return normalized;
}
function allowedAchievements(record) {
  if (record.achievementScale === 'pass') return ['P', 'F'];
  if (record.achievementScale === 'a-e') return ['A', 'B', 'C', 'D', 'E'];
  return ['A', 'B', 'C'];
}
function normalizeState(saved = {}) {
  const base = defaultState();
  const savedActual = Array.isArray(saved.actual) ? saved.actual.map(normalizeRecord) : [];
  const includeAchievementCourses = saved.includeAchievementCourses === true;
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
    includeAchievementCourses,
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
function saveState() {
  // 현재 페이지의 state가 세션 저장소다. 학생 데이터는 브라우저 영구 저장소에 쓰지 않는다.
  return state;
}
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
function completedSemesterIds() {
  return SEMESTERS.filter(({ id }) => detailedStatus(id).complete || validAverageInput(quickAverage(id))).map(({ id }) => id);
}
function fallbackRemainingSemesters() {
  const remainingSemesters = getRemainingSimulationSemesters(completedSemesterIds());
  if (!remainingSemesters.length) return [];
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
  const completed = new Set(completedSemesterIds());
  $('#semester-tabs').innerHTML = SEMESTERS.map((semester) => {
    const isComplete = completed.has(semester.id);
    return `<button class="tab-button ${state.activeSemester === semester.id ? 'active' : ''} ${isComplete ? 'complete' : ''}" data-semester="${semester.id}" aria-label="${semester.label}${isComplete ? ', 입력 완료' : ''}"><span>${semester.label}</span>${isComplete ? '<small aria-hidden="true">✓</small>' : ''}</button>`;
  }).join('');
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
  const studentId = String(state.student?.studentId ?? '');
  const classNumber = /^\d{5}$/.test(studentId) ? Number(studentId.slice(1, 3)) : null;
  const available = selectableCoursesForSemester(state.activeSemester, undefined, { classNumber }).filter((course) => !used.has(course.id));
  const firstGradeNote = state.activeSemester.startsWith('1-') ? '<p class="muted">1학년 공통 과목은 자동 생성되며, 반별 이수 과목은 실제 이수 학기에 맞게 선택하세요.</p>' : '';
  container.innerHTML = available.length ? `${firstGradeNote}<label>학교 개설 과목 <select id="course-picker" class="input"><option value="">과목 선택</option>${available.map((course) => `<option value="${course.id}">${escapeHtml(course.subjectName)} · ${course.credit}학점</option>`).join('')}</select></label><button id="add-grade" class="add-button">선택 과목 추가</button>` : firstGradeNote || '<p class="muted">이 학기에 추가할 학교 개설 과목이 없습니다.</p>';
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
function gradeInputRows() { return records().filter((record) => ['grade', 'both'].includes(record.gradingType) && record.fiveLevelEligible !== false); }
function validRows() { return gradeInputRows().filter((record) => record.subjectName?.trim() && Number(record.credit) > 0 && Number(record.gradeValue) >= 1 && Number(record.gradeValue) <= 5); }

function renderCurrentGradeResult() {
  const actual = state.calculated ? effectiveRecords() : [];
  const current = calculateOverallAverage(actual, state.weighted);
  const container = $('#current-grade-result');
  if (!state.calculated || !Number.isFinite(current)) {
    container.classList.remove('calculated');
    container.innerHTML = '<p>성적을 입력하고 내신을 계산해 보세요.</p>';
    return;
  }
  container.classList.add('calculated');
  container.innerHTML = `<span>계산된 현재 내신</span><strong>${fmt(current)}</strong>`;
}
function renderSemesterSummary() {
  const averages = calculateSemesterAverages(state.calculated ? effectiveRecords() : [], state.weighted);
  $('#semester-summary').innerHTML = averages.map((semester) => {
    const average = semester.average;
    const width = average == null ? 0 : Math.max(0, Math.min(100, (10 - average) * 12.5));
    return `<div class="bar-item"><div><span>${semester.label}</span></div><div class="bar-track"><i class="bar-fill" style="width:${width}%"></i></div><strong>${fmt(average)}</strong></div>`;
  }).join('');
}
function gradeScaleHtml({ label, value, position, scale }) {
  const segments = Array.from({ length: scale.scale }, (_, index) => `<span class="grade-position-band" aria-label="${index + 1}등급"><b>${index + 1}</b><small>등급</small></span>`).join('');
  const percentages = scale.cumulativePercentages.map((percentage) => `<span style="--grade-boundary:${percentage}%">${percentage}%</span>`).join('');
  const description = scale.cumulativePercentages.map((percentage, index) => `${index + 1}등급 ${percentage}%`).join(', ');
  const columns = scale.bandPercentages.map((percentage) => `${percentage}fr`).join(' ');
  return `<div class="grade-position-scale" data-scale="${scale.scale}" role="img" aria-label="${label}, 현재 ${fmt(value)}등급. 누적 비율 경계 ${description}"><div class="grade-position-scale-heading"><span>${label}</span><strong>${fmt(value)}</strong></div><div class="grade-position-chart" style="--grade-position:${position}%;--grade-band-columns:${columns}"><div class="grade-position-bands">${segments}</div><i class="grade-position-marker" aria-hidden="true"><b>현재</b></i></div><div class="grade-position-percent-axis" aria-hidden="true">${percentages}</div><small class="grade-position-axis-caption">누적 비율 경계</small></div>`;
}
function renderGradePosition() {
  const container = $('#grade-position');
  const current = state.calculated ? calculateOverallAverage(effectiveRecords(), state.weighted) : null;
  const model = buildGradePositionModel(current);
  if (!model) {
    container.innerHTML = '<div class="empty-state grade-position-empty">내신을 계산하면 현재 등급 위치를 확인할 수 있어요.</div>';
    return;
  }
  container.innerHTML = `<div class="grade-position-values"><div><span>현재 5등급제 평균</span><strong>${fmt(model.grade5)}</strong><small>현재 계산 내신</small></div><div><span>9등급제 환산 참고</span><strong>약 ${fmt(model.grade9)}</strong><small>교육청 기준 환산</small></div></div><div class="grade-position-scales">${gradeScaleHtml({ label: '5등급제 구간', value: model.grade5, position: model.grade5Position, scale: model.grade5Scale })}${gradeScaleHtml({ label: '9등급제 구간', value: model.grade9, position: model.grade9Position, scale: model.grade9Scale })}</div><p class="grade-position-note">현재 내신을 기준으로 5등급제와 9등급제 위치를 참고용으로 보여줍니다.<br />교육청 환산 기준 참고값이며, 실제 대학별 반영 방식과 다를 수 있습니다.</p>`;
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
function admissionOptions(values, placeholder, labels = {}) {
  return `<option value="">${placeholder}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labels[value] ?? value)}</option>`).join('')}`;
}
function resetAdmissionViewPaging() {
  admissionVisibleResultLimits = resetAdmissionGroupLimits();
  admissionExpandedSubjectGroup = ADMISSION_SUBJECT_GROUPS.SIMILAR;
  admissionResultGroupExpanded.reset();
  admissionOpenUniversityKeys.clear();
  admissionUniversityResultLimits.clear();
  admissionUniversityGroupLimits.clear();
}
function setAdmissionViewMode(mode) {
  const normalized = normalizeAdmissionViewMode(mode);
  if (normalized === admissionViewMode) return;
  admissionViewMode = normalized;
  Object.assign(admissionFilters, { region: '', university: '', field: '', department: '', admissionName: '' });
  resetAdmissionViewPaging();
}
function ensureAdmissionViewModeControls() {
  const panel = $('#admission-reference-panel');
  const overview = panel?.querySelector('.admission-overview');
  if (!panel || !overview) return;

  if (!panel.querySelector('[data-admission-view-mode-selector]')) {
    const selector = document.createElement('div');
    selector.className = 'admission-control-group admission-view-mode-selector';
    selector.dataset.admissionViewModeSelector = '';
    selector.innerHTML = '<span>전형 방식 선택</span><div class="admission-basis" role="radiogroup" aria-label="전형 방식 선택"><label><input type="radio" name="admission-view-mode" value="student-record-subject" data-admission-view-mode="student-record-subject" /> 학생부교과</label><label><input type="radio" name="admission-view-mode" value="student-record-comprehensive" data-admission-view-mode="student-record-comprehensive" /> 학생부종합</label></div>';
    overview.before(selector);
  }
}
function renderAdmissionFilterOptions() {
  const options = getAdmissionViewFilterOptions(ADMISSION_REFERENCE_DATA, { admissionViewMode, filters: admissionFilters });
  const configurations = [
    ['region', 'admission-region', options.regions, '전체 지역'],
    ['university', 'admission-university', options.universities, '전체 대학'],
    ['field', 'admission-field', options.academicFields, '전체 계열', ADMISSION_ACADEMIC_FIELD_LABELS],
    ['admissionName', 'admission-name', options.admissionNames, '전체 전형명'],
  ];
  configurations.forEach(([key, elementId, values, placeholder, labels]) => {
    const element = $(`#${elementId}`);
    if (!element) return;
    element.innerHTML = admissionOptions(values, placeholder, labels);
    element.value = admissionFilters[key];
    element.disabled = !admissionViewMode || (key === 'admissionName' && values.length === 0);
  });
  const departmentInput = $('#admission-department');
  const departmentSuggestions = $('#admission-department-suggestions');
  departmentInput.value = admissionFilters.department;
  departmentInput.disabled = !admissionViewMode;
  departmentSuggestions.innerHTML = options.departmentSuggestions.map(({ department }) => `<option value="${escapeHtml(department)}"></option>`).join('');
  document.querySelectorAll('[data-admission-view-mode]').forEach((control) => {
    const active = normalizeAdmissionViewMode(control.dataset.admissionViewMode ?? control.value) === admissionViewMode;
    control.setAttribute('aria-pressed', String(active));
    if ('checked' in control) control.checked = active;
  });
}
function admissionComparison() {
  const current = calculateOverallAverage(state.calculated ? effectiveRecords() : [], state.weighted);
  const target = Number(state.targetAverage);
  const basis = $('input[name="admission-basis"]:checked')?.value ?? 'current';
  if (basis === 'target' && state.goalCalculated && validAverageInput(target)) return { value: target, basis: 'target', label: '목표 내신' };
  return { value: current, basis: 'current', label: '현재 내신' };
}
function admissionReferenceScoreLine(item) {
  const reference = getAdmissionPrimaryReference(item);
  const converted = reference.converted == null ? '-' : fmt(reference.converted);
  const original = reference.original == null ? '-' : fmt(reference.original);
  return `<span class="admission-score-cut">${escapeHtml(reference.label)}<span>5등급제 환산 참고 <b>${converted}</b></span><small>원본 9등급제 ${original}</small></span>`;
}
function admissionUniversityDisclosureKey(groupKey, group) {
  return `${groupKey}:${group.universityId ?? group.universityName}`;
}
function admissionUniversitySummary(group) {
  const differences = group.results
    .map((entry) => entry.absoluteDifference ?? entry.referenceAbsoluteDifference ?? Number.POSITIVE_INFINITY)
    .filter(Number.isFinite);
  const similarCount = group.results.filter((entry) => {
    const difference = entry.difference ?? entry.referenceDifference;
    return Number.isFinite(difference) && Math.abs(difference) <= 0.2;
  }).length;
  return {
    closestDifference: group.closestDifference ?? (differences.length ? Math.min(...differences) : null),
    similarCount,
  };
}
function admissionResultCardWithinUniversity(entry, comparison, groupKey) {
  const item = entry.item;
  const comparable = isComparableAdmissionRecord(item);
  const comprehensive = isStudentRecordComprehensive(item);
  const difference = !comparable ? null : admissionDifference(comparison.value, item.cut70Converted);
  const key = admissionInterestKey(item);
  const saved = state.admissionInterests.some((interest) => admissionInterestKey(interest) === key);
  const scoreLine = admissionReferenceScoreLine(item);
  const differenceLine = comprehensive ? '<p class="admission-difference">학생부종합 전형은 전년도 등록자 내신 참고로만 제공합니다.</p>' : `<p class="admission-difference">차이 <b>${difference >= 0 ? '+' : ''}${fmt(difference)}</b><span>${describeAdmissionDifference(difference)}</span></p>`;
  const currentLine = !comparable ? '' : `<span class="admission-score-current">${comparison.label} <b>${fmt(comparison.value)}</b></span>`;
  const availabilityLine = item.dataAvailability === 'cut70-only' ? '<small>공식 70% cut만 공개</small>' : item.dataAvailability === 'average-only' ? '<small>공식 평균등급 참고</small>' : '';
  return `<article class="admission-card admission-department-card"><div class="admission-card-heading"><div><strong>${escapeHtml(item.department)}</strong></div></div><p class="admission-type">${escapeHtml(item.admissionCategory)} · ${escapeHtml(item.admissionName)}</p><div class="admission-scores">${scoreLine}${currentLine}${availabilityLine}</div>${differenceLine}<div class="admission-card-actions"><button class="quiet-button admission-save${saved ? ' is-saved' : ''}" data-admission-save="${escapeHtml(key)}" aria-pressed="${saved}">${saved ? '관심 저장 해제' : '관심 대학 저장'}</button></div>${renderAdmissionCardDetails(item)}</article>`;
}
function renderAdmissionUniversityAccordion(group, comparison, groupKey) {
  const disclosureKey = admissionUniversityDisclosureKey(groupKey, group);
  const visibleLimit = admissionUniversityResultLimits.get(disclosureKey) ?? ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT;
  const visibleResults = group.results.slice(0, visibleLimit);
  const remainingCount = Math.max(0, group.results.length - visibleResults.length);
  const summary = admissionUniversitySummary(group);
  const closestText = summary.closestDifference == null ? '' : `<span>가장 가까운 차이 ${fmt(summary.closestDifference)}</span>`;
  const similarText = summary.similarCount ? `<span>비슷한 입결 ${summary.similarCount}개</span>` : '';
  const isOpen = admissionOpenUniversityKeys.has(disclosureKey);
  return `<details class="admission-university" data-admission-university-accordion data-admission-university-key="${escapeHtml(disclosureKey)}"${isOpen ? ' open' : ''}><summary aria-expanded="${isOpen}"><div class="admission-university-title"><strong>${escapeHtml(group.universityName)}</strong><span>${group.resultCount}개 모집단위</span></div><div class="admission-university-meta">${closestText}${similarText}</div></summary><div class="admission-university-content"><div class="admission-university-results">${visibleResults.map((entry) => admissionResultCardWithinUniversity(entry, comparison, groupKey)).join('')}</div>${remainingCount ? `<button class="quiet-button admission-university-more" data-admission-university-load-more="${escapeHtml(disclosureKey)}">이 대학 모집단위 더 보기 (${remainingCount}개)</button>` : ''}</div></details>`;
}
function createAdmissionUniversityGroupView(entries = []) {
  return {
    totalCount: entries.length,
    universityGroups: groupResultsByUniversity(entries),
  };
}
function renderAdmissionUniversityGroup({ key, title, description = '', groupView, comparison }) {
  if (!groupView?.universityGroups?.length) return '';
  const isExpanded = admissionResultGroupExpanded.isExpanded(key);
  const universityLimit = admissionUniversityGroupLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT;
  const visibleUniversities = groupView.universityGroups.slice(0, universityLimit);
  const remainingUniversities = Math.max(0, groupView.universityGroups.length - visibleUniversities.length);
  return `<details class="admission-result-group admission-result-group-${escapeHtml(key)}" data-admission-result-group-key="${escapeHtml(key)}"${isExpanded ? ' open' : ''}><summary class="admission-result-group-heading" aria-expanded="${isExpanded}"><div><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div><span>${groupView.totalCount}개</span></summary><div class="admission-university-list">${visibleUniversities.map((group) => renderAdmissionUniversityAccordion(group, comparison, key)).join('')}</div>${remainingUniversities ? `<button class="quiet-button admission-university-group-more" data-admission-university-group-load-more="${escapeHtml(key)}">대학 더 보기 (${remainingUniversities}곳)</button>` : ''}</details>`;
}
function renderAdmissionInterests() {
  const container = $('#admission-interests');
  if (!state.admissionInterests.length) { container.innerHTML = '<p class="muted">저장한 관심 대학·학과가 없습니다.</p>'; return; }
  container.innerHTML = state.admissionInterests.map((item) => `<article class="interest-item"><div><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.department)} · ${escapeHtml(item.admissionName)}</span><small>${escapeHtml(item.referenceYear)}학년도 · 70% cut ${fmt(item.cut70)} · ${item.comparisonBasis === 'reference' ? '전년도 등록자 내신 참고' : item.comparisonBasis === 'target' ? '목표 내신' : '현재 내신'}${item.comparisonScore == null ? '' : ` ${fmt(item.comparisonScore)}`}</small></div><button class="icon-button" data-admission-remove="${escapeHtml(admissionInterestKey(item))}">삭제</button></article>`).join('');
}
function admissionEmptyStateMessage() {
  if (!admissionFilters.university) return '선택한 조건에 맞는 참고 자료가 없습니다.';
  const universityRecords = ADMISSION_REFERENCE_DATA.filter((item) => item.university === admissionFilters.university);
  if (universityRecords.length) return '공식 입시결과는 확보되어 있지만 현재 선택 조건에 맞는 기본 노출 자료가 없습니다.';

  const audit = UNIVERSITY_AUDIT_2026.find((item) => item.universityName === admissionFilters.university);
  const admissionCategory = admissionCategoryForViewMode(admissionViewMode);
  const statuses = admissionCategory === '학생부교과'
    ? [audit?.subjectAdmissionStatus]
    : admissionCategory === '학생부종합'
      ? [audit?.comprehensiveAdmissionStatus]
      : [audit?.subjectAdmissionStatus, audit?.comprehensiveAdmissionStatus];
  if (statuses.some((status) => status === 'not-checked')) return '아직 공식 입시결과를 확인 중인 대학입니다.';
  if (statuses.every((status) => status === 'not-published')) return '대학이 해당 공식 입시결과 수치를 공개하지 않았습니다.';
  if (statuses.every((status) => ['no-subject-admission', 'no-comprehensive-admission'].includes(status))) return '해당 전형 또는 모집단위의 공식 결과가 없습니다.';
  return '현재 공식 입시결과를 확보하지 못했습니다.';
}
function renderAdmissionReferences() {
  const notice = document.querySelector('.admission-conversion-notice'); if (notice) notice.textContent = ADMISSION_CONVERSION_NOTICE;
  renderAdmissionFilterOptions();
  const result = $('#admission-reference-result');
  result.dataset.totalMatchedResults = '0';
  result.dataset.visibleResults = '0';
  result.dataset.visibleResultLimit = '0';
  result.dataset.admissionViewMode = admissionViewMode ?? '';
  result.dataset.subjectSimilarCount = '0';
  result.dataset.subjectHigherCount = '0';
  result.dataset.subjectLowerCount = '0';
  const loadMoreButtons = [...document.querySelectorAll('[data-admission-load-more]')];
  loadMoreButtons.forEach((button) => { button.hidden = true; button.disabled = true; button.dataset.remainingResults = '0'; });
  const comparison = admissionComparison();
  $('#admission-current-score').textContent = Number.isFinite(comparison.value) ? `${comparison.label} ${fmt(comparison.value)}` : '내신 계산 후 이용 가능';
  $('#admission-view-button').disabled = !admissionViewMode || !state.calculated || !Number.isFinite(comparison.value);
  if (!admissionViewMode) { result.innerHTML = ''; renderAdmissionInterests(); return; }
  if (!state.calculated || !Number.isFinite(comparison.value)) { result.innerHTML = '<div class="empty-state">내신 계산을 완료하면 현재 내신과 전년도 공개 입시결과를 비교할 수 있습니다.</div>'; renderAdmissionInterests(); return; }
  if (!ADMISSION_REFERENCE_DATA.length) { result.innerHTML = '<div class="empty-state">등록된 전년도 입시결과 데이터가 없습니다.<br /><small>대교협 대입정보포털 어디가의 공개 자료를 확인한 뒤 연도별 데이터 파일에 추가합니다.</small></div>'; renderAdmissionInterests(); return; }
  const view = prepareAdmissionResultView(ADMISSION_REFERENCE_DATA, {
    admissionViewMode,
    filters: admissionFilters,
    comparisonValue: comparison.value,
    comparisonEnabled: true,
    visibleResultLimits: admissionVisibleResultLimits,
  });
  result.dataset.totalMatchedResults = String(view.totalMatchedResults);
  result.dataset.visibleResults = String(view.totalMatchedResults);
  result.dataset.visibleResultLimit = String(view.totalMatchedResults);
  result.dataset.admissionCategory = view.admissionCategory;
  result.dataset.subjectSimilarCount = String(view.subjectSimilarCount);
  result.dataset.subjectHigherCount = String(view.subjectHigherCount);
  result.dataset.subjectLowerCount = String(view.subjectLowerCount);
  result.dataset.expandedSubjectGroup = '';
  const sections = [];
  if (admissionViewMode === ADMISSION_VIEW_MODES.SUBJECT) {
    sections.push(
      renderAdmissionUniversityGroup({ key: ADMISSION_SUBJECT_GROUPS.SIMILAR, title: '내 내신과 비슷한 입결 ±0.2', groupView: view.subjectGroups.similar, comparison }),
      renderAdmissionUniversityGroup({ key: ADMISSION_SUBJECT_GROUPS.HIGHER, title: '내 내신보다 입결이 높은 결과', groupView: view.subjectGroups.higher, comparison }),
      renderAdmissionUniversityGroup({ key: ADMISSION_SUBJECT_GROUPS.LOWER, title: '내 내신보다 입결이 낮은 결과', groupView: view.subjectGroups.lower, comparison }),
    );
  } else {
    const referenceGroups = view.comprehensiveReferenceGroups;
    sections.push(
      renderAdmissionUniversityGroup({ key: 'comprehensive-similar', title: '등록자 내신 참고값이 비슷한 범위 ±0.2', description: '전년도 등록자 내신 참고용으로만 확인하세요.', groupView: referenceGroups?.similar, comparison }),
      renderAdmissionUniversityGroup({ key: 'comprehensive-higher', title: '등록자 내신 참고값이 높은 결과', description: '전년도 등록자 내신 참고용입니다.', groupView: referenceGroups?.higher, comparison }),
      renderAdmissionUniversityGroup({ key: 'comprehensive-lower', title: '등록자 내신 참고값이 낮은 결과', description: '전년도 등록자 내신 참고용입니다.', groupView: referenceGroups?.lower, comparison }),
    );
    const unavailableEntries = (view.comprehensive?.allResults ?? []).filter(({ item }) => ![item.cut70Converted, item.averageGradeConverted, item.cut50Converted].some((value) => value != null && value !== '' && Number.isFinite(Number(value))));
    sections.push(renderAdmissionUniversityGroup({ key: 'comprehensive-unavailable', title: '내신 수치 미공개', description: '전년도 공개 자료에 내신 수치가 없는 모집단위입니다.', groupView: createAdmissionUniversityGroupView(unavailableEntries), comparison }));
  }
  result.innerHTML = sections.filter(Boolean).join('') || `<div class="empty-state">${escapeHtml(admissionEmptyStateMessage())}</div>`;
  renderAdmissionInterests();
}
function goalDetails() {
  const target = Number(state.targetAverage); const actual = effectiveRecords(); const remaining = fallbackRemainingSemesters();
  if (!state.calculated || !state.goalCalculated || !Number.isFinite(target) || target < 1 || target > 5 || !actual.length) return null;
  const simple = usesQuickAverage();
  const weighted = simple ? false : state.weighted !== false;
  const required = calculateRequiredRemainingAverage(actual, remaining, target, weighted);
  return required == null ? null : { required, actual, remaining, simple, weighted };
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
  const scenarios = details.required >= 1 && details.required <= 5 ? createGoalScenarioSummaries(actual, remaining, details.required, details.weighted).map(({ name, semesterResults, finalAverage }) => { const rows = semesterResults.map((item) => `<div class="scenario-semester"><span>${escapeHtml(semesterLabel(item.semesterId))}</span><strong>${fmt(item.target)}</strong></div>`).join(''); return `<article class="scenario-card"><h4>${name}</h4><div class="scenario-semesters">${rows}</div><p>예상 최종 내신 <strong>${fmt(finalAverage)}</strong></p></article>`; }).join('') : '';
  const guidance = details.simple ? '<li>간편 입력 결과는 학기 평균 기준 참고값입니다.</li><li>실제 과목별 학점 입력 시 결과가 달라질 수 있습니다.</li>' : '<li>상세 입력 과목의 실제 학점 가중치로 계산했습니다.</li>';
  const summaryText = details.required >= 1 && details.required <= 5 ? `목표 내신 ${fmt(Number(state.targetAverage))}을 위해 남은 학기 평균 ${fmt(details.required)}가 필요해요.` : difficulty;
  result.innerHTML = `<section class="goal-summary"><span>남은 학기 필요 평균</span><strong>${details.required >= 1 && details.required <= 5 ? `${fmt(details.required)}등급` : '-'}</strong><p>${summaryText}</p>${details.required < 1 || details.required > 5 ? `<small>남은 모든 과목을 1등급으로 가정한 최고 가능 최종 내신: ${fmt(highest)}</small>` : ''}</section>${scenarios ? `<section class="scenario-grid" aria-label="목표 시나리오">${scenarios}</section>` : ''}<aside class="goal-guidance"><strong>안내</strong><ul>${guidance}<li>대학 합격 가능성을 의미하지 않습니다.</li></ul></aside>`;
}
function renderPrintReport() {
  const model = buildPrintReportModel(state, { remainingRecords: fallbackRemainingSemesters() });
  $('#print-report').innerHTML = renderPrintReportHtml(model);
}
function render() {
  renderSemesterTabs(); renderInputMode(); renderGradeList(); renderCourseSelection(); renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderAdmissionReferences(); renderPrintReport();
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
  $('#input-mode-status').textContent = modeLabel(state.activeSemester); renderSemesterTabs(); renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderPrintReport();
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
  state.calculated = false; state.goalCalculated = false; saveState(); $('#input-mode-status').textContent = modeLabel(state.activeSemester); renderSemesterTabs(); renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderPrintReport();
});
$('#grade-list').addEventListener('change', (event) => event.target.dispatchEvent(new Event('input', { bubbles: true })));
$('#grade-list').addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'delete') return;
  const row = event.target.closest('[data-id]');
  state.actual = records().filter((item) => item.id !== row.dataset.id); state.calculated = false; state.goalCalculated = false;
  saveState(); render();
});
$('#calculate-button').addEventListener('click', () => { state.calculated = true; state.goalCalculated = false; resetAdmissionViewPaging(); saveState(); $('#input-mode-status').textContent = modeLabel(state.activeSemester); renderSemesterTabs(); renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderPrintReport(); showToast(`내신 계산을 완료했어요. 아직 등급을 입력하지 않은 과목은 ${gradeInputRows().length - validRows().length}개입니다.`); });
$('#goal-calculate-button').addEventListener('click', () => { state.goalCalculated = true; resetAdmissionViewPaging(); saveState(); renderGoal(); renderPrintReport(); });
$('#target-average').addEventListener('input', (event) => { state.targetAverage = event.target.value; state.goalCalculated = false; resetAdmissionViewPaging(); saveState(); renderGoal(); renderPrintReport(); });
$('#weighted-toggle').addEventListener('change', (event) => { state.weighted = event.target.checked; state.calculated = false; state.goalCalculated = false; saveState(); renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderPrintReport(); });
document.querySelector('#admission-filters').addEventListener('change', (event) => {
  const map = { 'admission-region': 'region', 'admission-university': 'university', 'admission-field': 'field', 'admission-department': 'department', 'admission-name': 'admissionName' };
  const key = map[event.target.id];
  if (!key) return;
  if (key === 'department') {
    clearTimeout(departmentSearchTimer);
    admissionFilters.department = event.target.value.trim();
    resetAdmissionViewPaging();
    renderAdmissionReferences();
    return;
  }
  admissionFilters[key] = event.target.value;
  Object.assign(admissionFilters, reconcileAdmissionViewFilters(ADMISSION_REFERENCE_DATA, { admissionViewMode, filters: admissionFilters }));
  resetAdmissionViewPaging();
  renderAdmissionReferences();
});
$('#admission-department').addEventListener('input', (event) => {
  admissionFilters.department = event.target.value.trim();
  resetAdmissionViewPaging();
  const options = getAdmissionViewFilterOptions(ADMISSION_REFERENCE_DATA, { admissionViewMode, filters: admissionFilters });
  $('#admission-department-suggestions').innerHTML = options.departmentSuggestions.map(({ department }) => `<option value="${escapeHtml(department)}"></option>`).join('');
  clearTimeout(departmentSearchTimer);
  if (event.isComposing) return;
  departmentSearchTimer = window.setTimeout(() => {
    departmentSearchTimer = null;
    renderAdmissionReferences();
  }, DEPARTMENT_SEARCH_DEBOUNCE_MS);
});
$('#admission-department').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  clearTimeout(departmentSearchTimer);
  departmentSearchTimer = null;
  admissionFilters.department = event.target.value.trim();
  resetAdmissionViewPaging();
  renderAdmissionReferences();
});
$('#admission-view-button').addEventListener('click', () => {
  const result = $('#admission-reference-result');
  renderAdmissionReferences();
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
document.querySelector('#admission-reference-panel').addEventListener('change', (event) => {
  if (event.target.name === 'admission-view-mode' || event.target.matches('[data-admission-view-mode]')) {
    setAdmissionViewMode(event.target.dataset.admissionViewMode ?? event.target.value);
    renderAdmissionReferences();
    return;
  }
  if (event.target.name !== 'admission-basis') return;
  resetAdmissionViewPaging();
  renderAdmissionReferences();
});
$('#admission-reference-result').addEventListener('toggle', (event) => {
  const disclosure = event.target.closest('[data-admission-university-accordion]');
  if (!disclosure) return;
  const key = disclosure.dataset.admissionUniversityKey;
  if (!key) return;
  if (disclosure.open) admissionOpenUniversityKeys.add(key);
  else admissionOpenUniversityKeys.delete(key);
  disclosure.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(disclosure.open));
}, true);
$('#admission-reference-result').addEventListener('click', (event) => {
  const resultGroupSummary = event.target.closest('.admission-result-group > summary');
  if (resultGroupSummary) {
    event.preventDefault();
    event.stopPropagation();
    const disclosure = resultGroupSummary.parentElement;
    const key = disclosure?.dataset.admissionResultGroupKey;
    if (!disclosure || !key) return;
    const isExpanded = admissionResultGroupExpanded.toggle(key);
    disclosure.open = isExpanded;
    resultGroupSummary.setAttribute('aria-expanded', String(isExpanded));
    return;
  }
  const universityGroupMore = event.target.closest('[data-admission-university-group-load-more]');
  if (universityGroupMore) {
    event.stopPropagation();
    const key = universityGroupMore.dataset.admissionUniversityGroupLoadMore;
    const currentLimit = admissionUniversityGroupLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT;
    admissionUniversityGroupLimits.set(key, currentLimit + ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT);
    renderAdmissionReferences();
    return;
  }
  const universityMore = event.target.closest('[data-admission-university-load-more]');
  if (!universityMore) return;
  event.stopPropagation();
  const key = universityMore.dataset.admissionUniversityLoadMore;
  const currentLimit = admissionUniversityResultLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT;
  admissionUniversityResultLimits.set(key, currentLimit + ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT);
  admissionOpenUniversityKeys.add(key);
  renderAdmissionReferences();
});
document.querySelector('#admission-reference-panel').addEventListener('click', (event) => {
  const universitySummaryControl = event.target.closest('.admission-university > summary');
  if (universitySummaryControl) {
    event.preventDefault();
    const disclosure = universitySummaryControl.closest('[data-admission-university-accordion]');
    const key = disclosure?.dataset.admissionUniversityKey;
    if (!disclosure || !key) return;
    disclosure.open = !disclosure.open;
    if (disclosure.open) admissionOpenUniversityKeys.add(key);
    else admissionOpenUniversityKeys.delete(key);
    universitySummaryControl.setAttribute('aria-expanded', String(disclosure.open));
    return;
  }
  const modeControl = event.target.closest('[data-admission-view-mode]');
  if (modeControl && modeControl.tagName !== 'INPUT') {
    setAdmissionViewMode(modeControl.dataset.admissionViewMode ?? modeControl.value);
    renderAdmissionReferences();
    return;
  }
  const groupControl = event.target.closest('[data-admission-subject-group]');
  if (groupControl) {
    const group = groupControl.dataset.admissionSubjectGroup;
    if (Object.values(ADMISSION_SUBJECT_GROUPS).includes(group)) admissionExpandedSubjectGroup = group;
    renderAdmissionReferences();
    return;
  }
  const universityGroupLoadMoreControl = event.target.closest('[data-admission-university-group-load-more]');
  if (universityGroupLoadMoreControl) {
    const key = universityGroupLoadMoreControl.dataset.admissionUniversityGroupLoadMore;
    const currentLimit = admissionUniversityGroupLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT;
    admissionUniversityGroupLimits.set(key, currentLimit + ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT);
    renderAdmissionReferences();
    return;
  }
  const universityLoadMoreControl = event.target.closest('[data-admission-university-load-more]');
  if (universityLoadMoreControl) {
    const key = universityLoadMoreControl.dataset.admissionUniversityLoadMore;
    const currentLimit = admissionUniversityResultLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT;
    admissionUniversityResultLimits.set(key, currentLimit + ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT);
    admissionOpenUniversityKeys.add(key);
    renderAdmissionReferences();
    return;
  }
  const loadMoreControl = event.target.closest('[data-admission-load-more]');
  if (loadMoreControl) {
    const group = admissionViewMode === ADMISSION_VIEW_MODES.COMPREHENSIVE
      ? 'comprehensive'
      : loadMoreControl.dataset.admissionLoadMore || admissionExpandedSubjectGroup;
    admissionVisibleResultLimits = increaseAdmissionGroupLimit(admissionVisibleResultLimits, group);
    renderAdmissionReferences();
    return;
  }
  const saveButton = event.target.closest('[data-admission-save]');
  const removeButton = event.target.closest('[data-admission-remove]');
  const key = saveButton?.dataset.admissionSave ?? removeButton?.dataset.admissionRemove;
  if (!key) return;
  const item = ADMISSION_REFERENCE_DATA.find((entry) => admissionInterestKey(entry) === key) ?? state.admissionInterests.find((entry) => admissionInterestKey(entry) === key);
  if (!item) return;
  if (saveButton) { const comparison = isComparableAdmissionRecord(item) ? admissionComparison() : { value: null, basis: 'reference' }; state.admissionInterests = toggleAdmissionInterest(state.admissionInterests, { ...item, comparisonScore: comparison.value, comparisonBasis: comparison.basis }); showToast(state.admissionInterests.some((interest) => admissionInterestKey(interest) === key) ? '관심 대학에 저장했습니다.' : '관심 대학 저장을 해제했습니다.'); }
  else { state.admissionInterests = state.admissionInterests.filter((interest) => admissionInterestKey(interest) !== key); showToast('관심 대학에서 삭제했습니다.'); }
  saveState(); renderAdmissionReferences(); renderPrintReport();
});
$('#export-button').addEventListener('click', () => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const blob = new Blob([JSON.stringify(createStudentBackup(state), null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `naesin-simulator-backup-${stamp}.json`; link.click(); URL.revokeObjectURL(link.href);
  showToast('백업 파일을 내려받았습니다.');
});
$('#import-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const imported = parseStudentBackup(await file.text());
    state = normalizeState(imported);
    render(); showToast('데이터를 불러왔습니다.');
  } catch (error) { console.error(error); showToast('백업 파일 형식을 확인해 주세요.', 'error'); }
  event.target.value = '';
});
$('#reset-button').addEventListener('click', () => {
  if (!confirm('입력한 학생 데이터와 성적을 초기화할까요?')) return;
  state = defaultState();
  admissionViewMode = null;
  admissionFilters.region = '';
  admissionFilters.university = '';
  admissionFilters.field = '';
  admissionFilters.department = '';
  admissionFilters.admissionName = '';
  resetAdmissionViewPaging();
  render();
  showToast('입력한 학생 데이터와 성적을 초기화했습니다.');
});
$('#print-button').addEventListener('click', () => { renderPrintReport(); window.print(); });
document.querySelector('.student-form').addEventListener('input', (event) => {
  if (!['student-id', 'student-name'].includes(event.target.id)) return;
  if (event.target.id === 'student-id') {
    const enteredId = event.target.value.replace(/\D/g, '').slice(0, 5);
    state.student.studentId = enteredId;
    event.target.value = enteredId;
  }
  if (event.target.id === 'student-name') { state.student.studentName = event.target.value.trimStart().replace(/\s+$/g, ''); event.target.value = state.student.studentName; }
  render();
});

ensureAdmissionViewModeControls();
render();

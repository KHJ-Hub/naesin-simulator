import {
  SEMESTERS,
  calculateOverallAverage,
  calculateSemesterAverages,
  calculateSubjectGroupAverages,
  calculateTotalCredits,
  calculateRequiredRemainingAverage,
  describeGoalDifficulty,
  validAverageInput,
} from './grade-calculator.mjs?v=20260919-student-tone1';
import { commonCourses, catalogCourseById as courseById, coursesForSemester, selectableCoursesForSemester } from './course-catalog-store.mjs?v=20260917-achievement-select1';
import { gradingInputs, recordFromCourse } from './course-catalog.mjs?v=20260914-grading-types3';
import { ADMISSION_CONVERSION_NOTICE, admissionDifference, describeAdmissionDifference, isComparableAdmissionRecord, isStudentRecordComprehensive, normalizeAdmissionReferenceData } from './admission-reference-core.mjs?v=20260919-readiness1';
import { admissionResultRegions, admissionResultRegionKey, loadAdmissionResultsByRegion } from './admission-results-loader.mjs?v=20260919-readiness1';
import { getAdmissionPrimaryReference } from './admission-card-summary.mjs?v=20260917-dual-grade-display1';
import { ADMISSION_ACADEMIC_FIELD_LABELS, ADMISSION_OWNERSHIP_LABELS } from './admission-filter-options.mjs?v=20260918-ownership1';
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
} from './admission-result-view.mjs?v=20260918-ownership1';
import { admissionInterestKey, normalizeAdmissionInterests, toggleAdmissionInterest } from './admission-reference-store.mjs?v=20260921-security-audit1';
import {
  MAX_ADMISSION_INTEREST_COMPARISONS,
  MIN_ADMISSION_INTEREST_COMPARISONS,
  buildAdmissionInterestComparison,
  reconcileAdmissionInterestComparisonSelection,
} from './admission-interest-comparison.mjs?v=20260919-interest-compare1';
import { createGoalScenarioSummaries, getRemainingSimulationSemesters } from './goal-simulation.mjs?v=20260917-progressive-scenarios1';
import { buildPrintReportModel, renderPrintReport as renderPrintReportHtml } from './print-report.mjs?v=20260919-readiness1';
import { renderAdmissionCardSupplement } from './admission-card-details.mjs?v=20260918-card-details-button1';
import {
  canCompareWithBusanAdmissions,
  findLocalAdmissionComparisons,
  renderLocalAdmissionComparison,
} from './admission-local-comparison.mjs?v=20260919-student-tone1';
import {
  ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT,
  ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT,
  createAdmissionAccordionState,
} from './admission-accordion-state.mjs?v=20260917-result-groups1';
import { UNIVERSITY_BY_NAME } from './data/universities.mjs?v=20260919-readiness1';
import { createStudentBackup, normalizeBackupRecordId, parseStudentBackup } from './student-backup.mjs?v=20260921-security-audit1';
import { getSchoolSettings } from './school-settings.mjs?v=20260917-integrated-audit1';
import { buildGradePositionModel } from './grade-position.mjs?v=20260918-shared-position1';
import { ENABLE_TEACHER_QUICK_MODE } from './feature-flags.mjs';
import { APP_VERSION } from './app-version.mjs?v=20260921-admin-admissions2';
import { setupStudentFeedback } from './student-feedback.mjs?v=20260921-admin-admissions2';

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
  region: '', ownership: '', university: '', field: '', department: '', admissionName: '',
  schoolRegion: schoolSettings.schoolRegion,
  schoolGender: schoolSettings.schoolGender,
};
let admissionViewMode = null;
let admissionReferenceData = [];
let admissionDataStatus = 'idle';
let admissionDataError = null;
const loadedAdmissionRegions = new Set();
const admissionRegionLoadPromises = new Map();
let admissionVisibleResultLimits = resetAdmissionGroupLimits();
let admissionExpandedSubjectGroup = ADMISSION_SUBJECT_GROUPS.SIMILAR;
const admissionOpenUniversityKeys = new Set();
const admissionUniversityResultLimits = new Map();
const admissionUniversityGroupLimits = new Map();
const admissionResultGroupExpanded = createAdmissionAccordionState();
const admissionInterestComparisonSelection = new Set();
let admissionInterestComparisonOpen = false;
const DEPARTMENT_SEARCH_DEBOUNCE_MS = 180;
let departmentSearchTimer = null;
let isDepartmentSuggestionsOpen = false;
let isDepartmentSearchComposing = false;
let pendingDepartmentSearchCommit = false;
let ignoreNativeDepartmentSearchUntil = 0;
let departmentResultScrollTimer = null;

function admissionRegionKeysForFilters({ allWhenUnscoped = false } = {}) {
  const selectedRegion = admissionResultRegionKey(admissionFilters.region);
  if (selectedRegion) return [selectedRegion];
  const universityRegion = UNIVERSITY_BY_NAME[admissionFilters.university]?.region;
  const selectedUniversityRegion = admissionResultRegionKey(universityRegion);
  if (selectedUniversityRegion) return [selectedUniversityRegion];
  return allWhenUnscoped ? [...admissionResultRegions] : [];
}

function mergeAdmissionReferenceData(records = []) {
  const merged = new Map(admissionReferenceData.map((item) => [admissionInterestKey(item), item]));
  normalizeAdmissionReferenceData(records).forEach((item) => merged.set(admissionInterestKey(item), item));
  admissionReferenceData = [...merged.values()];
}

async function loadAdmissionRegion(regionKey) {
  if (loadedAdmissionRegions.has(regionKey)) return;
  if (!admissionRegionLoadPromises.has(regionKey)) {
    const promise = loadAdmissionResultsByRegion(regionKey)
      .then((records) => {
        mergeAdmissionReferenceData(records);
        loadedAdmissionRegions.add(regionKey);
      })
      .finally(() => admissionRegionLoadPromises.delete(regionKey));
    admissionRegionLoadPromises.set(regionKey, promise);
  }
  await admissionRegionLoadPromises.get(regionKey);
}

async function ensureAdmissionData({ allWhenUnscoped = false } = {}) {
  const regionKeys = admissionRegionKeysForFilters({ allWhenUnscoped });
  const missing = regionKeys.filter((regionKey) => !loadedAdmissionRegions.has(regionKey));
  if (!missing.length) return true;
  admissionDataStatus = 'loading';
  admissionDataError = null;
  renderAdmissionReferences();
  const outcomes = await Promise.allSettled(missing.map(loadAdmissionRegion));
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
  admissionDataError = rejected?.reason ?? null;
  admissionDataStatus = admissionDataError && admissionReferenceData.length === 0 ? 'error' : 'ready';
  renderAdmissionReferences();
  return !admissionDataError;
}

function applyPublicFeatureVisibility() {
  const teacherQuickModeLink = $('[data-teacher-quick-mode-link]');
  if (teacherQuickModeLink) teacherQuickModeLink.hidden = !ENABLE_TEACHER_QUICK_MODE;
}

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
    const normalized = recordFromCourse(configured, normalizeBackupRecordId(record.id, makeId()));
    const grade = Number(record.gradeValue);
    const credit = Number(record.credit);
    return {
      ...normalized,
      credit: Number.isFinite(credit) && credit > 0 && credit <= 30 ? credit : normalized.credit,
      gradeValue: ['grade', 'both'].includes(normalized.gradingType) && Number.isInteger(grade) && grade >= 1 && grade <= 5 ? String(grade) : '',
      achievement: allowedAchievements(normalized).includes(record.achievement) ? record.achievement : '',
    };
  }
  const gradingType = ['grade', 'achievement', 'passfail', 'both'].includes(record.gradingType) ? record.gradingType : 'grade';
  const achievementScale = ['none', 'a-c', 'a-e', 'pass'].includes(record.achievementScale)
    ? record.achievementScale
    : gradingType === 'passfail' ? 'pass' : gradingType === 'achievement' || gradingType === 'both' ? 'a-c' : 'none';
  const grade = Number(record.gradeValue);
  const credit = Number(record.credit);
  const normalized = {
    id: normalizeBackupRecordId(record.id, makeId()),
    semesterId: SEMESTERS.some((semester) => semester.id === record.semesterId) ? record.semesterId : SEMESTERS[0].id,
    subjectName: String(record.subjectName ?? '').slice(0, 80),
    subjectGroup: String(record.subjectGroup ?? '기타').trim().slice(0, 40) || '기타',
    credit: Number.isFinite(credit) && credit > 0 && credit <= 30 ? credit : '',
    gradeValue: ['grade', 'both'].includes(gradingType) && Number.isInteger(grade) && grade >= 1 && grade <= 5 ? String(grade) : '',
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
  const targetAverage = Number(saved.targetAverage);
  const normalizedTargetAverage = validAverageInput(targetAverage) ? String(Number(targetAverage.toFixed(2))) : '';
  const calculated = Boolean(saved.calculated);
  return {
    ...base,
    actual: [...savedActual, ...commonActual],
    student: { studentId: String(saved.student?.studentId ?? saved.studentId ?? '').replace(/\D/g, '').slice(0, 5), studentName: String(saved.student?.studentName ?? saved.studentName ?? saved.student?.name ?? '').trim().slice(0, 30) },
    targetAverage: normalizedTargetAverage, weighted: saved.weighted !== false,
    activeSemester: SEMESTERS.some((semester) => semester.id === saved.activeSemester) ? saved.activeSemester : base.activeSemester,
    calculated, goalCalculated: calculated && Boolean(saved.goalCalculated) && Boolean(normalizedTargetAverage),
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
  SEMESTERS.forEach(({ id }) => {
    const mode = saved?.actual?.[id] ?? saved?.[id];
    if (mode === 'quick' || mode === 'detailed') result[id] = mode;
  });
  return result;
}
function saveState() {
  // 현재 페이지의 state가 세션 저장소다. 학생 데이터는 브라우저 영구 저장소에 쓰지 않는다.
  return state;
}

const STUDENT_ADMISSION_FILTER_KEYS = ['region', 'ownership', 'university', 'field', 'department', 'admissionName'];
function collectStudentBackupUiState() {
  return {
    admissionViewMode,
    comparisonBasis: $('input[name="admission-basis"]:checked')?.value === 'target' ? 'target' : 'current',
    admissionFilters: Object.fromEntries(STUDENT_ADMISSION_FILTER_KEYS.map((key) => [key, admissionFilters[key] ?? ''])),
  };
}
async function restoreStudentBackupUiState(saved = {}) {
  admissionInterestComparisonOpen = false;
  admissionInterestComparisonSelection.clear();
  admissionViewMode = normalizeAdmissionViewMode(saved?.admissionViewMode);
  STUDENT_ADMISSION_FILTER_KEYS.forEach((key) => {
    admissionFilters[key] = String(saved?.admissionFilters?.[key] ?? '').trim().slice(0, 150);
  });
  if (admissionViewMode) await ensureAdmissionData({ allWhenUnscoped: true });
  Object.assign(admissionFilters, reconcileAdmissionViewFilters(admissionReferenceData, { admissionViewMode, filters: admissionFilters }));
  const comparisonBasis = saved?.comparisonBasis === 'target' ? 'target' : 'current';
  document.querySelectorAll('input[name="admission-basis"]').forEach((control) => {
    control.checked = control.value === comparisonBasis;
  });
  closeDepartmentSuggestions();
  resetAdmissionViewPaging();
}
function hasCurrentStudentInput() {
  const defaultCourseIds = new Set(commonCourses().map((course) => course.id));
  return Boolean(
    state.student.studentId
    || state.student.studentName
    || state.targetAverage
    || state.admissionInterests.length
    || Object.keys(state.quickAverages ?? {}).length
    || state.actual.some((record) => record.gradeValue || record.achievement || (record.courseId && !defaultCourseIds.has(record.courseId)))
  );
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
  const quick = validAverageInput(quickAverage(semesterId));
  const selectedMode = semesterSelectedMode(semesterId);
  if (status.complete && quick) return '과목별 입력값을 기준으로 계산해요. 간편 평균도 보관돼요.';
  if (status.complete) return '이 학기는 과목별 입력값을 기준으로 계산해요.';
  if (quick && status.valid.length) return '상세 입력을 완료하기 전까지 간편 평균을 계산에 사용해요.';
  if (quick) return '입력한 학기 평균을 계산에 사용해요.';
  if (selectedMode === 'quick') return '학기 평균을 입력하면 계산에 반영돼요.';
  if (selectedMode === 'detailed') return '과목별 등급을 모두 입력하면 상세 입력값을 계산에 사용해요.';
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

let expandedSemesterId = state.activeSemester;

function semesterSelectedMode(semesterId) {
  const explicit = state.inputModes?.[semesterId];
  if (explicit === 'quick' || explicit === 'detailed') return explicit;
  const rows = detailedRows(semesterId);
  if (rows.some((record) => record.gradeValue || record.achievement)) return 'detailed';
  if (validAverageInput(quickAverage(semesterId))) return 'quick';
  return null;
}

function semesterCardView(semesterId) {
  const status = detailedStatus(semesterId);
  const quick = quickAverage(semesterId);
  const hasQuick = validAverageInput(quick);
  const hasDetailedInput = status.rows.some((record) => record.gradeValue || record.achievement);
  const detailedAverage = status.complete ? calculateOverallAverage(status.valid, state.weighted) : NaN;
  if (status.complete) return { badge: '상세 입력 완료', tone: 'complete', summary: `상세 입력 완료 · 평균 ${fmt(detailedAverage)}` };
  if (hasDetailedInput) return { badge: '입력 중', tone: 'progress', summary: hasQuick ? `상세 입력 중 · 평균 ${fmt(quick)} 적용` : '과목별 성적 입력 중' };
  if (hasQuick) return { badge: '간편 입력 완료', tone: 'complete', summary: `간편 입력 완료 · 평균 ${fmt(quick)}` };
  return { badge: '입력 전', tone: 'empty', summary: '입력 전' };
}

function gradeRowsHtml(semesterId) {
  const list = detailedRows(semesterId);
  if (!list.length) return `<div class="empty-state">${semesterLabel(semesterId)}에 등록된 성적이 없어요. 과목을 추가해 보세요.</div>`;
  return list.map((record) => `
    <div class="grade-row" data-id="${escapeHtml(record.id)}">
      <div class="course-name"><span>과목명</span><strong>${escapeHtml(record.subjectName)}</strong></div>
      <div class="course-meta"><span>${escapeHtml(record.subjectGroup)}</span><small>${escapeHtml(record.credit)}학점</small></div>
      <div class="grade-fields">
        ${gradingInputs(record.gradingType).grade ? `<label class="grade-input"><span>등급</span><select data-field="gradeValue" aria-label="${escapeHtml(record.subjectName)} 등급"><option value="">선택</option>${[1,2,3,4,5].map((value) => `<option value="${value}" ${Number(record.gradeValue) === value ? 'selected' : ''}>${value}등급</option>`).join('')}</select></label>` : ''}
        ${gradingInputs(record.gradingType).achievement || gradingInputs(record.gradingType).passfail ? `<label class="achievement-input"><span>${gradingInputs(record.gradingType).passfail ? '이수 여부' : '성취도'}</span><select data-field="achievement" aria-label="${escapeHtml(record.subjectName)} ${gradingInputs(record.gradingType).passfail ? '이수 여부' : '성취도'}"><option value="">-</option>${allowedAchievements(record).map((value) => `<option value="${value}" ${record.achievement === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>` : ''}
      </div>
      ${record.requirement === 'common' ? '<span class="locked-course">공통</span>' : `<button class="icon-button danger grade-delete" data-action="delete" aria-label="${escapeHtml(record.subjectName || '과목')} 삭제">삭제</button>`}
    </div>`).join('');
}

function courseSelectionHtml(semesterId) {
  const used = new Set(records().filter((record) => record.semesterId === semesterId).map((record) => record.courseId));
  const studentId = String(state.student?.studentId ?? '');
  const classNumber = /^\d{5}$/.test(studentId) ? Number(studentId.slice(1, 3)) : null;
  const available = selectableCoursesForSemester(semesterId, undefined, { classNumber }).filter((course) => !used.has(course.id));
  const firstGradeNote = semesterId.startsWith('1-') ? '<p class="muted">1학년 공통 과목은 자동 생성되며, 반별 이수 과목은 실제 이수 학기에 맞게 선택해 주세요.</p>' : '';
  return available.length ? `${firstGradeNote}<label>학교 개설 과목 <select class="input" data-course-picker="${semesterId}"><option value="">과목 선택</option>${available.map((course) => `<option value="${course.id}">${escapeHtml(course.subjectName)} · ${course.credit}학점</option>`).join('')}</select></label><button type="button" class="add-button" data-add-course="${semesterId}">선택 과목 추가</button>` : firstGradeNote || '<p class="muted">이 학기에 추가할 학교 개설 과목이 없어요.</p>';
}

function renderSemesterCards() {
  $('#semester-cards').innerHTML = SEMESTERS.map((semester) => {
    const semesterId = semester.id;
    const isExpanded = expandedSemesterId === semesterId;
    const mode = semesterSelectedMode(semesterId);
    const view = semesterCardView(semesterId);
    const quick = quickAverage(semesterId);
    const quickValue = validAverageInput(quick) ? quick.toFixed(2) : '';
    const modeNote = mode ? `<p class="semester-priority-note">${escapeHtml(modeLabel(semesterId))}</p>` : '';
    const completeButton = mode ? `<button type="button" class="primary-button semester-complete-button" data-semester-complete="${semesterId}">성적 입력 완료</button>` : '';
    const inputBody = mode === 'quick'
      ? `<div class="quick-entry semester-quick-entry"><label>이 학기 평균 내신 <input class="input" data-quick-average="${semesterId}" type="number" min="1" max="5" step="0.01" value="${quickValue}" placeholder="예: 2.14" /></label><p class="muted">성적표의 학기 종합 평균을 1.00~5.00 범위로 입력해 주세요.</p>${modeNote}${completeButton}</div>`
      : mode === 'detailed'
        ? `<div class="semester-detailed-entry"><div class="semester-detail-heading"><strong>과목별 성적</strong><span>${detailedRows(semesterId).length}개 과목</span></div><div class="grade-list">${gradeRowsHtml(semesterId)}</div><div class="course-selection">${courseSelectionHtml(semesterId)}</div>${modeNote}${completeButton}</div>`
        : '<div class="semester-mode-prompt">입력 방식을 선택하면 해당 학기의 입력란이 나타나요.</div>';
    return `<article class="semester-card ${isExpanded ? 'is-open' : ''}" data-semester-card="${semesterId}">
      <button type="button" class="semester-card-header" data-semester-toggle="${semesterId}" aria-expanded="${isExpanded}" aria-controls="semester-card-body-${semesterId}">
        <span class="semester-card-title"><strong>${escapeHtml(semester.label)}</strong><small class="semester-card-status-text">${escapeHtml(view.summary)}</small></span>
        <span class="semester-status-badge is-${view.tone}">${escapeHtml(view.badge)}</span>
        <span class="semester-card-chevron" aria-hidden="true">${isExpanded ? '⌃' : '⌄'}</span>
      </button>
      <div class="semester-card-body" id="semester-card-body-${semesterId}" ${isExpanded ? '' : 'hidden'}>
        <div class="semester-mode-options" role="group" aria-label="${escapeHtml(semester.label)} 입력 방식">
          <button type="button" class="semester-mode-option ${mode === 'quick' ? 'is-selected' : ''}" data-input-mode="quick" data-semester-id="${semesterId}" aria-pressed="${mode === 'quick'}"><strong>학기 평균으로 간단히 입력</strong><small>성적표의 학기 종합 평균만 입력</small></button>
          <button type="button" class="semester-mode-option ${mode === 'detailed' ? 'is-selected' : ''}" data-input-mode="detailed" data-semester-id="${semesterId}" aria-pressed="${mode === 'detailed'}"><strong>과목별로 자세히 입력</strong><small>과목별 등급과 학점을 반영해 계산</small></button>
        </div>
        ${inputBody}
      </div>
    </article>`;
  }).join('');
}

function refreshSemesterCardHeader(semesterId) {
  const card = document.querySelector(`[data-semester-card="${semesterId}"]`);
  if (!card) return;
  const view = semesterCardView(semesterId);
  const summary = card.querySelector('.semester-card-status-text');
  const badge = card.querySelector('.semester-status-badge');
  if (summary) summary.textContent = view.summary;
  if (badge) {
    badge.textContent = view.badge;
    badge.className = `semester-status-badge is-${view.tone}`;
  }
}
function clearSemesterCompletionErrors(card) {
  card.querySelectorAll('.semester-input-error').forEach((error) => error.remove());
  card.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
}
function addSemesterInputError(field, message) {
  field.setAttribute('aria-invalid', 'true');
  const error = document.createElement('small');
  error.className = 'semester-input-error';
  error.setAttribute('role', 'alert');
  error.textContent = message;
  const label = field.closest('label');
  if (label) label.append(error);
  else field.insertAdjacentElement('afterend', error);
}
function completeSemesterInput(semesterId) {
  const card = semesterCards.querySelector(`[data-semester-card="${semesterId}"]`);
  if (!card) return;
  clearSemesterCompletionErrors(card);
  const mode = semesterSelectedMode(semesterId);
  if (mode === 'quick') {
    const input = card.querySelector(`[data-quick-average="${semesterId}"]`);
    if (!input || !validAverageInput(Number(input.value))) {
      if (input) {
        addSemesterInputError(input, '1.00~5.00 범위의 학기 평균을 입력해 주세요.');
        input.focus();
      }
      showToast('학기 평균을 입력해 주세요.', 'error');
      return;
    }
  } else if (mode === 'detailed') {
    const status = detailedStatus(semesterId);
    if (!status.gradedRows.length) {
      const button = card.querySelector('[data-semester-complete]');
      if (button) addSemesterInputError(button, '등급을 입력할 과목이 없어요.');
      showToast('등급을 입력할 과목을 확인해 주세요.', 'error');
      return;
    }
    const missingRows = status.gradedRows.filter((record) => !(Number(record.gradeValue) >= 1 && Number(record.gradeValue) <= 5));
    if (missingRows.length) {
      const missingIds = new Set(missingRows.map((record) => record.id));
      const fields = [...card.querySelectorAll('[data-id]')]
        .filter((row) => missingIds.has(row.dataset.id))
        .map((row) => row.querySelector('[data-field="gradeValue"]'))
        .filter(Boolean);
      fields.forEach((field) => addSemesterInputError(field, '등급을 입력해 주세요.'));
      fields[0]?.focus();
      fields[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`입력하지 않은 등급이 ${missingRows.length}개 있어요.`, 'error');
      return;
    }
  } else {
    showToast('먼저 입력 방식을 선택해 주세요.', 'error');
    return;
  }

  state.activeSemester = semesterId;
  expandedSemesterId = null;
  saveState();
  renderSemesterCards();
  renderGradeDerivedViews();
  const semesterIndex = SEMESTERS.findIndex(({ id }) => id === semesterId);
  const nextSemesterId = SEMESTERS[semesterIndex + 1]?.id;
  window.requestAnimationFrame(() => {
    const nextCard = nextSemesterId ? semesterCards.querySelector(`[data-semester-card="${nextSemesterId}"]`) : null;
    (nextCard ?? semesterCards.querySelector(`[data-semester-card="${semesterId}"]`))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  showToast(`${semesterLabel(semesterId)} 성적 입력을 완료했어요.`);
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
function gradeScaleBandsHtml(scale) {
  const segments = Array.from({ length: scale.scale }, (_, index) => `<span class="grade-position-band" aria-label="${index + 1}등급"><b>${index + 1}</b><small>등급</small></span>`).join('');
  const columns = scale.bandPercentages.map((percentage) => `${percentage}fr`).join(' ');
  return `<div class="grade-position-bands" data-scale="${scale.scale}" style="--grade-band-columns:${columns}">${segments}</div>`;
}
function gradePositionComparisonHtml(model) {
  const axis = model.commonAxisPercentages.map((percentage) => `<span data-boundary="${percentage}" style="--grade-boundary:${percentage}%">${percentage}%</span>`).join('');
  const grade5Description = model.grade5Scale.cumulativePercentages.map((percentage, index) => `${index + 1}등급 ${percentage}%`).join(', ');
  const grade9Description = model.grade9Scale.cumulativePercentages.map((percentage, index) => `${index + 1}등급 ${percentage}%`).join(', ');
  return `<div class="grade-position-comparison" role="img" aria-label="공통 누적 위치 ${model.commonPosition}%. 5등급제 현재 ${fmt(model.grade5)}등급, 경계 ${grade5Description}. 9등급제 환산 약 ${fmt(model.grade9)}등급, 경계 ${grade9Description}"><div class="grade-position-row-labels" aria-hidden="true"><strong>5등급제</strong><strong>9등급제</strong><small>누적비율</small></div><div class="grade-position-plot" style="--grade-position:${model.commonPosition}%"><i class="grade-position-shared-marker" aria-hidden="true"><b>내 위치</b></i>${gradeScaleBandsHtml(model.grade5Scale)}${gradeScaleBandsHtml(model.grade9Scale)}<div class="grade-position-common-axis" aria-hidden="true">${axis}</div></div></div>`;
}
function renderGradePosition() {
  const container = $('#grade-position');
  const current = state.calculated ? calculateOverallAverage(effectiveRecords(), state.weighted) : null;
  const model = buildGradePositionModel(current);
  if (!model) {
    container.innerHTML = '<div class="empty-state grade-position-empty">내신을 계산하면 현재 등급 위치를 확인할 수 있어요.</div>';
    return;
  }
  container.innerHTML = `<div class="grade-position-values"><div><span>현재 5등급제 평균</span><strong>${fmt(model.grade5)}</strong><small>현재 계산 내신</small></div><div><span>9등급제 환산 참고</span><strong>약 ${fmt(model.grade9)}</strong><small>교육청 기준 환산</small></div></div>${gradePositionComparisonHtml(model)}<p class="grade-position-note">현재 내신을 기준으로 5등급제와 9등급제 위치를 참고용으로 보여줘요.<br />교육청 환산 기준 참고값이고, 실제 대학별 반영 방식과 다를 수 있어요.</p>`;
}
function renderSubjectSummary() {
  if (usesQuickAverage()) {
    $('#subject-summary').innerHTML = '<div class="empty-state">교과별 분석은 과목별 상세 입력 시 이용할 수 있어요.</div>';
    return;
  }
  const summary = calculateSubjectGroupAverages(state.calculated ? effectiveRecords() : [], state.weighted);
  const overall = calculateOverallAverage(state.calculated ? effectiveRecords() : [], state.weighted);
  const advice = (average) => {
    if (!Number.isFinite(overall)) return '';
    const gap = average - overall;
    if (gap <= -0.45) return '강점'; if (gap <= 0.2) return '유지 권장'; if (gap <= 0.6) return '조금 더 올리면 좋아요'; if (gap <= 1) return '향상 필요'; return '우선 관리 권장';
  };
  $('#subject-summary').innerHTML = summary.length ? summary.map(({ subjectGroup, average }) => `<div class="subject-card"><span>${escapeHtml(subjectGroup)}</span><strong>${fmt(average)}</strong><small>${advice(average)}</small></div>`).join('') : '<div class="empty-state">내신 계산 후 교과별 분석이 표시돼요.</div>';
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
  closeDepartmentSuggestions();
  admissionViewMode = normalized;
  Object.assign(admissionFilters, { region: '', ownership: '', university: '', field: '', department: '', admissionName: '' });
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
function renderDepartmentSuggestions(suggestions = []) {
  const input = $('#admission-department');
  const list = $('#admission-department-suggestions');
  if (!input || !list) return;
  list.innerHTML = suggestions.map(({ department }) => `<button type="button" role="option" data-department-suggestion="${escapeHtml(department)}">${escapeHtml(department)}</button>`).join('');
  if (!suggestions.length) isDepartmentSuggestionsOpen = false;
  const visible = Boolean(admissionViewMode && isDepartmentSuggestionsOpen && admissionFilters.department && suggestions.length);
  list.hidden = !visible;
  input.setAttribute('aria-expanded', String(visible));
}
function closeDepartmentSuggestions() {
  isDepartmentSuggestionsOpen = false;
  const input = $('#admission-department');
  const list = $('#admission-department-suggestions');
  input?.setAttribute('aria-expanded', 'false');
  if (list) list.hidden = true;
}
function openDepartmentSuggestions() {
  const options = getAdmissionViewFilterOptions(admissionReferenceData, { admissionViewMode, filters: admissionFilters });
  isDepartmentSuggestionsOpen = Boolean(admissionViewMode && admissionFilters.department && options.departmentSuggestions.length);
  renderDepartmentSuggestions(options.departmentSuggestions);
}
function updateDepartmentSuggestions(input, { open = true } = {}) {
  admissionFilters.department = input.value.trim();
  const options = getAdmissionViewFilterOptions(admissionReferenceData, { admissionViewMode, filters: admissionFilters });
  if (open) isDepartmentSuggestionsOpen = Boolean(admissionViewMode && admissionFilters.department && options.departmentSuggestions.length);
  renderDepartmentSuggestions(options.departmentSuggestions);
}
function scrollAdmissionResultsIntoView() {
  clearTimeout(departmentResultScrollTimer);
  departmentResultScrollTimer = window.setTimeout(() => {
    departmentResultScrollTimer = null;
    $('#admission-reference-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}
async function commitDepartmentSearch(input, { dismissKeyboard = false, revealResults = false } = {}) {
  clearTimeout(departmentSearchTimer);
  departmentSearchTimer = null;
  updateDepartmentSuggestions(input, { open: false });
  closeDepartmentSuggestions();
  if (dismissKeyboard) input.blur();
  resetAdmissionViewPaging();
  await ensureAdmissionData({ allWhenUnscoped: true });
  renderAdmissionReferences();
  if (revealResults) scrollAdmissionResultsIntoView();
}
function scheduleDepartmentSearchRender() {
  clearTimeout(departmentSearchTimer);
  departmentSearchTimer = window.setTimeout(() => {
    departmentSearchTimer = null;
    renderAdmissionReferences();
  }, DEPARTMENT_SEARCH_DEBOUNCE_MS);
}
function renderAdmissionFilterOptions() {
  const options = getAdmissionViewFilterOptions(admissionReferenceData, { admissionViewMode, filters: admissionFilters });
  const configurations = [
    ['region', 'admission-region', options.regions, '전체 지역'],
    ['ownership', 'admission-ownership', options.ownershipTypes, '전체', ADMISSION_OWNERSHIP_LABELS],
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
  departmentInput.value = admissionFilters.department;
  departmentInput.disabled = !admissionViewMode;
  renderDepartmentSuggestions(options.departmentSuggestions);
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
  const differenceLine = comprehensive ? '<p class="admission-difference">학생부종합 전형은 전년도 등록자 내신 참고로만 제공해요.</p>' : `<p class="admission-difference">차이 <b>${difference >= 0 ? '+' : ''}${fmt(difference)}</b><span>${describeAdmissionDifference(difference)}</span></p>`;
  const currentLine = !comparable ? '' : `<span class="admission-score-current">${comparison.label} <b>${fmt(comparison.value)}</b></span>`;
  const availabilityLine = item.dataAvailability === 'cut70-only' ? '<small>공식 70% cut만 공개</small>' : item.dataAvailability === 'average-only' ? '<small>공식 평균등급 참고</small>' : '';
  const localComparisonButton = canCompareWithBusanAdmissions(item)
    ? `<button type="button" class="quiet-button local-admission-compare-button" data-local-admission-compare="${escapeHtml(key)}" aria-expanded="false">부산 대학으로 치면?</button>`
    : '';
  const localComparisonPanel = localComparisonButton
    ? `<div class="local-admission-comparison-panel" data-local-admission-comparison-panel="${escapeHtml(key)}" hidden></div>`
    : '';
  return `<article class="admission-card admission-department-card"><div class="admission-card-heading"><div><strong>${escapeHtml(item.department)}</strong></div></div><p class="admission-type">${escapeHtml(item.admissionCategory)} · ${escapeHtml(item.admissionName)}</p><div class="admission-scores">${scoreLine}${currentLine}${availabilityLine}</div>${differenceLine}<div class="admission-card-actions"><button type="button" class="quiet-button admission-save${saved ? ' is-saved' : ''}" data-admission-save="${escapeHtml(key)}" aria-pressed="${saved}">${saved ? '관심 저장 해제' : '관심 대학 저장'}</button>${localComparisonButton}</div>${localComparisonPanel}${renderAdmissionCardSupplement(item)}</article>`;
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
  const resultLayoutClass = group.resultCount === 1 ? ' is-single' : '';
  return `<details class="admission-university" data-admission-university-accordion data-admission-university-key="${escapeHtml(disclosureKey)}"${isOpen ? ' open' : ''}><summary aria-expanded="${isOpen}"><div class="admission-university-title"><strong>${escapeHtml(group.universityName)}</strong><span>${group.resultCount}개 모집단위</span></div><div class="admission-university-meta">${closestText}${similarText}</div></summary><div class="admission-university-content"><div class="admission-university-results${resultLayoutClass}">${visibleResults.map((entry) => admissionResultCardWithinUniversity(entry, comparison, groupKey)).join('')}</div>${remainingCount ? `<button class="quiet-button admission-university-more" data-admission-university-load-more="${escapeHtml(disclosureKey)}">이 대학 모집단위 더 보기 (${remainingCount}개)</button>` : ''}</div></details>`;
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
  const expandedContent = isExpanded
    ? `<div class="admission-university-list">${visibleUniversities.map((group) => renderAdmissionUniversityAccordion(group, comparison, key)).join('')}</div>${remainingUniversities ? `<button class="quiet-button admission-university-group-more" data-admission-university-group-load-more="${escapeHtml(key)}">대학 더 보기 (${remainingUniversities}곳)</button>` : ''}`
    : '';
  return `<details class="admission-result-group admission-result-group-${escapeHtml(key)}" data-admission-result-group-key="${escapeHtml(key)}"${isExpanded ? ' open' : ''}><summary class="admission-result-group-heading" aria-expanded="${isExpanded}"><div><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div><span>${groupView.totalCount}개</span></summary>${expandedContent}</details>`;
}
function admissionInterestComparisonDifference(value) {
  if (!Number.isFinite(value)) return '<span class="muted">-</span>';
  return `<strong class="interest-compare-difference">${value > 0 ? '+' : ''}${fmt(value)}</strong>`;
}

function admissionInterestComparisonValue(value, suffix = '') {
  return Number.isFinite(Number(value)) ? `${fmt(Number(value))}${suffix}` : '<span class="muted">미공개</span>';
}

function renderAdmissionInterestComparisonTable(items, type) {
  if (!items.length) return '';
  const hasAverage = items.some((item) => Number.isFinite(item.averageGradeOriginal) || Number.isFinite(item.averageGradeConverted));
  const row = (label, renderValue, className = '') => ({ label, renderValue, className });
  const commonRows = [
    row('모집단위', (item) => `<strong>${escapeHtml(item.department)}</strong>`, 'is-key-row'),
    row('전형명', (item) => `<strong>${escapeHtml(item.admissionName)}</strong>`, 'is-key-row'),
    row('지역', (item) => escapeHtml(item.region ?? '-')),
    row('설립유형', (item) => escapeHtml(item.ownershipLabel ?? '-')),
    row('기준학년도', (item) => `${escapeHtml(item.referenceYear)}학년도`),
  ];
  const differenceRows = [
    row('현재 내신과 차이', (item) => `${admissionInterestComparisonDifference(item.currentDifference)}<small>${escapeHtml(item.primaryReference.label)}</small>`, 'is-key-row'),
    row('목표 내신과 차이', (item) => `${admissionInterestComparisonDifference(item.targetDifference)}<small>${escapeHtml(item.primaryReference.label)}</small>`, 'is-key-row'),
  ];
  const dataRows = type === 'subject'
    ? [
        row('9등급 원본 50% cut', (item) => admissionInterestComparisonValue(item.cut50Original)),
        row('9등급 원본 70% cut', (item) => admissionInterestComparisonValue(item.cut70Original)),
        row('5등급 환산 50% cut', (item) => admissionInterestComparisonValue(item.cut50Converted), 'is-key-row'),
        row('5등급 환산 70% cut', (item) => admissionInterestComparisonValue(item.cut70Converted), 'is-key-row'),
        ...(hasAverage ? [
          row('평균등급 원본', (item) => admissionInterestComparisonValue(item.averageGradeOriginal)),
          row('평균등급 환산 참고', (item) => admissionInterestComparisonValue(item.averageGradeConverted), 'is-key-row'),
        ] : []),
      ]
      : [
        row('공개 자료 유형', (item) => escapeHtml(item.primaryReference.label)),
        row('9등급 원본값', (item) => admissionInterestComparisonValue(item.primaryReference.original)),
        row('5등급 환산 참고값', (item) => admissionInterestComparisonValue(item.primaryReference.converted), 'is-key-row'),
      ];
  const rows = [...commonRows, ...dataRows, ...differenceRows];
  const title = type === 'subject' ? '관심 대학 학생부교과 비교' : '관심 대학 학생부종합 참고 비교';
  const note = type === 'comprehensive'
    ? '<p class="interest-compare-note">학생부종합전형은 내신 외 다양한 요소를 함께 평가하므로 아래 값은 전년도 등록자 내신 참고자료예요.</p>'
    : '<p class="interest-compare-note">공개된 전년도 입시결과와 5등급 환산 참고값을 나란히 보여줘요. 미공개 값은 추정하지 않아요.</p>';
  const desktopRows = rows.map(({ label, renderValue, className }) => `<tr class="${className}"><th scope="row">${escapeHtml(label)}</th>${items.map((item) => `<td>${renderValue(item)}</td>`).join('')}</tr>`).join('');
  const mobileRows = rows.map(({ label, renderValue, className }) => `<section class="interest-compare-mobile-row ${className}"><h5>${escapeHtml(label)}</h5><div class="interest-compare-mobile-values">${items.map((item, index) => `<div class="interest-compare-mobile-value"><span class="interest-compare-mobile-university"><b aria-hidden="true">${String.fromCharCode(65 + index)}</b>${escapeHtml(item.universityName)}</span><div>${renderValue(item)}</div></div>`).join('')}</div></section>`).join('');
  return `<section class="interest-compare-section" data-interest-compare-section="${type}"><h4>${title}</h4><div class="interest-compare-table-scroll"><table class="interest-compare-table"><thead><tr><th scope="col">비교 항목</th>${items.map((item) => `<th scope="col">${escapeHtml(item.universityName)}</th>`).join('')}</tr></thead><tbody>${desktopRows}</tbody></table></div><div class="interest-compare-mobile" aria-label="${escapeHtml(title)}">${mobileRows}</div>${note}</section>`;
}

function renderAdmissionInterestComparison() {
  const selectedItems = state.admissionInterests.filter((item) => admissionInterestComparisonSelection.has(admissionInterestKey(item)));
  if (selectedItems.length < MIN_ADMISSION_INTEREST_COMPARISONS) return '<p class="muted interest-compare-empty">비교할 항목을 2개 이상 선택해 주세요.</p>';
  const currentGrade = state.calculated ? calculateOverallAverage(effectiveRecords(), state.weighted) : null;
  const targetGrade = validAverageInput(Number(state.targetAverage)) ? Number(state.targetAverage) : null;
  const comparison = buildAdmissionInterestComparison(selectedItems, { currentGrade, targetGrade });
  const mixedNotice = comparison.mixed ? '<p class="interest-compare-mixed">교과와 종합은 입결 기준이 달라 각각 비교해요.</p>' : '';
  return `${mixedNotice}${renderAdmissionInterestComparisonTable(comparison.subject, 'subject')}${renderAdmissionInterestComparisonTable(comparison.comprehensive, 'comprehensive')}`;
}

function renderAdmissionInterests() {
  const container = $('#admission-interests');
  const interests = state.admissionInterests;
  const validSelection = reconcileAdmissionInterestComparisonSelection(interests, admissionInterestComparisonSelection);
  admissionInterestComparisonSelection.clear();
  validSelection.forEach((key) => admissionInterestComparisonSelection.add(key));
  if (interests.length < MIN_ADMISSION_INTEREST_COMPARISONS) admissionInterestComparisonOpen = false;
  if (!interests.length) { container.innerHTML = '<p class="muted">저장한 관심 대학·학과가 없어요.</p>'; return; }

  const savedList = interests.map((item) => `<article class="interest-item"><div><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.department)} · ${escapeHtml(item.admissionName)}</span><small>${escapeHtml(item.referenceYear)}학년도 · ${item.comparisonReferenceType === 'average-grade' ? '평균등급' : item.comparisonReferenceType === 'cut50' ? '50% cut' : '70% cut'} ${fmt(item.cut70 ?? item.cut50 ?? item.averageGradeOriginal)} · ${item.comparisonBasis === 'reference' ? '전년도 등록자 내신 참고' : item.comparisonBasis === 'target' ? '목표 내신' : '현재 내신'}${item.comparisonScore == null ? '' : ` ${fmt(item.comparisonScore)}`}</small></div><button type="button" class="icon-button" data-admission-remove="${escapeHtml(admissionInterestKey(item))}">삭제</button></article>`).join('');
  const compareEntry = interests.length >= MIN_ADMISSION_INTEREST_COMPARISONS
    ? `<div class="interest-compare-entry"><button type="button" class="secondary-button interest-compare-toggle" data-admission-interest-compare-toggle aria-expanded="${admissionInterestComparisonOpen}" aria-controls="admission-interest-comparison">${admissionInterestComparisonOpen ? '비교 닫기' : '관심 대학 비교하기'}</button></div>`
    : '';
  const comparePanel = admissionInterestComparisonOpen
    ? `<section id="admission-interest-comparison" class="interest-compare-panel"><div class="interest-compare-heading"><div><strong>비교할 항목 선택</strong><p>2~3개를 선택해 나란히 비교할 수 있어요.</p></div><span>${admissionInterestComparisonSelection.size}/${MAX_ADMISSION_INTEREST_COMPARISONS}</span></div><div class="interest-compare-choices">${interests.map((item) => {
        const key = admissionInterestKey(item);
        const checked = admissionInterestComparisonSelection.has(key);
        const disabled = !checked && admissionInterestComparisonSelection.size >= MAX_ADMISSION_INTEREST_COMPARISONS;
        return `<label class="${checked ? 'is-selected' : ''}${disabled ? ' is-disabled' : ''}"><input type="checkbox" data-admission-interest-compare-select="${escapeHtml(key)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} /><span><strong>${escapeHtml(item.university)}</strong><small>${escapeHtml(item.department)} · ${escapeHtml(item.admissionName)}</small></span></label>`;
      }).join('')}</div><div class="interest-compare-results">${renderAdmissionInterestComparison()}</div></section>`
    : '';
  container.innerHTML = `<div class="interest-list">${savedList}</div>${compareEntry}${comparePanel}`;
}

function updateAdmissionInterest(key, action = 'toggle') {
  if (!key) return false;
  const resultItem = admissionReferenceData.find((entry) => admissionInterestKey(entry) === key);
  const savedItem = state.admissionInterests.find((entry) => admissionInterestKey(entry) === key);
  const item = resultItem ?? savedItem;
  if (!item) return false;

  if (action === 'remove') {
    state.admissionInterests = state.admissionInterests.filter((interest) => admissionInterestKey(interest) !== key);
    showToast('관심 대학에서 삭제했어요.');
  } else {
    const comparison = isComparableAdmissionRecord(item) ? admissionComparison() : { value: null, basis: 'reference' };
    state.admissionInterests = toggleAdmissionInterest(state.admissionInterests, {
      ...item,
      comparisonScore: comparison.value,
      comparisonBasis: comparison.basis,
    });
    const saved = state.admissionInterests.some((interest) => admissionInterestKey(interest) === key);
    showToast(saved ? '관심 대학에 저장했어요.' : '관심 대학 저장을 해제했어요.');
  }

  saveState();
  renderAdmissionReferences();
  renderPrintReport();
  return true;
}
function admissionEmptyStateMessage() {
  if (!admissionFilters.university) return '선택한 조건에 맞는 참고 자료가 없어요.';
  const universityRecords = admissionReferenceData.filter((item) => item.university === admissionFilters.university);
  if (universityRecords.length) return '공식 입시결과는 확보돼 있지만 현재 선택 조건에 맞는 기본 노출 자료가 없어요.';

  return '현재 공식 입시결과를 확보하지 못했어요.';
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
  $('#admission-view-button').disabled = !admissionViewMode || !state.calculated || !Number.isFinite(comparison.value) || admissionDataStatus === 'loading';
  if (!admissionViewMode) { result.innerHTML = ''; renderAdmissionInterests(); return; }
  if (!state.calculated || !Number.isFinite(comparison.value)) { result.innerHTML = '<div class="empty-state">내신 계산을 완료하면 현재 내신과 전년도 공개 입시결과를 비교할 수 있어요.</div>'; renderAdmissionInterests(); return; }
  if (admissionDataStatus === 'loading' && !admissionReferenceData.length) { result.innerHTML = '<div class="empty-state">입시결과 자료를 불러오는 중이에요.</div>'; renderAdmissionInterests(); return; }
  if (admissionDataStatus === 'error' && !admissionReferenceData.length) { result.innerHTML = '<div class="empty-state">입시결과 자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>'; renderAdmissionInterests(); return; }
  if (!admissionReferenceData.length) { result.innerHTML = '<div class="empty-state">지역이나 대학을 선택하거나 ‘전년도 입시결과 보기’를 눌러 자료를 불러와 주세요.</div>'; renderAdmissionInterests(); return; }
  const view = prepareAdmissionResultView(admissionReferenceData, {
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
      renderAdmissionUniversityGroup({ key: 'comprehensive-similar', title: '등록자 내신 참고값이 비슷한 범위 ±0.2', description: '전년도 등록자 내신 참고용으로만 확인해 주세요.', groupView: referenceGroups?.similar, comparison }),
      renderAdmissionUniversityGroup({ key: 'comprehensive-higher', title: '등록자 내신 참고값이 높은 결과', description: '전년도 등록자 내신 참고용이에요.', groupView: referenceGroups?.higher, comparison }),
      renderAdmissionUniversityGroup({ key: 'comprehensive-lower', title: '등록자 내신 참고값이 낮은 결과', description: '전년도 등록자 내신 참고용이에요.', groupView: referenceGroups?.lower, comparison }),
    );
    const unavailableEntries = (view.comprehensive?.allResults ?? []).filter(({ item }) => ![item.cut70Converted, item.averageGradeConverted, item.cut50Converted].some((value) => value != null && value !== '' && Number.isFinite(Number(value))));
    sections.push(renderAdmissionUniversityGroup({ key: 'comprehensive-unavailable', title: '내신 수치 미공개', description: '전년도 공개 자료에 내신 수치가 없는 모집단위예요.', groupView: createAdmissionUniversityGroupView(unavailableEntries), comparison }));
  }
  const loadWarning = admissionDataError
    ? '<div class="empty-state admission-load-warning" role="alert">일부 지역 입시결과를 불러오지 못했어요. 현재 불러온 자료는 계속 이용할 수 있고, 다시 조회하면 재시도해요.</div>'
    : '';
  const renderedSections = sections.filter(Boolean).join('');
  result.innerHTML = `${loadWarning}${renderedSections || `<div class="empty-state">${escapeHtml(admissionEmptyStateMessage())}</div>`}`;
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
    result.innerHTML = '<p class="muted">내신 계산 후 목표(1.00~5.00)를 입력하면 남은 학기 기준 필요 평균을 계산해요.</p>';
    return;
  }
  const difficulty = describeGoalDifficulty(details.required);
  const actual = details.actual; const remaining = details.remaining;
  const actualCredits = calculateTotalCredits(actual); const remainingCredits = calculateTotalCredits(remaining, false);
  const highest = (actual.reduce((sum, item) => sum + Number(item.gradeValue) * (details.weighted ? Number(item.credit) : 1), 0) + (details.weighted ? remainingCredits : remaining.length)) / (details.weighted ? actualCredits + remainingCredits : actual.length + remaining.length);
  const scenarios = details.required >= 1 && details.required <= 5 ? createGoalScenarioSummaries(actual, remaining, details.required, details.weighted).map(({ name, semesterResults, finalAverage }) => { const rows = semesterResults.map((item) => `<div class="scenario-semester"><span>${escapeHtml(semesterLabel(item.semesterId))}</span><strong>${fmt(item.target)}</strong></div>`).join(''); return `<article class="scenario-card"><h4>${name}</h4><div class="scenario-semesters">${rows}</div><p>예상 최종 내신 <strong>${fmt(finalAverage)}</strong></p></article>`; }).join('') : '';
  const guidance = details.simple ? '<li>간편 입력 결과는 학기 평균 기준 참고값이에요.</li><li>실제 과목별 학점 입력 시 결과가 달라질 수 있어요.</li>' : '<li>상세 입력 과목의 실제 학점 가중치로 계산했어요.</li>';
  const summaryText = details.required >= 1 && details.required <= 5 ? `목표 내신 ${fmt(Number(state.targetAverage))}을 위해 남은 학기 평균 ${fmt(details.required)}가 필요해요.` : difficulty;
  result.innerHTML = `<section class="goal-summary"><span>남은 학기 필요 평균</span><strong>${details.required >= 1 && details.required <= 5 ? `${fmt(details.required)}등급` : '-'}</strong><p>${summaryText}</p>${details.required < 1 || details.required > 5 ? `<small>남은 모든 과목을 1등급으로 가정한 최고 가능 최종 내신: ${fmt(highest)}</small>` : ''}</section>${scenarios ? `<section class="scenario-grid" aria-label="목표 시나리오">${scenarios}</section>` : ''}<aside class="goal-guidance"><strong>안내</strong><ul>${guidance}<li>대학 합격 가능성을 의미하지 않아요.</li></ul></aside>`;
}
function renderPrintReport() {
  const model = buildPrintReportModel(state, { remainingRecords: fallbackRemainingSemesters() });
  $('#print-report').innerHTML = renderPrintReportHtml(model);
}
function renderGradeDerivedViews() {
  renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderPrintReport();
}
function render() {
  renderSemesterCards(); renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderAdmissionReferences(); renderPrintReport();
  $('#target-average').value = state.targetAverage;
  $('#weighted-toggle').checked = Boolean(state.weighted);
  $('#student-id').value = state.student.studentId; $('#student-name').value = state.student.studentName;
  const validStudentId = /^\d{5}$/.test(state.student.studentId);
  const validStudentName = Boolean(state.student.studentName.trim());
  $('#student-info-error').textContent = !validStudentId && state.student.studentId ? '학번은 숫자 5자리로 입력해 주세요.' : '';
  $('#student-info-summary').textContent = validStudentId && validStudentName ? `학번 ${state.student.studentId} · ${state.student.studentName}` : '';
}

const semesterCards = $('#semester-cards');
semesterCards.addEventListener('click', (event) => {
  const completeButton = event.target.closest('[data-semester-complete]');
  if (completeButton) {
    completeSemesterInput(completeButton.dataset.semesterComplete);
    return;
  }
  const toggle = event.target.closest('[data-semester-toggle]');
  if (toggle) {
    const semesterId = toggle.dataset.semesterToggle;
    expandedSemesterId = expandedSemesterId === semesterId ? null : semesterId;
    if (expandedSemesterId) state.activeSemester = expandedSemesterId;
    saveState(); renderSemesterCards();
    return;
  }
  const modeButton = event.target.closest('[data-input-mode][data-semester-id]');
  if (modeButton) {
    const semesterId = modeButton.dataset.semesterId;
    state.activeSemester = semesterId;
    expandedSemesterId = semesterId;
    state.inputModes[semesterId] = modeButton.dataset.inputMode;
    saveState(); renderSemesterCards();
    return;
  }
  const addButton = event.target.closest('[data-add-course]');
  if (addButton) {
    const semesterId = addButton.dataset.addCourse;
    const picker = semesterCards.querySelector(`[data-course-picker="${semesterId}"]`);
    const course = courseById(picker?.value);
    if (!course) { showToast('학교 개설 과목에서 선택해 주세요.', 'error'); return; }
    records().push(recordFromCourse(course, makeId())); state.calculated = false; state.goalCalculated = false; saveState(); render();
    return;
  }
  const deleteButton = event.target.closest('[data-action="delete"]');
  if (!deleteButton) return;
  const row = deleteButton.closest('[data-id]');
  if (!row) return;
  state.actual = records().filter((item) => item.id !== row.dataset.id); state.calculated = false; state.goalCalculated = false;
  saveState(); render();
});
semesterCards.addEventListener('input', (event) => {
  const semesterId = event.target.dataset.quickAverage;
  if (!semesterId) return;
  const value = Number(event.target.value);
  if (event.target.value === '' || !validAverageInput(value)) delete state.quickAverages[semesterId];
  else state.quickAverages[semesterId] = Number(value.toFixed(2));
  state.activeSemester = semesterId;
  state.calculated = false; state.goalCalculated = false; saveState();
  refreshSemesterCardHeader(semesterId); renderGradeDerivedViews();
});
semesterCards.addEventListener('change', (event) => {
  const quickSemesterId = event.target.dataset.quickAverage;
  if (quickSemesterId) {
    if (event.target.value && !validAverageInput(Number(event.target.value))) {
      event.target.value = '';
      delete state.quickAverages[quickSemesterId];
      showToast('학기 평균은 1.00~5.00 범위로 입력해 주세요.', 'error');
    }
    refreshSemesterCardHeader(quickSemesterId); renderGradeDerivedViews();
    return;
  }
  const row = event.target.closest('[data-id]');
  const field = event.target.dataset.field;
  if (!row || !field) return;
  const record = records().find((item) => item.id === row.dataset.id);
  if (!record) return;
  record[field] = event.target.value;
  if (field === 'gradeValue' && event.target.value && (Number(event.target.value) < 1 || Number(event.target.value) > 5)) { record[field] = ''; showToast('등급은 1~5등급만 입력할 수 있어요.', 'error'); }
  state.calculated = false; state.goalCalculated = false; saveState(); renderSemesterCards(); renderGradeDerivedViews();
});
$('#calculate-button').addEventListener('click', () => { state.calculated = true; state.goalCalculated = false; resetAdmissionViewPaging(); saveState(); renderSemesterCards(); renderGradeDerivedViews(); showToast(`내신 계산을 완료했어요. 아직 등급을 입력하지 않은 과목은 ${gradeInputRows().length - validRows().length}개예요.`); });
$('#goal-calculate-button').addEventListener('click', () => { state.goalCalculated = true; resetAdmissionViewPaging(); saveState(); renderGoal(); renderPrintReport(); });
$('#target-average').addEventListener('input', (event) => { state.targetAverage = event.target.value; state.goalCalculated = false; resetAdmissionViewPaging(); saveState(); renderGoal(); renderPrintReport(); });
$('#weighted-toggle').addEventListener('change', (event) => { state.weighted = event.target.checked; state.calculated = false; state.goalCalculated = false; saveState(); renderCurrentGradeResult(); renderSemesterSummary(); renderGradePosition(); renderSubjectSummary(); renderGoal(); renderPrintReport(); });
document.querySelector('#admission-filters').addEventListener('change', async (event) => {
  const map = { 'admission-region': 'region', 'admission-ownership': 'ownership', 'admission-university': 'university', 'admission-field': 'field', 'admission-department': 'department', 'admission-name': 'admissionName' };
  const key = map[event.target.id];
  if (!key) return;
  if (key === 'department') {
    clearTimeout(departmentSearchTimer);
    admissionFilters.department = event.target.value.trim();
    closeDepartmentSuggestions();
    resetAdmissionViewPaging();
    renderAdmissionReferences();
    return;
  }
  closeDepartmentSuggestions();
  admissionFilters[key] = event.target.value;
  resetAdmissionViewPaging();
  renderAdmissionReferences();
  if (key === 'region' || key === 'university') await ensureAdmissionData();
  Object.assign(admissionFilters, reconcileAdmissionViewFilters(admissionReferenceData, { admissionViewMode, filters: admissionFilters }));
  renderAdmissionReferences();
});
$('#admission-department').addEventListener('input', (event) => {
  updateDepartmentSuggestions(event.target);
  resetAdmissionViewPaging();
  if (event.isComposing || isDepartmentSearchComposing) return;
  scheduleDepartmentSearchRender();
});
$('#admission-department').addEventListener('compositionstart', () => {
  isDepartmentSearchComposing = true;
  pendingDepartmentSearchCommit = false;
});
$('#admission-department').addEventListener('compositionupdate', (event) => {
  window.requestAnimationFrame(() => updateDepartmentSuggestions(event.target));
});
$('#admission-department').addEventListener('compositionend', (event) => {
  isDepartmentSearchComposing = false;
  updateDepartmentSuggestions(event.target);
  resetAdmissionViewPaging();
  if (pendingDepartmentSearchCommit) {
    pendingDepartmentSearchCommit = false;
    commitDepartmentSearch(event.target, { dismissKeyboard: true, revealResults: true });
    return;
  }
  scheduleDepartmentSearchRender();
});
$('#admission-department').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDepartmentSuggestions();
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  ignoreNativeDepartmentSearchUntil = Date.now() + 500;
  if (event.isComposing || isDepartmentSearchComposing || event.keyCode === 229) {
    pendingDepartmentSearchCommit = true;
    return;
  }
  commitDepartmentSearch(event.target, { dismissKeyboard: true, revealResults: true });
});
$('#admission-department').addEventListener('search', (event) => {
  if (Date.now() < ignoreNativeDepartmentSearchUntil) return;
  commitDepartmentSearch(event.target, { dismissKeyboard: true, revealResults: true });
});
$('#admission-department').addEventListener('focus', () => {
  clearTimeout(departmentResultScrollTimer);
  departmentResultScrollTimer = null;
  openDepartmentSuggestions();
});
$('#admission-department').addEventListener('click', openDepartmentSuggestions);
$('#admission-department-suggestions').addEventListener('pointerdown', (event) => {
  if (event.target.closest('[data-department-suggestion]')) event.preventDefault();
});
$('#admission-department-suggestions').addEventListener('click', (event) => {
  const option = event.target.closest('[data-department-suggestion]');
  if (!option) return;
  admissionFilters.department = option.dataset.departmentSuggestion.trim();
  $('#admission-department').value = admissionFilters.department;
  clearTimeout(departmentSearchTimer);
  departmentSearchTimer = null;
  closeDepartmentSuggestions();
  resetAdmissionViewPaging();
  renderAdmissionReferences();
});
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.admission-department-field')) return;
  closeDepartmentSuggestions();
});
$('#admission-view-button').addEventListener('click', async () => {
  closeDepartmentSuggestions();
  await ensureAdmissionData({ allWhenUnscoped: true });
  renderAdmissionReferences();
  scrollAdmissionResultsIntoView();
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
  const disclosure = event.target.matches?.('[data-admission-university-accordion]') ? event.target : null;
  if (!disclosure) return;
  const key = disclosure.dataset.admissionUniversityKey;
  if (!key) return;
  if (disclosure.open) admissionOpenUniversityKeys.add(key);
  else admissionOpenUniversityKeys.delete(key);
  disclosure.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(disclosure.open));
}, true);
$('#admission-reference-result').addEventListener('click', async (event) => {
  const saveButton = event.target.closest('[data-admission-save]');
  if (saveButton) {
    event.preventDefault();
    event.stopPropagation();
    updateAdmissionInterest(saveButton.dataset.admissionSave);
    return;
  }
  const localComparisonButton = event.target.closest('[data-local-admission-compare]');
  if (localComparisonButton) {
    event.preventDefault();
    event.stopPropagation();
    const key = localComparisonButton.dataset.localAdmissionCompare;
    const panel = localComparisonButton.closest('.admission-card')?.querySelector('[data-local-admission-comparison-panel]');
    const item = admissionReferenceData.find((entry) => admissionInterestKey(entry) === key);
    if (!panel || !item) return;
    const isExpanded = localComparisonButton.getAttribute('aria-expanded') !== 'true';
    localComparisonButton.setAttribute('aria-expanded', String(isExpanded));
    localComparisonButton.textContent = isExpanded ? '접기' : '부산 대학으로 치면?';
    panel.hidden = !isExpanded;
    if (isExpanded) {
      panel.innerHTML = '<p class="muted">부산권 입시결과를 불러오는 중이에요.</p>';
      try {
        await loadAdmissionRegion('busan');
        panel.innerHTML = renderLocalAdmissionComparison(findLocalAdmissionComparisons(item, admissionReferenceData));
      } catch {
        panel.innerHTML = '<p class="muted">부산권 입시결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>';
      }
    }
    return;
  }
  const cardDetailsToggle = event.target.closest('[data-admission-card-details-toggle]');
  if (cardDetailsToggle) {
    event.preventDefault();
    event.stopPropagation();
    const details = cardDetailsToggle.closest('.admission-card-details');
    const body = details?.querySelector('.admission-card-details-body');
    const icon = cardDetailsToggle.querySelector('.admission-card-details-icon');
    if (!details || !body) return;
    const isExpanded = cardDetailsToggle.getAttribute('aria-expanded') !== 'true';
    cardDetailsToggle.setAttribute('aria-expanded', String(isExpanded));
    body.hidden = !isExpanded;
    if (icon) icon.textContent = isExpanded ? '▼' : '▶';
    return;
  }
  const resultGroupSummary = event.target.closest('.admission-result-group > summary');
  if (resultGroupSummary) {
    event.preventDefault();
    event.stopPropagation();
    const disclosure = resultGroupSummary.parentElement;
    const key = disclosure?.dataset.admissionResultGroupKey;
    if (!disclosure || !key) return;
    admissionResultGroupExpanded.toggle(key);
    renderAdmissionReferences();
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
$('#admission-interests').addEventListener('click', (event) => {
  const compareToggle = event.target.closest('[data-admission-interest-compare-toggle]');
  if (compareToggle) {
    event.preventDefault();
    admissionInterestComparisonOpen = !admissionInterestComparisonOpen;
    if (admissionInterestComparisonOpen && admissionInterestComparisonSelection.size < MIN_ADMISSION_INTEREST_COMPARISONS) {
      state.admissionInterests.slice(0, MIN_ADMISSION_INTEREST_COMPARISONS).forEach((item) => admissionInterestComparisonSelection.add(admissionInterestKey(item)));
    }
    renderAdmissionInterests();
    return;
  }
  const removeButton = event.target.closest('[data-admission-remove]');
  if (!removeButton) return;
  event.preventDefault();
  updateAdmissionInterest(removeButton.dataset.admissionRemove, 'remove');
});
$('#admission-interests').addEventListener('change', (event) => {
  const comparisonChoice = event.target.closest('[data-admission-interest-compare-select]');
  if (!comparisonChoice) return;
  const key = comparisonChoice.dataset.admissionInterestCompareSelect;
  if (comparisonChoice.checked && admissionInterestComparisonSelection.size >= MAX_ADMISSION_INTEREST_COMPARISONS) {
    comparisonChoice.checked = false;
    showToast('관심 대학은 최대 3개까지 비교할 수 있어요.', 'error');
    return;
  }
  if (comparisonChoice.checked) admissionInterestComparisonSelection.add(key);
  else admissionInterestComparisonSelection.delete(key);
  renderAdmissionInterests();
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
});
$('#export-button').addEventListener('click', () => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const blob = new Blob([JSON.stringify(createStudentBackup({ ...state, admissionUi: collectStudentBackupUiState() }), null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `naesin-simulator-backup-${stamp}.json`; link.click(); URL.revokeObjectURL(link.href);
  showToast('백업 파일을 내려받았어요.');
});
$('#import-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const imported = parseStudentBackup(await file.text());
    if (hasCurrentStudentInput() && !confirm('현재 입력 내용이 백업 파일의 내용으로 바뀌어요. 불러올까요?')) {
      event.target.value = '';
      return;
    }
    state = normalizeState(imported);
    expandedSemesterId = state.activeSemester;
    await restoreStudentBackupUiState(imported.admissionUi);
    render(); showToast('백업 데이터를 불러왔어요.');
  } catch (error) { console.error(error); showToast(error instanceof Error ? error.message : '백업 파일 형식을 확인해 주세요.', 'error'); }
  event.target.value = '';
});
$('#reset-button').addEventListener('click', () => {
  if (!confirm('입력한 학생 데이터와 성적을 초기화할까요?')) return;
  state = defaultState();
  expandedSemesterId = state.activeSemester;
  admissionViewMode = null;
  admissionFilters.region = '';
  admissionFilters.ownership = '';
  admissionFilters.university = '';
  admissionFilters.field = '';
  admissionFilters.department = '';
  admissionFilters.admissionName = '';
  admissionInterestComparisonOpen = false;
  admissionInterestComparisonSelection.clear();
  closeDepartmentSuggestions();
  resetAdmissionViewPaging();
  render();
  showToast('입력한 학생 데이터와 성적을 초기화했어요.');
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

applyPublicFeatureVisibility();
ensureAdmissionViewModeControls();
$('#app-version').textContent = `v${APP_VERSION}`;
setupStudentFeedback();
render();

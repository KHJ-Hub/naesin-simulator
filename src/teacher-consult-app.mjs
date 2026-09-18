import { SEMESTERS } from './grade-calculator.mjs';
import { calculateQuickConsultation, createQuickConsultationState } from './quick-consultation.mjs';
import {
  ADMISSION_CONVERSION_NOTICE,
  ADMISSION_REFERENCE_DATA,
  admissionDifference,
  describeAdmissionDifference,
  isComparableAdmissionRecord,
  isStudentRecordComprehensive,
} from './admission-reference.mjs';
import { getAdmissionPrimaryReference } from './admission-card-summary.mjs';
import { renderAdmissionCardSupplement } from './admission-card-details.mjs';
import {
  canCompareWithBusanAdmissions,
  findLocalAdmissionComparisons,
  renderLocalAdmissionComparison,
} from './admission-local-comparison.mjs';
import { ADMISSION_ACADEMIC_FIELD_LABELS, ADMISSION_OWNERSHIP_LABELS } from './admission-filter-options.mjs';
import {
  ADMISSION_SUBJECT_GROUPS,
  ADMISSION_VIEW_MODES,
  getAdmissionViewFilterOptions,
  groupResultsByUniversity,
  prepareAdmissionResultView,
  reconcileAdmissionViewFilters,
  resetAdmissionGroupLimits,
} from './admission-result-view.mjs';
import { admissionInterestKey, toggleAdmissionInterest } from './admission-reference-store.mjs';
import {
  ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT,
  ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT,
} from './admission-accordion-state.mjs';
import { buildQuickConsultPrintModel, renderPrintReport } from './print-report.mjs';
import { getSchoolSettings } from './school-settings.mjs';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const fmt = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
const schoolSettings = getSchoolSettings(localStorage);

let state = createQuickConsultationState();
let consultationResult = null;
let admissionViewMode = ADMISSION_VIEW_MODES.SUBJECT;
let comparisonBasis = 'current';
let admissionFilters = defaultAdmissionFilters();
let admissionVisibleResultLimits = resetAdmissionGroupLimits();
const openResultGroups = new Set();
const openUniversities = new Set();
const universityGroupLimits = new Map();
const universityResultLimits = new Map();

function defaultAdmissionFilters() {
  return {
    region: '', ownership: '', university: '', field: '', department: '', admissionName: '',
    schoolRegion: schoolSettings.schoolRegion,
    schoolGender: schoolSettings.schoolGender,
  };
}

function resetAdmissionUiState() {
  admissionVisibleResultLimits = resetAdmissionGroupLimits();
  openResultGroups.clear();
  openUniversities.clear();
  universityGroupLimits.clear();
  universityResultLimits.clear();
}

function showToast(message) {
  const toast = $('#consult-toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1900);
}

function inputState() {
  return {
    studentName: $('#consult-student-name').value.trim(),
    studentId: $('#consult-student-id').value.trim(),
    currentAverage: $('#consult-current-grade').value.trim(),
    completedSemesterId: $('#consult-completed-semester').value,
    targetAverage: $('#consult-target-grade').value.trim(),
    semesterAverages: Object.fromEntries([...document.querySelectorAll('[data-consult-semester-average]')]
      .map((input) => [input.dataset.consultSemesterAverage, input.value.trim()])),
  };
}

function updateSemesterAverageAvailability() {
  const completedId = $('#consult-completed-semester').value;
  const completedIndex = SEMESTERS.findIndex((semester) => semester.id === completedId);
  document.querySelectorAll('[data-consult-semester-average]').forEach((input) => {
    const inputIndex = SEMESTERS.findIndex((semester) => semester.id === input.dataset.consultSemesterAverage);
    input.disabled = completedIndex < 0 || inputIndex > completedIndex;
    if (input.disabled) input.value = '';
  });
}

function renderFormErrors(errors = {}) {
  const message = Object.values(errors)[0] ?? '';
  const container = $('#consult-form-error');
  container.textContent = message;
  container.hidden = !message;
}

function renderStatus() {
  const result = consultationResult;
  $('#consult-status-grid').innerHTML = [
    ['현재 내신', fmt(result.currentAverage)],
    ['완료 학기', `${result.completedSemesters.at(-1)?.label ?? '-'}까지`],
    ['남은 학기', `${result.remainingSemesterCount}개`],
    ['목표 내신', fmt(result.targetAverage)],
  ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
}

function scenarioCard(scenario) {
  const rows = scenario.semesterResults.map((semester) => `<li><span>${escapeHtml(semester.label)}</span><strong>${fmt(semester.target)}</strong></li>`).join('');
  return `<article class="consult-scenario-card"><h3>${escapeHtml(scenario.name)}</h3><ul>${rows}</ul><p>예상 최종 내신 <strong>${fmt(scenario.finalAverage)}</strong></p></article>`;
}

function renderGoal() {
  const result = consultationResult;
  if (!result.remainingSemesterCount) {
    $('#consult-goal-result').innerHTML = `<div class="consult-goal-summary"><span>남은 학기 없음</span><strong>${result.achievable ? '현재 내신과 목표가 같습니다.' : '완료 학기 이후 추가 시뮬레이션을 만들 수 없습니다.'}</strong></div>`;
    return;
  }
  if (!result.achievable) {
    $('#consult-goal-result').innerHTML = `<div class="consult-goal-summary is-warning"><span>목표 달성 어려움</span><strong>남은 모든 학기를 1.00으로 가정한 최고 도달 참고값 ${fmt(result.highestReachableAverage)}</strong></div>`;
    return;
  }
  $('#consult-goal-result').innerHTML = `<div class="consult-goal-summary"><span>남은 학기 필요 평균</span><strong>${fmt(result.requiredAverage)}</strong></div><div class="consult-scenario-grid">${result.scenarios.map(scenarioCard).join('')}</div>`;
}

function admissionOptions(values, placeholder, labels = {}) {
  return `<option value="">${escapeHtml(placeholder)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labels[value] ?? value)}</option>`).join('')}`;
}

function renderAdmissionFilterOptions() {
  const options = getAdmissionViewFilterOptions(ADMISSION_REFERENCE_DATA, { admissionViewMode, filters: admissionFilters });
  const configurations = [
    ['region', '#consult-admission-region', options.regions, '전체 지역'],
    ['ownership', '#consult-admission-ownership', options.ownershipTypes, '전체', ADMISSION_OWNERSHIP_LABELS],
    ['university', '#consult-admission-university', options.universities, '전체 대학'],
    ['field', '#consult-admission-field', options.academicFields, '전체 계열', ADMISSION_ACADEMIC_FIELD_LABELS],
    ['admissionName', '#consult-admission-name', options.admissionNames, '전체 전형명'],
  ];
  configurations.forEach(([key, selector, values, placeholder, labels]) => {
    const select = $(selector);
    select.innerHTML = admissionOptions(values, placeholder, labels);
    select.value = admissionFilters[key];
  });
  $('#consult-admission-department').value = admissionFilters.department;
  $('#consult-department-suggestions').innerHTML = options.departmentSuggestions
    .map(({ department }) => `<option value="${escapeHtml(department)}"></option>`).join('');
}

function comparison() {
  return comparisonBasis === 'target'
    ? { value: consultationResult.targetAverage, label: '목표 내신', basis: 'target' }
    : { value: consultationResult.currentAverage, label: '현재 내신', basis: 'current' };
}

function entryReferenceGrade(entry) {
  const reference = getAdmissionPrimaryReference(entry.item);
  return reference.converted;
}

function universityDisclosureKey(groupKey, group) {
  return `${groupKey}:${group.universityId ?? group.universityName}`;
}

function admissionScoreLine(item) {
  const reference = getAdmissionPrimaryReference(item);
  return `<span class="admission-score-cut">${escapeHtml(reference.label)}<span>5등급제 환산 참고 <b>${fmt(reference.converted)}</b></span><small>원본 9등급제 ${fmt(reference.original)}</small></span>`;
}

function admissionCard(entry, compare) {
  const item = entry.item;
  const comprehensive = isStudentRecordComprehensive(item);
  const key = admissionInterestKey(item);
  const saved = state.admissionInterests.some((interest) => admissionInterestKey(interest) === key);
  const difference = comprehensive || !isComparableAdmissionRecord(item) ? null : admissionDifference(compare.value, item.cut70Converted);
  const differenceDescription = difference === null ? '' : describeAdmissionDifference(difference).replace('현재 내신', compare.label);
  const differenceLine = comprehensive
    ? '<p class="admission-difference">전년도 등록자 내신 참고용 자료입니다.</p>'
    : `<p class="admission-difference">차이 <b>${difference >= 0 ? '+' : ''}${fmt(difference)}</b><span>${escapeHtml(differenceDescription)}</span></p>`;
  const localComparisonButton = canCompareWithBusanAdmissions(item)
    ? `<button type="button" class="quiet-button local-admission-compare-button" data-consult-local-admission-compare="${escapeHtml(key)}" aria-expanded="false">부산 대학으로 치면?</button>`
    : '';
  const localComparisonPanel = localComparisonButton
    ? `<div class="local-admission-comparison-panel" data-local-admission-comparison-panel="${escapeHtml(key)}" hidden></div>`
    : '';
  return `<article class="admission-card admission-department-card"><div class="admission-card-heading"><div><strong>${escapeHtml(item.department)}</strong></div></div><p class="admission-type">${escapeHtml(item.admissionCategory)} · ${escapeHtml(item.admissionName)}</p><div class="admission-scores">${admissionScoreLine(item)}${comprehensive ? '' : `<span class="admission-score-current">${escapeHtml(compare.label)} <b>${fmt(compare.value)}</b></span>`}</div>${differenceLine}<div class="admission-card-actions"><button type="button" class="quiet-button admission-save${saved ? ' is-saved' : ''}" data-consult-admission-save="${escapeHtml(key)}" aria-pressed="${saved}">${saved ? '관심 저장 해제' : '관심 대학 저장'}</button>${localComparisonButton}</div>${localComparisonPanel}${renderAdmissionCardSupplement(item)}</article>`;
}

function universityAccordion(group, compare, groupKey) {
  const key = universityDisclosureKey(groupKey, group);
  const limit = universityResultLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT;
  const visible = group.results.slice(0, limit);
  const remaining = Math.max(0, group.results.length - visible.length);
  const open = openUniversities.has(key);
  return `<details class="admission-university" data-consult-university-key="${escapeHtml(key)}"${open ? ' open' : ''}><summary aria-expanded="${open}"><div class="admission-university-title"><strong>${escapeHtml(group.universityName)}</strong><span>${group.resultCount}개 모집단위</span></div></summary><div class="admission-university-content"><div class="admission-university-results${group.resultCount === 1 ? ' is-single' : ''}">${visible.map((entry) => admissionCard(entry, compare)).join('')}</div>${remaining ? `<button type="button" class="quiet-button admission-university-more" data-consult-university-more="${escapeHtml(key)}">이 대학 모집단위 더 보기 (${remaining}개)</button>` : ''}</div></details>`;
}

function resultGroup({ key, title, description = '', view, compare }) {
  if (!view?.universityGroups?.length) return '';
  const limit = universityGroupLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT;
  const visible = view.universityGroups.slice(0, limit);
  const remaining = Math.max(0, view.universityGroups.length - visible.length);
  const open = openResultGroups.has(key);
  return `<details class="admission-result-group" data-consult-result-group="${escapeHtml(key)}"${open ? ' open' : ''}><summary class="admission-result-group-heading" aria-expanded="${open}"><div><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div><span>${view.totalCount}개</span></summary><div class="admission-university-list">${visible.map((group) => universityAccordion(group, compare, key)).join('')}</div>${remaining ? `<button type="button" class="quiet-button admission-university-group-more" data-consult-group-more="${escapeHtml(key)}">대학 더 보기 (${remaining}곳)</button>` : ''}</details>`;
}

function groupView(entries) {
  return { totalCount: entries.length, universityGroups: groupResultsByUniversity(entries) };
}

function renderAdmissionResults() {
  renderAdmissionFilterOptions();
  $('#consult-conversion-notice').textContent = ADMISSION_CONVERSION_NOTICE;
  if (!consultationResult) return;
  const compare = comparison();
  const view = prepareAdmissionResultView(ADMISSION_REFERENCE_DATA, {
    admissionViewMode,
    filters: admissionFilters,
    comparisonValue: compare.value,
    comparisonEnabled: true,
    visibleResultLimits: admissionVisibleResultLimits,
  });
  const sections = [];
  if (admissionViewMode === ADMISSION_VIEW_MODES.SUBJECT) {
    sections.push(
      resultGroup({ key: 'similar', title: '내 내신과 비슷한 입결 ±0.2', view: view.subjectGroups.similar, compare }),
      resultGroup({ key: 'higher', title: '내 내신보다 입결이 높은 결과', view: view.subjectGroups.higher, compare }),
      resultGroup({ key: 'lower', title: '내 내신보다 입결이 낮은 결과', view: view.subjectGroups.lower, compare }),
    );
  } else {
    const groups = view.comprehensiveReferenceGroups;
    sections.push(
      resultGroup({ key: 'comprehensive-similar', title: '등록자 내신 참고값이 비슷한 범위 ±0.2', description: '전년도 등록자 내신 참고용입니다.', view: groups.similar, compare }),
      resultGroup({ key: 'comprehensive-higher', title: '등록자 내신 참고값이 높은 결과', description: '합격 가능성 판단에 사용하지 않습니다.', view: groups.higher, compare }),
      resultGroup({ key: 'comprehensive-lower', title: '등록자 내신 참고값이 낮은 결과', description: '합격 가능성 판단에 사용하지 않습니다.', view: groups.lower, compare }),
    );
    const unavailable = (view.comprehensive?.allResults ?? []).filter((entry) => entryReferenceGrade(entry) == null);
    sections.push(resultGroup({ key: 'comprehensive-unavailable', title: '내신 수치 미공개', description: '공식 자료에 비교 가능한 내신 수치가 없습니다.', view: groupView(unavailable), compare }));
  }
  $('#consult-admission-results').innerHTML = sections.some(Boolean)
    ? `<p class="consult-result-count">선택 조건에 맞는 공식 자료 ${view.totalMatchedResults}건</p>${sections.join('')}`
    : '<div class="empty-state">선택한 조건에 맞는 참고 자료가 없습니다.</div>';
}

function renderInterests() {
  const container = $('#consult-admission-interests');
  if (!state.admissionInterests.length) {
    container.innerHTML = '<p class="muted">저장한 관심 대학·학과가 없습니다.</p>';
    return;
  }
  container.innerHTML = state.admissionInterests.map((item) => `<article class="interest-item"><div><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.department)} · ${escapeHtml(item.admissionName)}</span><small>${item.referenceYear}학년도 · ${item.admissionCategory === '학생부종합' || item.admissionCategory === 'student-record-comprehensive' ? '전년도 등록자 내신 참고' : '교과 입결 비교'}</small></div><button type="button" class="icon-button" data-consult-admission-remove="${escapeHtml(admissionInterestKey(item))}">삭제</button></article>`).join('');
}

function updatePrintReport() {
  if (!consultationResult) {
    $('#print-report').innerHTML = '';
    return;
  }
  const model = buildQuickConsultPrintModel(state, consultationResult);
  $('#print-report').innerHTML = renderPrintReport(model);
}

function updateInterest(key, remove = false) {
  const dataItem = ADMISSION_REFERENCE_DATA.find((item) => admissionInterestKey(item) === key);
  const savedItem = state.admissionInterests.find((item) => admissionInterestKey(item) === key);
  const item = dataItem ?? savedItem;
  if (!item) return;
  if (remove) {
    state.admissionInterests = state.admissionInterests.filter((interest) => admissionInterestKey(interest) !== key);
    showToast('관심 대학에서 삭제했습니다.');
  } else {
    const compare = comparison();
    state.admissionInterests = toggleAdmissionInterest(state.admissionInterests, {
      ...item,
      comparisonScore: isStudentRecordComprehensive(item) ? null : compare.value,
      comparisonBasis: isStudentRecordComprehensive(item) ? 'reference' : compare.basis,
    });
    const saved = state.admissionInterests.some((interest) => admissionInterestKey(interest) === key);
    showToast(saved ? '관심 대학에 저장했습니다.' : '관심 대학 저장을 해제했습니다.');
  }
  renderAdmissionResults();
  renderInterests();
  updatePrintReport();
}

function startConsultation(event) {
  event.preventDefault();
  const input = inputState();
  const result = calculateQuickConsultation(input);
  renderFormErrors(result.errors);
  if (!result.valid) return;
  state = { ...state, ...input, admissionInterests: state.admissionInterests };
  consultationResult = result;
  $('#consult-results').hidden = false;
  $('#consult-print-button').disabled = false;
  resetAdmissionUiState();
  renderStatus();
  renderGoal();
  renderAdmissionResults();
  renderInterests();
  updatePrintReport();
  $('#consult-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetConsultation() {
  if (consultationResult && !window.confirm('현재 상담 내용을 초기화하고 새 상담을 시작할까요?')) return;
  state = createQuickConsultationState();
  consultationResult = null;
  admissionViewMode = ADMISSION_VIEW_MODES.SUBJECT;
  comparisonBasis = 'current';
  admissionFilters = defaultAdmissionFilters();
  resetAdmissionUiState();
  $('#consult-form').reset();
  updateSemesterAverageAvailability();
  renderFormErrors();
  $('#consult-results').hidden = true;
  $('#consult-print-button').disabled = true;
  $('#print-report').innerHTML = '';
  document.querySelector('input[name="consult-admission-mode"][value="student-record-subject"]').checked = true;
  document.querySelector('input[name="consult-comparison-basis"][value="current"]').checked = true;
  $('#consult-student-name').focus();
}

$('#consult-form').addEventListener('submit', startConsultation);
$('#consult-completed-semester').addEventListener('change', updateSemesterAverageAvailability);
$('#consult-student-id').addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 5); });
$('#new-consult-button').addEventListener('click', resetConsultation);
$('#consult-print-button').addEventListener('click', () => { updatePrintReport(); window.print(); });
$('#consult-admission-view-button').addEventListener('click', renderAdmissionResults);

document.querySelectorAll('input[name="consult-admission-mode"]').forEach((input) => input.addEventListener('change', (event) => {
  admissionViewMode = event.target.value;
  admissionFilters = defaultAdmissionFilters();
  resetAdmissionUiState();
  renderAdmissionResults();
}));
document.querySelectorAll('input[name="consult-comparison-basis"]').forEach((input) => input.addEventListener('change', (event) => {
  comparisonBasis = event.target.value;
  resetAdmissionUiState();
  renderAdmissionResults();
  updatePrintReport();
}));

const filterMap = {
  'consult-admission-region': 'region',
  'consult-admission-ownership': 'ownership',
  'consult-admission-university': 'university',
  'consult-admission-field': 'field',
  'consult-admission-name': 'admissionName',
};
Object.entries(filterMap).forEach(([id, key]) => $(`#${id}`).addEventListener('change', (event) => {
  admissionFilters[key] = event.target.value;
  admissionFilters = reconcileAdmissionViewFilters(ADMISSION_REFERENCE_DATA, { admissionViewMode, filters: admissionFilters });
  resetAdmissionUiState();
  renderAdmissionResults();
}));
$('#consult-admission-department').addEventListener('input', (event) => {
  admissionFilters.department = event.target.value.trim();
  resetAdmissionUiState();
  renderAdmissionResults();
});
$('#consult-admission-department').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  admissionFilters.department = event.target.value.trim();
  renderAdmissionResults();
});

document.addEventListener('click', (event) => {
  const save = event.target.closest('[data-consult-admission-save]');
  if (save) { updateInterest(save.dataset.consultAdmissionSave); return; }
  const localComparisonButton = event.target.closest('[data-consult-local-admission-compare]');
  if (localComparisonButton) {
    event.preventDefault();
    event.stopPropagation();
    const key = localComparisonButton.dataset.consultLocalAdmissionCompare;
    const panel = localComparisonButton.closest('.admission-card')?.querySelector('[data-local-admission-comparison-panel]');
    const item = ADMISSION_REFERENCE_DATA.find((entry) => admissionInterestKey(entry) === key);
    if (!panel || !item) return;
    const isExpanded = localComparisonButton.getAttribute('aria-expanded') !== 'true';
    localComparisonButton.setAttribute('aria-expanded', String(isExpanded));
    localComparisonButton.textContent = isExpanded ? '접기' : '부산 대학으로 치면?';
    panel.hidden = !isExpanded;
    if (isExpanded) panel.innerHTML = renderLocalAdmissionComparison(findLocalAdmissionComparisons(item, ADMISSION_REFERENCE_DATA));
    return;
  }
  const remove = event.target.closest('[data-consult-admission-remove]');
  if (remove) { updateInterest(remove.dataset.consultAdmissionRemove, true); return; }
  const groupMore = event.target.closest('[data-consult-group-more]');
  if (groupMore) {
    const key = groupMore.dataset.consultGroupMore;
    universityGroupLimits.set(key, (universityGroupLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT) + 10);
    renderAdmissionResults();
    return;
  }
  const universityMore = event.target.closest('[data-consult-university-more]');
  if (universityMore) {
    const key = universityMore.dataset.consultUniversityMore;
    universityResultLimits.set(key, (universityResultLimits.get(key) ?? ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT) + 5);
    renderAdmissionResults();
    return;
  }
  const detailsToggle = event.target.closest('[data-admission-card-details-toggle]');
  if (detailsToggle) {
    event.preventDefault();
    event.stopPropagation();
    const body = detailsToggle.parentElement.querySelector('.admission-card-details-body');
    const expanded = detailsToggle.getAttribute('aria-expanded') !== 'true';
    detailsToggle.setAttribute('aria-expanded', String(expanded));
    detailsToggle.querySelector('.admission-card-details-icon').textContent = expanded ? '▼' : '▶';
    body.hidden = !expanded;
  }
});

document.addEventListener('toggle', (event) => {
  const group = event.target.closest?.('[data-consult-result-group]');
  if (group === event.target) {
    const key = group.dataset.consultResultGroup;
    group.open ? openResultGroups.add(key) : openResultGroups.delete(key);
    group.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(group.open));
    return;
  }
  const university = event.target.closest?.('[data-consult-university-key]');
  if (university === event.target) {
    const key = university.dataset.consultUniversityKey;
    university.open ? openUniversities.add(key) : openUniversities.delete(key);
    university.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(university.open));
  }
}, true);

updateSemesterAverageAvailability();
renderAdmissionFilterOptions();

import { APP_BUILD_DATE } from './app-version.mjs?v=20260921-service-settings1';
import {
  admissionResultRegions,
  clearAdmissionResultsCache,
  loadAdmissionResultsByRegion,
} from './admission-results-loader.mjs?v=20260921-service-settings1';
import { UNIVERSITIES } from './data/universities.mjs?v=20260921-service-settings1';
import {
  ADMISSION_DASHBOARD_REGION_ORDER,
  ADMISSION_DASHBOARD_STATUSES,
  ADMISSION_DASHBOARD_STATUS_LABELS,
  ADMISSION_DASHBOARD_WARNING_SEVERITY_LABELS,
  buildAdmissionDataDashboard,
  filterAdmissionDashboardUniversities,
  filterAdmissionDashboardWarnings,
  loadAdmissionDashboardDataset,
} from './admission-data-dashboard-core.mjs?v=20260921-service-settings1';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const ownershipLabel = (value) => ({ national: '국립', public: '공립', private: '사립' }[value] ?? '미확인');
const categoryLabel = (value) => value || '미분류';
const valueLabel = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
const UNIVERSITY_PAGE_SIZE = 20;
const WARNING_PAGE_SIZE = 30;
const RECORD_PAGE_SIZE = 15;

const panel = $('[data-teacher-main-view="admissions"]');
const statusElement = $('#admission-dashboard-status');
const errorElement = $('#admission-dashboard-error');
const contentElement = $('#admission-dashboard-content');
const universityList = $('#admission-dashboard-universities');
const warningList = $('#admission-dashboard-warnings');
const filters = { region: '', ownership: '', admissionCategory: '', dataAvailability: '', query: '' };
const detailLimits = new Map();
let dashboard = null;
let failures = [];
let loading = false;
let universityLimit = UNIVERSITY_PAGE_SIZE;
let warningLimit = WARNING_PAGE_SIZE;
let warningSeverity = 'actionable';

function summaryCard(label, value, hint = '') {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</article>`;
}

function renderSummary() {
  const { summary } = dashboard;
  const years = summary.referenceYears.length ? summary.referenceYears.join(', ') : '미확인';
  const updated = summary.latestUpdatedAt || `앱 데이터 빌드 ${APP_BUILD_DATE}`;
  $('#admission-dashboard-summary').innerHTML = [
    summaryCard('전체 대학', `${summary.universityCount}개`),
    summaryCard('전체 입결 레코드', `${summary.recordCount.toLocaleString('ko-KR')}건`),
    summaryCard('학생부교과', `${summary.subjectCount.toLocaleString('ko-KR')}건`),
    summaryCard('학생부종합', `${summary.comprehensiveCount.toLocaleString('ko-KR')}건`),
    summaryCard('기준연도', years),
    summaryCard('최근 데이터 정보', updated, summary.latestUpdatedAt ? '레코드 updatedAt 기준' : '레코드별 업데이트일 미기록'),
  ].join('');
  $('#admission-dashboard-status-summary').innerHTML = ADMISSION_DASHBOARD_STATUSES
    .map((status) => summaryCard(ADMISSION_DASHBOARD_STATUS_LABELS[status], `${summary.statusCounts[status].toLocaleString('ko-KR')}건`))
    .join('');
  $('#admission-dashboard-quality-summary').innerHTML = [
    summaryCard('중요', `${summary.quality.importantCount.toLocaleString('ko-KR')}건`, '우선 확인할 오류'),
    summaryCard('확인 필요', `${summary.quality.reviewCount.toLocaleString('ko-KR')}건`, '관리자 검토 대상'),
    summaryCard('taxonomy 자동 분류', `${summary.quality.academicFieldInfo.inferredByTaxonomy.toLocaleString('ko-KR')}건`, '원본은 비어 있으나 화면 분석에서 정상 분류'),
    summaryCard('계열 분류 불가', `${summary.quality.academicFieldInfo.unclassified.toLocaleString('ko-KR')}건`, '확인 필요에 포함'),
  ].join('');
}

function renderRegions() {
  $('#admission-dashboard-regions').innerHTML = `<div class="admission-dashboard-region-head"><span>지역</span><span>대학</span><span>전체</span><span>교과</span><span>종합</span><span>확인 필요</span></div>${dashboard.regionSummaries.map((item) => `<article><strong>${escapeHtml(item.region)}</strong><span data-label="대학">${item.universityCount}</span><span data-label="전체">${item.recordCount.toLocaleString('ko-KR')}</span><span data-label="교과">${item.subjectCount.toLocaleString('ko-KR')}</span><span data-label="종합">${item.comprehensiveCount.toLocaleString('ko-KR')}</span><span data-label="확인 필요" class="${item.checkNeeded ? 'needs-check' : ''}">${item.checkNeeded.toLocaleString('ko-KR')}</span></article>`).join('')}`;
}

function statusChips(counts) {
  const chips = ADMISSION_DASHBOARD_STATUSES
    .filter((status) => counts[status] > 0)
    .map((status) => `<span>${escapeHtml(ADMISSION_DASHBOARD_STATUS_LABELS[status])} ${counts[status]}</span>`);
  return chips.length ? chips.join('') : '<span>입결 0건</span>';
}

function filteredUniversities() {
  return filterAdmissionDashboardUniversities(dashboard?.universities ?? [], filters);
}

function universityCard(item) {
  return `<details class="admission-dashboard-university" data-admission-dashboard-university="${escapeHtml(item.universityId)}"><summary><div class="admission-dashboard-university-name"><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.region)} · ${escapeHtml(ownershipLabel(item.ownership))}</span></div><div class="admission-dashboard-university-counts"><span>전체 <strong>${item.total}</strong></span><span>교과 ${item.subject}</span><span>종합 ${item.comprehensive}</span><span class="${item.checkNeeded ? 'needs-check' : ''}">확인 필요 ${item.checkNeeded}</span></div><div class="admission-dashboard-status-chips">${statusChips(item.statusCounts)}</div></summary><div class="admission-dashboard-records" aria-live="polite"><p class="muted">펼치면 모집단위별 데이터를 표시합니다.</p></div></details>`;
}

function renderUniversities() {
  const rows = filteredUniversities();
  const visible = rows.slice(0, universityLimit);
  $('#admission-dashboard-university-count').textContent = `${rows.length}개 대학 중 ${visible.length}개 표시`;
  universityList.innerHTML = visible.length ? visible.map(universityCard).join('') : '<p class="empty-state">현재 조건에 맞는 대학 데이터가 없습니다.</p>';
  const more = $('#admission-dashboard-more-universities');
  more.hidden = visible.length >= rows.length;
  more.textContent = `대학 더 보기 (${Math.min(UNIVERSITY_PAGE_SIZE, rows.length - visible.length)}개)`;
}

function recordCard(record) {
  return `<article class="admission-dashboard-record"><div><strong>${escapeHtml(record.department || '모집단위 미확인')}</strong><span>${escapeHtml(record.admissionName || '전형명 미확인')}</span></div><dl><div><dt>전형구분</dt><dd>${escapeHtml(categoryLabel(record.admissionCategory))}</dd></div><div><dt>기준연도</dt><dd>${Number.isInteger(Number(record.referenceYear)) ? Number(record.referenceYear) : '-'}</dd></div><div><dt>상태</dt><dd>${escapeHtml(ADMISSION_DASHBOARD_STATUS_LABELS[record.dataAvailability] ?? record.dataAvailability ?? '미확인')}</dd></div><div><dt>70%컷</dt><dd>${valueLabel(record.cut70Original)}</dd></div><div><dt>50%컷</dt><dd>${valueLabel(record.cut50Original)}</dd></div><div><dt>평균</dt><dd>${valueLabel(record.averageGradeOriginal)}</dd></div></dl></article>`;
}

function renderUniversityRecords(details) {
  const id = details.dataset.admissionDashboardUniversity;
  const item = filteredUniversities().find((row) => row.universityId === id);
  const target = details.querySelector('.admission-dashboard-records');
  if (!item || !target) return;
  const limit = detailLimits.get(id) ?? RECORD_PAGE_SIZE;
  const sorted = [...item.records].sort((a, b) => String(a.department).localeCompare(String(b.department), 'ko')
    || String(a.admissionName).localeCompare(String(b.admissionName), 'ko'));
  const visible = sorted.slice(0, limit);
  target.innerHTML = visible.length
    ? `${visible.map(recordCard).join('')}<button type="button" class="quiet-button admission-dashboard-record-more" data-admission-dashboard-more-records="${escapeHtml(id)}" ${visible.length >= sorted.length ? 'hidden' : ''}>모집단위 더 보기 (${Math.min(RECORD_PAGE_SIZE, sorted.length - visible.length)}개)</button>`
    : '<p class="empty-state">현재 조건에 맞는 입결 레코드가 없습니다.</p>';
}

function renderWarnings() {
  const filtered = filterAdmissionDashboardWarnings(dashboard.warnings, warningSeverity);
  const visible = filtered.slice(0, warningLimit);
  $('#admission-dashboard-warning-count').textContent = `${filtered.length.toLocaleString('ko-KR')}건 중 ${visible.length.toLocaleString('ko-KR')}건 표시`;
  warningList.innerHTML = visible.length ? visible.map((item) => `<article class="is-${escapeHtml(item.severity)}"><div class="admission-dashboard-warning-labels"><span class="admission-dashboard-warning-severity">${escapeHtml(ADMISSION_DASHBOARD_WARNING_SEVERITY_LABELS[item.severity] ?? '확인 필요')}</span><span class="admission-dashboard-warning-type">${escapeHtml(item.type)}</span></div><div><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.department)} · ${escapeHtml(item.admissionName)}</span><p>${escapeHtml(item.description)}</p></div></article>`).join('') : '<p class="empty-state">현재 조건에 해당하는 데이터 품질 경고가 없습니다.</p>';
  const more = $('#admission-dashboard-more-warnings');
  more.hidden = visible.length >= filtered.length;
  more.textContent = `경고 더 보기 (${Math.min(WARNING_PAGE_SIZE, filtered.length - visible.length)}건)`;
}

function renderDashboard() {
  if (!dashboard) return;
  renderSummary();
  renderRegions();
  renderUniversities();
  renderWarnings();
  contentElement.hidden = false;
  const failureText = failures.length ? ` · ${failures.length}개 지역 로딩 실패` : '';
  statusElement.textContent = `전국 ${dashboard.summary.recordCount.toLocaleString('ko-KR')}건을 확인했습니다${failureText}.`;
  errorElement.hidden = failures.length === 0;
  errorElement.textContent = failures.length ? `일부 지역 데이터를 불러오지 못했습니다: ${failures.map((item) => item.regionKey).join(', ')}. 나머지 데이터는 계속 확인할 수 있습니다.` : '';
}

async function loadDashboard({ force = false } = {}) {
  if (loading || (dashboard && !force)) return;
  loading = true;
  contentElement.hidden = true;
  errorElement.hidden = true;
  statusElement.textContent = '지역별 입결 데이터를 불러오는 중입니다.';
  if (force) clearAdmissionResultsCache();
  try {
    const dataset = await loadAdmissionDashboardDataset({ regionKeys: admissionResultRegions, loadRegion: loadAdmissionResultsByRegion });
    failures = dataset.failures;
    dashboard = buildAdmissionDataDashboard(dataset.records, UNIVERSITIES);
    universityLimit = UNIVERSITY_PAGE_SIZE;
    warningLimit = WARNING_PAGE_SIZE;
    warningSeverity = 'actionable';
    $('#admission-dashboard-filter-warning-severity').value = 'actionable';
    detailLimits.clear();
    renderDashboard();
  } catch (error) {
    dashboard = null;
    statusElement.textContent = '입결 데이터 현황을 불러오지 못했습니다.';
    errorElement.hidden = false;
    errorElement.textContent = error?.message ?? '잠시 후 다시 시도해 주세요.';
  } finally {
    loading = false;
  }
}

$('#admission-dashboard-filter-region').innerHTML += ADMISSION_DASHBOARD_REGION_ORDER.map((region) => `<option value="${region}">${region}</option>`).join('');
$('#admission-dashboard-filter-status').innerHTML += ADMISSION_DASHBOARD_STATUSES.map((status) => `<option value="${status}">${ADMISSION_DASHBOARD_STATUS_LABELS[status]}</option>`).join('');

const filterBindings = [
  ['#admission-dashboard-filter-region', 'region', 'change'],
  ['#admission-dashboard-filter-ownership', 'ownership', 'change'],
  ['#admission-dashboard-filter-category', 'admissionCategory', 'change'],
  ['#admission-dashboard-filter-status', 'dataAvailability', 'change'],
  ['#admission-dashboard-filter-query', 'query', 'input'],
];
filterBindings.forEach(([selector, key, eventName]) => $(selector).addEventListener(eventName, (event) => {
  filters[key] = event.target.value;
  universityLimit = UNIVERSITY_PAGE_SIZE;
  detailLimits.clear();
  if (dashboard) renderUniversities();
}));

document.querySelector('[data-teacher-main-tab="admissions"]').addEventListener('click', () => loadDashboard());
$('#admission-dashboard-reload').addEventListener('click', () => loadDashboard({ force: true }));
$('#admission-dashboard-more-universities').addEventListener('click', () => { universityLimit += UNIVERSITY_PAGE_SIZE; renderUniversities(); });
$('#admission-dashboard-more-warnings').addEventListener('click', () => { warningLimit += WARNING_PAGE_SIZE; renderWarnings(); });
$('#admission-dashboard-filter-warning-severity').addEventListener('change', (event) => {
  warningSeverity = event.target.value;
  warningLimit = WARNING_PAGE_SIZE;
  if (dashboard) renderWarnings();
});
universityList.addEventListener('toggle', (event) => {
  const details = event.target.closest('[data-admission-dashboard-university]');
  if (details?.open) renderUniversityRecords(details);
}, true);
universityList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-admission-dashboard-more-records]');
  if (!button) return;
  const id = button.dataset.admissionDashboardMoreRecords;
  detailLimits.set(id, (detailLimits.get(id) ?? RECORD_PAGE_SIZE) + RECORD_PAGE_SIZE);
  renderUniversityRecords(button.closest('[data-admission-dashboard-university]'));
});

if (!panel.hidden) loadDashboard();

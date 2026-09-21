import { APP_BUILD_DATE, APP_VERSION } from './app-version.mjs?v=20260921-service-settings1';
import {
  admissionResultRegions,
  loadAdmissionResultsByRegion,
} from './admission-results-loader.mjs?v=20260921-service-settings1';
import { buildAdmissionDataDashboard, loadAdmissionDashboardDataset } from './admission-data-dashboard-core.mjs?v=20260921-service-settings1';
import { UNIVERSITIES } from './data/universities.mjs?v=20260921-service-settings1';
import { DEFAULT_BUSAN_CONVERSION_DATASET, conversionDataset } from './grade-conversion/grade9-to-grade5.mjs';
import { FEEDBACK_GAS_URL } from './feedback-config.mjs?v=20260921-service-settings1';
import {
  DEFAULT_SERVICE_SETTINGS,
  SERVICE_NOTICE_MESSAGE_MAX_LENGTH,
  loadServiceSettings,
  normalizeServiceSettings,
  resetServiceSettings,
  saveServiceSettings,
  serviceFeatureStates,
} from './service-settings.mjs?v=20260921-service-settings1';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const panel = $('[data-teacher-main-view="service-settings"]');
const form = $('#service-settings-form');
const loadingStatus = $('#service-settings-data-loading');
let savedSettings = loadServiceSettings();
let serviceDashboard = null;
let serviceFailures = [];
let loading = false;

function toast(message, type = 'success') {
  const element = $('#teacher-toast');
  element.textContent = message;
  element.dataset.type = type;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.textContent = '';
    element.dataset.type = '';
  }, 2600);
}

function infoCard(label, value, hint = '') {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</article>`;
}

function featureCard(feature) {
  const status = feature.enabled ? '활성화' : '비활성화';
  return `<article><div><strong>${escapeHtml(feature.label)}</strong><small>${escapeHtml(feature.note)}</small></div><span class="service-feature-status ${feature.enabled ? 'is-enabled' : 'is-disabled'}">${status}</span></article>`;
}

function localStorageAvailable() {
  try { return Boolean(globalThis.localStorage); } catch { return false; }
}

function staticDeploymentLabel() {
  return window.location.hostname.endsWith('github.io')
    ? 'GitHub Pages에서 실행 중'
    : 'GitHub Pages 정적 배포 구성';
}

function renderFeatureStates() {
  $('#service-feature-states').innerHTML = serviceFeatureStates().map(featureCard).join('');
}

function renderServiceInfo() {
  const conversion = conversionDataset(DEFAULT_BUSAN_CONVERSION_DATASET);
  const summary = serviceDashboard?.summary;
  $('#service-basic-info').innerHTML = [
    infoCard('현재 앱 버전', `v${APP_VERSION}`),
    infoCard('현재 빌드일', APP_BUILD_DATE),
    infoCard('입결 기준연도', summary?.referenceYears?.join(', ') || '확인 중'),
    infoCard('등급 변환 기준', conversion?.label ?? DEFAULT_BUSAN_CONVERSION_DATASET, conversion ? `부산교육청 공식 자료 · 표본 ${conversion.sampleSize.toLocaleString('ko-KR')}명` : ''),
    infoCard('최근 입결 업데이트', summary?.latestUpdatedAt || '기록 없음'),
    infoCard('현재 입결 레코드', summary ? `${summary.recordCount.toLocaleString('ko-KR')}건` : '확인 중'),
    infoCard('현재 대학', `${UNIVERSITIES.length.toLocaleString('ko-KR')}개`),
  ].join('');
}

function renderDataStates() {
  const summary = serviceDashboard?.summary;
  const loadState = loading
    ? '불러오는 중'
    : serviceDashboard
      ? (serviceFailures.length ? `일부 로딩 실패 (${serviceFailures.length}개 지역)` : '정상')
      : '탭을 열면 확인';
  $('#service-data-states').innerHTML = [
    infoCard('입결 데이터 로딩', loadState),
    infoCard('입결 품질 경고', summary ? `${summary.quality.actionableCount.toLocaleString('ko-KR')}건` : '확인 중', '중요 + 확인 필요'),
    infoCard('학생 의견 연결', String(FEEDBACK_GAS_URL ?? '').trim() ? '설정됨' : '설정되지 않음', '접속 주소나 인증정보는 표시하지 않음'),
    infoCard('관리자 운영 설정 저장', localStorageAvailable() ? '브라우저 저장 사용' : '사용 불가', '학생 개인 데이터와 분리'),
    infoCard('배포 구조', staticDeploymentLabel(), '정적 파일 기반'),
  ].join('');
  loadingStatus.textContent = loading
    ? '입결 데이터와 품질 상태를 확인하는 중입니다.'
    : serviceFailures.length
      ? `일부 지역(${serviceFailures.map((item) => item.regionKey).join(', ')})은 불러오지 못했지만 나머지 상태는 확인할 수 있습니다.`
      : '';
  loadingStatus.dataset.type = serviceFailures.length ? 'error' : '';
}

function formSettings() {
  return normalizeServiceSettings({
    noticeEnabled: form.elements.noticeEnabled.checked,
    noticeMessage: form.elements.noticeMessage.value,
    noticeLevel: form.elements.noticeLevel.value,
  });
}

function sameSettings(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function updateDirtyState() {
  const dirty = !sameSettings(formSettings(), savedSettings);
  $('#service-settings-dirty').textContent = dirty ? '저장하지 않은 변경사항이 있어요.' : '저장된 상태예요.';
  $('#service-settings-dirty').dataset.dirty = String(dirty);
  $('#service-settings-save').disabled = !dirty;
}

function renderForm(settings = savedSettings) {
  form.elements.noticeEnabled.checked = settings.noticeEnabled;
  form.elements.noticeMessage.value = settings.noticeMessage;
  form.elements.noticeLevel.value = settings.noticeLevel;
  updateDirtyState();
}

async function loadServiceDashboard() {
  if (loading || serviceDashboard) return;
  loading = true;
  renderDataStates();
  renderServiceInfo();
  try {
    const dataset = await loadAdmissionDashboardDataset({
      regionKeys: admissionResultRegions,
      loadRegion: loadAdmissionResultsByRegion,
    });
    serviceFailures = dataset.failures;
    serviceDashboard = buildAdmissionDataDashboard(dataset.records, UNIVERSITIES);
  } catch (error) {
    serviceDashboard = null;
    serviceFailures = [{ regionKey: '전체', message: error?.message ?? '불러오기 실패' }];
  } finally {
    loading = false;
    renderServiceInfo();
    renderDataStates();
  }
}

renderFeatureStates();
renderForm(savedSettings);
renderServiceInfo();
renderDataStates();
form.elements.noticeMessage.maxLength = SERVICE_NOTICE_MESSAGE_MAX_LENGTH;

form.addEventListener('input', updateDirtyState);
form.addEventListener('change', updateDirtyState);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const next = formSettings();
  if (next.noticeEnabled && !next.noticeMessage) {
    toast('운영 공지를 사용하려면 공지 문구를 입력해 주세요.', 'error');
    form.elements.noticeMessage.focus();
    return;
  }
  try {
    savedSettings = saveServiceSettings(next);
    renderForm(savedSettings);
    toast('서비스 운영 설정을 저장했습니다.');
  } catch {
    toast('설정을 저장하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.', 'error');
  }
});

$('#service-settings-reset').addEventListener('click', () => {
  if (!confirm('서비스 운영 설정을 기본값으로 되돌릴까요?')) return;
  try {
    savedSettings = resetServiceSettings();
    renderForm(savedSettings);
    toast('서비스 운영 설정을 기본값으로 되돌렸습니다.');
  } catch {
    savedSettings = normalizeServiceSettings(DEFAULT_SERVICE_SETTINGS);
    renderForm(savedSettings);
    toast('저장된 설정을 지우지 못했습니다. 현재 화면만 기본값으로 바꿨습니다.', 'error');
  }
});

document.querySelector('[data-teacher-main-tab="service-settings"]').addEventListener('click', loadServiceDashboard);
if (!panel.hidden) loadServiceDashboard();


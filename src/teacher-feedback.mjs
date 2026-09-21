import { APP_VERSION } from './app-version.mjs?v=20260921-service-settings1';
import { FEEDBACK_ADMIN_SESSION_KEY } from './feedback-config.mjs?v=20260921-service-settings1';
import {
  FEEDBACK_STATUSES,
  feedbackStatusCounts,
  filterFeedbackRecords,
  listFeedback,
  loginFeedbackAdmin,
  updateFeedback,
} from './feedback-core.mjs?v=20260921-service-settings1';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const loginForm = $('#feedback-admin-login');
const dashboard = $('#feedback-admin-dashboard');
const listElement = $('#feedback-list');
const listStatus = $('#feedback-list-status');
const refreshButton = $('#feedback-refresh');
const logoutButton = $('#feedback-logout');
const feedbackView = $('[data-teacher-main-view="feedback"]');
const newBadge = $('[data-feedback-new-badge]');
let adminToken = sessionStorage.getItem(FEEDBACK_ADMIN_SESSION_KEY) ?? '';
let records = [];
let loadedOnce = false;
const filters = { category: '', status: '', grade: '', query: '', sort: 'latest' };

const versionElement = $('#teacher-app-version');
if (versionElement) versionElement.textContent = `v${APP_VERSION}`;

function feedbackToast(message) {
  const toast = $('#teacher-toast');
  if (!toast) return;
  toast.textContent = message;
  clearTimeout(feedbackToast.timer);
  feedbackToast.timer = window.setTimeout(() => { toast.textContent = ''; }, 2600);
}

function setListStatus(message, type = '') {
  listStatus.textContent = message;
  listStatus.dataset.type = type;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusOptions(current) {
  return FEEDBACK_STATUSES.map((status) => `<option${status === current ? ' selected' : ''}>${status}</option>`).join('');
}

function renderSummary() {
  const counts = feedbackStatusCounts(records);
  FEEDBACK_STATUSES.forEach((status) => {
    const target = document.querySelector(`[data-feedback-count="${status}"]`);
    if (target) target.textContent = String(counts[status] ?? 0);
  });
  const newCount = counts['신규'] ?? 0;
  newBadge.hidden = newCount === 0;
  newBadge.textContent = newCount ? String(newCount) : '';
}

function feedbackCard(item) {
  const id = escapeHtml(item.id);
  const grade = item.grade ? escapeHtml(item.grade) : '미선택';
  return `<article class="teacher-feedback-card${item.status === '신규' ? ' is-new' : ''}" data-feedback-id="${id}"><header><div><span class="teacher-feedback-category">${escapeHtml(item.category)}</span><time datetime="${escapeHtml(item.submittedAt)}">${escapeHtml(formatDate(item.submittedAt))}</time></div><select class="input" data-feedback-status aria-label="처리 상태">${statusOptions(item.status)}</select></header><p class="teacher-feedback-message">${escapeHtml(item.message)}</p><dl class="teacher-feedback-meta"><div><dt>학년</dt><dd>${grade}</dd></div><div><dt>앱 버전</dt><dd>${escapeHtml(item.appVersion || '-')}</dd></div><div><dt>현재 화면</dt><dd>${escapeHtml(item.currentSection || '-')}</dd></div></dl><details class="teacher-feedback-tech"><summary>기술 정보</summary><dl><div><dt>화면 크기</dt><dd>${escapeHtml(item.viewport || '-')}</dd></div><div><dt>브라우저</dt><dd>${escapeHtml(item.userAgent || '-')}</dd></div><div><dt>의견 ID</dt><dd>${id}</dd></div></dl></details><label class="teacher-feedback-note">관리자 메모<textarea class="input" rows="2" maxlength="800" data-feedback-note placeholder="처리 내용이나 확인할 사항">${escapeHtml(item.adminNote || '')}</textarea></label><div class="teacher-feedback-card-actions"><button type="button" class="quiet-button" data-feedback-save-note>메모 저장</button></div></article>`;
}

function renderFeedback() {
  renderSummary();
  const visible = filterFeedbackRecords(records, filters);
  setListStatus(`${visible.length}개 의견 · ${filters.sort === 'oldest' ? '오래된순' : '최신순'}`);
  listElement.innerHTML = visible.length ? visible.map(feedbackCard).join('') : '<p class="empty-state">현재 조건에 맞는 학생 의견이 없습니다.</p>';
}

function showAuthenticated(authenticated) {
  loginForm.hidden = authenticated;
  dashboard.hidden = !authenticated;
  refreshButton.hidden = !authenticated;
  logoutButton.hidden = !authenticated;
}

function clearAdminSession() {
  adminToken = '';
  records = [];
  loadedOnce = false;
  sessionStorage.removeItem(FEEDBACK_ADMIN_SESSION_KEY);
  showAuthenticated(false);
  newBadge.hidden = true;
}

async function loadFeedback({ announce = false } = {}) {
  if (!adminToken) { showAuthenticated(false); return; }
  setListStatus('학생 의견을 불러오는 중입니다.');
  refreshButton.disabled = true;
  try {
    const result = await listFeedback(adminToken);
    records = Array.isArray(result.feedback) ? result.feedback : [];
    loadedOnce = true;
    showAuthenticated(true);
    renderFeedback();
    if (announce) feedbackToast('학생 의견을 새로 불러왔습니다.');
  } catch (error) {
    if (error?.code === 'unauthorized') clearAdminSession();
    setListStatus(error?.message ?? '학생 의견을 불러오지 못했습니다.', 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

document.querySelectorAll('[data-teacher-main-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const selected = tab.dataset.teacherMainTab;
    document.querySelectorAll('[data-teacher-main-tab]').forEach((button) => {
      const active = button.dataset.teacherMainTab === selected;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-teacher-main-view]').forEach((view) => { view.hidden = view.dataset.teacherMainView !== selected; });
    const editor = $('#course-editor');
    if (selected !== 'courses' && editor) editor.hidden = true;
    if (selected === 'feedback' && adminToken && !loadedOnce) loadFeedback();
  });
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = '확인 중...';
  try {
    const result = await loginFeedbackAdmin(loginForm.elements.password.value);
    adminToken = result.adminToken;
    sessionStorage.setItem(FEEDBACK_ADMIN_SESSION_KEY, adminToken);
    loginForm.reset();
    showAuthenticated(true);
    await loadFeedback();
  } catch (error) {
    setListStatus(error?.message ?? '관리자 인증에 실패했습니다.', 'error');
    feedbackToast(error?.message ?? '관리자 인증에 실패했습니다.');
  } finally {
    submit.disabled = false;
    submit.textContent = '학생 의견 열기';
  }
});

refreshButton.addEventListener('click', () => loadFeedback({ announce: true }));
logoutButton.addEventListener('click', () => { clearAdminSession(); feedbackToast('의견함에서 로그아웃했습니다.'); });

['category', 'status', 'grade', 'sort'].forEach((key) => {
  $(`#feedback-filter-${key}`).addEventListener('change', (event) => { filters[key] = event.target.value; renderFeedback(); });
});
$('#feedback-filter-query').addEventListener('input', (event) => { filters.query = event.target.value; renderFeedback(); });

listElement.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-feedback-status]');
  if (!select) return;
  const card = select.closest('[data-feedback-id]');
  const item = records.find((record) => record.id === card?.dataset.feedbackId);
  if (!item) return;
  const previousStatus = item.status;
  select.disabled = true;
  try {
    await updateFeedback({ id: item.id, status: select.value, adminNote: item.adminNote ?? '' }, adminToken);
    item.status = select.value;
    renderFeedback();
    feedbackToast('처리 상태를 저장했어요.');
  } catch (error) {
    item.status = previousStatus;
    select.value = previousStatus;
    select.disabled = false;
    feedbackToast(error?.message ?? '처리 상태를 저장하지 못했습니다.');
  }
});

listElement.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-feedback-save-note]');
  if (!button) return;
  const card = button.closest('[data-feedback-id]');
  const item = records.find((record) => record.id === card?.dataset.feedbackId);
  const note = card?.querySelector('[data-feedback-note]')?.value ?? '';
  if (!item) return;
  button.disabled = true;
  try {
    await updateFeedback({ id: item.id, status: item.status, adminNote: note }, adminToken);
    item.adminNote = note.trim();
    feedbackToast('관리자 메모를 저장했어요.');
  } catch (error) {
    feedbackToast(error?.message ?? '관리자 메모를 저장하지 못했습니다.');
  } finally {
    button.disabled = false;
  }
});

showAuthenticated(Boolean(adminToken));
if (!feedbackView.hidden && adminToken) loadFeedback();

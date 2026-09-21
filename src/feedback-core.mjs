import {
  FEEDBACK_ADMIN_NOTE_MAX_LENGTH,
  FEEDBACK_GAS_URL,
  FEEDBACK_MESSAGE_MAX_LENGTH,
} from './feedback-config.mjs?v=20260921-admin-admissions1';

export const FEEDBACK_CATEGORIES = Object.freeze([
  '오류가 있어요',
  '사용하기 불편해요',
  '기능 제안',
  '입결 데이터 관련',
  '기타',
]);

export const FEEDBACK_STATUSES = Object.freeze(['신규', '확인중', '반영완료', '보류']);
export const FEEDBACK_GRADES = Object.freeze(['', '1학년', '2학년', '3학년']);

function cleanText(value, maxLength) {
  return String(value ?? '').trim().replace(/\u0000/g, '').slice(0, maxLength);
}

function finiteViewport(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

export function validateAnonymousFeedback(input = {}) {
  const category = cleanText(input.category, 40);
  const rawMessage = String(input.message ?? '').trim().replace(/\u0000/g, '');
  const grade = cleanText(input.grade, 10);
  if (!FEEDBACK_CATEGORIES.includes(category)) throw new Error('의견 종류를 선택해 주세요.');
  if (!rawMessage) throw new Error('의견 내용을 입력해 주세요.');
  if (rawMessage.length > FEEDBACK_MESSAGE_MAX_LENGTH) throw new Error(`의견은 ${FEEDBACK_MESSAGE_MAX_LENGTH}자 이내로 입력해 주세요.`);
  if (!FEEDBACK_GRADES.includes(grade)) throw new Error('학년 선택값을 확인해 주세요.');
  return { category, message: rawMessage, grade };
}

export function createAnonymousFeedbackPayload(input = {}, technical = {}) {
  const feedback = validateAnonymousFeedback(input);
  const width = finiteViewport(technical.viewportWidth);
  const height = finiteViewport(technical.viewportHeight);
  return {
    ...feedback,
    appVersion: cleanText(technical.appVersion, 30),
    buildDate: cleanText(technical.buildDate, 30),
    currentSection: cleanText(technical.currentSection, 100) || '확인 불가',
    viewport: `${width}x${height}`,
    userAgent: cleanText(technical.userAgent, 400),
    submittedAt: cleanText(technical.submittedAt, 40) || new Date().toISOString(),
  };
}

export function feedbackCooldownRemaining(lastSubmittedAt, now = Date.now(), cooldownMs = 30_000) {
  if (lastSubmittedAt === null || lastSubmittedAt === undefined || String(lastSubmittedAt).trim() === '') return 0;
  const submittedAt = Number(lastSubmittedAt);
  const currentTime = Number(now);
  const duration = Number(cooldownMs);
  if (!Number.isFinite(submittedAt) || !Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, Math.ceil(duration - (currentTime - submittedAt))));
}

function feedbackEndpoint(endpoint) {
  const value = String(endpoint ?? '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(value)) {
    throw new Error('의견함 연결이 아직 설정되지 않았어요.');
  }
  return value;
}

export async function feedbackApiRequest(action, payload = {}, {
  adminToken = '',
  endpoint = FEEDBACK_GAS_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('네트워크 요청을 사용할 수 없어요.');
  const response = await fetchImpl(feedbackEndpoint(endpoint), {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload, adminToken }),
  });
  if (!response.ok) throw new Error('의견함 서버에 연결하지 못했어요.');
  let result;
  try { result = await response.json(); } catch { throw new Error('의견함 응답을 확인하지 못했어요.'); }
  if (!result?.ok) {
    const messages = {
      unauthorized: '관리자 인증이 필요합니다.',
      invalid_request: '입력 내용을 확인해 주세요.',
      not_found: '해당 의견을 찾지 못했습니다.',
      rate_limited: '잠시 후 다시 시도해 주세요.',
    };
    const error = new Error(messages[result?.error] ?? '요청을 처리하지 못했습니다.');
    error.code = result?.error ?? 'request_failed';
    throw error;
  }
  return result;
}

export async function submitAnonymousFeedback(payload, {
  endpoint = FEEDBACK_GAS_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  // The anonymous create path is deliberately fire-and-confirm-delivery. Apps Script
  // ContentService may finish the write and then expose its redirected response as
  // opaque to a cross-origin browser. Local validation still catches invalid input,
  // and an actual transport failure still rejects the fetch promise.
  validateAnonymousFeedback(payload);
  if (typeof fetchImpl !== 'function') throw new Error('네트워크 요청을 사용할 수 없어요.');
  const response = await fetchImpl(feedbackEndpoint(endpoint), {
    method: 'POST',
    mode: 'no-cors',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'createFeedback', payload, adminToken: '' }),
  });

  if (response?.type === 'opaque' || response?.type === 'opaqueredirect') {
    return { ok: true, delivery: 'opaque' };
  }
  if (!response?.ok) throw new Error('의견함 서버에 연결하지 못했어요.');
  let result;
  try { result = await response.json(); } catch { throw new Error('의견함 응답을 확인하지 못했어요.'); }
  if (!result?.ok) {
    const error = new Error(result?.error === 'rate_limited' ? '잠시 후 다시 시도해 주세요.' : '요청을 처리하지 못했습니다.');
    error.code = result?.error ?? 'request_failed';
    throw error;
  }
  return result;
}

export function loginFeedbackAdmin(password, options) {
  const value = cleanText(password, 200);
  if (!value) return Promise.reject(new Error('관리자 비밀번호를 입력해 주세요.'));
  return feedbackApiRequest('adminLogin', { password: value }, options);
}

export function listFeedback(adminToken, options) {
  return feedbackApiRequest('listFeedback', {}, { ...options, adminToken });
}

export function updateFeedback({ id, status, adminNote }, adminToken, options) {
  const feedbackId = cleanText(id, 100);
  const nextStatus = cleanText(status, 20);
  const note = cleanText(adminNote, FEEDBACK_ADMIN_NOTE_MAX_LENGTH);
  if (!feedbackId) return Promise.reject(new Error('의견 ID를 확인해 주세요.'));
  if (!FEEDBACK_STATUSES.includes(nextStatus)) return Promise.reject(new Error('처리 상태를 확인해 주세요.'));
  return feedbackApiRequest('updateFeedback', { id: feedbackId, status: nextStatus, adminNote: note }, { ...options, adminToken });
}

export function feedbackStatusCounts(records = []) {
  return FEEDBACK_STATUSES.reduce((counts, status) => {
    counts[status] = records.filter((item) => item.status === status).length;
    return counts;
  }, {});
}

export function filterFeedbackRecords(records = [], filters = {}) {
  const category = cleanText(filters.category, 40);
  const status = cleanText(filters.status, 20);
  const grade = cleanText(filters.grade, 10);
  const query = cleanText(filters.query, 120).toLocaleLowerCase('ko-KR');
  const direction = filters.sort === 'oldest' ? 1 : -1;
  return [...records]
    .filter((item) => !category || item.category === category)
    .filter((item) => !status || item.status === status)
    .filter((item) => !grade || (grade === '미선택' ? !item.grade : item.grade === grade))
    .filter((item) => !query || String(item.message ?? '').toLocaleLowerCase('ko-KR').includes(query))
    .sort((a, b) => direction * String(a.submittedAt ?? '').localeCompare(String(b.submittedAt ?? '')));
}

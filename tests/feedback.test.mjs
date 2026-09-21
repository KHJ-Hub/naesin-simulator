import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createAnonymousFeedbackPayload,
  feedbackStatusCounts,
  filterFeedbackRecords,
  listFeedback,
  submitAnonymousFeedback,
  updateFeedback,
  validateAnonymousFeedback,
} from '../src/feedback-core.mjs';

const ENDPOINT = 'https://script.google.com/macros/s/test-deployment/exec';

function response(data, ok = true) {
  return { ok, json: async () => data };
}

test('익명 의견 payload에는 허용된 의견과 기술 정보만 포함된다', () => {
  const payload = createAnonymousFeedbackPayload({
    category: '기능 제안',
    message: '검색 기능이 더 편해졌으면 좋겠어요.',
    grade: '1학년',
    name: '홍길동',
    studentNumber: '10101',
    grades: [1, 2],
    targetGrade: 1.5,
    interestedUniversities: ['테스트대학교'],
  }, {
    appVersion: '1.3.0',
    buildDate: '2026.09.20',
    currentSection: '입시결과 비교',
    viewportWidth: 390,
    viewportHeight: 844,
    userAgent: 'Mobile test browser',
    submittedAt: '2026-09-20T00:00:00.000Z',
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    'appVersion', 'buildDate', 'category', 'currentSection', 'grade',
    'message', 'submittedAt', 'userAgent', 'viewport',
  ].sort());
  assert.equal(payload.viewport, '390x844');
  assert.equal('name' in payload, false);
  assert.equal('studentNumber' in payload, false);
  assert.equal('grades' in payload, false);
  assert.equal('targetGrade' in payload, false);
  assert.equal('interestedUniversities' in payload, false);
});

test('의견 입력값은 종류·내용·학년·길이를 검증한다', () => {
  assert.throws(() => validateAnonymousFeedback({ category: '', message: '의견' }), /종류/);
  assert.throws(() => validateAnonymousFeedback({ category: '기능 제안', message: '   ' }), /내용/);
  assert.throws(() => validateAnonymousFeedback({ category: '기능 제안', message: '의견', grade: '4학년' }), /학년/);
  assert.throws(() => validateAnonymousFeedback({ category: '기능 제안', message: '가'.repeat(1201) }), /1200자/);
  assert.equal(validateAnonymousFeedback({ category: '기능 제안', message: ' 의견 ', grade: '' }).message, '의견');
});

test('학생 제출 API는 POST body에 createFeedback만 전송한다', async () => {
  let request;
  const result = await submitAnonymousFeedback({ category: '기타', message: '테스트', grade: '' }, {
    endpoint: ENDPOINT,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response({ ok: true, id: 'feedback-1' });
    },
  });
  assert.equal(result.id, 'feedback-1');
  assert.equal(request.url, ENDPOINT);
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    action: 'createFeedback',
    payload: { category: '기타', message: '테스트', grade: '' },
    adminToken: '',
  });
});

test('관리자 목록과 수정 요청에는 관리자 토큰이 포함된다', async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return response(requests.length === 1 ? { ok: true, feedback: [] } : { ok: true });
  };
  await listFeedback('session-token', { endpoint: ENDPOINT, fetchImpl });
  await updateFeedback({ id: 'id-1', status: '확인중', adminNote: '확인했어요.' }, 'session-token', { endpoint: ENDPOINT, fetchImpl });
  assert.deepEqual(requests.map((item) => item.action), ['listFeedback', 'updateFeedback']);
  assert.equal(requests.every((item) => item.adminToken === 'session-token'), true);
  assert.deepEqual(requests[1].payload, { id: 'id-1', status: '확인중', adminNote: '확인했어요.' });
});

test('의견 요약·필터·검색은 최신순으로 동작한다', () => {
  const records = [
    { id: '1', category: '기능 제안', message: '검색 개선', grade: '1학년', status: '신규', submittedAt: '2026-09-19T00:00:00Z' },
    { id: '2', category: '오류가 있어요', message: '모바일 오류', grade: '', status: '확인중', submittedAt: '2026-09-20T00:00:00Z' },
    { id: '3', category: '기능 제안', message: '모바일 검색', grade: '2학년', status: '신규', submittedAt: '2026-09-21T00:00:00Z' },
  ];
  assert.deepEqual(feedbackStatusCounts(records), { 신규: 2, 확인중: 1, 반영완료: 0, 보류: 0 });
  assert.deepEqual(filterFeedbackRecords(records, { category: '기능 제안', query: '검색' }).map((item) => item.id), ['3', '1']);
  assert.deepEqual(filterFeedbackRecords(records, { grade: '미선택' }).map((item) => item.id), ['2']);
});

test('학생/관리자 UI와 Apps Script는 익명 제출 및 보호된 관리 경로를 갖는다', async () => {
  const [html, teacher, studentModule, teacherModule, gas] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../teacher.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/student-feedback.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/teacher-feedback.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../google-apps-script/feedback-api.gs', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /💬 의견 보내기/);
  assert.match(html, /이름, 학번, 성적은 수집하지 않아요/);
  assert.match(studentModule, /createAnonymousFeedbackPayload/);
  assert.match(studentModule, /보내는 중/);
  assert.match(teacher, /data-teacher-main-tab="feedback"/);
  assert.match(teacher, /관리자 메모/);
  assert.match(teacherModule, /sessionStorage/);
  assert.match(teacherModule, /updateFeedback/);
  assert.match(gas, /request\.action === 'createFeedback'/);
  assert.match(gas, /request\.action === 'listFeedback'[\s\S]*feedbackRequireAdmin_/);
  assert.match(gas, /request\.action === 'updateFeedback'[\s\S]*feedbackRequireAdmin_/);
  assert.doesNotMatch(gas, /학번|targetGrade|interestedUniversities|관심 대학|성적/);
  assert.doesNotMatch(gas, /getIp|ipAddress|X-Forwarded-For/i);
});

test('관리자 탭 전환 시 과목 관리 패널과 의견 패널은 동시에 노출되지 않는다', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.teacher-panel\[data-teacher-main-view\]\[hidden\][\s\S]*display:\s*none\s*!important/);
});

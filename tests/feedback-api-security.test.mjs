import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../google-apps-script/feedback-api.gs', import.meta.url), 'utf8');

function createHarness() {
  let clock = 0;
  let uuid = 0;
  const cacheEntries = new Map();
  const rows = [];
  const cache = {
    get(key) {
      const entry = cacheEntries.get(key);
      if (!entry || entry.expiresAt <= clock) {
        cacheEntries.delete(key);
        return null;
      }
      return entry.value;
    },
    put(key, value, seconds) {
      cacheEntries.set(key, { value: String(value), expiresAt: clock + (Number(seconds) * 1000) });
    },
    remove(key) { cacheEntries.delete(key); },
  };
  const range = (row, column, rowCount, columnCount) => ({
    setNumberFormat() { return this; },
    setValues(values) {
      values.forEach((valuesRow, rowIndex) => {
        const targetIndex = row - 1 + rowIndex;
        rows[targetIndex] ??= [];
        valuesRow.forEach((value, columnIndex) => { rows[targetIndex][column - 1 + columnIndex] = value; });
      });
      return this;
    },
    getValues() {
      return Array.from({ length: rowCount }, (_, rowIndex) => Array.from({ length: columnCount }, (_, columnIndex) => rows[row - 1 + rowIndex]?.[column - 1 + columnIndex] ?? ''));
    },
    getDisplayValues() { return this.getValues().map((values) => values.map(String)); },
  });
  const sheet = {
    getLastRow: () => rows.length,
    getRange: range,
    setFrozenRows() {},
  };
  const context = vm.createContext({
    console,
    Object,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Math,
    Date,
    Error,
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => ({ FEEDBACK_SHEET_ID: 'sheet-id', FEEDBACK_ADMIN_PASSWORD: 'correct-password', FEEDBACK_SHEET_NAME: '학생 의견' }[key] ?? '') }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => [...createHash('sha256').update(value, 'utf8').digest()],
      getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`,
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: () => ({ setMimeType() { return this; } }),
    },
  });
  vm.runInContext(source, context);
  return { context, rows, cache, advance: (milliseconds) => { clock += milliseconds; } };
}

function validPayload(overrides = {}) {
  return {
    category: '기능 제안',
    message: '검색 결과가 더 보기 쉬우면 좋겠어요.',
    grade: '1학년',
    appVersion: '1.0.3',
    buildDate: '2026.10.23',
    currentSection: '입결 비교',
    viewport: '390x844',
    userAgent: 'Test browser',
    submittedAt: '2026-10-23T00:00:00.000Z',
    ...overrides,
  };
}

function expectErrorCode(callback, code) {
  let error;
  try { callback(); } catch (caught) { error = caught; }
  assert.ok(error, `expected ${code}`);
  assert.equal(error.message, code);
}

test('서버는 정상 의견을 저장하고 동일 내용의 짧은 반복만 차단한다', () => {
  const { context, rows } = createHarness();
  assert.equal(context.feedbackCreate_(validPayload()).ok, true);
  assert.equal(rows.length, 2);
  expectErrorCode(() => context.feedbackCreate_(validPayload()), 'rate_limited');
  assert.equal(context.feedbackCreate_(validPayload({ message: '필터 설명을 조금 더 보고 싶어요.' })).ok, true);
  assert.equal(rows.length, 3);
});

test('서버는 빈 값·최대 길이·예상 밖 타입과 필드를 거부한다', () => {
  const { context } = createHarness();
  expectErrorCode(() => context.feedbackCreate_(validPayload({ message: '   ' })), 'invalid_request');
  expectErrorCode(() => context.feedbackCreate_(validPayload({ message: '가'.repeat(1201) })), 'invalid_request');
  expectErrorCode(() => context.feedbackCreate_(validPayload({ message: ['배열'] })), 'invalid_request');
  expectErrorCode(() => context.feedbackCreate_({ ...validPayload(), studentName: '저장 금지' }), 'invalid_request');
});

test('서버 전체 폭주 제한은 정상적인 서로 다른 의견 여러 건보다 높게 설정된다', () => {
  const { context } = createHarness();
  assert.ok(context.FEEDBACK_CREATE_BURST_MAX >= 50);
  assert.ok(context.FEEDBACK_CREATE_WINDOW_MAX >= 150);
  Array.from({ length: 20 }, (_, index) => validPayload({ message: `서로 다른 정상 의견 ${index}` }))
    .forEach((payload) => assert.equal(context.feedbackCreate_(payload).ok, true));
});

test('Sheet에 쓰는 의견과 메모는 수식 시작 문자를 중립화한다', () => {
  const { context } = createHarness();
  ['=SUM(A1:A2)', '+1', '-1', '@mention'].forEach((value) => {
    assert.equal(context.feedbackSafeSheetText_(value), `'${value}`);
  });
  assert.equal(context.feedbackSafeSheetText_('일반 의견'), '일반 의견');
});

test('관리자 로그인은 5회 실패 후 15분 잠그고 만료 뒤 다시 허용한다', () => {
  const { context, advance } = createHarness();
  for (let attempt = 1; attempt < 5; attempt += 1) {
    expectErrorCode(() => context.feedbackAdminLogin_({ password: 'wrong-password' }), 'unauthorized');
  }
  expectErrorCode(() => context.feedbackAdminLogin_({ password: 'wrong-password' }), 'rate_limited');
  expectErrorCode(() => context.feedbackAdminLogin_({ password: 'correct-password' }), 'rate_limited');
  advance(901_000);
  const login = context.feedbackAdminLogin_({ password: 'correct-password' });
  assert.equal(login.ok, true);
  assert.equal(login.expiresIn, 21600);
});

test('관리자 로그인 성공은 실패 횟수를 초기화한다', () => {
  const { context } = createHarness();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    expectErrorCode(() => context.feedbackAdminLogin_({ password: 'wrong-password' }), 'unauthorized');
  }
  assert.equal(context.feedbackAdminLogin_({ password: 'correct-password' }).ok, true);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    expectErrorCode(() => context.feedbackAdminLogin_({ password: 'wrong-password' }), 'unauthorized');
  }
});

test('관리자 로그아웃은 서버 token을 즉시 폐기한다', () => {
  const { context } = createHarness();
  const login = context.feedbackAdminLogin_({ password: 'correct-password' });
  assert.doesNotThrow(() => context.feedbackRequireAdmin_(login.adminToken));
  assert.equal(context.feedbackAdminLogout_(login.adminToken).ok, true);
  expectErrorCode(() => context.feedbackRequireAdmin_(login.adminToken), 'unauthorized');
});

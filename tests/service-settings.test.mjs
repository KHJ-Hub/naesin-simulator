import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_SERVICE_SETTINGS,
  SERVICE_NOTICE_MESSAGE_MAX_LENGTH,
  SERVICE_SETTINGS_STORAGE_KEY,
  loadServiceSettings,
  normalizeServiceSettings,
  resetServiceSettings,
  saveServiceSettings,
  serviceFeatureStates,
} from '../src/service-settings.mjs';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    value: (key) => values.get(key),
  };
}

test('서비스 운영 설정은 학생 데이터와 분리된 안전한 기본값으로 시작한다', () => {
  const settings = loadServiceSettings(memoryStorage());
  assert.deepEqual(settings, DEFAULT_SERVICE_SETTINGS);
  assert.equal(SERVICE_SETTINGS_STORAGE_KEY, 'naesin-service-settings:v1');
});

test('정상 운영 공지는 정규화한 최소 필드만 저장하고 다시 불러온다', () => {
  const storage = memoryStorage();
  const saved = saveServiceSettings({
    noticeEnabled: true,
    noticeMessage: '  모의고사 기간에는 접속이 많을 수 있습니다.  ',
    noticeLevel: 'important',
    studentName: '저장 금지',
    grades: [1, 2],
    feedback: ['저장 금지'],
  }, storage);
  assert.deepEqual(saved, {
    schemaVersion: 1,
    noticeEnabled: true,
    noticeMessage: '모의고사 기간에는 접속이 많을 수 있습니다.',
    noticeLevel: 'important',
  });
  assert.deepEqual(loadServiceSettings(storage), saved);
  assert.deepEqual(Object.keys(JSON.parse(storage.value(SERVICE_SETTINGS_STORAGE_KEY))).sort(), [
    'noticeEnabled', 'noticeLevel', 'noticeMessage', 'schemaVersion',
  ]);
});

test('손상된 저장값과 허용되지 않은 boolean·중요도는 기본값으로 복구한다', () => {
  const broken = memoryStorage({ [SERVICE_SETTINGS_STORAGE_KEY]: '{not-json' });
  assert.deepEqual(loadServiceSettings(broken), DEFAULT_SERVICE_SETTINGS);
  const invalid = normalizeServiceSettings({ noticeEnabled: 'true', noticeLevel: 'danger', noticeMessage: 123 });
  assert.equal(invalid.noticeEnabled, false);
  assert.equal(invalid.noticeLevel, 'info');
  assert.equal(invalid.noticeMessage, '');
});

test('공지 문구는 문자열을 정리하고 최대 길이를 제한한다', () => {
  const settings = normalizeServiceSettings({ noticeMessage: `  ${'가'.repeat(SERVICE_NOTICE_MESSAGE_MAX_LENGTH + 20)}  ` });
  assert.equal(settings.noticeMessage.length, SERVICE_NOTICE_MESSAGE_MAX_LENGTH);
  assert.equal(settings.noticeMessage, '가'.repeat(SERVICE_NOTICE_MESSAGE_MAX_LENGTH));
});

test('기본값으로 되돌리기는 전용 저장값만 제거한다', () => {
  const storage = memoryStorage({
    [SERVICE_SETTINGS_STORAGE_KEY]: JSON.stringify({ noticeEnabled: true, noticeMessage: '공지', noticeLevel: 'normal' }),
    'unrelated-student-data': 'preserve',
  });
  assert.deepEqual(resetServiceSettings(storage), DEFAULT_SERVICE_SETTINGS);
  assert.equal(storage.getItem(SERVICE_SETTINGS_STORAGE_KEY), null);
  assert.equal(storage.getItem('unrelated-student-data'), 'preserve');
});

test('기능 상태는 실제 endpoint와 코드 feature flag를 읽고 빠른 상담 비활성을 표시한다', () => {
  const states = Object.fromEntries(serviceFeatureStates().map((item) => [item.key, item]));
  assert.equal(states.feedback.enabled, true);
  assert.equal(states.teacherQuickMode.enabled, false);
  assert.equal(states.admissionComparison.enabled, true);
  assert.equal(states.localAdmissionComparison.enabled, true);
  assert.equal(states.interestComparison.enabled, true);
  assert.match(states.teacherQuickMode.note, /배포 필요/);
});

test('teacher.html은 기존 세 탭 뒤에 서비스 설정을 추가하고 학생 화면에는 설정 UI를 노출하지 않는다', async () => {
  const [teacher, student, module, styles] = await Promise.all([
    readFile(new URL('../teacher.html', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/teacher-service-settings.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(teacher, /data-teacher-main-tab="courses"[\s\S]*data-teacher-main-tab="admissions"[\s\S]*data-teacher-main-tab="feedback"[\s\S]*data-teacher-main-tab="service-settings"/);
  assert.match(teacher, /data-teacher-main-view="service-settings" hidden/);
  assert.match(teacher, /name="noticeEnabled"[\s\S]*name="noticeLevel"[\s\S]*name="noticeMessage"/);
  assert.doesNotMatch(student, /data-teacher-main-tab="service-settings"|service-settings-form/);
  assert.match(module, /loadAdmissionDashboardDataset/);
  assert.match(module, /DEFAULT_BUSAN_CONVERSION_DATASET/);
  assert.match(module, /saveServiceSettings/);
  assert.match(styles, /\.service-settings-panel/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.service-info-grid/);
});


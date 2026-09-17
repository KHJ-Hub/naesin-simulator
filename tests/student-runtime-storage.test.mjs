import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryStorage,
  createStudentRuntimeStorage,
  isStudentTestMode,
} from '../src/student-runtime-storage.mjs';
import {
  createStudentProfile,
  getCurrentStudentProfile,
  getStudentProfiles,
} from '../src/student-profile-store.mjs';

function seedPersistentStudent() {
  const storage = createMemoryStorage();
  createStudentProfile('10101', '김학생', {
    actual: [{ id: 'saved-grade', gradeValue: 2 }],
    targetAverage: '1.80',
    admissionInterests: [{ universityId: 'pusan-national' }],
  }, storage);
  return storage;
}

test('test=1일 때만 학생 테스트 모드를 사용한다', () => {
  assert.equal(isStudentTestMode('?test=1'), true);
  assert.equal(isStudentTestMode('?foo=x&test=1'), true);
  assert.equal(isStudentTestMode(''), false);
  assert.equal(isStudentTestMode('?test=0'), false);
});

test('일반 모드는 기존 영구 저장소와 학생 데이터를 그대로 사용한다', () => {
  const persistentStorage = seedPersistentStudent();
  const runtime = createStudentRuntimeStorage({ search: '', persistentStorage });

  assert.equal(runtime.isTestMode, false);
  assert.equal(runtime.storage, persistentStorage);
  assert.equal(getCurrentStudentProfile(runtime.storage).studentNumber, '10101');
  assert.equal(getCurrentStudentProfile(runtime.storage).targetAverage, '1.80');
});

test('테스트 모드는 기존 학생 데이터를 읽지 않고 빈 상태로 시작한다', () => {
  const persistentStorage = seedPersistentStudent();
  const runtime = createStudentRuntimeStorage({ search: '?test=1', persistentStorage });

  assert.equal(runtime.isTestMode, true);
  assert.notEqual(runtime.storage, persistentStorage);
  assert.deepEqual(getStudentProfiles(runtime.storage), {});
  assert.equal(getCurrentStudentProfile(runtime.storage), null);
});

test('테스트 모드 새로고침을 재현하면 입력 데이터가 다시 빈 상태가 된다', () => {
  const persistentStorage = seedPersistentStudent();
  const firstLoad = createStudentRuntimeStorage({ search: '?test=1', persistentStorage });
  createStudentProfile('99999', '테스트학생', { targetAverage: '2.00' }, firstLoad.storage);
  assert.equal(getCurrentStudentProfile(firstLoad.storage).studentNumber, '99999');

  const reloaded = createStudentRuntimeStorage({ search: '?test=1', persistentStorage });
  assert.deepEqual(getStudentProfiles(reloaded.storage), {});
  assert.equal(getCurrentStudentProfile(reloaded.storage), null);
});

test('테스트 모드는 기존 localStorage를 변경하지 않고 일반 모드 복귀 시 원본을 복원한다', () => {
  const persistentStorage = seedPersistentStudent();
  const before = Object.fromEntries(
    Array.from({ length: persistentStorage.length }, (_, index) => persistentStorage.key(index))
      .map((key) => [key, persistentStorage.getItem(key)]),
  );

  const testRuntime = createStudentRuntimeStorage({ search: '?test=1', persistentStorage });
  createStudentProfile('99999', '테스트학생', { targetAverage: '2.00' }, testRuntime.storage);
  testRuntime.storage.clear();

  const after = Object.fromEntries(
    Array.from({ length: persistentStorage.length }, (_, index) => persistentStorage.key(index))
      .map((key) => [key, persistentStorage.getItem(key)]),
  );
  assert.deepEqual(after, before);

  const normalRuntime = createStudentRuntimeStorage({ search: '', persistentStorage });
  assert.equal(getCurrentStudentProfile(normalRuntime.storage).studentNumber, '10101');
  assert.equal(getStudentProfiles(normalRuntime.storage)['99999'], undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCHOOL_SETTINGS,
  SCHOOL_SETTINGS_STORAGE_KEY,
  getSchoolSettings,
  saveSchoolSettings,
} from '../src/school-settings.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('학교 공통 설정은 부산 남고 기본값을 사용한다', () => {
  const storage = memoryStorage();
  assert.deepEqual(getSchoolSettings(storage), DEFAULT_SCHOOL_SETTINGS);
});

test('학교 공통 설정은 학생 프로필과 다른 키에 저장된다', () => {
  const storage = memoryStorage();
  const saved = saveSchoolSettings({ schoolRegion: '부산광역시', schoolGender: 'male', schoolType: '일반고' }, storage);
  assert.equal(saved.schoolGender, 'male');
  assert.ok(storage.getItem(SCHOOL_SETTINGS_STORAGE_KEY));
  assert.equal(storage.getItem('naesin-student-profiles:v1'), null);
});

test('손상된 학교 설정은 안전하게 기본값으로 복원한다', () => {
  const storage = memoryStorage();
  storage.setItem(SCHOOL_SETTINGS_STORAGE_KEY, '{broken');
  assert.deepEqual(getSchoolSettings(storage), DEFAULT_SCHOOL_SETTINGS);
});

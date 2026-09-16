import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_STUDENT_ID_STORAGE_KEY,
  LEGACY_STUDENT_STORAGE_KEY,
  STUDENT_PROFILE_MIGRATION_KEY,
  clearAllStudentProfiles,
  createStudentProfile,
  deleteStudentProfile,
  getCurrentStudentProfile,
  getStudentProfileStartup,
  getStudentProfiles,
  migrateLegacyStudentData,
  resetCurrentStudentInput,
  restoreStudentProfile,
  saveCurrentStudentProfile,
  selectStudentProfile,
  startNewStudentProfile,
} from '../src/student-profile-store.mjs';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

const profileData = (studentId, studentName, grade, interest = '') => ({
  student: { studentId, studentName },
  actual: [{ id: `${studentId}-grade`, semesterId: '1-1', subjectName: '공통국어1', credit: 4, gradeValue: grade }],
  detailedGrades: { '1-1': grade },
  targetAverage: String(Math.max(1, grade - 0.5)),
  simulationData: { required: Math.max(1, grade - 0.25) },
  admissionInterests: interest ? [{ university: interest }] : [],
});

test('학생 A와 B를 생성하고 성적·목표·관심 대학을 서로 독립적으로 저장한다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2, 'A대학교'), storage);
  createStudentProfile('10102', '학생 B', profileData('10102', '학생 B', 4, 'B대학교'), storage);

  const profiles = getStudentProfiles(storage);
  assert.equal(profiles['10101'].actual[0].gradeValue, 2);
  assert.equal(profiles['10102'].actual[0].gradeValue, 4);
  assert.equal(profiles['10101'].admissionInterests[0].university, 'A대학교');
  assert.equal(profiles['10102'].admissionInterests[0].university, 'B대학교');
  assert.equal(getCurrentStudentProfile(storage).studentNumber, '10102');
});

test('학생 전환 전에 현재 입력을 저장하고 각 학생 데이터를 복원한다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);
  createStudentProfile('10102', '학생 B', profileData('10102', '학생 B', 4), storage);

  const changedB = profileData('10102', '학생 B', 3);
  const selectedA = selectStudentProfile('10101', { currentProfile: changedB, storage });
  assert.equal(selectedA.actual[0].gradeValue, 2);
  assert.equal(getStudentProfiles(storage)['10102'].actual[0].gradeValue, 3);

  const selectedB = selectStudentProfile('10102', { currentProfile: selectedA, storage });
  assert.equal(selectedB.actual[0].gradeValue, 3);
});

test('현재 학생 입력을 초기화해도 관심 대학과 다른 학생 데이터는 유지한다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2, 'A대학교'), storage);
  createStudentProfile('10102', '학생 B', profileData('10102', '학생 B', 4, 'B대학교'), storage);
  selectStudentProfile('10101', { storage });

  resetCurrentStudentInput({ actual: [], targetAverage: '', quickAverages: {}, simulationData: null }, storage);
  const profiles = getStudentProfiles(storage);
  assert.deepEqual(profiles['10101'].actual, []);
  assert.equal(profiles['10101'].targetAverage, '');
  assert.equal(profiles['10101'].admissionInterests[0].university, 'A대학교');
  assert.equal(profiles['10102'].actual[0].gradeValue, 4);
});

test('학생 A를 삭제해도 학생 B와 현재 선택 상태는 유지한다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);
  createStudentProfile('10102', '학생 B', profileData('10102', '학생 B', 4), storage);
  selectStudentProfile('10101', { storage });

  assert.equal(deleteStudentProfile('10101', storage), true);
  assert.deepEqual(Object.keys(getStudentProfiles(storage)), ['10102']);
  assert.equal(getCurrentStudentProfile(storage).studentNumber, '10102');
});

test('모든 학생 초기화는 학생 데이터만 지우고 학교 공통 설정은 유지한다', () => {
  const storage = new MemoryStorage();
  storage.setItem('naesin-school-settings:v1', JSON.stringify({ schoolRegion: '부산광역시', schoolType: '일반고' }));
  storage.setItem('naesin-course-catalog:v1', JSON.stringify({ courses: ['공통국어1'] }));
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);

  clearAllStudentProfiles(storage);
  assert.deepEqual(getStudentProfiles(storage), {});
  assert.equal(getCurrentStudentProfile(storage), null);
  assert.deepEqual(JSON.parse(storage.getItem('naesin-school-settings:v1')), { schoolRegion: '부산광역시', schoolType: '일반고' });
  assert.deepEqual(JSON.parse(storage.getItem('naesin-course-catalog:v1')), { courses: ['공통국어1'] });
});

test('기존 단일 저장 데이터를 첫 프로필로 한 번만 마이그레이션한다', () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_STUDENT_STORAGE_KEY, JSON.stringify(profileData('10101', '기존 학생', 2, '기존대학교')));

  const first = migrateLegacyStudentData({ storage });
  assert.equal(first.migrated, true);
  assert.equal(first.studentId, '10101');
  assert.equal(getStudentProfiles(storage)['10101'].actual[0].gradeValue, 2);
  assert.equal(storage.getItem(CURRENT_STUDENT_ID_STORAGE_KEY), '10101');
  assert.ok(storage.getItem(STUDENT_PROFILE_MIGRATION_KEY));

  storage.setItem(LEGACY_STUDENT_STORAGE_KEY, JSON.stringify(profileData('10101', '기존 학생', 5)));
  const second = migrateLegacyStudentData({ storage });
  assert.equal(second.reason, 'already-migrated');
  assert.equal(getStudentProfiles(storage)['10101'].actual[0].gradeValue, 2);
});

test('프로필 수에 따라 새 학생·바로 불러오기·학생 선택 시작 상태를 구분한다', () => {
  const storage = new MemoryStorage();
  assert.equal(getStudentProfileStartup(storage).mode, 'new');
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);
  assert.equal(getStudentProfileStartup(storage).mode, 'resume');
  createStudentProfile('10102', '학생 B', profileData('10102', '학생 B', 4), storage);
  assert.equal(getStudentProfileStartup(storage).mode, 'select');
});

test('현재 학생 저장은 선택된 학생번호를 바꾸지 않는다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);
  const edited = profileData('99999', '학생 A 수정', 1);
  const saved = saveCurrentStudentProfile(edited, storage);
  assert.equal(saved.studentNumber, '10101');
  assert.equal(saved.student.studentId, '10101');
  assert.equal(saved.actual[0].gradeValue, 1);
});

test('동일 학번을 새로 생성해도 기존 프로필을 덮어쓰지 않는다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);
  const existing = createStudentProfile('10101', '다른 이름', profileData('10101', '다른 이름', 5), storage);
  assert.equal(existing.name, '학생 A');
  assert.equal(existing.actual[0].gradeValue, 2);
});

test('새 학생 시작은 현재 학생을 저장하고 기존 프로필을 유지한다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);
  const changedA = profileData('10101', '학생 A', 1);
  const blank = { student: { studentId: '', studentName: '' }, actual: [] };
  startNewStudentProfile({ currentProfile: changedA, initialProfile: blank, storage });

  assert.equal(getCurrentStudentProfile(storage), null);
  assert.equal(getStudentProfiles(storage)['10101'].actual[0].gradeValue, 1);
  assert.deepEqual(getStudentProfileStartup(storage).profiles['10101'].student.studentId, '10101');
});

test('JSON 복원용 명시적 교체는 대상 학생만 갱신한다', () => {
  const storage = new MemoryStorage();
  createStudentProfile('10101', '학생 A', profileData('10101', '학생 A', 2), storage);
  createStudentProfile('10102', '학생 B', profileData('10102', '학생 B', 4), storage);
  restoreStudentProfile(profileData('10101', '학생 A', 1, '복원대학교'), storage);

  const profiles = getStudentProfiles(storage);
  assert.equal(profiles['10101'].actual[0].gradeValue, 1);
  assert.equal(profiles['10101'].admissionInterests[0].university, '복원대학교');
  assert.equal(profiles['10102'].actual[0].gradeValue, 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPrintReportModel, renderPrintReport } from '../src/print-report.mjs';
import {
  STUDENT_BACKUP_SCHEMA_VERSION,
  STUDENT_BACKUP_TYPE,
  createStudentBackup,
  parseStudentBackup,
} from '../src/student-backup.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');

function completeStudentState() {
  return {
    student: { studentId: '10101', studentName: '김학생' },
    actual: [
      { id: 'korean', courseId: 'common-korean-1', semesterId: '1-1', subjectName: '공통국어1', subjectGroup: '국어', credit: 4, gradingType: 'grade', fiveLevelEligible: true, gradeValue: '2', achievement: '' },
      { id: 'math', courseId: 'common-math-1', semesterId: '1-1', subjectName: '공통수학1', subjectGroup: '수학', credit: 4, gradingType: 'grade', fiveLevelEligible: true, gradeValue: '3', achievement: '' },
      { id: 'music', courseId: 'music-1', semesterId: '1-1', subjectName: '음악', subjectGroup: '예술', credit: 2, gradingType: 'achievement', fiveLevelEligible: false, gradeValue: '', achievement: 'A' },
    ],
    quickAverages: { '1-2': 2.1 },
    inputModes: { '1-1': 'detailed', '1-2': 'quick' },
    activeSemester: '1-2',
    targetAverage: '2.20',
    weighted: true,
    calculated: true,
    goalCalculated: true,
    includeAchievementCourses: true,
    admissionInterests: [
      { referenceYear: 2026, universityId: 'university-a', university: '검증대학교', department: '경제학과', admissionName: '일반전형', admissionCategory: '학생부교과', cut70Original: 3.2, cut70Converted: 1.95, comparisonBasis: 'current', comparisonScore: 2.3, sourceUrl: 'https://example.edu/result' },
      { referenceYear: 2026, universityId: 'university-b', university: '확인대학교', department: '경영학과', admissionName: '학생부종합', admissionCategory: '학생부종합', averageGradeOriginal: 3.4, averageGradeConverted: 2.1, comparisonReferenceType: 'average-grade', comparisonBasis: 'reference', sourceUrl: 'https://example.edu/comprehensive' },
    ],
    admissionUi: {
      admissionViewMode: 'student-record-subject',
      comparisonBasis: 'target',
      admissionFilters: { region: '부산광역시', ownership: 'national', university: '', field: 'humanities', department: '경제', admissionName: '일반전형' },
    },
  };
}

test('현재 학생 프로필을 JSON 백업 형식으로 복제한다', () => {
  const profile = completeStudentState();
  const backup = createStudentBackup(profile, '2026-09-17T00:00:00.000Z');
  backup.student.studentName = '변경';
  assert.equal(profile.student.studentName, '김학생');
  assert.equal(backup.admissionInterests[0].department, '경제학과');
  assert.equal(backup.backupType, STUDENT_BACKUP_TYPE);
  assert.equal(backup.schemaVersion, STUDENT_BACKUP_SCHEMA_VERSION);
  assert.equal(backup.exportedAt, '2026-09-17T00:00:00.000Z');
});

test('학생 정보·상세/성취도 성적·목표·관심 대학·입결 UI 상태가 백업 왕복 후 유지된다', () => {
  const profile = completeStudentState();
  const restored = parseStudentBackup(JSON.stringify(createStudentBackup(profile, '2026-09-17T00:00:00.000Z')));
  assert.deepEqual(restored.student, profile.student);
  assert.deepEqual(restored.actual, profile.actual);
  assert.deepEqual(restored.quickAverages, profile.quickAverages);
  assert.deepEqual(restored.inputModes, profile.inputModes);
  assert.equal(restored.targetAverage, profile.targetAverage);
  assert.equal(restored.weighted, true);
  assert.equal(restored.calculated, true);
  assert.equal(restored.goalCalculated, true);
  assert.deepEqual(restored.admissionInterests, profile.admissionInterests);
  assert.deepEqual(restored.admissionUi, profile.admissionUi);
});

test('백업 복원 데이터로 현재 내신·목표 시뮬레이션·관심 대학 인쇄를 다시 계산한다', () => {
  const restored = parseStudentBackup(JSON.stringify(createStudentBackup(completeStudentState())));
  const remainingRecords = [
    { id: 'remaining-2-1', semesterId: '2-1', subjectName: '남은 학기', subjectGroup: '', credit: 1 },
    { id: 'remaining-2-2', semesterId: '2-2', subjectName: '남은 학기', subjectGroup: '', credit: 1 },
  ];
  const model = buildPrintReportModel(restored, { remainingRecords, now: new Date('2026-09-18T00:00:00.000Z') });
  const html = renderPrintReport(model);
  assert.equal(model.student.studentId, '10101');
  assert.equal(model.student.studentName, '김학생');
  assert.equal(model.current.average, 2.46);
  assert.equal(model.goal.targetAverage, 2.2);
  assert.equal(model.interests.subject.length, 1);
  assert.equal(model.interests.comprehensive.length, 1);
  assert.match(html, /검증대학교/);
  assert.match(html, /확인대학교/);
});

test('구버전 무표식 백업은 알려진 학생 상태 구조일 때 schemaVersion 1로 마이그레이션한다', () => {
  const legacy = completeStudentState();
  delete legacy.admissionUi;
  const restored = parseStudentBackup(JSON.stringify(legacy));
  assert.equal(restored.schemaVersion, 1);
  assert.equal(restored.backupType, STUDENT_BACKUP_TYPE);
  assert.equal(restored.student.studentId, '10101');
});

test('현재 버전 백업의 선택 필드가 일부 없어도 필수 학생·성적 구조가 있으면 불러온다', () => {
  const partial = {
    backupType: STUDENT_BACKUP_TYPE,
    schemaVersion: 1,
    exportedAt: '2026-09-18T00:00:00.000Z',
    student: { studentId: '10101', studentName: '김학생' },
    actual: [],
  };
  const restored = parseStudentBackup(JSON.stringify(partial));
  assert.deepEqual(restored.actual, []);
  assert.equal(restored.targetAverage, undefined);
});

test('잘못된 JSON·타 앱 JSON·필수 구조 누락·미지원 신버전을 안전하게 거부한다', () => {
  assert.throws(() => parseStudentBackup('{bad'), /JSON/);
  assert.throws(() => parseStudentBackup(JSON.stringify({ app: 'other', values: [] })), /백업 형식/);
  assert.throws(() => parseStudentBackup(JSON.stringify({ backupType: STUDENT_BACKUP_TYPE, schemaVersion: 1, student: {} })), /성적 데이터/);
  assert.throws(() => parseStudentBackup(JSON.stringify({ backupType: STUDENT_BACKUP_TYPE, schemaVersion: 99, student: {}, actual: [] })), /새로운 버전/);
});

test('학생 앱은 덮어쓰기 확인 후 상태·입결 UI를 복원하고 전체 화면과 인쇄를 다시 렌더링한다', () => {
  assert.match(app, /현재 입력 내용이 백업 파일의 내용으로 바뀝니다\. 불러올까요\?/);
  assert.match(app, /state = normalizeState\(imported\);/);
  assert.match(app, /restoreStudentBackupUiState\(imported\.admissionUi\);/);
  assert.match(app, /render\(\); showToast\('백업 데이터를 불러왔습니다\.'\)/);
  assert.match(app, /function render\(\)[\s\S]*?renderPrintReport\(\)/);
  assert.match(app, /gradeValue:[\s\S]*?Number\.isInteger\(grade\)[\s\S]*?grade >= 1 && grade <= 5/);
});

test('학생 개인 데이터 자동저장은 재도입하지 않고 학교 공통 설정만 localStorage를 사용한다', () => {
  assert.match(app, /function loadState\(\)\s*{[\s\S]*?return defaultState\(\);/);
  assert.match(app, /function saveState\(\)\s*{[\s\S]*?return state;/);
  assert.equal((app.match(/localStorage/g) ?? []).length, 1);
  assert.match(app, /getSchoolSettings\(localStorage\)/);
});

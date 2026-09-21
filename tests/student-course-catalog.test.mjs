import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCHOOL_COURSES, recordFromCourse } from '../src/course-catalog.mjs';
import { buildStudentGradeModels } from '../src/semester-grade-model.mjs';
import { buildPrintReportModel, renderPrintReport } from '../src/print-report.mjs';
import {
  buildCatalogAwareGradeState,
  catalogSupportForYear,
  getCatalogForEntryYear,
  getSupportedEntryYears,
  resolveEntryYear,
} from '../src/student-course-catalog.mjs';

const [appSource, teacherSource, html] = await Promise.all([
  readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/teacher-app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

function detailedRecord(entryYear = 2026, gradeValue = '2') {
  const course = SCHOOL_COURSES.find((item) => item.entryYear === entryYear && item.id === 'common-korean-1');
  return { ...recordFromCourse(course, `record-${entryYear}`), gradeValue };
}

test('현재 실제 학생 화면 지원 입학생 연도는 검증된 2026 하나다', () => {
  assert.deepEqual(getSupportedEntryYears(), [2026]);
  assert.deepEqual(getSupportedEntryYears(SCHOOL_COURSES), [2026]);
  assert.equal(catalogSupportForYear(2026, SCHOOL_COURSES).studentSupported, true);
  assert.equal(catalogSupportForYear(2025, SCHOOL_COURSES).studentSupported, false);
});

test('5자리 학번 첫 자리의 현재 학년으로 입학생 연도를 결정한다', () => {
  assert.deepEqual(resolveEntryYear({ studentId: '10101' }).status, 'supported');
  assert.equal(resolveEntryYear({ studentId: '10101' }).entryYear, 2026);
  assert.equal(resolveEntryYear({ studentId: '20101' }).entryYear, 2025);
  assert.equal(resolveEntryYear({ studentId: '20101' }).status, 'unsupported');
  assert.equal(resolveEntryYear({ studentId: '30101' }).entryYear, 2024);
  assert.equal(resolveEntryYear({ studentId: '00101' }).status, 'invalid');
  assert.equal(resolveEntryYear({ studentId: '1010' }).status, 'pending');
});

test('지원하지 않는 연도는 2026 카탈로그로 fallback하지 않는다', () => {
  assert.equal(getCatalogForEntryYear(2025, SCHOOL_COURSES), null);
  assert.equal(getCatalogForEntryYear(2099, SCHOOL_COURSES), null);
  assert.ok(getCatalogForEntryYear(2026, SCHOOL_COURSES).length > 0);
});

test('상세 입력은 해결된 입학생 연도의 레코드만 계산에 사용한다', () => {
  const base = {
    student: { studentId: '10101' },
    actual: [detailedRecord(2026, '2'), { ...detailedRecord(2026, '4'), id: 'wrong-year', entryYear: 2025 }],
    quickAverages: {},
    weighted: true,
  };
  const context = resolveEntryYear(base.student);
  const filtered = buildCatalogAwareGradeState(base, context, SCHOOL_COURSES);
  assert.equal(filtered.actual.length, 1);
  assert.equal(buildStudentGradeModels(filtered).current.average, 2);
});

test('미지원 입학생 연도에서는 상세입력을 제외하고 간편입력과 미래 학기 모델은 안전하게 동작한다', () => {
  const base = {
    student: { studentId: '20101' },
    actual: [detailedRecord(2026, '1')],
    quickAverages: { '1-1': 3, '1-2': 2.5 },
    weighted: true,
    calculated: true,
  };
  const context = resolveEntryYear(base.student);
  const filtered = buildCatalogAwareGradeState(base, context, SCHOOL_COURSES);
  const models = buildStudentGradeModels(filtered);
  assert.equal(filtered.actual.length, 0);
  assert.equal(models.current.average, 2.75);
  assert.deepEqual(models.remaining.remainingSemesters.map((semester) => semester.id), ['2-1', '2-2', '3-1']);
});

test('학교 선택과목 개설 수는 목표 시뮬레이션의 남은 학기 수나 가중치를 바꾸지 않는다', () => {
  const base = { student: { studentId: '10101' }, actual: [detailedRecord(2026, '2')], quickAverages: {}, weighted: true };
  const context = resolveEntryYear(base.student);
  const smallCatalog = SCHOOL_COURSES.filter((course) => course.id === 'common-korean-1');
  const largeCatalog = [...SCHOOL_COURSES, ...Array.from({ length: 50 }, (_, index) => ({ ...SCHOOL_COURSES[0], id: `extra-${index}`, autoGenerate: false }))];
  const small = buildStudentGradeModels(buildCatalogAwareGradeState(base, context, smallCatalog)).remaining;
  const large = buildStudentGradeModels(buildCatalogAwareGradeState(base, context, largeCatalog)).remaining;
  assert.deepEqual(large.remainingRecords, small.remainingRecords);
  assert.ok(large.remainingRecords.every((record) => record.credit === 1));
});

test('인쇄 모델은 화면·목표 모델과 같은 입학생 연도 필터가 적용된 상태를 사용한다', () => {
  const base = {
    student: { studentId: '20101', studentName: '김학생' },
    actual: [detailedRecord(2026, '1')],
    quickAverages: { '1-1': 3 },
    weighted: true,
    calculated: true,
    goalCalculated: false,
  };
  const context = resolveEntryYear(base.student);
  const filtered = buildCatalogAwareGradeState(base, context, SCHOOL_COURSES);
  const screenAverage = buildStudentGradeModels(filtered).current.average;
  const print = buildPrintReportModel(filtered);
  assert.equal(screenAverage, 3);
  assert.equal(print.current.average, screenAverage);
  assert.equal(print.current.catalogEntryYear, 2025);
  assert.match(renderPrintReport(print), /2025학년도 상세 과목 미지원 · 간편입력 기준/);
});

test('학생 UI는 미지원 연도에서 상세입력을 막고 간편입력은 유지한다', () => {
  assert.match(html, /id="course-catalog-status"/);
  assert.match(appSource, /현재 \$\{catalogContext\.entryYear\}학년도 입학생 과목 정보는 아직 준비되지 않았어요/);
  assert.match(appSource, /data-input-mode="quick"/);
  assert.match(appSource, /detailedSupported \? '' : 'disabled aria-disabled="true"'/);
  assert.match(appSource, /selectableCoursesForSemester\(semesterId, context\.entryYear/);
  assert.match(appSource, /buildPrintReportModel\(gradeCalculationState\(\)\)/);
});

test('관리자 과목 관리는 편집 가능 연도와 학생 화면 지원 연도를 구분해 표시한다', () => {
  assert.match(teacherSource, /catalogSupportForYear/);
  assert.match(teacherSource, /학생 화면 지원 중/);
  assert.match(teacherSource, /과목 데이터 있음 · 학생 화면 미지원/);
  assert.match(teacherSource, /upsertCatalogCourse/);
  assert.match(teacherSource, /resetCatalogOverrides/);
});

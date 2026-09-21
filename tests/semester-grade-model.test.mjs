import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRequiredRemainingAverage } from '../src/grade-calculator.mjs';
import { createGoalScenarioSummaries } from '../src/goal-simulation.mjs';
import { buildPrintReportModel, renderPrintReport } from '../src/print-report.mjs';
import { createStudentBackup, parseStudentBackup } from '../src/student-backup.mjs';
import { buildStudentGradeModels } from '../src/semester-grade-model.mjs';

function course(semesterId, index, gradeValue, credit = 4) {
  return {
    id: `${semesterId}-${index}`,
    semesterId,
    subjectName: `과목 ${index}`,
    subjectGroup: '공통',
    gradingType: 'grade',
    fiveLevelEligible: true,
    gradeValue,
    credit,
  };
}

function state(overrides = {}) {
  return {
    student: { studentId: '10101', studentName: '학생' },
    actual: [],
    quickAverages: {},
    weighted: true,
    calculated: true,
    goalCalculated: true,
    targetAverage: '2.50',
    admissionInterests: [],
    ...overrides,
  };
}

test('모든 학기 간편입력은 학기별 동일 비중으로 계산한다', () => {
  const model = buildStudentGradeModels(state({ quickAverages: { '1-1': 2, '1-2': 4 } }));
  assert.equal(model.current.average, 3);
  assert.deepEqual(model.current.semesterRecords.map(({ credit }) => credit), [1, 1]);
});

test('모든 학기 상세입력은 학기 안에서만 학점 가중하고 학기끼리는 동일 비중으로 계산한다', () => {
  const actual = [course('1-1', 1, 1, 4), course('1-1', 2, 3, 2), course('1-2', 3, 4, 3)];
  const weighted = buildStudentGradeModels(state({ actual, weighted: true }));
  const unweighted = buildStudentGradeModels(state({ actual, weighted: false }));
  assert.equal(weighted.current.semesters[0].average, 1.67);
  assert.equal(weighted.current.average, 2.83);
  assert.equal(unweighted.current.semesters[0].average, 2);
  assert.equal(unweighted.current.average, 3);
});

test('상세 4학점 6과목 2.00과 다음 학기 간편 4.00은 ON/OFF 모두 3.00이다', () => {
  const actual = Array.from({ length: 6 }, (_, index) => course('1-1', index + 1, 2, 4));
  [true, false].forEach((weighted) => {
    const model = buildStudentGradeModels(state({ actual, quickAverages: { '1-2': 4 }, weighted }));
    assert.equal(model.current.average, 3);
    assert.equal(model.current.semesterRecords.length, 2);
  });
});

test('상세 학기의 과목 수가 늘어도 간편입력 학기의 비중을 압도하지 않는다', () => {
  const sixCourses = Array.from({ length: 6 }, (_, index) => course('1-1', index + 1, 2));
  const twelveCourses = Array.from({ length: 12 }, (_, index) => course('1-1', index + 1, 2));
  const quickAverages = { '1-2': 4 };
  assert.equal(buildStudentGradeModels(state({ actual: sixCourses, quickAverages })).current.average, 3);
  assert.equal(buildStudentGradeModels(state({ actual: twelveCourses, quickAverages })).current.average, 3);
});

test('마지막 완료 학기 이전 누락은 과거 누락이고 이후 학기만 미래다', () => {
  const input = state({ quickAverages: { '1-1': 2, '2-1': 3 } });
  const model = buildStudentGradeModels(input);
  assert.deepEqual(model.remaining.missingPastSemesters.map(({ id }) => id), ['1-2']);
  assert.deepEqual(model.remaining.remainingSemesters.map(({ id }) => id), ['2-2', '3-1']);
  const print = buildPrintReportModel(input);
  assert.deepEqual(print.goal.missingPastSemesters, ['1학년 2학기']);
  assert.match(renderPrintReport(print), /1학년 2학기 성적이 비어 있어 현재 평균에서 제외했습니다/);
});

test('미래 학교 개설 과목 수와 무관하게 남은 학기는 각각 한 단위다', () => {
  const base = state({ quickAverages: { '1-1': 2 } });
  const withUnusedFutureCourses = state({
    quickAverages: { '1-1': 2 },
    actual: Array.from({ length: 20 }, (_, index) => ({ ...course('2-1', index + 1, '', 3), gradeValue: '' })),
  });
  const first = buildStudentGradeModels(base).remaining.remainingRecords;
  const second = buildStudentGradeModels(withUnusedFutureCourses).remaining.remainingRecords;
  assert.deepEqual(second, first);
  assert.deepEqual(first.map(({ semesterId, credit }) => ({ semesterId, credit })), [
    { semesterId: '1-2', credit: 1 },
    { semesterId: '2-1', credit: 1 },
    { semesterId: '2-2', credit: 1 },
    { semesterId: '3-1', credit: 1 },
  ]);
});

test('현재 내신·목표 시뮬레이션·인쇄가 같은 학기 단위 모델을 사용한다', () => {
  const actual = Array.from({ length: 6 }, (_, index) => course('1-1', index + 1, 2, 4));
  const input = state({ actual, quickAverages: { '1-2': 4 }, targetAverage: '2.8' });
  const models = buildStudentGradeModels(input);
  const required = calculateRequiredRemainingAverage(
    models.current.semesterRecords,
    models.remaining.remainingRecords,
    2.8,
    false,
  );
  const scenarios = createGoalScenarioSummaries(
    models.current.semesterRecords,
    models.remaining.remainingRecords,
    required,
    false,
  );
  const print = buildPrintReportModel(input);
  assert.equal(models.current.average, 3);
  assert.equal(print.current.average, 3);
  assert.equal(print.goal.requiredAverage, required);
  scenarios.forEach(({ finalAverage }) => assert.ok(Math.abs(finalAverage - 2.8) <= 0.01));
});

test('백업 복원 뒤에도 동일한 공통 모델로 다시 계산한다', () => {
  const input = state({
    actual: [course('1-1', 1, 2, 4), course('1-1', 2, 3, 2)],
    quickAverages: { '1-2': 4 },
  });
  const before = buildStudentGradeModels(input).current.average;
  const restored = parseStudentBackup(JSON.stringify(createStudentBackup(input)));
  assert.equal(buildStudentGradeModels(restored).current.average, before);
  assert.equal(buildPrintReportModel(restored).current.average, before);
});

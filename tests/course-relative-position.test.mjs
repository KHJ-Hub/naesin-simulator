import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCourseRelativePosition,
  formatCourseRelativePercentage,
  validateCourseRankReference,
} from '../src/course-relative-position.mjs';
import { buildStudentGradeModels } from '../src/semester-grade-model.mjs';

const course = (overrides = {}) => ({
  id: Math.random().toString(16), semesterId: '1-1', subjectName: '공통국어1', credit: 4,
  gradingType: 'grade', fiveLevelEligible: true, courseRank: '40', courseRankTotal: '200', ...overrides,
});

test('한 학기 안에서는 유효한 과목 석차 비율을 학점으로 가중한다', () => {
  const model = buildCourseRelativePosition({
    inputModes: { '1-1': 'detailed' },
    actual: [
      course({ subjectName: '국어', credit: 4, courseRank: '40' }),
      course({ subjectName: '수학', credit: 4, courseRank: '70' }),
      course({ subjectName: '영어', credit: 3, courseRank: '30' }),
    ],
  });
  assert.equal(Number(model.percentage.toFixed(2)), 24.09);
  assert.equal(model.percentageLabel, '24.1%');
  assert.equal(model.courseCount, 3);
  assert.equal(model.credits, 11);
});

test('학기별 상대 위치는 학점 합계와 무관하게 학기 사이 동일 비중으로 평균한다', () => {
  const model = buildCourseRelativePosition({
    inputModes: { '1-1': 'detailed', '1-2': 'detailed' },
    actual: [
      course({ semesterId: '1-1', credit: 2, courseRank: '20', courseRankTotal: '100' }),
      course({ semesterId: '1-2', credit: 8, courseRank: '30', courseRankTotal: '100' }),
    ],
  });
  assert.equal(model.percentage, 25);
  assert.equal(model.percentageLabel, '25%');
  assert.deepEqual(model.semesters.map(({ percentage }) => percentage), [20, 30]);
});

test('부분·범위초과·0·음수·소수·문자 입력은 유효한 참고값으로 사용하지 않는다', () => {
  const invalid = [
    { courseRank: '2', courseRankTotal: '' },
    { courseRank: '201', courseRankTotal: '200' },
    { courseRank: '0', courseRankTotal: '200' },
    { courseRank: '-1', courseRankTotal: '200' },
    { courseRank: '1.5', courseRankTotal: '200' },
    { courseRank: '가', courseRankTotal: '200' },
  ];
  invalid.forEach((record) => assert.notEqual(validateCourseRankReference(record).status, 'valid'));
  assert.equal(buildCourseRelativePosition({ inputModes: { '1-1': 'detailed' }, actual: invalid.map(course) }), null);
});

test('A/B/C·P/F 과목과 간편입력 학기는 상대 위치 집계에서 제외한다', () => {
  const model = buildCourseRelativePosition({
    inputModes: { '1-1': 'detailed', '1-2': 'quick', '2-1': 'detailed' },
    actual: [
      course(),
      course({ semesterId: '1-2', courseRank: '10', courseRankTotal: '100' }),
      course({ semesterId: '2-1', gradingType: 'achievement', fiveLevelEligible: false, courseRank: '10', courseRankTotal: '100' }),
      course({ semesterId: '2-1', gradingType: 'passfail', fiveLevelEligible: false, courseRank: '10', courseRankTotal: '100' }),
    ],
  });
  assert.equal(model.courseCount, 1);
  assert.equal(model.percentage, 20);
});

test('미입력 시 결과가 없고 유효 비율 라벨은 소수 첫째 자리까지만 표시한다', () => {
  assert.equal(buildCourseRelativePosition({ actual: [] }), null);
  assert.equal(formatCourseRelativePercentage(0.5), '0.5%');
  assert.equal(formatCourseRelativePercentage(100), '100%');
});

test('과목 석차 입력은 기존 현재 내신 계산값에 영향을 주지 않는다', () => {
  const base = {
    inputModes: { '1-1': 'detailed' }, weighted: true,
    actual: [
      course({ gradeValue: '2', courseRank: '', courseRankTotal: '' }),
      course({ subjectName: '수학', gradeValue: '3', courseRank: '', courseRankTotal: '' }),
    ],
  };
  const withRanks = {
    ...base,
    actual: base.actual.map((record, index) => ({ ...record, courseRank: index ? '70' : '40', courseRankTotal: '200' })),
  };
  assert.equal(buildStudentGradeModels(base).current.average, 2.5);
  assert.equal(buildStudentGradeModels(withRanks).current.average, 2.5);
});

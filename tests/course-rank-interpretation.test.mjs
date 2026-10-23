import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretCourseRankPosition } from '../src/course-rank-interpretation.mjs';
import { buildGradePositionModel, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';
import { buildCourseRelativePosition } from '../src/course-relative-position.mjs';
import { buildCurrentGradeModel } from '../src/semester-grade-model.mjs';

for (const [average, converted, percentage, grade5, grade9] of [
  [1.65, 2.64, 15.7, 2, 3],
  [2.65, 4.43, 43.2, 3, 5],
  [4.04, 6.78, 78, 4, 7],
]) {
  test(`내신 ${average} / 환산 ${converted} / 석차 위치 ${percentage}%의 표시 해석`, () => {
    const actual = Array.from({ length: 100 }, (_, i) => ({
      semesterId: '1-1', subjectName: `검증 과목 ${i + 1}`, credit: 1,
      gradingType: 'grade', gradeValue: i < Math.round((average % 1) * 100) ? Math.ceil(average) : Math.floor(average),
      courseRank: String(Math.round(percentage * 10)), courseRankTotal: '1000',
    }));
    const state = { actual, weighted: true, inputModes: { '1-1': 'detailed' } };
    const current = buildCurrentGradeModel(state);
    assert.equal(current.average, average);
    assert.equal(buildGradePositionModel(current.average).grade9, converted);
    const relative = buildCourseRelativePosition(state);
    assert.ok(Math.abs(relative.percentage - percentage) < 1e-10);
    const interpretation = interpretCourseRankPosition(relative.percentage);
    assert.equal(interpretation.grade5, grade5);
    assert.equal(interpretation.grade9, grade9);
    assert.equal(interpretation.label, `참고 위치 기준 · 5등급제 ${grade5}등급 구간 / 9등급제 ${grade9}등급 구간`);
    assert.equal(buildCurrentGradeModel({ ...state, actual: actual.map(({ courseRank, courseRankTotal, ...record }) => record) }).average, average);
  });
}

test('누적 경계 자체는 상한 구간에 포함하고 경계 직후에는 다음 구간으로 표시한다', () => {
  for (const [key, field] of [['grade5', 'grade5'], ['grade9', 'grade9']]) {
    GRADE_POSITION_SCALES[key].cumulativePercentages.forEach((boundary, index) => {
      assert.equal(interpretCourseRankPosition(boundary)[field], index + 1);
      if (boundary < 100) assert.equal(interpretCourseRankPosition(boundary + 0.001)[field], index + 2);
    });
  }
  assert.equal(interpretCourseRankPosition(0).grade5, 1);
});

test('석차 위치가 없거나 유효하지 않으면 등급 구간을 추정하지 않는다', () => {
  for (const value of [null, undefined, '', '43.2', NaN, Infinity, -1, 101]) {
    assert.equal(interpretCourseRankPosition(value), null);
  }
});

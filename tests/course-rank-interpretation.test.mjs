import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel } from '../src/grade-position.mjs';
import { buildCourseRelativePosition } from '../src/course-relative-position.mjs';
import { buildCurrentGradeModel } from '../src/semester-grade-model.mjs';

for (const [average, converted, percentage] of [
  [1.65, 2.64, 15.7],
  [2.65, 4.43, 43.2],
  [4.04, 6.78, 78],
]) {
  test(`내신 ${average} / 환산 ${converted} / 석차 위치 ${percentage}%는 독립된 계산값으로 유지한다`, () => {
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
    assert.equal(buildCurrentGradeModel({ ...state, actual: actual.map(({ courseRank, courseRankTotal, ...record }) => record) }).average, average);
  });
}

test('학생 UI는 석차 위치를 환산값과 구획하고 특정 등급으로 자동 해석하지 않는다', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /interpretCourseRankPosition|course-rank-interpretation|참고 위치 기준 ·|interpretation\.grade/);
  assert.match(app, /석차 기준 위치와 9등급 환산값은 계산 기준이 서로 다른 별도 참고정보예요/);
  assert.match(app, /실제 전교 석차나 대학의 공식 백분위를 의미하지 않아요/);
  assert.match(app, /<section class="course-rank-info"/);
  assert.match(app, /두 등급제의 누적 등급 구간을 비교하는 참고표예요/);
  assert.match(app, /석차 기준 위치 · \$\{relative.percentageLabel\}/);
  assert.match(app, /\$\{relative.courseCount\}과목 · \$\{relative.credits\}학점 반영/);
});

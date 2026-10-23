import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel } from '../src/grade-position.mjs';
import { buildCourseRelativePosition } from '../src/course-relative-position.mjs';
import { buildCurrentGradeModel } from '../src/semester-grade-model.mjs';
import { renderCourseRankPosition, renderCourseRankGrade5Marker } from '../src/course-rank-position-view.mjs';
import { buildPrintReportModel, renderPrintReport } from '../src/print-report.mjs';

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
    const html = renderCourseRankPosition(relative);
    assert.doesNotMatch(html, /course-rank-track|course-rank-marker/);
    const marker = renderCourseRankGrade5Marker(relative, 5);
    assert.match(marker, /course-rank-grade5-line/);
    assert.ok(marker.includes(`left:${relative.percentage}%`));
    assert.ok(marker.includes(`석차 기준 참고 위치 · ${relative.percentageLabel}`));
    assert.doesNotMatch(marker, /현재 [1-9]등급|실제 [1-9]등급/);
    assert.equal(renderCourseRankGrade5Marker(relative, 9), '');
    assert.ok(html.includes(`${relative.percentageLabel} 지점`));
    assert.doesNotMatch(html, /[1-9]등급|전교 상위/);
    const printModel = buildPrintReportModel({ ...state, calculated: true });
    assert.equal(printModel.current.average, average);
    assert.equal(printModel.current.courseRelativePosition.percentageLabel, relative.percentageLabel);
    const printHtml = renderPrintReport(printModel);
    assert.ok(printHtml.includes(relative.percentageLabel));
    assert.doesNotMatch(printHtml, /course-rank-track|course-relative-band-marker|참고 위치 기준 ·|[59]등급제 [1-9]등급 구간/);
    assert.equal(buildCurrentGradeModel({ ...state, actual: actual.map(({ courseRank, courseRankTotal, ...record }) => record) }).average, average);
  });
}

test('학생 UI는 석차 위치를 환산값과 구획하고 특정 등급으로 자동 해석하지 않는다', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /interpretCourseRankPosition|course-rank-interpretation|참고 위치 기준 ·|interpretation\.grade/);
  assert.match(app, /9등급 환산값과는 계산 기준이 다른 별도 참고정보예요/);
  assert.match(app, /<section class="course-rank-info"/);
  assert.match(app, /5등급제와 9등급제의 등급별 누적 구간을 비교한 참고표예요/);
  assert.match(app, /renderCourseRankPosition\(relative\)/);
});

test('석차 미입력 시 요약과 마커가 없고 끝값도 5등급제에만 표시한다', () => {
  assert.equal(renderCourseRankPosition(buildCourseRelativePosition({ actual: [] })), '');
  assert.equal(renderCourseRankGrade5Marker(null, 5), '');
  for (const percentage of [0, 0.1, 100]) {
    const html = renderCourseRankPosition({ percentage, courseCount: 6, credits: 23 });
    assert.ok(renderCourseRankGrade5Marker({ percentage }, 5).includes(`left:${percentage}%`));
    assert.equal(renderCourseRankGrade5Marker({ percentage }, 9), '');
    assert.match(html, /석차 입력 6과목 · 23학점 반영/);
    assert.match(html, /실제 전교 전체 석차나 대학의 공식 백분위를 의미하지 않아요/);
  }
  for (const percentage of [-1, 101, NaN, undefined]) {
    assert.equal(renderCourseRankPosition({ percentage }), '');
    assert.equal(renderCourseRankGrade5Marker({ percentage }, 5), '');
  }
});

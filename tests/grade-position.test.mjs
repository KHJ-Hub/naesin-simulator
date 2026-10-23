import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';

test('현재 내신과 기존 환산값 및 누적 비율 구간을 유지한다', () => {
  const model = buildGradePositionModel(2.8);
  assert.equal(model.grade5, 2.8);
  assert.equal(model.grade9, 4.67);
  assert.equal('grade5LinearPosition' in model, false);
  assert.equal('grade9LinearPosition' in model, false);
  assert.deepEqual(model.grade5Scale.cumulativePercentages, [10, 34, 66, 90, 100]);
  assert.deepEqual(model.grade9Scale.cumulativePercentages, [4, 11, 23, 40, 60, 77, 89, 96, 100]);
  assert.deepEqual(model.grade5Scale.bandPercentages, [10, 24, 32, 24, 10]);
  assert.deepEqual(model.grade9Scale.bandPercentages, [4, 7, 12, 17, 20, 17, 12, 7, 4]);
  assert.equal(model.conversionDataset, 'busan-grade5-g2-1sem-15978');
  assert.equal(model.isApproximate, true);
});

test('기존 교육청 환산값은 그대로 유지한다', () => {
  assert.equal(buildGradePositionModel(1.35).grade9, 2.11);
  assert.equal(buildGradePositionModel(4.6).grade9, 7.7);
});

test('등급 위치 카드는 중복 선형 그래프와 전체 석차 입력 없이 누적 비율 막대만 렌더링한다', async () => {
  const [indexSource, appSource, styles] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(indexSource, /<p class="eyebrow">5등급제 · 9등급제<\/p><h2 id="grade-position-title">등급 구간 비교<\/h2>/);
  assert.doesNotMatch(appSource, /gradeValuePositionHtml|gradeValueScaleHtml|grade-value-position|grade-value-marker-label/);
  assert.doesNotMatch(appSource, /data-rank-reference|actual-rank|실제 석차 기준/);
  assert.doesNotMatch(styles, /\.grade-value-position|\.grade-value-marker|\.actual-rank/);
  assert.match(appSource, /grade-position-percent-axis/);
  assert.doesNotMatch(appSource, /course-relative-band-marker/);
  assert.match(appSource, /과목별 석차를 입력하면 상대 위치도 확인할 수 있어요/);
  assert.match(styles, /\.grade-position-comparison \{[\s\S]*?font-family: "Gowun Dodum", "Malgun Gothic", system-ui, sans-serif/);
});

test('5등급 경계는 위, 9등급 경계는 아래에 실제 좌표로 표시한다', async () => {
  const [appSource, styles] = await Promise.all([
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  const positionSection = appSource.slice(appSource.indexOf('function gradeScaleBandsHtml'), appSource.indexOf('function renderSubjectSummary'));
  assert.match(positionSection, /scale\.cumulativePercentages\.slice\(0, -1\)/);
  assert.match(positionSection, /scale\.scale === 5 \? 'is-top' : 'is-bottom'/);
  assert.match(positionSection, /scale\.scale === 5 \? `\$\{percentageAxis\}\$\{bands\}` : `\$\{bands\}\$\{percentageAxis\}`/);
  assert.match(styles, /grade-position-percent-axis\.is-top[\s\S]*?margin-bottom/);
  assert.match(styles, /\.grade-position-bands\[data-scale="5"\][\s\S]*?#cbb9f3[\s\S]*?#afe5cc/);
  assert.match(styles, /\.grade-position-bands\[data-scale="9"\][\s\S]*?#cbb9f3[\s\S]*?#afe5cc/);
  assert.match(positionSection, /현재 5등급제 평균/);
  assert.match(positionSection, /9등급제 환산 참고/);
});

test('과목별 석차 참고값은 전용 막대로 표시하고 등급 구간에 개인 표시를 넣지 않는다', async () => {
  const appSource = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(appSource, /data-course-rank="courseRank"/);
  assert.match(appSource, /data-course-rank="courseRankTotal"/);
  assert.match(appSource, /buildCourseRelativePosition\(gradeCalculationState\(\)\)/);
  assert.match(appSource, /summary.innerHTML = renderCourseRankPosition\(relative\)/);
  assert.doesNotMatch(appSource, /course-relative-band-marker/);
  const comparison = appSource.slice(appSource.indexOf('function gradePositionComparisonHtml'), appSource.indexOf('function updateCourseRelativePositionUi'));
  assert.doesNotMatch(comparison, /marker|relative\.percentage|참고 위치를 함께 표시/);
});

test('등급 위치 시각화는 인쇄에 추가하지 않고 과목별 상대 위치만 유지한다', async () => {
  const printSource = await readFile(new URL('../src/print-report.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(printSource, /grade-position|내 위치와 등급 구간 비교|실제 석차 참고/);
  assert.match(printSource, /과목별 석차 기준 위치/);
});

test('계산 전이거나 5등급 범위 밖이면 위치 모델을 만들지 않는다', () => {
  assert.equal(buildGradePositionModel(null), null);
  assert.equal(buildGradePositionModel(''), null);
  assert.equal(buildGradePositionModel(0.99), null);
  assert.equal(buildGradePositionModel(5.01), null);
});

test('등급 구간 상수의 합은 각각 100이다', () => {
  assert.equal(GRADE_POSITION_SCALES.grade5.bandPercentages.reduce((sum, value) => sum + value, 0), 100);
  assert.equal(GRADE_POSITION_SCALES.grade9.bandPercentages.reduce((sum, value) => sum + value, 0), 100);
});

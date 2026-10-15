import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';

test('현재 내신과 환산값의 시각적 마커 위치를 각 등급 체계에서 따로 만든다', () => {
  const model = buildGradePositionModel(2);
  assert.equal(model.grade5, 2);
  assert.equal(model.grade9, 3.3);
  assert.equal(model.grade5Position, 10);
  assert.equal(model.grade9Position, 14.6);
  assert.equal('markerPosition' in model, false);
  assert.equal('commonAxisPercentages' in model, false);
  assert.deepEqual(model.grade5Scale.cumulativePercentages, [10, 34, 66, 90, 100]);
  assert.deepEqual(model.grade9Scale.cumulativePercentages, [4, 11, 23, 40, 60, 77, 89, 96, 100]);
  assert.deepEqual(model.grade5Scale.bandPercentages, [10, 24, 32, 24, 10]);
  assert.deepEqual(model.grade9Scale.bandPercentages, [4, 7, 12, 17, 20, 17, 12, 7, 4]);
  assert.equal(model.conversionDataset, 'busan-grade5-g2-1sem-15978');
  assert.equal(model.isApproximate, true);
});

test('5등급 구간은 실제 분포 폭 10·24·32·24·10을 유지한다', () => {
  assert.equal(GRADE_POSITION_SCALES.grade5.scale, 5);
  assert.equal(GRADE_POSITION_SCALES.grade9.scale, 9);
  assert.equal(GRADE_POSITION_SCALES.grade5.cumulativePercentages.at(-1), 100);
  assert.equal(GRADE_POSITION_SCALES.grade9.cumulativePercentages.at(-1), 100);
});

test('5등급 평균은 현재 등급 구간 안에서 piecewise 보간한다', () => {
  assert.equal(buildGradePositionModel(2).grade5Position, 10);
  assert.equal(buildGradePositionModel(2.5).grade5Position, 22);
  assert.equal(buildGradePositionModel(2.99).grade5Position, 33.76);
  assert.equal(buildGradePositionModel(3).grade5Position, 34);
  assert.equal(buildGradePositionModel(3.5).grade5Position, 50);
});

test('두 시각적 마커 위치는 5등급 평균이 커질수록 각각 역전 없이 이동한다', () => {
  let previousGrade5 = -Infinity;
  let previousGrade9 = -Infinity;
  for (let grade = 1; grade <= 5; grade += 0.01) {
    const model = buildGradePositionModel(Number(grade.toFixed(2)));
    assert.ok(model.grade5Position >= previousGrade5);
    assert.ok(model.grade9Position >= previousGrade9);
    previousGrade5 = model.grade5Position;
    previousGrade9 = model.grade9Position;
  }
});

test('1.35의 기존 환산값은 유지하고 마커는 1등급 구간 안에 둔다', () => {
  const model = buildGradePositionModel(1.35);
  assert.equal(model.grade9, 2.11);
  assert.equal(model.grade5Position, 3.5);
  assert.equal(model.grade9Position, 4.77);
});

test('4.60과 환산 7.70은 각 등급 구간 안의 서로 다른 위치에 표시한다', () => {
  const model = buildGradePositionModel(4.6);
  assert.equal(model.grade9, 7.7);
  assert.equal(model.grade5Position, 80.4);
  assert.equal(model.grade9Position, 85.4);
  assert.notEqual(model.grade5Position, model.grade9Position);
});

test('학생 화면은 공통 마커 없이 각 등급 행에 독립 마커를 렌더링한다', async () => {
  const [appSource, styles] = await Promise.all([
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.equal(appSource.includes('grade-position-shared-marker'), false);
  assert.equal(appSource.includes('grade-position-common-axis'), false);
  assert.match(appSource, /grade-position-row-marker/);
  assert.match(appSource, /현재 \$\{fmt\(model\.grade5\)\}/);
  assert.match(appSource, /환산 \$\{fmt\(model\.grade9\)\}/);
  assert.match(appSource, /grade-position-percent-axis/);
  assert.doesNotMatch(styles, /\.grade-position-shared-marker/);
  assert.match(styles, /\.grade-position-row-marker[\s\S]*?width: 2px[\s\S]*?background: #40358a/);
  assert.match(styles, /\.grade-position-marker-label b[\s\S]*?background: #40358a/);
  assert.match(styles, /\.grade-position-comparison \{[\s\S]*?font-family: "Gowun Dodum", "Malgun Gothic", system-ui, sans-serif/);
  assert.match(styles, /\.grade-position-bands\[data-scale="5"\][\s\S]*?font-size: clamp\(\.82rem, 1\.2vw, \.95rem\);[\s\S]*?font-weight: 650/);
  assert.match(styles, /\.grade-position-bands\[data-scale="9"\][\s\S]*?font-size: clamp\(\.82rem, 1\.15vw, \.94rem\);[\s\S]*?font-weight: 600;[\s\S]*?font-variant-numeric: tabular-nums/);
  assert.match(styles, /\.grade-position-scale-row\[data-scale="5"\][\s\S]*?border-top-color: #40358a/);
  assert.match(styles, /\.grade-position-scale-row\[data-scale="9"\][\s\S]*?border-bottom-color: #40358a/);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*?\.grade-position-comparison/);
});

test('학생 화면은 5등급 경계를 막대 위, 9등급 경계를 막대 아래에 표시한다', async () => {
  const [appSource, styles] = await Promise.all([
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  const positionSection = appSource.slice(appSource.indexOf('function gradeScaleBandsHtml'), appSource.indexOf('function renderSubjectSummary'));
  assert.doesNotMatch(positionSection, /공통 누적 위치|누적비율|상위\s*\$?\{?[^<]*%/);
  assert.match(positionSection, /scale\.cumulativePercentages\.slice\(0, -1\)/);
  assert.match(positionSection, /\$\{scale\.scale\}등급제 구간 누적 기준/);
  assert.match(positionSection, /scale\.scale === 5 \? 'is-top' : 'is-bottom'/);
  assert.match(positionSection, /scale\.scale === 5 \? `\$\{percentageAxis\}\$\{markerLabel\}\$\{bands\}` : `\$\{bands\}\$\{markerLabel\}\$\{percentageAxis\}`/);
  assert.match(styles, /grade-position-percent-axis\.is-top[\s\S]*?margin-bottom/);
  assert.match(styles, /\.grade-position-percent-axis \{[\s\S]*?font-size: \.64rem;[\s\S]*?font-weight: 600/);
  assert.match(styles, /\.grade-position-bands\[data-scale="5"\][\s\S]*?#cbb9f3[\s\S]*?#afe5cc/);
  assert.match(styles, /\.grade-position-bands\[data-scale="9"\][\s\S]*?#cbb9f3[\s\S]*?#afe5cc/);
  assert.doesNotMatch(styles, /grade-position-percent-axis\.is-bottom span:nth-child\(even\)/);
  assert.match(positionSection, /실제 석차 백분위가 아니에요/);
  assert.match(positionSection, /실제 석차 백분위가 아닌 등급 환산 기준의 대략적인 위치예요/);
  assert.match(positionSection, /현재 5등급제 평균/);
  assert.match(positionSection, /9등급제 환산 참고/);
});

test('등급 위치 시각화는 인쇄 결과표에 추가하지 않는다', async () => {
  const printSource = await readFile(new URL('../src/print-report.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(printSource, /grade-position|내 등급 위치|환산 기준 위치/);
});

test('계산 전이거나 5등급 범위 밖이면 위치 모델을 만들지 않는다', () => {
  assert.equal(buildGradePositionModel(null), null);
  assert.equal(buildGradePositionModel(''), null);
  assert.equal(buildGradePositionModel(0.99), null);
  assert.equal(buildGradePositionModel(5.01), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';

test('현재 내신으로 두 등급 체계가 공유하는 시각적 마커 위치를 한 번만 만든다', () => {
  const model = buildGradePositionModel(2);
  assert.equal(model.grade5, 2);
  assert.equal(model.grade9, 3.3);
  assert.equal(model.markerPosition, 10);
  assert.equal('grade5Position' in model, false);
  assert.equal('grade9Position' in model, false);
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
  assert.equal(buildGradePositionModel(2).markerPosition, 10);
  assert.equal(buildGradePositionModel(2.5).markerPosition, 22);
  assert.equal(buildGradePositionModel(2.99).markerPosition, 33.76);
  assert.equal(buildGradePositionModel(3).markerPosition, 34);
  assert.equal(buildGradePositionModel(3.5).markerPosition, 50);
});

test('시각적 마커 위치는 5등급 평균이 커질수록 역전 없이 이동한다', () => {
  let previous = -Infinity;
  for (let grade = 1; grade <= 5; grade += 0.01) {
    const position = buildGradePositionModel(Number(grade.toFixed(2))).markerPosition;
    assert.ok(position >= previous);
    previous = position;
  }
});

test('1.35의 기존 환산값은 유지하고 마커는 1등급 구간 안에 둔다', () => {
  const model = buildGradePositionModel(1.35);
  assert.equal(model.grade9, 2.11);
  assert.equal(model.markerPosition, 3.5);
});

test('학생 화면은 두 등급 행을 관통하는 공통 마커 하나만 렌더링한다', async () => {
  const [appSource, styles] = await Promise.all([
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.equal((appSource.match(/grade-position-shared-marker/g) || []).length, 1);
  assert.equal(appSource.includes('grade-position-common-axis'), false);
  assert.equal(appSource.includes('grade-position-marker'), false);
  assert.match(appSource, /grade-position-percent-axis/);
  assert.match(styles, /\.grade-position-shared-marker[\s\S]*?height: 102px/);
  assert.match(appSource, /<b>현재 위치<\/b>/);
  assert.match(styles, /\.grade-position-comparison \{[\s\S]*?font-family: "Gowun Dodum", "Malgun Gothic", system-ui, sans-serif/);
  assert.match(styles, /\.grade-position-bands\[data-scale="5"\][\s\S]*?font-size: clamp\(\.82rem, 1\.2vw, \.95rem\);[\s\S]*?font-weight: 650/);
  assert.match(styles, /\.grade-position-bands\[data-scale="9"\][\s\S]*?font-size: clamp\(\.82rem, 1\.15vw, \.94rem\);[\s\S]*?font-weight: 600;[\s\S]*?font-variant-numeric: tabular-nums/);
  assert.match(styles, /\.grade-position-shared-marker[\s\S]*?width: 3px[\s\S]*?background: #332978/);
  assert.match(styles, /\.grade-position-shared-marker::before[\s\S]*?width: 22px[\s\S]*?background: rgba\(92, 82, 177, \.13\)/);
  assert.doesNotMatch(styles, /\.grade-position-shared-marker::after/);
  assert.match(styles, /\.grade-position-shared-marker b::after[\s\S]*?border-top-color: #332978/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.grade-position-shared-marker \{ height: 94px/);
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
  assert.match(positionSection, /scale\.scale === 5 \? `\$\{percentageAxis\}\$\{bands\}` : `\$\{bands\}\$\{percentageAxis\}`/);
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

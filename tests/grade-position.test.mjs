import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';

test('현재 내신과 기존 환산값은 유지하되 개인 퍼센트 위치를 만들지 않는다', () => {
  const model = buildGradePositionModel(2.8);
  assert.equal(model.grade5, 2.8);
  assert.equal(model.grade9, 4.67);
  assert.equal('markerPosition' in model, false);
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

test('1.35의 기존 환산값은 그대로 유지한다', () => {
  const model = buildGradePositionModel(1.35);
  assert.equal(model.grade9, 2.11);
});

test('4.60의 기존 교육청 환산값도 그대로 유지한다', () => {
  const model = buildGradePositionModel(4.6);
  assert.equal(model.grade9, 7.7);
});

test('학생 화면은 개인 위치 마커 없이 등급 구간 비교표만 렌더링한다', async () => {
  const [indexSource, appSource, styles] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(indexSource, /<p class="eyebrow">5등급제 · 9등급제<\/p><h2 id="grade-position-title">등급 구간 비교<\/h2>/);
  assert.equal(appSource.includes('grade-position-shared-marker'), false);
  assert.equal(appSource.includes('grade-position-common-axis'), false);
  assert.equal(appSource.includes('grade-position-row-marker'), false);
  assert.equal(appSource.includes('grade-position-marker-label'), false);
  assert.doesNotMatch(appSource, /--grade-row-position|grade5Position|grade9Position/);
  assert.doesNotMatch(appSource, /현재 등급 위치|환산 위치 참고/);
  assert.match(appSource, /grade-position-percent-axis/);
  assert.doesNotMatch(styles, /\.grade-position-shared-marker/);
  assert.doesNotMatch(styles, /\.grade-position-row-marker|\.grade-position-marker-label/);
  assert.match(styles, /\.grade-position-comparison \{[\s\S]*?font-family: "Gowun Dodum", "Malgun Gothic", system-ui, sans-serif/);
  assert.match(styles, /\.grade-position-bands\[data-scale="5"\][\s\S]*?font-size: clamp\(\.82rem, 1\.2vw, \.95rem\);[\s\S]*?font-weight: 650/);
  assert.match(styles, /\.grade-position-bands\[data-scale="9"\][\s\S]*?font-size: clamp\(\.82rem, 1\.15vw, \.94rem\);[\s\S]*?font-weight: 600;[\s\S]*?font-variant-numeric: tabular-nums/);
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
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?grade-position-percent-axis\.is-bottom span:nth-child\(even\)[\s\S]*?translate\(-50%, 10px\)/);
  assert.match(positionSection, /현재 내신의 실제 석차 백분위를 의미하지 않아요/);
  assert.match(positionSection, /9등급제 환산값은 교육청 자료를 기준으로 한 참고값이며, 실제 대학별 반영 방식과 다를 수 있어요/);
  assert.match(positionSection, /현재 5등급제 평균/);
  assert.match(positionSection, /9등급제 환산 참고/);
});

test('등급 위치 시각화는 인쇄 결과표에 추가하지 않는다', async () => {
  const printSource = await readFile(new URL('../src/print-report.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(printSource, /grade-position|등급 구간 비교|누적 비율 구간/);
});

test('계산 전이거나 5등급 범위 밖이면 위치 모델을 만들지 않는다', () => {
  assert.equal(buildGradePositionModel(null), null);
  assert.equal(buildGradePositionModel(''), null);
  assert.equal(buildGradePositionModel(0.99), null);
  assert.equal(buildGradePositionModel(5.01), null);
});

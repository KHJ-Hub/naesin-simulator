import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel, gradeValueLinearPosition, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';

test('현재 내신과 기존 환산값은 유지하며 등급 숫자 선형 위치를 별도로 만든다', () => {
  const model = buildGradePositionModel(2.8);
  assert.equal(model.grade5, 2.8);
  assert.equal(model.grade9, 4.67);
  assert.ok(Math.abs(model.grade5LinearPosition - 45) < 1e-10);
  assert.ok(Math.abs(model.grade9LinearPosition - 45.875) < 1e-10);
  assert.equal('markerPosition' in model, false);
  assert.equal('commonAxisPercentages' in model, false);
  assert.deepEqual(model.grade5Scale.cumulativePercentages, [10, 34, 66, 90, 100]);
  assert.deepEqual(model.grade9Scale.cumulativePercentages, [4, 11, 23, 40, 60, 77, 89, 96, 100]);
  assert.deepEqual(model.grade5Scale.bandPercentages, [10, 24, 32, 24, 10]);
  assert.deepEqual(model.grade9Scale.bandPercentages, [4, 7, 12, 17, 20, 17, 12, 7, 4]);
  assert.equal(model.conversionDataset, 'busan-grade5-g2-1sem-15978');
  assert.equal(model.isApproximate, true);
});

test('내 위치는 석차 백분위가 아닌 등급 숫자 사이의 선형 위치다', () => {
  assert.equal(gradeValueLinearPosition(1, 5), 0);
  assert.ok(Math.abs(gradeValueLinearPosition(2.8, 5) - 45) < 1e-10);
  assert.ok(Math.abs(gradeValueLinearPosition(4.67, 9) - 45.875) < 1e-10);
  assert.equal(gradeValueLinearPosition(5, 5), 100);
  assert.equal(gradeValueLinearPosition(0.9, 5), null);
  assert.equal(gradeValueLinearPosition(5.1, 5), null);
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

test('학생 화면은 선형 등급값 위치와 누적 비율 참고표를 분리해 렌더링한다', async () => {
  const [indexSource, appSource, styles] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(indexSource, /<p class="eyebrow">5등급제 · 9등급제<\/p><h2 id="grade-position-title">내 위치와 등급 구간 비교<\/h2>/);
  assert.equal(appSource.includes('grade-position-shared-marker'), false);
  assert.equal(appSource.includes('grade-position-common-axis'), false);
  assert.equal(appSource.includes('grade-position-row-marker'), false);
  assert.doesNotMatch(appSource, /--grade-row-position|grade5Position|grade9Position/);
  assert.match(appSource, /grade-value-position/);
  assert.match(appSource, /grade-value-marker-label/);
  assert.match(appSource, /valueLabel: '현재'/);
  assert.match(appSource, /valueLabel: '환산'/);
  assert.match(appSource, /내 위치/);
  assert.match(appSource, /등급 구간 비율 참고/);
  assert.match(appSource, /data-rank-reference="rank"/);
  assert.match(appSource, /data-rank-reference="total"/);
  assert.match(appSource, /actual-rank-band-marker/);
  assert.match(appSource, /reference\.status !== 'valid'/);
  assert.match(appSource, /grade-position-percent-axis/);
  assert.doesNotMatch(styles, /\.grade-position-shared-marker/);
  assert.doesNotMatch(styles, /\.grade-position-row-marker|\.grade-position-marker-label/);
  assert.match(styles, /\.grade-value-marker-label/);
  assert.match(styles, /\.grade-value-position/);
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
  assert.match(positionSection, /위의 내 위치는 등급 숫자를 기준으로 표시한 위치예요/);
  assert.match(positionSection, /아래 막대는 각 등급이 차지하는 누적 비율을 비교한 참고표예요\. 실제 개인 석차 백분위를 의미하지 않아요/);
  assert.match(positionSection, /9등급제 환산값은 교육청 자료를 기준으로 한 참고값이며, 실제 대학별 반영 방식과 다를 수 있어요/);
  assert.match(positionSection, /현재 5등급제 평균/);
  assert.match(positionSection, /9등급제 환산 참고/);
});

test('과목별 실제 석차 참고값은 선택 입력이며 누적 비율 막대에만 별도 표시한다', async () => {
  const appSource = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(appSource, /data-course-rank="courseRank"/);
  assert.match(appSource, /data-course-rank="courseRankTotal"/);
  assert.match(appSource, /course-relative-band-marker/);
  assert.match(appSource, /과목별 상대 위치 ·/);
  assert.match(appSource, /학교 전체 석차나 대학의 공식 백분위가 아니에요/);
});

test('등급 위치 시각화는 인쇄 결과표에 추가하지 않는다', async () => {
  const printSource = await readFile(new URL('../src/print-report.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(printSource, /grade-position|내 위치와 등급 구간 비교|누적 비율 구간/);
});

test('계산 전이거나 5등급 범위 밖이면 위치 모델을 만들지 않는다', () => {
  assert.equal(buildGradePositionModel(null), null);
  assert.equal(buildGradePositionModel(''), null);
  assert.equal(buildGradePositionModel(0.99), null);
  assert.equal(buildGradePositionModel(5.01), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGradePositionModel, GRADE_POSITION_COMMON_AXIS, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';

test('현재 내신으로 두 등급 체계가 공유하는 누적 위치를 한 번만 만든다', () => {
  const model = buildGradePositionModel(2);
  assert.equal(model.grade5, 2);
  assert.equal(model.grade9, 3.3);
  assert.equal(model.commonPosition, 22);
  assert.equal('grade5Position' in model, false);
  assert.equal('grade9Position' in model, false);
  assert.deepEqual(model.commonAxisPercentages, GRADE_POSITION_COMMON_AXIS);
  assert.deepEqual(model.grade5Scale.cumulativePercentages, [10, 34, 66, 90, 100]);
  assert.deepEqual(model.grade9Scale.cumulativePercentages, [4, 11, 23, 40, 60, 77, 89, 96, 100]);
  assert.deepEqual(model.grade5Scale.bandPercentages, [10, 24, 32, 24, 10]);
  assert.deepEqual(model.grade9Scale.bandPercentages, [4, 7, 12, 17, 20, 17, 12, 7, 4]);
  assert.equal(model.conversionDataset, 'busan-grade5-g2-1sem-15978');
  assert.equal(model.isApproximate, true);
});

test('등급 구간 차트는 공식 등급별 누적비율 경계를 사용한다', () => {
  assert.equal(GRADE_POSITION_SCALES.grade5.scale, 5);
  assert.equal(GRADE_POSITION_SCALES.grade9.scale, 9);
  assert.equal(GRADE_POSITION_SCALES.grade5.cumulativePercentages.at(-1), 100);
  assert.equal(GRADE_POSITION_SCALES.grade9.cumulativePercentages.at(-1), 100);
  assert.deepEqual(GRADE_POSITION_COMMON_AXIS, [4, 10, 23, 34, 60, 77, 90, 100]);
});

test('공통 위치는 5등급 평균이 커질수록 역전 없이 이동한다', () => {
  let previous = -Infinity;
  for (let grade = 1; grade <= 5; grade += 0.01) {
    const position = buildGradePositionModel(Number(grade.toFixed(2))).commonPosition;
    assert.ok(position >= previous);
    previous = position;
  }
});

test('학생 화면은 두 등급 행을 관통하는 공통 마커 하나와 공통 축 하나만 렌더링한다', async () => {
  const appSource = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.equal((appSource.match(/grade-position-shared-marker/g) || []).length, 1);
  assert.equal((appSource.match(/grade-position-common-axis/g) || []).length, 1);
  assert.equal(appSource.includes('grade-position-marker'), false);
  assert.equal(appSource.includes('grade-position-percent-axis'), false);
});

test('계산 전이거나 5등급 범위 밖이면 위치 모델을 만들지 않는다', () => {
  assert.equal(buildGradePositionModel(null), null);
  assert.equal(buildGradePositionModel(''), null);
  assert.equal(buildGradePositionModel(0.99), null);
  assert.equal(buildGradePositionModel(5.01), null);
});

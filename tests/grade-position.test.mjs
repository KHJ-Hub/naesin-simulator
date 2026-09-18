import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGradePositionModel, GRADE_POSITION_SCALES } from '../src/grade-position.mjs';

test('현재 내신으로 5등급제와 9등급제 마커 위치를 만든다', () => {
  const model = buildGradePositionModel(2);
  assert.equal(model.grade5, 2);
  assert.equal(model.grade9, 3.3);
  assert.equal(model.grade5Position, 22);
  assert.equal(model.grade9Position, 21.35);
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
});

test('계산 전이거나 5등급 범위 밖이면 위치 모델을 만들지 않는다', () => {
  assert.equal(buildGradePositionModel(null), null);
  assert.equal(buildGradePositionModel(''), null);
  assert.equal(buildGradePositionModel(0.99), null);
  assert.equal(buildGradePositionModel(5.01), null);
});

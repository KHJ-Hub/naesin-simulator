import test from 'node:test';
import assert from 'node:assert/strict';
import { convertGrade9ToGrade5, conversionDisplay } from '../src/grade-conversion/grade9-to-grade5.mjs';

test('공식 대응표의 정확한 기준점은 그대로 사용한다', () => {
  const value = convertGrade9ToGrade5(3.30);
  assert.equal(value.convertedValue, 2);
  assert.equal(value.interpolation, false);
});

test('공식 대응표 사이 값은 인접 기준점 사이에서만 보간한다', () => {
  const value = convertGrade9ToGrade5(3.42);
  assert.equal(value.conversionDataset, 'busan-grade5-g2-1sem-15978');
  assert.equal(value.interpolation, true);
  assert.equal(value.lowerAnchor.original, 3.30);
  assert.equal(value.upperAnchor.original, 3.58);
  assert.equal(value.convertedValue, 2.07);
  assert.equal(conversionDisplay(value), '약 2.07등급');
});

test('범위 밖 값은 임의의 외삽 대신 표의 경계값으로 표시한다', () => {
  const value = convertGrade9ToGrade5(1.00);
  assert.equal(value.convertedValue, 1);
  assert.equal(value.boundary, 'lower-bound');
  assert.equal(convertGrade9ToGrade5(9).convertedValue, 5);
});

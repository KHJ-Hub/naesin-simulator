import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertGrade5ToGrade9,
  convertGrade9ToGrade5,
  conversionDataset,
  conversionDisplay,
} from '../src/grade-conversion/grade9-to-grade5.mjs';

const JINHAK_PEN_REFERENCE_RANGES = Object.freeze([
  { grade5: 1.00, grade9: [1.00, 1.18], maxDifference: 0.03 },
  { grade5: 1.50, grade9: [2.28, 2.38], maxDifference: 0.07 },
  { grade5: 2.00, grade9: [3.19, 3.29], maxDifference: 0.07 },
  { grade5: 2.50, grade9: [4.10, 4.20], maxDifference: 0.05 },
  { grade5: 3.00, grade9: [4.99, 5.09], maxDifference: 0.05 },
  { grade5: 3.50, grade9: [5.86, 5.96], maxDifference: 0.07 },
  { grade5: 4.00, grade9: [6.77, 6.87], maxDifference: 0.10 },
  { grade5: 4.50, grade9: [7.68, 7.78], maxDifference: 0.16 },
  { grade5: 5.00, grade9: [8.95, 9.00], maxDifference: 0.03 },
]);

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

test('진학PEN 주요 구간과의 현재 오차 범위를 유지한다', () => {
  assert.equal(conversionDataset().id, 'busan-grade5-g2-1sem-15978');

  JINHAK_PEN_REFERENCE_RANGES.forEach(({ grade5, grade9: [lower, upper], maxDifference }) => {
    const middle = (lower + upper) / 2;
    [lower, middle, upper].forEach((original) => {
      const converted = convertGrade9ToGrade5(original)?.convertedValue;
      assert.ok(Number.isFinite(converted), `${original} 환산값이 필요합니다.`);
      assert.ok(
        Math.abs(converted - grade5) <= maxDifference + Number.EPSILON,
        `9등급 ${original}의 5등급 환산값 ${converted}이 기준 ${grade5}에서 ${maxDifference}를 초과했습니다.`,
      );
    });
  });
});

test('9등급 1.00~9.00 환산값은 단조 증가한다', () => {
  let previous = convertGrade9ToGrade5(1)?.convertedValue;
  for (let step = 1; step <= 8000; step += 1) {
    const original = 1 + step / 1000;
    const current = convertGrade9ToGrade5(original)?.convertedValue;
    assert.ok(current >= previous, `${original.toFixed(3)}에서 ${previous} → ${current}로 역전되었습니다.`);
    previous = current;
  }
});

test('현재 5등급 평균은 같은 공식 대응표로 9등급 참고값을 역방향 보간한다', () => {
  const exact = convertGrade5ToGrade9(2);
  assert.equal(exact.convertedValue, 3.3);
  assert.equal(exact.conversionDataset, 'busan-grade5-g2-1sem-15978');
  assert.equal(exact.interpolation, false);

  const interpolated = convertGrade5ToGrade9(2.08);
  assert.equal(interpolated.convertedValue, 3.44);
  assert.equal(interpolated.interpolation, true);
  assert.deepEqual(interpolated.lowerAnchor, { original: 2, converted: 3.3 });
  assert.deepEqual(interpolated.upperAnchor, { original: 2.16, converted: 3.58 });
});

test('5등급→9등급 참고값도 1~5 범위에서 단조 증가하고 범위 밖은 거부한다', () => {
  let previous = convertGrade5ToGrade9(1).convertedValue;
  for (let step = 1; step <= 4000; step += 1) {
    const current = convertGrade5ToGrade9(1 + step / 1000).convertedValue;
    assert.ok(current >= previous);
    previous = current;
  }
  assert.equal(convertGrade5ToGrade9(0.99), null);
  assert.equal(convertGrade5ToGrade9(5.01), null);
});

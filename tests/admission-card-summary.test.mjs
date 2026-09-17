import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdmissionPrimaryReference } from '../src/admission-card-summary.mjs';

test('70% cut은 5등급 환산값과 9등급 원본값을 함께 제공한다', () => {
  assert.deepEqual(getAdmissionPrimaryReference({ cut70Original: 2.53, cut70Converted: 1.58 }), {
    kind: 'cut70', label: '전년도 70% cut', original: 2.53, converted: 1.58,
  });
});

test('학종 평균등급은 cut으로 오인하지 않고 원본·환산값을 함께 제공한다', () => {
  assert.deepEqual(getAdmissionPrimaryReference({ averageGradeOriginal: 3.41, averageGradeConverted: 2.06 }), {
    kind: 'average', label: '전년도 평균등급', original: 3.41, converted: 2.06,
  });
});

test('70% cut이 없고 50% cut만 있으면 공식 50% 값을 사용한다', () => {
  assert.deepEqual(getAdmissionPrimaryReference({ cut50Original: 2.31, cut50Converted: 1.44 }), {
    kind: 'cut50', label: '전년도 50% cut', original: 2.31, converted: 1.44,
  });
});

test('공개 내신 수치가 없으면 원본·환산값을 임의 생성하지 않는다', () => {
  assert.deepEqual(getAdmissionPrimaryReference({ cut70Original: null, cut70Converted: '' }), {
    kind: 'unavailable', label: '전년도 내신 자료', original: null, converted: null,
  });
});

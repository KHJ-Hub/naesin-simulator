import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA, admissionDifference, classifyAdmissionReference, describeAdmissionDifference, filterAdmissionReferences, validAdmissionReference } from '../src/admission-reference.mjs';

test('실제 대학 데이터는 별도 모듈에서 비어 있는 상태로 시작한다', () => {
  assert.deepEqual(ADMISSION_REFERENCE_DATA, []);
});

test('설정된 차이 기준으로 참고 범위를 분류한다', () => {
  assert.equal(classifyAdmissionReference(1.82, 2.10), 'comfortable');
  assert.equal(classifyAdmissionReference(1.82, 1.85), 'similar');
  assert.equal(classifyAdmissionReference(1.82, 1.60), 'challenging');
});

test('낮은 등급이 더 좋은 구조를 반영해 차이 방향을 설명한다', () => {
  assert.equal(admissionDifference(1.8, 2.0), 0.2);
  assert.match(describeAdmissionDifference(0.2), /더 좋은 성적/);
  assert.match(describeAdmissionDifference(-0.2), /더 낮은 성적/);
});

test('필수 공개 데이터 필드를 갖춘 항목만 결과에 사용한다', () => {
  assert.equal(validAdmissionReference({ referenceYear: 2026, university: 'A대', region: '서울', field: '인문', department: '국어', admissionName: '일반', admissionType: '일반전형', category: '학생부교과', cut70: 2.1, cut50: null, source: '대입정보포털 어디가' }), true);
  assert.equal(validAdmissionReference({ university: 'A대', cut70: 2.1 }), false);
});

test('참고 결과 필터는 지역·대학·전형 조건을 조합한다', () => {
  const data = [
    { referenceYear: 2026, region: '인천', university: 'A대', field: '인문', department: '국어', admissionName: '일반', admissionType: '일반전형', category: '학생부교과', cut70: 2.1, source: '대입정보포털 어디가' },
    { referenceYear: 2026, region: '서울', university: 'B대', field: '자연', department: '수학', admissionName: '지역', admissionType: '지역인재', category: '학생부종합', cut70: 2.2, source: '대입정보포털 어디가' },
  ];
  assert.equal(filterAdmissionReferences(data, { region: '인천', category: '학생부교과' }).length, 1);
});

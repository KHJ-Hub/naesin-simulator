import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA, classifyAdmissionReference, filterAdmissionReferences } from '../src/admission-reference.mjs';

test('실제 대학 데이터는 별도 모듈에서 비어 있는 상태로 시작한다', () => {
  assert.deepEqual(ADMISSION_REFERENCE_DATA, []);
});

test('설정된 차이 기준으로 안정·적정·도전을 분류한다', () => {
  assert.equal(classifyAdmissionReference(1.82, 2.10), 'stable');
  assert.equal(classifyAdmissionReference(1.82, 1.85), 'adequate');
  assert.equal(classifyAdmissionReference(1.82, 1.60), 'challenge');
});

test('참고 결과 필터는 지역·대학·전형 조건을 조합한다', () => {
  const data = [
    { region: '인천', university: 'A대', field: '인문', department: '국어', admissionType: '일반전형', category: '학생부교과' },
    { region: '서울', university: 'B대', field: '자연', department: '수학', admissionType: '지역인재', category: '학생부종합' },
  ];
  assert.equal(filterAdmissionReferences(data, { region: '인천', category: '학생부교과' }).length, 1);
});

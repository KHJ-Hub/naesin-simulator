import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA, filterAdmissionReferences } from '../src/admission-reference.mjs';
import { classifyAdmissionEligibility, isDefaultStudentVisibleAdmission } from '../src/admission-eligibility.mjs';
import { isSchoolRegionEligible } from '../src/admission-regional-eligibility.mjs';

test('지원자격 제한 전형은 이름이 명확할 때만 분류하고 고른기회는 검토 대기로 둔다', () => {
  assert.equal(classifyAdmissionEligibility({ admissionName: '학생부종합(농어촌학생)' }).eligibilityType, 'rural');
  assert.equal(classifyAdmissionEligibility({ admissionName: '학생부교과(지역인재전형)' }).eligibilityType, 'regional');
  assert.equal(classifyAdmissionEligibility({ admissionName: '학생부종합(고른기회)' }).eligibilityType, 'unknown');
});

test('공식 지원지역이 확인된 지역인재만 부산 학생 기본 검색에 포함한다', () => {
  const rural = ADMISSION_REFERENCE_DATA.find((item) => item.eligibilityType === 'rural');
  const regional = ADMISSION_REFERENCE_DATA.find((item) => item.eligibilityType === 'regional');
  const unknown = ADMISSION_REFERENCE_DATA.find((item) => item.eligibilityType === 'unknown');
  assert.equal(isDefaultStudentVisibleAdmission(rural), false);
  assert.equal(regional.regionalEligibility.verified, true);
  assert.equal(isSchoolRegionEligible(regional.regionalEligibility, '부산'), true);
  assert.equal(isSchoolRegionEligible(regional.regionalEligibility, '대구'), false);
  assert.equal(isDefaultStudentVisibleAdmission(regional), true);
  assert.equal(isDefaultStudentVisibleAdmission(unknown), false);
  assert.equal(filterAdmissionReferences(ADMISSION_REFERENCE_DATA).filter((item) => item.eligibilityType === 'regional').length, 15);
  assert.equal(filterAdmissionReferences(ADMISSION_REFERENCE_DATA).some((item) => item.eligibilityType === 'rural' || item.eligibilityType === 'unknown'), false);
  assert.equal(filterAdmissionReferences(ADMISSION_REFERENCE_DATA, { includeSpecialEligibility: true }).length, ADMISSION_REFERENCE_DATA.length);
});

test('전국 확장 데이터도 정해진 자격 유형만 사용한다', () => {
  const allowed = new Set(['general', 'school-recommendation', 'regional', 'rural', 'opportunity', 'vocational', 'special', 'unknown']);
  assert.ok(ADMISSION_REFERENCE_DATA.every((item) => allowed.has(item.eligibilityType)));
  assert.ok(ADMISSION_REFERENCE_DATA.some((item) => item.eligibilityType === 'general'));
  assert.ok(ADMISSION_REFERENCE_DATA.some((item) => item.eligibilityType === 'school-recommendation'));
  assert.ok(ADMISSION_REFERENCE_DATA.some((item) => item.eligibilityType === 'rural'));
  assert.ok(ADMISSION_REFERENCE_DATA.some((item) => item.eligibilityType === 'unknown'));
});

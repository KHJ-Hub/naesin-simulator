import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA, admissionComparisonCut, admissionDifference, classifyAdmissionReference, describeAdmissionDifference, filterAdmissionReferences, isComparableAdmissionRecord, isStudentRecordComprehensive, validAdmissionReference } from '../src/admission-reference.mjs';
import { ADMISSION_DATA_AVAILABILITY, normalizeAdmissionRecord, validateAdmissionRecord } from '../src/admission-record-normalizer.mjs';

test('공식 확인된 2026 지역 자료만 연결한다', () => {
  assert.ok(ADMISSION_REFERENCE_DATA.length > 0);
  assert.ok(ADMISSION_REFERENCE_DATA.every((item) => validAdmissionReference(item)));
  assert.deepEqual([...new Set(ADMISSION_REFERENCE_DATA.map((item) => item.region))].sort(), ['경기도', '경상남도', '부산광역시', '울산광역시', '인천광역시']);
  assert.deepEqual([...new Set(ADMISSION_REFERENCE_DATA.map((item) => item.university))].sort(), ['가천대학교', '경남대학교', '경상국립대학교', '고신대학교', '국립부경대학교', '국립창원대학교', '동아대학교', '동의대학교', '부산가톨릭대학교', '부산대학교', '울산대학교', '인제대학교', '인천대학교', '인하대학교']);
  assert.equal(ADMISSION_REFERENCE_DATA.length, 115);
  assert.ok(ADMISSION_REFERENCE_DATA.every((item) => item.cut70Original === item.cut70 && Number.isFinite(item.cut70Converted) && item.conversionDataset === 'busan-grade5-g2-1sem-15978'));
  assert.ok(ADMISSION_REFERENCE_DATA.every((item) => item.admissionCategory && item.sourceUrl));
});

test('인천대학교의 미공개 50% cut은 null로 유지하고 70% cut만 환산한다', () => {
  const incheon = ADMISSION_REFERENCE_DATA.find((item) => item.university === '인천대학교' && item.department === '국어국문학과');
  assert.equal(incheon.cut50Original, null);
  assert.equal(incheon.cut50Converted, null);
  assert.equal(incheon.cut70Original, 3.10);
  assert.equal(incheon.updatedAt, '2026-04-01');
  assert.equal(incheon.source, '인천대학교 입학처');
  assert.ok(Number.isFinite(incheon.cut70Converted));
});

test('환산 모드는 환산값을, 원본 모드는 원본값을 비교 기준으로 선택한다', () => {
  const item = ADMISSION_REFERENCE_DATA[0];
  assert.equal(admissionComparisonCut(item, 'converted'), item.cut70Converted);
  assert.equal(admissionComparisonCut(item, 'original'), item.cut70Original);
});

test('학생부종합은 환산 수치를 보존하되 학생 내신 비교 대상으로 분류하지 않는다', () => {
  const comprehensive = ADMISSION_REFERENCE_DATA.find(isStudentRecordComprehensive);
  const subject = ADMISSION_REFERENCE_DATA.find((item) => !isStudentRecordComprehensive(item));
  assert.ok(comprehensive);
  assert.equal(isComparableAdmissionRecord(comprehensive), false);
  assert.equal(isComparableAdmissionRecord(subject), true);
  assert.ok(Number.isFinite(comprehensive.cut70Converted));
});

test('인하대 전형별 합산 공개 자료는 개별 학과에 임의 배정하지 않는다', () => {
  const inha = ADMISSION_REFERENCE_DATA.find((item) => item.university === '인하대학교' && item.admissionName === '학생부종합(농어촌학생)');
  assert.equal(inha.department, '선발인원 3명 이하 모집단위 합산');
  assert.equal(inha.cut50Original, 2.92);
  assert.equal(inha.cut70Original, 3.20);
  assert.equal(isComparableAdmissionRecord(inha), false);
});

test('기존 category/year 입력은 canonical schema로 정규화한다', () => {
  const normalized = normalizeAdmissionRecord({
    year: 2026, university: '검증대', region: '서울', department: '국어', admissionName: '일반',
    category: 'student-record-subject', admissionType: '학생부교과', dataAvailability: 'cut70-only',
    cut70Original: 2.1, cut70Converted: 1.7, source: '공식', sourceUrl: 'https://example.test/result',
  });
  assert.equal(normalized.referenceYear, 2026);
  assert.equal(normalized.admissionCategory, '학생부교과');
  assert.equal(normalized.category, '학생부교과');
  assert.equal(normalized.admissionType, null);
  assert.equal(validAdmissionReference(normalized), true);
});

test('상태별 필수 수치와 환산 범위를 검증한다', () => {
  const base = { referenceYear: 2026, university: '검증대', region: '서울', department: '국어', admissionName: '일반', admissionCategory: '학생부교과', source: '공식', sourceUrl: 'https://example.test/result' };
  assert.ok(validateAdmissionRecord({ ...base, dataAvailability: ADMISSION_DATA_AVAILABILITY.CONFIRMED_CUT, cut50Original: 2.1, cut70Original: 2.3, cut50Converted: 1.7, cut70Converted: 1.8 }).length === 0);
  assert.ok(validateAdmissionRecord({ ...base, dataAvailability: ADMISSION_DATA_AVAILABILITY.CONFIRMED_CUT, cut70Original: 2.3 }).includes('confirmed-cut-values'));
  assert.ok(validateAdmissionRecord({ ...base, dataAvailability: ADMISSION_DATA_AVAILABILITY.CUT70_ONLY, cut70Original: 2.3, cut70Converted: 5.1 }).includes('cut70Converted'));
  assert.ok(validateAdmissionRecord({ ...base, dataAvailability: ADMISSION_DATA_AVAILABILITY.AVERAGE_ONLY, averageGradeOriginal: 2.9, averageGradeConverted: 2.1 }).length === 0);
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
  assert.equal(validAdmissionReference({ referenceYear: 2026, university: 'A대', region: '서울', field: '인문', department: '국어', admissionName: '일반', admissionType: '일반전형', admissionCategory: '학생부교과', dataAvailability: 'cut70-only', cut70: 2.1, cut50: null, source: '대입정보포털 어디가', sourceUrl: 'https://example.test/a', updatedAt: '2026-09-01' }), true);
  assert.equal(validAdmissionReference({ referenceYear: 2026, university: 'B대', region: '부산', field: null, department: '국어', admissionName: '일반', admissionType: null, admissionCategory: '학생부교과', dataAvailability: 'cut70-only', cut70: 2.1, cut50: null, source: '대입정보포털 어디가', sourceUrl: 'https://example.test/b', updatedAt: null }), true);
  assert.equal(validAdmissionReference({ university: 'A대', cut70: 2.1 }), false);
});

test('참고 결과 필터는 지역·대학·전형 조건을 조합한다', () => {
  const data = [
    { referenceYear: 2026, region: '인천', university: 'A대', field: '인문', department: '국어', admissionName: '일반', admissionType: '일반전형', admissionCategory: '학생부교과', dataAvailability: 'cut70-only', cut70: 2.1, source: '대입정보포털 어디가', sourceUrl: 'https://example.test/a', updatedAt: '2026-09-01' },
    { referenceYear: 2026, region: '서울', university: 'B대', field: '자연', department: '수학', admissionName: '지역', admissionType: '지역인재', admissionCategory: '학생부종합', dataAvailability: 'cut70-only', cut70: 2.2, source: '대입정보포털 어디가', sourceUrl: 'https://example.test/b', updatedAt: '2026-09-01' },
  ];
  assert.equal(filterAdmissionReferences(data, { region: '인천', admissionCategory: '학생부교과' }).length, 1);
});

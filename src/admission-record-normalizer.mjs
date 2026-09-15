import { ADMISSION_ELIGIBILITY_TYPES, classifyAdmissionEligibility } from './admission-eligibility.mjs';
import { DEFAULT_SCHOOL_REGION, isSchoolRegionEligible, normalizeRegionalEligibility } from './admission-regional-eligibility.mjs';

/** 전국 입시결과 파일이 공유하는 정규 스키마와 검증 규칙이다. */
export const ADMISSION_CATEGORIES = Object.freeze({
  SUBJECT: '학생부교과',
  COMPREHENSIVE: '학생부종합',
});

export const ADMISSION_DATA_AVAILABILITY = Object.freeze({
  CONFIRMED_CUT: 'confirmed-cut',
  CUT70_ONLY: 'cut70-only',
  CUT50_ONLY: 'cut50-only',
  AVERAGE_ONLY: 'average-only',
  NOT_PUBLISHED: 'not-published',
  NOT_CHECKED: 'not-checked',
  NO_RESULT: 'no-result',
});

const CATEGORY_ALIASES = Object.freeze({
  '학생부교과': ADMISSION_CATEGORIES.SUBJECT,
  'student-record-subject': ADMISSION_CATEGORIES.SUBJECT,
  '학생부종합': ADMISSION_CATEGORIES.COMPREHENSIVE,
  'student-record-comprehensive': ADMISSION_CATEGORIES.COMPREHENSIVE,
});

const AVAILABILITY_VALUES = new Set(Object.values(ADMISSION_DATA_AVAILABILITY));
const finiteOrNull = (value) => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const textOrNull = (value) => String(value ?? '').trim() || null;

export function normalizeAdmissionCategory(value) {
  return CATEGORY_ALIASES[String(value ?? '').trim()] ?? null;
}

/**
 * `referenceYear`를 기준 학년도 canonical field로 사용한다.
 * 이전 파일의 category/year/cut70 형태도 읽되, 원본 숫자를 변환하거나 덮어쓰지 않는다.
 */
export function normalizeAdmissionRecord(record = {}) {
  const admissionCategory = normalizeAdmissionCategory(record.admissionCategory ?? record.category);
  const legacyCategory = normalizeAdmissionCategory(record.category);
  const suppliedType = textOrNull(record.admissionType);
  const admissionType = normalizeAdmissionCategory(suppliedType) ? null : suppliedType;
  const referenceYear = Number(record.referenceYear ?? record.year);
  const suppliedAvailability = record.dataAvailability ?? record.status;
  const dataAvailability = suppliedAvailability == null
    ? ADMISSION_DATA_AVAILABILITY.NOT_CHECKED
    : AVAILABILITY_VALUES.has(suppliedAvailability) ? suppliedAvailability : null;
  const cut50Original = finiteOrNull(record.cut50Original ?? record.cut50);
  const cut70Original = finiteOrNull(record.cut70Original ?? record.cut70);
  const averageGradeOriginal = finiteOrNull(record.averageGradeOriginal ?? record.averageGrade);
  const regionalEligibility = normalizeRegionalEligibility(record.regionalEligibility);
  const regionalEligibilityConfirmed = regionalEligibility?.verified === true || record.regionalEligibilityConfirmed === true;
  const eligibility = classifyAdmissionEligibility({
    admissionName: record.admissionName,
    eligibilityType: record.eligibilityType,
    regionalEligibility,
    regionalEligibilityConfirmed,
    schoolRegion: record.schoolRegion ?? DEFAULT_SCHOOL_REGION,
  });

  return {
    ...record,
    referenceYear,
    admissionCategory,
    // category는 이전 저장본·필터와의 호환을 위한 alias다.
    category: legacyCategory ?? admissionCategory,
    admissionType,
    dataAvailability,
    cut50Original,
    cut70Original,
    cut50: cut50Original,
    cut70: cut70Original,
    cut50Converted: finiteOrNull(record.cut50Converted),
    cut70Converted: finiteOrNull(record.cut70Converted),
    averageGradeOriginal,
    averageGradeConverted: finiteOrNull(record.averageGradeConverted),
    eligibilityType: eligibility.eligibilityType,
    eligibilityVerification: String(record.eligibilityVerification ?? eligibility.eligibilityVerification),
    regionalEligibility,
    regionalEligibilityConfirmed,
    schoolRegion: String(record.schoolRegion ?? DEFAULT_SCHOOL_REGION).trim() || DEFAULT_SCHOOL_REGION,
    regionalEligibleForSchool: eligibility.eligibilityType === ADMISSION_ELIGIBILITY_TYPES.REGIONAL
      ? isSchoolRegionEligible(regionalEligibility, record.schoolRegion ?? DEFAULT_SCHOOL_REGION)
      : null,
    studentDefaultVisible: record.studentDefaultVisible === true || (record.studentDefaultVisible == null && eligibility.studentDefaultVisible),
    field: textOrNull(record.field),
    sourceUrl: textOrNull(record.sourceUrl),
  };
}

export function isStudentRecordSubject(item = {}) {
  return normalizeAdmissionCategory(item.admissionCategory ?? item.category) === ADMISSION_CATEGORIES.SUBJECT;
}

export function isStudentRecordComprehensive(item = {}) {
  return normalizeAdmissionCategory(item.admissionCategory ?? item.category) === ADMISSION_CATEGORIES.COMPREHENSIVE;
}

export function hasAdmissionCut(item = {}) {
  return Number.isFinite(Number(item.cut50Original)) || Number.isFinite(Number(item.cut70Original));
}

export function isComparableAdmissionRecord(item = {}) {
  return isStudentRecordSubject(item) && Number.isFinite(Number(item.cut70Original));
}

export function validateAdmissionRecord(record = {}) {
  const item = normalizeAdmissionRecord(record);
  const errors = [];
  if (!Number.isInteger(item.referenceYear)) errors.push('referenceYear');
  if (!item.admissionCategory) errors.push('admissionCategory');
  if (!Object.values(ADMISSION_ELIGIBILITY_TYPES).includes(item.eligibilityType)) errors.push('eligibilityType');
  if (item.eligibilityType === ADMISSION_ELIGIBILITY_TYPES.REGIONAL) {
    if (!item.regionalEligibility) errors.push('regionalEligibility');
    if (item.regionalEligibility?.verified && (!item.regionalEligibility.sourceUrl || item.regionalEligibility.eligibleSchoolRegions.length === 0)) errors.push('regionalEligibility-verification');
  }
  if (!textOrNull(item.university)) errors.push('university');
  if (!textOrNull(item.region)) errors.push('region');
  if (!textOrNull(item.department)) errors.push('department');
  if (!textOrNull(item.admissionName)) errors.push('admissionName');
  if (!textOrNull(item.source)) errors.push('source');
  if (!item.sourceUrl) errors.push('sourceUrl');
  if (!AVAILABILITY_VALUES.has(item.dataAvailability)) errors.push('dataAvailability');

  const inOriginalRange = (value) => value == null || (value >= 1 && value <= 9);
  const inConvertedRange = (value) => value == null || (value >= 1 && value <= 5);
  if (!inOriginalRange(item.cut50Original)) errors.push('cut50Original');
  if (!inOriginalRange(item.cut70Original)) errors.push('cut70Original');
  if (!inOriginalRange(item.averageGradeOriginal)) errors.push('averageGradeOriginal');
  if (!inConvertedRange(item.cut50Converted)) errors.push('cut50Converted');
  if (!inConvertedRange(item.cut70Converted)) errors.push('cut70Converted');
  if (!inConvertedRange(item.averageGradeConverted)) errors.push('averageGradeConverted');

  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.CONFIRMED_CUT
    && (item.cut50Original == null || item.cut70Original == null)) errors.push('confirmed-cut-values');
  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.CUT70_ONLY && item.cut70Original == null) errors.push('cut70-only-value');
  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.CUT50_ONLY && item.cut50Original == null) errors.push('cut50-only-value');
  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.AVERAGE_ONLY && item.averageGradeOriginal == null) errors.push('average-only-value');
  return errors;
}

export function validAdmissionRecord(record = {}) {
  return validateAdmissionRecord(record).length === 0;
}

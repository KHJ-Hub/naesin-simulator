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

export const ADMISSION_ACADEMIC_FIELDS = Object.freeze({
  HUMANITIES: 'humanities',
  NATURAL: 'natural',
  ARTS: 'arts',
  OTHER: 'other',
  UNKNOWN: 'unknown',
});

const ACADEMIC_FIELD_ALIASES = Object.freeze({
  humanities: ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '인문': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '인문사회': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '사회': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '교육': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  natural: ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '자연': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '자연과학': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '공학': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '의학/보건': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '의약': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '보건': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  arts: ADMISSION_ACADEMIC_FIELDS.ARTS,
  '예체능': ADMISSION_ACADEMIC_FIELDS.ARTS,
  '예술': ADMISSION_ACADEMIC_FIELDS.ARTS,
  '체육': ADMISSION_ACADEMIC_FIELDS.ARTS,
  other: ADMISSION_ACADEMIC_FIELDS.OTHER,
  '기타': ADMISSION_ACADEMIC_FIELDS.OTHER,
  unknown: ADMISSION_ACADEMIC_FIELDS.UNKNOWN,
  '미분류': ADMISSION_ACADEMIC_FIELDS.UNKNOWN,
});

export function normalizeAcademicField(value) {
  const normalized = String(value ?? '').trim();
  return ACADEMIC_FIELD_ALIASES[normalized] ?? ADMISSION_ACADEMIC_FIELDS.UNKNOWN;
}

/** 공식 계열값이 없을 때 모집단위명만으로 명확한 경우에 한해 넓은 계열을 보완한다. */
export function inferAcademicFieldFromDepartment(department) {
  const name = String(department ?? '').replace(/\s/g, '');
  if (!name) return ADMISSION_ACADEMIC_FIELDS.UNKNOWN;
  if (/(예술|디자인|미술|회화|조형|음악|성악|작곡|무용|연극|영화|공연|체육|스포츠|애니메이션)/.test(name)) return ADMISSION_ACADEMIC_FIELDS.ARTS;
  if (/((?<!전)공학|컴퓨터|소프트웨어|인공지능|데이터사이언스|정보보호|사이버보안|수학|통계|물리|화학|생명|생물|바이오|간호|의예|의학|약학|치의|한의|보건|재활|임상병리|방사선|치위생|응급구조|건축|환경|식품|영양|농학|산림|원예|축산|동물|해양|지구과학|스마트팜)/.test(name)) return ADMISSION_ACADEMIC_FIELDS.NATURAL;
  if (/(국어|문예|문학|영어|독어|불어|중어|일어|러시아|스페인|언어|사학|역사|철학|종교|신학|법학|행정|정치|외교|경제|경영|회계|무역|금융|관광|사회|복지|심리|아동|유아|교육|미디어|언론|광고|홍보|국제|문화인류)/.test(name)) return ADMISSION_ACADEMIC_FIELDS.HUMANITIES;
  if (/(자유전공|자율전공|무전공|융합학부|융합전공)/.test(name)) return ADMISSION_ACADEMIC_FIELDS.OTHER;
  return ADMISSION_ACADEMIC_FIELDS.UNKNOWN;
}

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
    academicField: record.academicField != null || record.field != null
      ? normalizeAcademicField(record.academicField ?? record.field)
      : inferAcademicFieldFromDepartment(record.department),
    majorSearchGroup: textOrNull(record.majorSearchGroup),
    normalizedMajorKeyword: textOrNull(record.normalizedMajorKeyword),
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

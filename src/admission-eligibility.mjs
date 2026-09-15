/** 학생 화면의 기본 노출 여부를 결정하는 전형 자격 유형이다. */
export const ADMISSION_ELIGIBILITY_TYPES = Object.freeze({
  GENERAL: 'general',
  SCHOOL_RECOMMENDATION: 'school-recommendation',
  REGIONAL: 'regional',
  RURAL: 'rural',
  OPPORTUNITY: 'opportunity',
  VOCATIONAL: 'vocational',
  SPECIAL: 'special',
  UNKNOWN: 'unknown',
});

export const DEFAULT_STUDENT_ELIGIBILITY_TYPES = Object.freeze([
  ADMISSION_ELIGIBILITY_TYPES.GENERAL,
  ADMISSION_ELIGIBILITY_TYPES.SCHOOL_RECOMMENDATION,
]);

const ELIGIBILITY_VALUES = new Set(Object.values(ADMISSION_ELIGIBILITY_TYPES));
const GENERAL_NAME_PATTERN = /(일반|학생부교과전형|교과성적우수|학업성적우수|학생부우수|학생부종합전형)/;
const SPECIAL_NAME_PATTERN = /(국가보훈|보훈|기초생활|차상위|한부모|사회통합|사회배려|장애|특수교육|기회균등)/;

/**
 * 전형명만으로 지원자격 제한을 확정할 수 없는 경우 unknown을 반환한다.
 * 특히 고른기회는 대학별 모집요강 확인 전 opportunity로 자동 단정하지 않는다.
 */
export function classifyAdmissionEligibility({ admissionName = '', eligibilityType = null, regionalEligibilityConfirmed = false } = {}) {
  if (ELIGIBILITY_VALUES.has(eligibilityType)) {
    return {
      eligibilityType,
      eligibilityVerification: 'official-confirmed',
      studentDefaultVisible: eligibilityType === 'general' || eligibilityType === 'school-recommendation' || (eligibilityType === 'regional' && regionalEligibilityConfirmed),
    };
  }
  const name = String(admissionName).replace(/\s/g, '');
  if (/농어촌/.test(name)) return { eligibilityType: 'rural', eligibilityVerification: 'name-classified', studentDefaultVisible: false };
  if (/특성화고|마이스터고/.test(name)) return { eligibilityType: 'vocational', eligibilityVerification: 'name-classified', studentDefaultVisible: false };
  if (/지역인재|지역혁신인재|지역교과/.test(name)) return { eligibilityType: 'regional', eligibilityVerification: 'name-classified', studentDefaultVisible: false };
  if (/학교장추천|추천형|추천전형/.test(name)) return { eligibilityType: 'school-recommendation', eligibilityVerification: 'name-classified', studentDefaultVisible: true };
  if (/고른기회|기회균형/.test(name)) return { eligibilityType: 'unknown', eligibilityVerification: 'needs-eligibility-review', studentDefaultVisible: false };
  if (SPECIAL_NAME_PATTERN.test(name)) return { eligibilityType: 'special', eligibilityVerification: 'name-classified', studentDefaultVisible: false };
  if (GENERAL_NAME_PATTERN.test(name)) return { eligibilityType: 'general', eligibilityVerification: 'name-classified', studentDefaultVisible: true };
  return { eligibilityType: 'unknown', eligibilityVerification: 'needs-eligibility-review', studentDefaultVisible: false };
}

export function isDefaultStudentVisibleAdmission(item = {}) {
  return item.studentDefaultVisible === true
    || (DEFAULT_STUDENT_ELIGIBILITY_TYPES.includes(item.eligibilityType) && item.studentDefaultVisible !== false);
}

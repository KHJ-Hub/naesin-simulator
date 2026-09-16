import { classifyAdmissionEligibility } from '../admission-eligibility.mjs';
import { DEFAULT_SCHOOL_REGION, regionalEligibilityFor } from '../admission-regional-eligibility.mjs';
import { convertGrade9ToGrade5, DEFAULT_BUSAN_CONVERSION_DATASET } from '../grade-conversion/grade9-to-grade5.mjs';

const finiteOrNull = (value) => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;

/** 공식 원본값을 보존하면서 공통 2026 입시결과 스키마를 만든다. */
export function createOfficialAdmissionResult({
  university,
  region,
  department,
  academicField = null,
  admissionName,
  admissionCategory,
  cut50Original = null,
  cut70Original = null,
  averageGradeOriginal = null,
  dataAvailability = null,
  source = '대입정보포털 어디가',
  sourceUrl,
  updatedAt = null,
  eligibilityType = null,
  regionalEligibility = null,
  referenceYear = 2026,
}) {
  const cut50 = finiteOrNull(cut50Original);
  const cut70 = finiteOrNull(cut70Original);
  const average = finiteOrNull(averageGradeOriginal);
  const converted50 = cut50 == null ? null : convertGrade9ToGrade5(cut50, DEFAULT_BUSAN_CONVERSION_DATASET);
  const converted70 = cut70 == null ? null : convertGrade9ToGrade5(cut70, DEFAULT_BUSAN_CONVERSION_DATASET);
  const convertedAverage = average == null ? null : convertGrade9ToGrade5(average, DEFAULT_BUSAN_CONVERSION_DATASET);
  const verifiedRegionalEligibility = regionalEligibility
    ?? regionalEligibilityFor({ university, admissionName, department })
    ?? (eligibilityType === 'regional' ? {
      eligibleRegions: [],
      eligibleSchoolRegions: [],
      requirementSummary: '',
      sourceUrl,
      additionalRequirements: null,
      requiresIndividualVerification: false,
      verified: false,
      checkedAt: null,
    } : null);
  const eligibility = classifyAdmissionEligibility({
    admissionName,
    eligibilityType,
    regionalEligibility: verifiedRegionalEligibility,
    schoolRegion: DEFAULT_SCHOOL_REGION,
  });
  const availability = dataAvailability
    ?? (cut50 != null && cut70 != null ? 'confirmed-cut'
      : cut70 != null ? 'cut70-only'
        : cut50 != null ? 'cut50-only'
          : average != null ? 'average-only' : 'no-result');

  return {
    referenceYear,
    university,
    region,
    field: null,
    academicField,
    department,
    admissionName,
    admissionCategory,
    admissionType: null,
    category: admissionCategory,
    cut50,
    cut70,
    cut50Original: cut50,
    cut70Original: cut70,
    cut50Converted: converted50?.convertedValue ?? null,
    cut70Converted: converted70?.convertedValue ?? null,
    averageGradeOriginal: average,
    averageGradeConverted: convertedAverage?.convertedValue ?? null,
    eligibilityType: eligibility.eligibilityType,
    eligibilityVerification: eligibility.eligibilityVerification,
    regionalEligibility: verifiedRegionalEligibility,
    regionalEligibilityConfirmed: verifiedRegionalEligibility?.verified === true,
    schoolRegion: DEFAULT_SCHOOL_REGION,
    studentDefaultVisible: eligibility.studentDefaultVisible,
    dataAvailability: availability,
    originalScale: 9,
    convertedScale: 5,
    conversionDataset: DEFAULT_BUSAN_CONVERSION_DATASET,
    interpolation: {
      cut50: Boolean(converted50?.interpolation),
      cut70: Boolean(converted70?.interpolation),
      averageGrade: Boolean(convertedAverage?.interpolation),
    },
    conversionMethod: 'busan-grade5-cumulative-anchor-interpolation-v1',
    conversionBasis: '부산광역시교육청학력개발원 진로진학지원센터 98개교 15,978명 고2 1학기 누적 등급평균 분석 자료',
    conversionSampleSize: 15978,
    conversionSchoolCount: 98,
    isApproximate: true,
    source,
    sourceUrl,
    updatedAt,
  };
}

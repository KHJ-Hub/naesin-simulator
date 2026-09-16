import {
  ADMISSION_REGION_ORDER,
  filterAdmissionRecords,
  getAvailableAcademicFields,
  getAvailableAdmissionNames,
  getAvailableDepartments,
  normalizeAdmissionRegion,
} from './admission-filter-options.mjs';
import {
  ADMISSION_CATEGORIES,
  isComparableAdmissionRecord,
  isStudentRecordComprehensive,
} from './admission-record-normalizer.mjs';

export const ADMISSION_RESULT_PAGE_SIZE = 20;
export const ADMISSION_VIEW_MODES = Object.freeze({
  SUBJECT: 'student-record-subject',
  COMPREHENSIVE: 'student-record-comprehensive',
});
export const ADMISSION_SUBJECT_GROUPS = Object.freeze({
  SIMILAR: 'similar',
  HIGHER: 'higher',
  LOWER: 'lower',
});

const koSort = (left, right) => String(left ?? '').localeCompare(String(right ?? ''), 'ko');
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort(koSort);
const convertedCut70 = (item) => item.cut70Converted != null && item.cut70Converted !== '' && Number.isFinite(Number(item.cut70Converted))
  ? Number(item.cut70Converted)
  : null;
const comparisonDifference = (score, cut) => score != null && score !== '' && cut != null && cut !== '' && Number.isFinite(Number(score)) && Number.isFinite(Number(cut))
  ? Number((Number(cut) - Number(score)).toFixed(2))
  : null;

function stableTextSort(left, right) {
  return koSort(left.item.university, right.item.university)
    || koSort(left.item.department, right.item.department)
    || koSort(left.item.admissionName, right.item.admissionName);
}

export function normalizeAdmissionViewMode(mode) {
  if ([ADMISSION_VIEW_MODES.SUBJECT, ADMISSION_CATEGORIES.SUBJECT].includes(mode)) return ADMISSION_VIEW_MODES.SUBJECT;
  if ([ADMISSION_VIEW_MODES.COMPREHENSIVE, ADMISSION_CATEGORIES.COMPREHENSIVE].includes(mode)) return ADMISSION_VIEW_MODES.COMPREHENSIVE;
  return null;
}

export function admissionCategoryForViewMode(mode) {
  const normalized = normalizeAdmissionViewMode(mode);
  if (normalized === ADMISSION_VIEW_MODES.SUBJECT) return ADMISSION_CATEGORIES.SUBJECT;
  if (normalized === ADMISSION_VIEW_MODES.COMPREHENSIVE) return ADMISSION_CATEGORIES.COMPREHENSIVE;
  return null;
}

export function resetAdmissionResultLimit() {
  return ADMISSION_RESULT_PAGE_SIZE;
}

export function increaseAdmissionResultLimit(currentLimit, pageSize = ADMISSION_RESULT_PAGE_SIZE) {
  const current = Number.isFinite(Number(currentLimit)) ? Math.max(0, Number(currentLimit)) : ADMISSION_RESULT_PAGE_SIZE;
  return current + Math.max(1, Number(pageSize) || ADMISSION_RESULT_PAGE_SIZE);
}

export function resetAdmissionGroupLimits() {
  return {
    [ADMISSION_SUBJECT_GROUPS.SIMILAR]: ADMISSION_RESULT_PAGE_SIZE,
    [ADMISSION_SUBJECT_GROUPS.HIGHER]: ADMISSION_RESULT_PAGE_SIZE,
    [ADMISSION_SUBJECT_GROUPS.LOWER]: ADMISSION_RESULT_PAGE_SIZE,
    subjectReference: ADMISSION_RESULT_PAGE_SIZE,
    comprehensive: ADMISSION_RESULT_PAGE_SIZE,
  };
}

export function increaseAdmissionGroupLimit(limits = {}, group, pageSize = ADMISSION_RESULT_PAGE_SIZE) {
  if (![...Object.values(ADMISSION_SUBJECT_GROUPS), 'subjectReference', 'comprehensive'].includes(group)) return { ...limits };
  return { ...limits, [group]: increaseAdmissionResultLimit(limits[group], pageSize) };
}

/** 낮을수록 좋은 내신 숫자 방향을 반영한 교과 입결 그룹 분류다. */
export function classifySubjectAdmissionRange(studentGrade, referenceGrade) {
  const difference = comparisonDifference(studentGrade, referenceGrade);
  if (difference == null) return null;
  if (Math.abs(difference) <= 0.2) return ADMISSION_SUBJECT_GROUPS.SIMILAR;
  return difference < -0.2 ? ADMISSION_SUBJECT_GROUPS.HIGHER : ADMISSION_SUBJECT_GROUPS.LOWER;
}

function groupView(entries, limit) {
  const visibleResultLimit = Math.max(0, Number(limit) || ADMISSION_RESULT_PAGE_SIZE);
  const visibleResults = entries.slice(0, visibleResultLimit);
  return Object.freeze({
    totalCount: entries.length,
    visibleResults: Object.freeze(visibleResults),
    visibleResultLimit,
    hasMore: visibleResults.length < entries.length,
    remainingResultCount: Math.max(0, entries.length - visibleResults.length),
  });
}

/** 선택된 최상위 모드 안에서만 종속 필터 선택지를 계산한다. */
export function getAdmissionViewFilterOptions(data, { admissionViewMode = null, filters = {} } = {}) {
  const admissionCategory = admissionCategoryForViewMode(admissionViewMode);
  if (!admissionCategory) return Object.freeze({ regions: [], universities: [], academicFields: [], departments: [], admissionNames: [] });
  const scopedFilters = { ...filters, admissionCategory };
  const visibility = { admissionCategory, includeSpecialEligibility: filters.includeSpecialEligibility === true };
  const regionRecords = filterAdmissionRecords(data, visibility);
  const presentRegions = new Set(regionRecords.map((item) => normalizeAdmissionRegion(item.region)));
  const regions = [
    ...ADMISSION_REGION_ORDER.filter((region) => presentRegions.has(region)),
    ...[...presentRegions].filter((region) => !ADMISSION_REGION_ORDER.includes(region)).sort(koSort),
  ];
  const universityRecords = filterAdmissionRecords(data, {
    ...visibility,
    region: filters.region,
  });
  return Object.freeze({
    regions: Object.freeze(regions),
    universities: Object.freeze(uniqueSorted(universityRecords.map((item) => item.university))),
    academicFields: Object.freeze(getAvailableAcademicFields(data, scopedFilters)),
    departments: Object.freeze(getAvailableDepartments(data, scopedFilters)),
    admissionNames: Object.freeze(getAvailableAdmissionNames(data, scopedFilters)),
  });
}

export function reconcileAdmissionViewFilters(data, { admissionViewMode = null, filters = {} } = {}) {
  const next = {
    region: normalizeAdmissionRegion(filters.region),
    university: String(filters.university ?? ''),
    field: String(filters.field ?? filters.academicField ?? ''),
    department: String(filters.department ?? ''),
    admissionName: String(filters.admissionName ?? ''),
    includeSpecialEligibility: filters.includeSpecialEligibility === true,
  };
  if (!normalizeAdmissionViewMode(admissionViewMode)) return { ...next, region: '', university: '', field: '', department: '', admissionName: '' };
  let options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.region && !options.regions.includes(next.region)) next.region = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.university && !options.universities.includes(next.university)) next.university = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.field && !options.academicFields.includes(next.field)) next.field = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.department && !options.departments.includes(next.department)) next.department = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.admissionName && !options.admissionNames.includes(next.admissionName)) next.admissionName = '';
  return next;
}

/** 교과는 세 범위로 나누고, 학종은 학생 내신과 비교하지 않는다. */
export function prepareAdmissionResultView(data, {
  admissionViewMode = null,
  filters = {},
  comparisonValue = null,
  comparisonEnabled = true,
  visibleResultLimits = resetAdmissionGroupLimits(),
} = {}) {
  const normalizedMode = normalizeAdmissionViewMode(admissionViewMode);
  const admissionCategory = admissionCategoryForViewMode(normalizedMode);
  if (!admissionCategory) {
    return Object.freeze({
      admissionViewMode: null, admissionCategory: null, totalMatchedResults: 0,
      visibleResults: Object.freeze([]), visibleResultLimit: 0, hasMore: false,
      subjectSimilarCount: 0, subjectHigherCount: 0, subjectLowerCount: 0,
      subjectGroups: null, subjectReference: null, comprehensive: null,
    });
  }

  const effectiveFilters = { ...filters, admissionCategory };
  const filtered = filterAdmissionRecords(data, effectiveFilters);

  if (normalizedMode === ADMISSION_VIEW_MODES.COMPREHENSIVE) {
    const entries = filtered
      .filter(isStudentRecordComprehensive)
      .map((item) => ({ item, difference: null, absoluteDifference: null, group: null }))
      .sort(stableTextSort);
    const comprehensive = groupView(entries, visibleResultLimits.comprehensive);
    return Object.freeze({
      admissionViewMode: normalizedMode, admissionCategory,
      totalMatchedResults: entries.length,
      visibleResults: comprehensive.visibleResults,
      visibleResultLimit: comprehensive.visibleResultLimit,
      hasMore: comprehensive.hasMore,
      subjectSimilarCount: 0, subjectHigherCount: 0, subjectLowerCount: 0,
      subjectGroups: null, subjectReference: null, comprehensive,
    });
  }

  if (!comparisonEnabled) {
    const entries = filtered
      .map((item) => ({ item, difference: null, absoluteDifference: null, group: null }))
      .sort(stableTextSort);
    const subjectReference = groupView(entries, visibleResultLimits.subjectReference);
    return Object.freeze({
      admissionViewMode: normalizedMode, admissionCategory,
      totalMatchedResults: entries.length,
      visibleResults: subjectReference.visibleResults,
      visibleResultLimit: subjectReference.visibleResultLimit,
      hasMore: subjectReference.hasMore,
      subjectSimilarCount: 0, subjectHigherCount: 0, subjectLowerCount: 0,
      subjectGroups: null, subjectReference, comprehensive: null,
    });
  }

  const entries = filtered
    .filter((item) => isComparableAdmissionRecord(item) && convertedCut70(item) != null)
    .map((item) => {
      const referenceGrade = convertedCut70(item);
      const difference = comparisonDifference(comparisonValue, referenceGrade);
      return {
        item, referenceGrade, difference,
        absoluteDifference: difference == null ? Number.POSITIVE_INFINITY : Math.abs(difference),
        group: classifySubjectAdmissionRange(comparisonValue, referenceGrade),
      };
    })
    .filter((entry) => entry.group)
    .sort((left, right) => left.absoluteDifference - right.absoluteDifference || stableTextSort(left, right));
  const grouped = Object.fromEntries(Object.values(ADMISSION_SUBJECT_GROUPS).map((group) => [
    group,
    groupView(entries.filter((entry) => entry.group === group), visibleResultLimits[group]),
  ]));
  return Object.freeze({
    admissionViewMode: normalizedMode, admissionCategory,
    totalMatchedResults: entries.length,
    visibleResults: Object.freeze(Object.values(ADMISSION_SUBJECT_GROUPS).flatMap((group) => grouped[group].visibleResults)),
    visibleResultLimit: Object.values(ADMISSION_SUBJECT_GROUPS).reduce((sum, group) => sum + grouped[group].visibleResultLimit, 0),
    hasMore: Object.values(ADMISSION_SUBJECT_GROUPS).some((group) => grouped[group].hasMore),
    subjectSimilarCount: grouped.similar.totalCount,
    subjectHigherCount: grouped.higher.totalCount,
    subjectLowerCount: grouped.lower.totalCount,
    subjectGroups: Object.freeze(grouped), subjectReference: null,
    comprehensive: null,
  });
}

import {
  filterAdmissionRecords,
  getAvailableAcademicFields,
  getAvailableAdmissionNames,
  getAvailableDepartments,
  getAvailableRegions,
  getAvailableOwnershipTypes,
  getAvailableUniversities,
  normalizeAdmissionRegion,
  searchAvailableDepartments,
} from './admission-filter-options.mjs?v=20260922-open-major1';
import {
  ADMISSION_CATEGORIES,
  isComparableAdmissionRecord,
  isStudentRecordComprehensive,
} from './admission-record-normalizer.mjs?v=20260922-open-major1';

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
const convertedCut70 = (item) => item.cut70Converted != null && item.cut70Converted !== '' && Number.isFinite(Number(item.cut70Converted))
  ? Number(item.cut70Converted)
  : null;
const comprehensiveReferenceGrade = (item) => {
  for (const value of [item.cut70Converted, item.averageGradeConverted, item.cut50Converted]) {
    if (value != null && value !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};
const comparisonDifference = (score, cut) => score != null && score !== '' && cut != null && cut !== '' && Number.isFinite(Number(score)) && Number.isFinite(Number(cut))
  ? Number((Number(cut) - Number(score)).toFixed(2))
  : null;

function stableTextSort(left, right) {
  return koSort(left.item.university, right.item.university)
    || koSort(left.item.department, right.item.department)
    || koSort(left.item.admissionName, right.item.admissionName);
}

/** 한 대학의 모집단위가 첫 페이지를 독점하지 않도록 대학별 한 건씩 순환 배치한다. */
export function interleaveAdmissionResultsByUniversity(entries) {
  const buckets = new Map();
  entries.forEach((entry) => {
    const key = entry.item.university;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  });
  const universityNames = [...buckets.keys()].sort(koSort);
  const interleaved = [];
  for (let index = 0; interleaved.length < entries.length; index += 1) {
    universityNames.forEach((university) => {
      const entry = buckets.get(university)?.[index];
      if (entry) interleaved.push(entry);
    });
  }
  return interleaved;
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

/** 학종 공개 내신값을 합격 판단 없이 참고 구간으로만 나눈다. */
export function classifyComprehensiveReferenceRange(studentGrade, referenceGrade) {
  const difference = comparisonDifference(studentGrade, referenceGrade);
  if (difference == null) return null;
  if (Math.abs(difference) <= 0.2) return ADMISSION_SUBJECT_GROUPS.SIMILAR;
  return difference < -0.2 ? ADMISSION_SUBJECT_GROUPS.HIGHER : ADMISSION_SUBJECT_GROUPS.LOWER;
}

function finiteNumber(value) {
  return value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
}

function entryDifference(entry) {
  return finiteNumber(entry?.absoluteDifference ?? entry?.referenceAbsoluteDifference);
}

function entryReferenceGrade(entry, referenceScale = 'converted') {
  const direct = finiteNumber(entry?.referenceGrade);
  if (direct != null) return direct;
  const item = entry?.item ?? entry ?? {};
  const fields = referenceScale === 'original'
    ? ['cut70Original', 'averageGradeOriginal', 'cut50Original']
    : ['cut70Converted', 'averageGradeConverted', 'cut50Converted'];
  for (const field of fields) {
    const value = finiteNumber(item[field]);
    if (value != null) return value;
  }
  return null;
}

function compareUniversityResults(left, right, referenceScale) {
  const leftGrade = entryReferenceGrade(left, referenceScale);
  const rightGrade = entryReferenceGrade(right, referenceScale);
  if (leftGrade != null || rightGrade != null) {
    if (leftGrade == null) return 1;
    if (rightGrade == null) return -1;
    if (leftGrade !== rightGrade) return leftGrade - rightGrade;
  }
  const leftItem = left?.item ?? left ?? {};
  const rightItem = right?.item ?? right ?? {};
  return koSort(leftItem.department, rightItem.department)
    || koSort(leftItem.admissionName, rightItem.admissionName);
}

/** 대학은 가장 가까운 차이순, 대학 내부 모집단위는 입결 등급 숫자가 낮은 순으로 묶는다. */
export function groupResultsByUniversity(results = [], { referenceScale = 'converted' } = {}) {
  const groups = new Map();
  results.forEach((result) => {
    const item = result?.item ?? result;
    const universityId = item?.universityId ?? null;
    const universityName = String(item?.university ?? '').trim();
    const key = universityId || `university-name:${universityName}`;
    if (!groups.has(key)) {
      groups.set(key, { universityId, universityName, resultCount: 0, results: [] });
    }
    const group = groups.get(key);
    group.results.push(result);
    group.resultCount += 1;
  });
  return Object.freeze([...groups.values()]
    .map((group) => {
      const differences = group.results.map(entryDifference).filter((value) => value != null);
      return Object.freeze({
        ...group,
        closestDifference: differences.length ? Math.min(...differences) : null,
        results: Object.freeze([...group.results].sort((left, right) => compareUniversityResults(left, right, referenceScale))),
      });
    })
    .sort((left, right) => {
      const leftDifference = left.closestDifference ?? Number.POSITIVE_INFINITY;
      const rightDifference = right.closestDifference ?? Number.POSITIVE_INFINITY;
      return leftDifference - rightDifference || koSort(left.universityName, right.universityName);
    }));
}

function groupView(entries, limit, options = {}) {
  const visibleResultLimit = Math.max(0, Number(limit) || ADMISSION_RESULT_PAGE_SIZE);
  const visibleResults = entries.slice(0, visibleResultLimit);
  return Object.freeze({
    totalCount: entries.length,
    allResults: Object.freeze(entries),
    visibleResults: Object.freeze(visibleResults),
    universityGroups: groupResultsByUniversity(entries, options),
    visibleResultLimit,
    hasMore: visibleResults.length < entries.length,
    remainingResultCount: Math.max(0, entries.length - visibleResults.length),
  });
}

/** 선택된 최상위 모드 안에서만 종속 필터 선택지를 계산한다. */
export function getAdmissionViewFilterOptions(data, { admissionViewMode = null, filters = {} } = {}) {
  const admissionCategory = admissionCategoryForViewMode(admissionViewMode);
  if (!admissionCategory) return Object.freeze({ regions: [], ownershipTypes: [], universities: [], academicFields: [], departments: [], departmentSuggestions: [], admissionNames: [] });
  const scopedFilters = { ...filters, admissionCategory };
  const visibility = {
    admissionCategory,
    includeSpecialEligibility: filters.includeSpecialEligibility === true,
    schoolRegion: filters.schoolRegion,
    schoolGender: filters.schoolGender,
    ownership: filters.ownership,
  };
  const regions = getAvailableRegions(data, visibility);
  const departmentSuggestions = filters.department
    ? searchAvailableDepartments(data, { ...scopedFilters, department: '', admissionName: '' }, filters.department, { limit: 30 })
    : [];
  return Object.freeze({
    regions: Object.freeze(regions),
    ownershipTypes: Object.freeze(getAvailableOwnershipTypes()),
    universities: Object.freeze(getAvailableUniversities(data, { ...visibility, region: filters.region })),
    academicFields: Object.freeze(getAvailableAcademicFields(data, scopedFilters)),
    departments: Object.freeze(filters.university ? getAvailableDepartments(data, scopedFilters) : []),
    departmentSuggestions: Object.freeze(departmentSuggestions),
    admissionNames: Object.freeze(getAvailableAdmissionNames(data, scopedFilters)),
  });
}

export function reconcileAdmissionViewFilters(data, { admissionViewMode = null, filters = {} } = {}) {
  const next = {
    region: normalizeAdmissionRegion(filters.region),
    ownership: String(filters.ownership ?? ''),
    university: String(filters.university ?? ''),
    field: String(filters.field ?? filters.academicField ?? ''),
    department: String(filters.department ?? ''),
    admissionName: String(filters.admissionName ?? ''),
    includeSpecialEligibility: filters.includeSpecialEligibility === true,
    schoolRegion: String(filters.schoolRegion ?? ''),
    schoolGender: String(filters.schoolGender ?? ''),
  };
  if (!normalizeAdmissionViewMode(admissionViewMode)) return { ...next, region: '', ownership: '', university: '', field: '', department: '', admissionName: '' };
  let options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.region && !options.regions.includes(next.region)) next.region = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.ownership && !options.ownershipTypes.includes(next.ownership)) next.ownership = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.university && !options.universities.includes(next.university)) next.university = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.field && !options.academicFields.includes(next.field)) next.field = '';
  options = getAdmissionViewFilterOptions(data, { admissionViewMode, filters: next });
  if (next.department && !searchAvailableDepartments(data, {
    ...next,
    department: '',
    admissionName: '',
    admissionCategory: admissionCategoryForViewMode(admissionViewMode),
  }, next.department, { limit: 1 }).length) next.department = '';
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
      comprehensiveSimilarCount: 0, comprehensiveHigherCount: 0, comprehensiveLowerCount: 0,
      subjectGroups: null, subjectReference: null, comprehensiveReferenceGroups: null, comprehensive: null,
    });
  }

  const effectiveFilters = { ...filters, admissionCategory };
  const filtered = filterAdmissionRecords(data, effectiveFilters);

  if (normalizedMode === ADMISSION_VIEW_MODES.COMPREHENSIVE) {
    const sourceEntries = filtered
      .filter(isStudentRecordComprehensive)
      .map((item) => ({ item, difference: null, absoluteDifference: null, group: null }));
    const entries = interleaveAdmissionResultsByUniversity([...sourceEntries].sort(stableTextSort));
    const comprehensive = groupView(entries, visibleResultLimits.comprehensive);
    const referenceEntries = sourceEntries
      .map(({ item }) => {
        const referenceGrade = comprehensiveReferenceGrade(item);
        const referenceDifference = comparisonDifference(comparisonValue, referenceGrade);
        return {
          item,
          referenceGrade,
          referenceDifference,
          referenceAbsoluteDifference: referenceDifference == null ? Number.POSITIVE_INFINITY : Math.abs(referenceDifference),
          referenceGroup: classifyComprehensiveReferenceRange(comparisonValue, referenceGrade),
        };
      })
      .filter((entry) => entry.referenceGroup)
      .sort((left, right) => left.referenceAbsoluteDifference - right.referenceAbsoluteDifference || stableTextSort(left, right));
    const comprehensiveReferenceGroups = Object.fromEntries(Object.values(ADMISSION_SUBJECT_GROUPS).map((group) => [
      group,
      groupView(referenceEntries.filter((entry) => entry.referenceGroup === group), visibleResultLimits[group]),
    ]));
    return Object.freeze({
      admissionViewMode: normalizedMode, admissionCategory,
      totalMatchedResults: entries.length,
      visibleResults: comprehensive.visibleResults,
      visibleResultLimit: comprehensive.visibleResultLimit,
      hasMore: comprehensive.hasMore,
      subjectSimilarCount: 0, subjectHigherCount: 0, subjectLowerCount: 0,
      comprehensiveSimilarCount: comprehensiveReferenceGroups.similar.totalCount,
      comprehensiveHigherCount: comprehensiveReferenceGroups.higher.totalCount,
      comprehensiveLowerCount: comprehensiveReferenceGroups.lower.totalCount,
      subjectGroups: null, subjectReference: null,
      comprehensiveReferenceGroups: Object.freeze(comprehensiveReferenceGroups), comprehensive,
    });
  }

  if (!comparisonEnabled) {
    const entries = filtered
      .map((item) => ({ item, difference: null, absoluteDifference: null, group: null }))
      .sort(stableTextSort);
    const subjectReference = groupView(entries, visibleResultLimits.subjectReference, { referenceScale: 'original' });
    return Object.freeze({
      admissionViewMode: normalizedMode, admissionCategory,
      totalMatchedResults: entries.length,
      visibleResults: subjectReference.visibleResults,
      visibleResultLimit: subjectReference.visibleResultLimit,
      hasMore: subjectReference.hasMore,
      subjectSimilarCount: 0, subjectHigherCount: 0, subjectLowerCount: 0,
      comprehensiveSimilarCount: 0, comprehensiveHigherCount: 0, comprehensiveLowerCount: 0,
      subjectGroups: null, subjectReference, comprehensiveReferenceGroups: null, comprehensive: null,
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
    comprehensiveSimilarCount: 0, comprehensiveHigherCount: 0, comprehensiveLowerCount: 0,
    subjectGroups: Object.freeze(grouped), subjectReference: null, comprehensiveReferenceGroups: null,
    comprehensive: null,
  });
}

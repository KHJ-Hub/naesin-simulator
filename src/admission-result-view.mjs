import { filterAdmissionRecords } from './admission-filter-options.mjs';
import {
  ADMISSION_CATEGORIES,
  isComparableAdmissionRecord,
  isStudentRecordComprehensive,
} from './admission-record-normalizer.mjs';

export const ADMISSION_RESULT_PAGE_SIZE = 20;

const koSort = (left, right) => String(left ?? '').localeCompare(String(right ?? ''), 'ko');
const convertedCut70 = (item) => Number.isFinite(Number(item.cut70Converted)) ? Number(item.cut70Converted) : null;
const comparisonDifference = (score, cut) => Number.isFinite(Number(score)) && Number.isFinite(Number(cut))
  ? Number((Number(cut) - Number(score)).toFixed(2))
  : null;

function stableTextSort(left, right) {
  return koSort(left.item.university, right.item.university)
    || koSort(left.item.department, right.item.department)
    || koSort(left.item.admissionName, right.item.admissionName);
}

export function resetAdmissionResultLimit() {
  return ADMISSION_RESULT_PAGE_SIZE;
}

export function increaseAdmissionResultLimit(currentLimit, pageSize = ADMISSION_RESULT_PAGE_SIZE) {
  const current = Number.isFinite(Number(currentLimit)) ? Math.max(0, Number(currentLimit)) : ADMISSION_RESULT_PAGE_SIZE;
  return current + Math.max(1, Number(pageSize) || ADMISSION_RESULT_PAGE_SIZE);
}

/**
 * 학생부교과는 5등급 환산 70% cut과 현재/목표 내신의 차이가 가까운 순으로 정렬한다.
 * 학생부종합은 차이를 만들지 않고 공식 모집단위명을 기준으로만 안정 정렬한다.
 */
export function prepareAdmissionResultView(data, {
  filters = {},
  comparisonValue = null,
  visibleResultLimit = ADMISSION_RESULT_PAGE_SIZE,
} = {}) {
  const admissionCategory = filters.admissionCategory === ADMISSION_CATEGORIES.COMPREHENSIVE
    ? ADMISSION_CATEGORIES.COMPREHENSIVE
    : ADMISSION_CATEGORIES.SUBJECT;
  const effectiveFilters = { ...filters, admissionCategory };
  const filtered = filterAdmissionRecords(data, effectiveFilters);

  const matchedResults = admissionCategory === ADMISSION_CATEGORIES.SUBJECT
    ? filtered
      .filter((item) => isComparableAdmissionRecord(item) && convertedCut70(item) != null)
      .map((item) => {
        const difference = comparisonDifference(comparisonValue, convertedCut70(item));
        return { item, difference, absoluteDifference: difference == null ? Number.POSITIVE_INFINITY : Math.abs(difference) };
      })
      .sort((left, right) => left.absoluteDifference - right.absoluteDifference || stableTextSort(left, right))
    : filtered
      .filter(isStudentRecordComprehensive)
      .map((item) => ({ item, difference: null, absoluteDifference: null }))
      .sort(stableTextSort);

  const limit = Math.max(0, Number(visibleResultLimit) || ADMISSION_RESULT_PAGE_SIZE);
  const visibleResults = matchedResults.slice(0, limit);
  return Object.freeze({
    admissionCategory,
    totalMatchedResults: matchedResults.length,
    visibleResults: Object.freeze(visibleResults),
    visibleResultLimit: limit,
    hasMore: visibleResults.length < matchedResults.length,
    remainingResultCount: Math.max(0, matchedResults.length - visibleResults.length),
  });
}

import { getAdmissionPrimaryReference } from './admission-card-summary.mjs';
import {
  ADMISSION_ACADEMIC_FIELDS,
  isStudentRecordComprehensive,
  isStudentRecordSubject,
  normalizeAcademicField,
  normalizeAdmissionCategory,
} from './admission-record-normalizer.mjs';
import { normalizeAdmissionRegion } from './admission-filter-options.mjs';
import { UNIVERSITY_BY_ID, UNIVERSITY_BY_NAME } from './data/universities.mjs';

export const LOCAL_ADMISSION_SCOPES = Object.freeze({
  BUSAN: 'busan',
  BUSAN_ULSAN_GYEONGNAM: 'busan-ulsan-gyeongnam',
});

export const LOCAL_ADMISSION_SCOPE_CONFIG = Object.freeze({
  [LOCAL_ADMISSION_SCOPES.BUSAN]: Object.freeze({
    label: '부산권',
    regions: Object.freeze(['부산광역시']),
  }),
  [LOCAL_ADMISSION_SCOPES.BUSAN_ULSAN_GYEONGNAM]: Object.freeze({
    label: '부산·울산·경남권',
    regions: Object.freeze(['부산광역시', '울산광역시', '경상남도']),
  }),
});

const finiteOrNull = (value) => value == null || value === ''
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;

const koSort = (left, right) => String(left ?? '').localeCompare(String(right ?? ''), 'ko');

function universityInfo(item = {}) {
  return item.universityInfo
    ?? UNIVERSITY_BY_ID[item.universityId]
    ?? UNIVERSITY_BY_NAME[item.university]
    ?? null;
}

function itemRegion(item = {}) {
  return normalizeAdmissionRegion(universityInfo(item)?.region ?? item.region);
}

function itemUniversityId(item = {}) {
  return String(item.universityId ?? universityInfo(item)?.universityId ?? item.university ?? '').trim();
}

function sameUniversityAndDepartment(left = {}, right = {}) {
  return itemUniversityId(left) === itemUniversityId(right)
    && String(left.department ?? '').trim() === String(right.department ?? '').trim();
}

/** 공식 원본과 5등급 환산값이 모두 있는 카드의 대표 자료 유형만 반환한다. */
export function getLocalComparisonReference(item = {}) {
  const reference = getAdmissionPrimaryReference(item);
  const original = finiteOrNull(reference.original);
  const converted = finiteOrNull(reference.converted);
  if (reference.kind === 'unavailable' || original == null || converted == null) return null;
  return Object.freeze({ ...reference, original, converted });
}

export function canCompareWithBusanAdmissions(item = {}) {
  return Boolean(
    (isStudentRecordSubject(item) || isStudentRecordComprehensive(item))
    && Number.isInteger(Number(item.referenceYear))
    && getLocalComparisonReference(item),
  );
}

/**
 * 대학 서열을 만들지 않고 동일 학년도·전형 범주·공개 지표 종류의 부산권 자료만 비교한다.
 * 같은 계열을 먼저 채운 뒤, 결과가 부족할 때만 다른 계열의 비교 가능한 자료로 보완한다.
 */
export function findLocalAdmissionComparisons(target = {}, data = [], {
  scope = LOCAL_ADMISSION_SCOPES.BUSAN,
  limit = 5,
} = {}) {
  const config = LOCAL_ADMISSION_SCOPE_CONFIG[scope] ?? LOCAL_ADMISSION_SCOPE_CONFIG[LOCAL_ADMISSION_SCOPES.BUSAN];
  const targetReference = getLocalComparisonReference(target);
  const targetCategory = normalizeAdmissionCategory(target.admissionCategory ?? target.category);
  const targetYear = Number(target.referenceYear ?? target.year);
  const targetField = normalizeAcademicField(target.academicField ?? target.field);
  const validLimit = Math.max(1, Math.min(10, Number(limit) || 5));
  const comprehensive = isStudentRecordComprehensive(target);

  const empty = (reason) => Object.freeze({
    available: false,
    reason,
    scope,
    scopeLabel: config.label,
    target,
    targetReference,
    admissionCategory: targetCategory,
    isComprehensive: comprehensive,
    usedAcademicFieldFallback: false,
    results: Object.freeze([]),
  });

  if (!targetReference || !targetCategory || !Number.isInteger(targetYear)) {
    return empty('target-unavailable');
  }

  const regions = new Set(config.regions.map(normalizeAdmissionRegion));
  const candidates = data.flatMap((candidate) => {
    if (!candidate || sameUniversityAndDepartment(target, candidate)) return [];
    if (!regions.has(itemRegion(candidate))) return [];
    if (Number(candidate.referenceYear ?? candidate.year) !== targetYear) return [];
    if (normalizeAdmissionCategory(candidate.admissionCategory ?? candidate.category) !== targetCategory) return [];
    if (candidate.studentDefaultVisible === false) return [];

    const reference = getLocalComparisonReference(candidate);
    if (!reference || reference.kind !== targetReference.kind) return [];
    const field = normalizeAcademicField(candidate.academicField ?? candidate.field);
    const sameAcademicField = targetField !== ADMISSION_ACADEMIC_FIELDS.UNKNOWN && field === targetField;
    const difference = Number((reference.converted - targetReference.converted).toFixed(2));
    return [{
      item: candidate,
      reference,
      difference,
      absoluteDifference: Math.abs(difference),
      sameAcademicField,
    }];
  });

  const sortClosest = (left, right) => left.absoluteDifference - right.absoluteDifference
    || koSort(left.item.university, right.item.university)
    || koSort(left.item.department, right.item.department)
    || koSort(left.item.admissionName, right.item.admissionName);
  const sameField = candidates.filter((entry) => entry.sameAcademicField).sort(sortClosest);
  const otherFields = candidates.filter((entry) => !entry.sameAcademicField).sort(sortClosest);
  const results = [...sameField, ...otherFields].slice(0, validLimit);
  if (!results.length) return empty('no-comparable-local-data');

  return Object.freeze({
    available: true,
    reason: null,
    scope,
    scopeLabel: config.label,
    target,
    targetReference,
    admissionCategory: targetCategory,
    isComprehensive: comprehensive,
    usedAcademicFieldFallback: results.some((entry) => !entry.sameAcademicField),
    results: Object.freeze(results.map(Object.freeze)),
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function formatGrade(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
}

function signedDifference(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}`;
}

/** 학생용·교사용 카드가 공유하는 부산권 유사 입결 결과 패널이다. */
export function renderLocalAdmissionComparison(result = {}) {
  const scopeLabel = escapeHtml(result.scopeLabel || '부산권');
  if (!result.available) {
    return `<section class="local-admission-comparison" aria-live="polite"><h4>${scopeLabel}에서 비슷한 입결</h4><p class="local-admission-empty">비교 가능한 ${scopeLabel} 입결 자료가 없습니다.</p></section>`;
  }

  const target = result.target;
  const reference = result.targetReference;
  const comprehensive = result.isComprehensive;
  const title = comprehensive ? `${scopeLabel} 전년도 등록자 내신 참고` : `${scopeLabel}에서 비슷한 입결`;
  const criteria = `${escapeHtml(result.admissionCategory)} · ${escapeHtml(reference.label)} · 5등급제 환산 기준`;
  const rows = result.results.map(({ item, reference: candidateReference, difference }) => `
    <li>
      <span><strong>${escapeHtml(item.university)}</strong><small>${escapeHtml(item.department)} · ${escapeHtml(item.admissionName)}</small></span>
      <b>${formatGrade(candidateReference.converted)}</b>
      <em>차이 ${signedDifference(difference)}</em>
    </li>`).join('');
  const fallback = result.usedAcademicFieldFallback
    ? `<p class="local-admission-fallback">같은 계열의 비교 가능한 자료가 부족해 ${scopeLabel} 전체에서 함께 찾았습니다.</p>`
    : '';
  const notice = comprehensive
    ? '학생부종합전형은 서류·활동·면접 등 다양한 요소를 함께 평가하므로 내신만으로 대학 수준이나 합격 가능성을 비교할 수 없습니다.'
    : '대학의 전체적인 수준이나 선호도를 비교한 결과가 아니라, 공개된 전년도 입시결과 중 비슷한 등급대의 모집단위를 보여주는 참고자료입니다.';

  return `<section class="local-admission-comparison" aria-live="polite"><header><h4>${title}</h4><p>${criteria}</p></header><div class="local-admission-target"><span>대상</span><strong>${escapeHtml(target.university)} · ${escapeHtml(target.department)}</strong><b>${formatGrade(reference.converted)}</b></div><h5>비슷한 ${scopeLabel} 모집단위</h5><ol>${rows}</ol>${fallback}<p class="local-admission-notice">${notice}</p></section>`;
}

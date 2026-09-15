import { admissionResultsByYear } from './admission-results/index.mjs';
import { UNIVERSITY_BY_NAME } from './data/universities.mjs';

/** 전년도 공개 입시결과를 현재 내신과 단순 비교하기 위한 설정이다. */
export const ADMISSION_REFERENCE_SETTINGS = Object.freeze({
  defaultYear: 2026,
  bands: Object.freeze({
    comfortable: Object.freeze({ label: '비교적 여유 있는 범위', minDifference: 0.20 }),
    similar: Object.freeze({ label: '현재 내신과 비슷한 범위', minDifference: -0.20 }),
    challenging: Object.freeze({ label: '조금 도전적인 범위', minDifference: Number.NEGATIVE_INFINITY }),
  }),
});
export const ADMISSION_CONVERSION_NOTICE = '5등급제 환산값은 부산광역시교육청학력개발원 진로진학지원센터의 부산 관내 98개교 15,978명 누적 등급평균 자료를 기준으로 환산한 참고값입니다. 실제 대학별 2028학년도 평가·환산 방식과 다를 수 있습니다.';

// 연도별 모듈만 교체·추가하면 화면 코드 수정 없이 자료를 갱신할 수 있다.
export const ADMISSION_REFERENCE_DATA = Object.freeze(admissionResultsByYear[2026].map((item) => {
  const universityInfo = UNIVERSITY_BY_NAME[item.university] ?? null;
  return { ...item, universityId: universityInfo?.universityId ?? null, universityInfo };
}));

export const ADMISSION_REFERENCE_SCHEMA = Object.freeze({
  referenceYear: 'number', universityId: 'string|null', region: 'string', university: 'string', field: 'string',
  department: 'string', admissionName: 'string', admissionType: 'string', category: '학생부교과|학생부종합',
  cut70: 'number', cut50: 'number|null', cut70Original: 'number', cut50Original: 'number|null',
  cut70Converted: 'number|null', cut50Converted: 'number|null', conversionDataset: 'string',
  interpolation: 'object', isApproximate: 'boolean', source: 'string', updatedAt: 'YYYY-MM-DD|null',
});

export function admissionUniversityLinks(item = {}) {
  const info = item.universityInfo ?? UNIVERSITY_BY_NAME[item.university];
  if (!info) return [];
  return [
    ['대학 홈페이지', info.homepageUrl],
    ['입학처', info.admissionsUrl],
    ['어디가', info.adigaUrl],
  ].filter(([, url]) => Boolean(url));
}

export function admissionComparisonCut(item = {}, scale = 'converted') {
  if (scale === 'original') return Number.isFinite(Number(item.cut70Original ?? item.cut70)) ? Number(item.cut70Original ?? item.cut70) : null;
  return Number.isFinite(Number(item.cut70Converted)) ? Number(item.cut70Converted) : null;
}

export function validAdmissionReference(item = {}) {
  return Number.isInteger(Number(item.referenceYear))
    && ['university', 'region', 'department', 'admissionName', 'admissionType', 'source'].every((key) => Boolean(String(item[key] ?? '').trim()))
    && (item.field == null || typeof item.field === 'string')
    && (item.updatedAt == null || Boolean(String(item.updatedAt).trim()))
    && ['학생부교과', '학생부종합'].includes(item.category)
    && Number.isFinite(Number(item.cut70))
    && Number(item.cut70) >= 1 && Number(item.cut70) <= 9
    && (item.cut50 == null || item.cut50 === '' || Number.isFinite(Number(item.cut50)));
}

// difference가 양수면 현재 내신 숫자가 더 낮아(더 좋은 성적) 70% cut보다 여유가 있음을 뜻한다.
export function admissionDifference(currentAverage, cut70) {
  const difference = Number(cut70) - Number(currentAverage);
  return Number.isFinite(difference) ? Number(difference.toFixed(2)) : null;
}

export function classifyAdmissionReference(currentAverage, cut70, settings = ADMISSION_REFERENCE_SETTINGS) {
  const difference = admissionDifference(currentAverage, cut70);
  if (difference == null) return null;
  if (difference >= settings.bands.comfortable.minDifference) return 'comfortable';
  if (difference >= settings.bands.similar.minDifference) return 'similar';
  return 'challenging';
}

export function describeAdmissionDifference(difference) {
  if (!Number.isFinite(Number(difference))) return '';
  const magnitude = Math.abs(Number(difference)).toFixed(2);
  if (Number(difference) > 0) return `현재 내신이 전년도 70% cut보다 ${magnitude}등급 더 좋은 성적입니다.`;
  if (Number(difference) < 0) return `현재 내신이 전년도 70% cut보다 ${magnitude}등급 더 낮은 성적입니다.`;
  return '현재 내신과 전년도 70% cut이 같습니다.';
}

export function filterAdmissionReferences(data, filters = {}) {
  return data.filter((item) => validAdmissionReference(item) && (
    (!filters.region || item.region === filters.region)
    && (!filters.university || item.university === filters.university)
    && (!filters.field || item.field === filters.field)
    && (!filters.department || item.department === filters.department)
    && (!filters.admissionName || item.admissionName === filters.admissionName)
    && (!filters.admissionType || item.admissionType === filters.admissionType)
    && (!filters.category || item.category === filters.category)
  ));
}

import {
  ADMISSION_CATEGORIES,
  ADMISSION_DATA_AVAILABILITY,
  inferAcademicFieldFromDepartment,
  normalizeAcademicField,
  normalizeAdmissionRecord,
} from './admission-record-normalizer.mjs';
import { normalizeAdmissionRegion } from './admission-filter-options.mjs';

export const ADMISSION_DASHBOARD_STATUSES = Object.freeze(Object.values(ADMISSION_DATA_AVAILABILITY));
export const ADMISSION_DASHBOARD_REGION_ORDER = Object.freeze([
  '부산', '울산', '경남',
  '서울', '경기', '인천',
  '대구', '경북',
  '대전', '세종', '충남', '충북',
  '광주', '전남', '전북',
  '강원', '제주',
]);
export const ADMISSION_DASHBOARD_STATUS_LABELS = Object.freeze({
  'confirmed-cut': '50%·70%컷',
  'cut70-only': '70%컷',
  'cut50-only': '50%컷만',
  'average-only': '평균만',
  'not-published': '미공개',
  'not-checked': '미확인',
  'no-result': '결과 없음',
});
export const ADMISSION_DASHBOARD_WARNING_SEVERITIES = Object.freeze({
  IMPORTANT: 'important',
  REVIEW: 'review',
});
export const ADMISSION_DASHBOARD_WARNING_SEVERITY_LABELS = Object.freeze({
  [ADMISSION_DASHBOARD_WARNING_SEVERITIES.IMPORTANT]: '중요',
  [ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW]: '확인 필요',
});

const CHECK_NEEDED_STATUSES = new Set([
  ADMISSION_DATA_AVAILABILITY.NOT_PUBLISHED,
  ADMISSION_DATA_AVAILABILITY.NOT_CHECKED,
  ADMISSION_DATA_AVAILABILITY.NO_RESULT,
]);
const text = (value) => String(value ?? '').trim();
const validConverted = (value) => Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 5;
const hasValue = (value) => value !== null && value !== undefined && value !== '';

function emptyStatusCounts() {
  return Object.fromEntries(ADMISSION_DASHBOARD_STATUSES.map((status) => [status, 0]));
}

function statusCounts(records = []) {
  const counts = emptyStatusCounts();
  records.forEach((record) => {
    if (record.dataAvailability in counts) counts[record.dataAvailability] += 1;
  });
  return counts;
}

function recordCategoryCounts(records = []) {
  return {
    subject: records.filter((record) => record.admissionCategory === ADMISSION_CATEGORIES.SUBJECT).length,
    comprehensive: records.filter((record) => record.admissionCategory === ADMISSION_CATEGORIES.COMPREHENSIVE).length,
  };
}

function warning(type, record, description, universityName = '', severity = ADMISSION_DASHBOARD_WARNING_SEVERITIES.IMPORTANT) {
  return {
    type,
    severity,
    recordId: text(record?.dashboardRecordId),
    universityId: text(record?.universityId),
    university: text(record?.university) || universityName || '확인 불가',
    department: text(record?.department) || '-',
    admissionName: text(record?.admissionName) || '-',
    description,
  };
}

function conversionWarnings(raw, item) {
  const fields = [
    ['cut70Original', 'cut70Converted', '70%컷'],
    ['cut50Original', 'cut50Converted', '50%컷'],
    ['averageGradeOriginal', 'averageGradeConverted', '평균등급'],
  ];
  const needsConversion = Number(raw?.originalScale ?? 9) === 9;
  if (!needsConversion) return [];
  const invalidLabels = fields
    .filter(([original, converted]) => hasValue(item[original]) && !validConverted(item[converted]))
    .map(([, , label]) => label);
  return invalidLabels.length
    ? [warning('환산값 이상', item, `${invalidLabels.join(', ')} 원본값은 있지만 유효한 5등급 환산값이 없습니다.`)]
    : [];
}

function invalidNumericWarning(raw, item) {
  const fields = [
    ['cut70Original', '70%컷 원본', 1, 9],
    ['cut50Original', '50%컷 원본', 1, 9],
    ['averageGradeOriginal', '평균등급 원본', 1, 9],
    ['cut70Converted', '70%컷 환산', 1, 5],
    ['cut50Converted', '50%컷 환산', 1, 5],
    ['averageGradeConverted', '평균등급 환산', 1, 5],
  ];
  const invalid = fields.filter(([field, , min, max]) => {
    const value = raw?.[field];
    return hasValue(value) && (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max);
  }).map(([, label]) => label);
  return invalid.length ? warning('숫자 형식 오류', item, `${invalid.join(', ')} 값이 허용 범위를 벗어났거나 숫자가 아닙니다.`) : null;
}

function recordWarnings(raw, item, universityById, universityByName) {
  const warnings = [];
  const rawUniversityId = text(raw?.universityId);
  if (rawUniversityId && !universityById.has(rawUniversityId)) {
    warnings.push(warning('대학 연결 오류', item, `metadata에 없는 universityId(${rawUniversityId})입니다.`));
  } else if (!universityByName.has(text(item.university))) {
    warnings.push(warning('대학 연결 오류', item, '대학명이 universities metadata와 연결되지 않습니다.'));
  }
  if (!text(item.admissionName)) warnings.push(warning('전형명 누락', item, 'admissionName이 비어 있습니다.'));
  if (!Number.isInteger(Number(item.referenceYear))) warnings.push(warning('기준연도 누락', item, 'referenceYear가 없거나 유효하지 않습니다.'));
  if (item.academicField === 'unknown') {
    warnings.push(warning(
      '계열 분류 불가',
      item,
      '원본 계열값이 없거나 유효하지 않고, 모집단위 taxonomy로도 안전하게 분류할 수 없습니다.',
      '',
      ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW,
    ));
  }
  const numericWarning = invalidNumericWarning(raw, item);
  if (numericWarning) warnings.push(numericWarning);
  warnings.push(...conversionWarnings(raw, item));
  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.AVERAGE_ONLY
    && [item.cut50Original, item.cut70Original, item.cut50Converted, item.cut70Converted].some(hasValue)) {
    warnings.push(warning('평균·컷 혼용 의심', item, 'average-only 레코드에 cut 필드 값이 함께 있습니다.'));
  }
  const missingIdentifiers = [
    ['university', item.university],
    ['department', item.department],
    ['admissionCategory', item.admissionCategory],
    ['dataAvailability', item.dataAvailability],
  ].filter(([, value]) => !text(value)).map(([field]) => field);
  if (missingIdentifiers.length) {
    warnings.push(warning('필수 식별값 누락', item, `${missingIdentifiers.join(', ')} 필드가 비어 있습니다.`));
  }
  return warnings;
}

function deduplicateWarnings(warnings = []) {
  const seen = new Set();
  return warnings.filter((item) => {
    const targetKey = item.recordId || [item.universityId, item.university, item.department, item.admissionName].join('\u0001');
    const key = [item.severity, item.type, targetKey, item.description].join('\u0001');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function universitySummary(university, records, warnings) {
  const categories = recordCategoryCounts(records);
  const counts = statusCounts(records);
  const warningCount = warnings.filter((item) => item.universityId === university.universityId
    || item.university === university.name).length;
  const statusAttention = records.filter((record) => CHECK_NEEDED_STATUSES.has(record.dataAvailability)).length;
  return {
    universityId: university.universityId,
    university: university.name,
    region: normalizeAdmissionRegion(university.region),
    ownership: university.ownership ?? null,
    officialEstablishmentType: university.officialEstablishmentType ?? university.establishmentType ?? null,
    total: records.length,
    subject: categories.subject,
    comprehensive: categories.comprehensive,
    statusCounts: counts,
    checkNeeded: statusAttention + warningCount,
    records,
  };
}

export function buildAdmissionDataDashboard(records = [], universities = []) {
  const universityById = new Map(universities.map((item) => [item.universityId, item]));
  const universityByName = new Map(universities.map((item) => [item.name, item]));
  const normalizedRecords = [];
  const collectedWarnings = [];
  const academicFieldInfo = {
    sourceProvided: 0,
    inferredByTaxonomy: 0,
    unclassified: 0,
  };

  records.forEach((raw, index) => {
    const normalized = normalizeAdmissionRecord(raw);
    const sourceAcademicField = text(raw?.academicField ?? raw?.field);
    const normalizedSourceAcademicField = normalizeAcademicField(sourceAcademicField);
    const inferredAcademicField = inferAcademicFieldFromDepartment(normalized.department);
    const dashboardAcademicField = normalized.academicField === 'unknown' && inferredAcademicField !== 'unknown'
      ? inferredAcademicField
      : normalized.academicField;
    const rawUniversityId = text(raw?.universityId);
    const master = (rawUniversityId && universityById.get(rawUniversityId)) || universityByName.get(text(normalized.university)) || null;
    const item = {
      ...normalized,
      academicField: dashboardAcademicField,
      universityId: rawUniversityId || master?.universityId || null,
      dashboardRecordId: `${master?.universityId ?? rawUniversityId ?? 'unknown'}-${index}`,
    };
    normalizedRecords.push(item);
    const hasValidSourceAcademicField = Boolean(sourceAcademicField) && normalizedSourceAcademicField !== 'unknown';
    if (hasValidSourceAcademicField && item.academicField !== 'unknown') academicFieldInfo.sourceProvided += 1;
    else if (item.academicField !== 'unknown') academicFieldInfo.inferredByTaxonomy += 1;
    else academicFieldInfo.unclassified += 1;
    collectedWarnings.push(...recordWarnings(raw, item, universityById, universityByName));
  });

  const recordsByUniversity = new Map();
  normalizedRecords.forEach((record) => {
    const key = universityById.has(record.universityId) ? record.universityId : universityByName.get(record.university)?.universityId;
    if (!key) return;
    if (!recordsByUniversity.has(key)) recordsByUniversity.set(key, []);
    recordsByUniversity.get(key).push(record);
  });
  universities.forEach((university) => {
    if ((recordsByUniversity.get(university.universityId) ?? []).length === 0) {
      collectedWarnings.push(warning(
        '입결 0건',
        { universityId: university.universityId },
        'universities metadata에는 있지만 입결 레코드가 없습니다.',
        university.name,
        ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW,
      ));
    }
  });

  const warnings = deduplicateWarnings(collectedWarnings).sort((a, b) => {
    const severityOrder = { important: 0, review: 1 };
    return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
      || a.university.localeCompare(b.university, 'ko')
      || a.department.localeCompare(b.department, 'ko');
  });

  const universitiesSummary = universities
    .map((university) => universitySummary(university, recordsByUniversity.get(university.universityId) ?? [], warnings))
    .sort((a, b) => a.university.localeCompare(b.university, 'ko'));
  const categories = recordCategoryCounts(normalizedRecords);
  const years = [...new Set(normalizedRecords.map((record) => Number(record.referenceYear)).filter(Number.isInteger))].sort((a, b) => b - a);
  const updatedDates = normalizedRecords.map((record) => text(record.updatedAt)).filter(Boolean).sort().reverse();
  const summary = {
    universityCount: universities.length,
    recordCount: normalizedRecords.length,
    subjectCount: categories.subject,
    comprehensiveCount: categories.comprehensive,
    referenceYears: years,
    latestUpdatedAt: updatedDates[0] ?? null,
    statusCounts: statusCounts(normalizedRecords),
    quality: {
      importantCount: warnings.filter((item) => item.severity === ADMISSION_DASHBOARD_WARNING_SEVERITIES.IMPORTANT).length,
      reviewCount: warnings.filter((item) => item.severity === ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW).length,
      actionableCount: warnings.length,
      academicFieldInfo,
    },
  };
  const regionSummaries = ADMISSION_DASHBOARD_REGION_ORDER.map((region) => {
    const canonicalRegion = normalizeAdmissionRegion(region);
    const regionUniversities = universitiesSummary.filter((item) => item.region === canonicalRegion);
    return {
      region,
      universityCount: regionUniversities.length,
      recordCount: regionUniversities.reduce((sum, item) => sum + item.total, 0),
      subjectCount: regionUniversities.reduce((sum, item) => sum + item.subject, 0),
      comprehensiveCount: regionUniversities.reduce((sum, item) => sum + item.comprehensive, 0),
      checkNeeded: regionUniversities.reduce((sum, item) => sum + item.checkNeeded, 0),
    };
  });

  return { summary, regionSummaries, universities: universitiesSummary, records: normalizedRecords, warnings };
}

export function filterAdmissionDashboardUniversities(universities = [], filters = {}) {
  const region = normalizeAdmissionRegion(filters.region);
  const ownership = text(filters.ownership);
  const category = text(filters.admissionCategory);
  const status = text(filters.dataAvailability);
  const query = text(filters.query).toLocaleLowerCase('ko-KR');
  return universities.flatMap((university) => {
    if (region && university.region !== region) return [];
    if (ownership && university.ownership !== ownership) return [];
    if (query && !university.university.toLocaleLowerCase('ko-KR').includes(query)) return [];
    const records = university.records.filter((record) => (!category || record.admissionCategory === category)
      && (!status || record.dataAvailability === status));
    if ((category || status) && records.length === 0) return [];
    const categories = recordCategoryCounts(records);
    const counts = statusCounts(records);
    return [{
      ...university,
      total: records.length,
      subject: categories.subject,
      comprehensive: categories.comprehensive,
      statusCounts: counts,
      records,
    }];
  });
}

export function filterAdmissionDashboardWarnings(warnings = [], severity = 'actionable') {
  if (severity === 'actionable' || !text(severity)) return [...warnings];
  return warnings.filter((item) => item.severity === severity);
}

export async function loadAdmissionDashboardDataset({ regionKeys = [], loadRegion }) {
  if (typeof loadRegion !== 'function') throw new Error('입결 데이터 로더가 필요합니다.');
  const outcomes = await Promise.allSettled(regionKeys.map(async (regionKey) => ({
    regionKey,
    records: await loadRegion(regionKey),
  })));
  const records = [];
  const failures = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') records.push(...(Array.isArray(outcome.value.records) ? outcome.value.records : []));
    else failures.push({ regionKey: regionKeys[index], message: outcome.reason?.message ?? '불러오기 실패' });
  });
  return { records, failures };
}

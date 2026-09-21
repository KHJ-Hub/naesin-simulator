import {
  ADMISSION_CATEGORIES,
  ADMISSION_ACADEMIC_FIELDS,
  ADMISSION_DATA_AVAILABILITY,
  analyzeAcademicFieldFromDepartment,
  normalizeAcademicField,
  normalizeAdmissionRecord,
} from './admission-record-normalizer.mjs?v=20260922-official-field1';
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
  INFO: 'info',
});
export const ADMISSION_DASHBOARD_WARNING_SEVERITY_LABELS = Object.freeze({
  [ADMISSION_DASHBOARD_WARNING_SEVERITIES.IMPORTANT]: '중요',
  [ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW]: '확인 필요',
  [ADMISSION_DASHBOARD_WARNING_SEVERITIES.INFO]: '정보',
});

export const ADMISSION_ZERO_RESULT_REASONS = Object.freeze({
  OFFICIAL_NOT_PUBLISHED: 'official-not-published',
  OUTSIDE_CURRENT_SCOPE: 'outside-current-scope',
  SOURCE_REVIEW_NEEDED: 'source-review-needed',
  MAPPING_OR_LOADER_SUSPECTED: 'mapping-or-loader-suspected',
  NOT_YET_AUDITED: 'not-yet-audited',
});

export const ADMISSION_ZERO_RESULT_REASON_LABELS = Object.freeze({
  [ADMISSION_ZERO_RESULT_REASONS.OFFICIAL_NOT_PUBLISHED]: '공식 결과 미공개',
  [ADMISSION_ZERO_RESULT_REASONS.OUTSIDE_CURRENT_SCOPE]: '현재 수집 대상 결과 없음',
  [ADMISSION_ZERO_RESULT_REASONS.SOURCE_REVIEW_NEEDED]: '소스 확인 필요',
  [ADMISSION_ZERO_RESULT_REASONS.MAPPING_OR_LOADER_SUSPECTED]: '매핑·로더 확인 필요',
  [ADMISSION_ZERO_RESULT_REASONS.NOT_YET_AUDITED]: '아직 미확인',
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

function warning(type, record, description, universityName = '', severity = ADMISSION_DASHBOARD_WARNING_SEVERITIES.IMPORTANT, metadata = {}) {
  return {
    type,
    severity,
    recordId: text(record?.dashboardRecordId),
    universityId: text(record?.universityId),
    university: text(record?.university) || universityName || '확인 불가',
    department: text(record?.department) || '-',
    admissionName: text(record?.admissionName) || '-',
    description,
    ...metadata,
  };
}

function unclassifiedAcademicFieldReason(department) {
  const name = text(department);
  if (!name || name.length <= 1) return {
    reasonCode: 'invalid-department-name',
    reasonLabel: '모집단위명 확인 필요',
    description: '모집단위명이 비어 있거나 너무 짧아 계열을 안전하게 판단할 수 없습니다.',
  };
  if (/(융합|자율|자유|무전공|미래|창의|글로컬|첨단|스크랜튼|상상력)/i.test(name)) return {
    reasonCode: 'interdisciplinary-or-broad',
    reasonLabel: '복합·융합 모집단위',
    description: '복합·융합 또는 광역 모집단위라 이름만으로 하나의 계열을 단정하지 않았습니다.',
  };
  return {
    reasonCode: 'insufficient-name-evidence',
    reasonLabel: '이름만으로 판단 어려움',
    description: '모집단위명만으로 계열을 안전하게 판단할 근거가 부족합니다.',
  };
}

export function classifyZeroResultUniversity(audit = null) {
  const statuses = [audit?.subjectAdmissionStatus, audit?.comprehensiveAdmissionStatus].filter(Boolean);
  if (!audit || audit.auditState === 'not-checked') return {
    reasonCode: ADMISSION_ZERO_RESULT_REASONS.NOT_YET_AUDITED,
    reasonLabel: ADMISSION_ZERO_RESULT_REASON_LABELS[ADMISSION_ZERO_RESULT_REASONS.NOT_YET_AUDITED],
    severity: ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW,
    description: '2026 입결 수집 여부를 아직 확인하지 못했습니다.',
  };
  if (audit.failureReason || String(audit.auditState ?? '').includes('warning')) return {
    reasonCode: ADMISSION_ZERO_RESULT_REASONS.SOURCE_REVIEW_NEEDED,
    reasonLabel: ADMISSION_ZERO_RESULT_REASON_LABELS[ADMISSION_ZERO_RESULT_REASONS.SOURCE_REVIEW_NEEDED],
    severity: ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW,
    description: `공식 소스는 점검했지만 프로젝트 반영 여부를 다시 확인해야 합니다${audit.failureReason ? ` (${audit.failureReason})` : ''}.`,
  };
  if (statuses.some((status) => ['confirmed-cut', 'average-only'].includes(status))) return {
    reasonCode: ADMISSION_ZERO_RESULT_REASONS.MAPPING_OR_LOADER_SUSPECTED,
    reasonLabel: ADMISSION_ZERO_RESULT_REASON_LABELS[ADMISSION_ZERO_RESULT_REASONS.MAPPING_OR_LOADER_SUSPECTED],
    severity: ADMISSION_DASHBOARD_WARNING_SEVERITIES.IMPORTANT,
    description: '감사 기록에는 공개 입결이 있으나 레코드가 없어 universityId 매핑 또는 지역 로더를 확인해야 합니다.',
  };
  if (statuses.includes('not-published')) return {
    reasonCode: ADMISSION_ZERO_RESULT_REASONS.OFFICIAL_NOT_PUBLISHED,
    reasonLabel: ADMISSION_ZERO_RESULT_REASON_LABELS[ADMISSION_ZERO_RESULT_REASONS.OFFICIAL_NOT_PUBLISHED],
    severity: ADMISSION_DASHBOARD_WARNING_SEVERITIES.INFO,
    description: '2026 공식 감사에서 학생부교과·종합 결과 미공개 상태를 확인했습니다.',
  };
  if (statuses.length && statuses.every((status) => ['no-subject-admission', 'no-comprehensive-admission'].includes(status))) return {
    reasonCode: ADMISSION_ZERO_RESULT_REASONS.OUTSIDE_CURRENT_SCOPE,
    reasonLabel: ADMISSION_ZERO_RESULT_REASON_LABELS[ADMISSION_ZERO_RESULT_REASONS.OUTSIDE_CURRENT_SCOPE],
    severity: ADMISSION_DASHBOARD_WARNING_SEVERITIES.INFO,
    description: '2026 공식 감사에서 현재 수집 범위인 학생부교과·학생부종합 결과가 확인되지 않았습니다.',
  };
  return {
    reasonCode: ADMISSION_ZERO_RESULT_REASONS.NOT_YET_AUDITED,
    reasonLabel: ADMISSION_ZERO_RESULT_REASON_LABELS[ADMISSION_ZERO_RESULT_REASONS.NOT_YET_AUDITED],
    severity: ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW,
    description: '입결 레코드가 없는 원인을 추가로 확인해야 합니다.',
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
    const reason = unclassifiedAcademicFieldReason(item.department);
    warnings.push(warning(
      '계열 분류 불가',
      item,
      reason.description,
      '',
      ADMISSION_DASHBOARD_WARNING_SEVERITIES.REVIEW,
      { reasonCode: reason.reasonCode, reasonLabel: reason.reasonLabel },
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
    const targetKey = item.type === '계열 분류 불가'
      ? [item.universityId, item.university, item.department].join('\u0001')
      : item.recordId || [item.universityId, item.university, item.department, item.admissionName].join('\u0001');
    const key = [item.severity, item.type, targetKey, item.description].join('\u0001');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function universitySummary(university, records, warnings) {
  const categories = recordCategoryCounts(records);
  const counts = statusCounts(records);
  const warningCount = warnings.filter((item) => item.severity !== ADMISSION_DASHBOARD_WARNING_SEVERITIES.INFO
    && (item.universityId === university.universityId || item.university === university.name)).length;
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

export function buildAdmissionDataDashboard(records = [], universities = [], { universityAudits = [] } = {}) {
  const universityById = new Map(universities.map((item) => [item.universityId, item]));
  const universityByName = new Map(universities.map((item) => [item.name, item]));
  const auditByUniversityId = new Map(universityAudits.map((item) => [item.universityId, item]));
  const normalizedRecords = [];
  const collectedWarnings = [];
  const academicFieldInfo = {
    officiallyVerified: 0,
    officiallyReviewedUnresolved: 0,
    sourceProvided: 0,
    inferredByNormalization: 0,
    inferredByExplicitField: 0,
    inferredByTaxonomy: 0,
    inferredAsOpenMajor: 0,
    unclassified: 0,
    unclassifiedByReason: {},
    uniqueDepartments: {
      officiallyVerified: 0,
      dataOrTaxonomyClassified: 0,
      unclassified: 0,
    },
    counts: Object.fromEntries(Object.values(ADMISSION_ACADEMIC_FIELDS).map((field) => [field, 0])),
  };
  const officialDepartmentKeys = new Set();
  const classifiedDepartmentKeys = new Set();
  const unclassifiedDepartmentKeys = new Set();

  records.forEach((raw, index) => {
    const normalized = normalizeAdmissionRecord(raw);
    const sourceAcademicField = text(raw?.academicField ?? raw?.field);
    const normalizedSourceAcademicField = normalizeAcademicField(sourceAcademicField);
    const inference = analyzeAcademicFieldFromDepartment(normalized.department);
    const inferredAcademicField = inference.academicField;
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
    academicFieldInfo.counts[item.academicField] = (academicFieldInfo.counts[item.academicField] ?? 0) + 1;
    const departmentKey = [item.universityId ?? item.university, item.department].join('\u0001');
    const hasValidSourceAcademicField = Boolean(sourceAcademicField) && normalizedSourceAcademicField !== 'unknown';
    if (item.academicFieldClassificationSource === 'official-verification') {
      academicFieldInfo.officiallyVerified += 1;
      officialDepartmentKeys.add(departmentKey);
    } else if (hasValidSourceAcademicField && item.academicField !== 'unknown') academicFieldInfo.sourceProvided += 1;
    else if (item.academicField === ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR) academicFieldInfo.inferredAsOpenMajor += 1;
    else if (item.academicField !== 'unknown' && inference.resolution === 'normalization') academicFieldInfo.inferredByNormalization += 1;
    else if (item.academicField !== 'unknown' && inference.resolution === 'explicit-field') academicFieldInfo.inferredByExplicitField += 1;
    else if (item.academicField !== 'unknown') academicFieldInfo.inferredByTaxonomy += 1;
    else {
      academicFieldInfo.unclassified += 1;
      if (item.academicFieldClassificationSource === 'official-review-unresolved') {
        academicFieldInfo.officiallyReviewedUnresolved += 1;
      }
      unclassifiedDepartmentKeys.add(departmentKey);
      const reason = unclassifiedAcademicFieldReason(item.department).reasonCode;
      academicFieldInfo.unclassifiedByReason[reason] = (academicFieldInfo.unclassifiedByReason[reason] ?? 0) + 1;
    }
    if (item.academicField !== ADMISSION_ACADEMIC_FIELDS.UNKNOWN
      && item.academicFieldClassificationSource !== 'official-verification') classifiedDepartmentKeys.add(departmentKey);
    collectedWarnings.push(...recordWarnings(raw, item, universityById, universityByName));
  });
  academicFieldInfo.uniqueDepartments.officiallyVerified = officialDepartmentKeys.size;
  academicFieldInfo.uniqueDepartments.dataOrTaxonomyClassified = classifiedDepartmentKeys.size;
  academicFieldInfo.uniqueDepartments.unclassified = unclassifiedDepartmentKeys.size;

  const recordsByUniversity = new Map();
  normalizedRecords.forEach((record) => {
    const key = universityById.has(record.universityId) ? record.universityId : universityByName.get(record.university)?.universityId;
    if (!key) return;
    if (!recordsByUniversity.has(key)) recordsByUniversity.set(key, []);
    recordsByUniversity.get(key).push(record);
  });
  universities.forEach((university) => {
    if ((recordsByUniversity.get(university.universityId) ?? []).length === 0) {
      const reason = classifyZeroResultUniversity(auditByUniversityId.get(university.universityId));
      collectedWarnings.push(warning(
        '입결 0건',
        { universityId: university.universityId },
        reason.description,
        university.name,
        reason.severity,
        { reasonCode: reason.reasonCode, reasonLabel: reason.reasonLabel },
      ));
    }
  });

  const warnings = deduplicateWarnings(collectedWarnings).sort((a, b) => {
    const severityOrder = { important: 0, review: 1, info: 2 };
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
      infoCount: warnings.filter((item) => item.severity === ADMISSION_DASHBOARD_WARNING_SEVERITIES.INFO).length,
      actionableCount: warnings.filter((item) => item.severity !== ADMISSION_DASHBOARD_WARNING_SEVERITIES.INFO).length,
      zeroResultInfo: Object.freeze({
        total: warnings.filter((item) => item.type === '입결 0건').length,
        byReason: Object.freeze(warnings.filter((item) => item.type === '입결 0건').reduce((counts, item) => {
          counts[item.reasonCode] = (counts[item.reasonCode] ?? 0) + 1;
          return counts;
        }, {})),
      }),
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
  if (severity === 'all' || !text(severity)) return [...warnings];
  if (severity === 'actionable') return warnings.filter((item) => item.severity !== ADMISSION_DASHBOARD_WARNING_SEVERITIES.INFO);
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

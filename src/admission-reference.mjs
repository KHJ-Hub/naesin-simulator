/**
 * 어디가 전년도 입시결과를 교체해 넣기 위한 별도 데이터 모듈.
 * 실제 대학 자료를 확인하기 전에는 빈 배열을 유지하며, 임의의 대학·컷을 생성하지 않는다.
 */
export const ADMISSION_REFERENCE_SETTINGS = Object.freeze({
  defaultYear: 2025,
  bands: Object.freeze({
    stable: Object.freeze({ label: '안정 참고', minDifference: 0.20 }),
    adequate: Object.freeze({ label: '적정 참고', minDifference: -0.15 }),
    challenge: Object.freeze({ label: '도전 참고', minDifference: Number.NEGATIVE_INFINITY }),
  }),
});

// 추후 어디가 원자료를 정제한 항목을 연도별로 추가한다.
export const ADMISSION_REFERENCE_DATA = [];

export const ADMISSION_REFERENCE_SCHEMA = Object.freeze({
  referenceYear: 'number', region: 'string', university: 'string', field: 'string',
  department: 'string', admissionName: 'string', admissionType: 'string', category: '학생부교과|학생부종합',
  cut70: 'number', cut50: 'number|null', source: 'string',
});

export function classifyAdmissionReference(currentAverage, cut70, settings = ADMISSION_REFERENCE_SETTINGS) {
  const difference = Number(cut70) - Number(currentAverage);
  if (!Number.isFinite(difference)) return null;
  if (difference >= settings.bands.stable.minDifference) return 'stable';
  if (difference >= settings.bands.adequate.minDifference) return 'adequate';
  return 'challenge';
}

export function filterAdmissionReferences(data, filters = {}) {
  return data.filter((item) => (
    (!filters.region || item.region === filters.region)
    && (!filters.university || item.university === filters.university)
    && (!filters.field || item.field === filters.field)
    && (!filters.department || item.department === filters.department)
    && (!filters.admissionType || item.admissionType === filters.admissionType)
    && (!filters.category || item.category === filters.category)
  ));
}

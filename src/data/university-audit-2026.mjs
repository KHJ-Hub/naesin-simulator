import { admissionResultsByYear } from '../admission-results/index.mjs';
import { normalizeAdmissionRecord } from '../admission-record-normalizer.mjs';
import { UNIVERSITIES } from './universities.mjs';

/**
 * 대학 단위 감사 상태는 모집단위별 입시결과 레코드와 별개다.
 * 레코드가 없다는 사실만으로 전형 부재·미공개를 추정하지 않으며, 조사 전에는 not-checked를 사용한다.
 */
export const UNIVERSITY_AUDIT_REGIONS_2026 = Object.freeze([
  '서울특별시',
  '경기도',
  '인천광역시',
]);

export const UNIVERSITY_ADMISSION_AUDIT_STATUS = Object.freeze({
  CONFIRMED_CUT: 'confirmed-cut',
  AVERAGE_ONLY: 'average-only',
  NOT_PUBLISHED: 'not-published',
  NOT_CHECKED: 'not-checked',
  NO_SUBJECT_ADMISSION: 'no-subject-admission',
  NO_COMPREHENSIVE_ADMISSION: 'no-comprehensive-admission',
});

const RESULTS_2026 = Object.freeze((admissionResultsByYear[2026] ?? []).map(normalizeAdmissionRecord));
const AUDIT_CHECKED_AT = '2026-09-15';

/**
 * 2026학년도 어디가 결과 표에서 해당 전형의 50%/70% cut 열과 모집단위 행을 직접 확인한 대학 단위 감사 결과다.
 * 이 목록은 "공식 표 존재"만 뜻하며, 모집단위별 숫자는 별도 레코드 검증 전까지 추가하지 않는다.
 */
const ADIGA_CUT_AUDIT_IDS_2026 = Object.freeze({
  subject: new Set([
    'incheon-national', 'konkuk', 'kyunghee', 'kookmin', 'dongduk', 'myongji', 'sangmyung', 'sogang',
    'snue', 'swu', 'sungkyunkwan', 'hanyang', 'myongji-yongin', 'seoul-jangsin', 'ajou', 'cha',
    'hansei', 'hanyang-erica', 'hyupsung', 'hwasung', 'gyeongin', 'inha', 'chungwoon',
  ]),
  comprehensive: new Set([
    'konkuk', 'kyunghee', 'myongji', 'sangmyung', 'sogang', 'uos', 'sungkyunkwan', 'hufs',
    'hanyang', 'myongji-yongin', 'ajou', 'cha', 'hanyang-erica', 'gyeongin', 'inha',
  ]),
});

const auditSourceUrl = (university) => university.adigaUrl?.replace('searchSyr=2027', 'searchSyr=2026') ?? null;
const auditStatusFromRecords = (records, category) => {
  const matched = records.filter((record) => record.admissionCategory === category);
  // 이 함수는 이미 공식 결과 레코드가 있는 대학에만 상태를 부여한다.
  if (!matched.length) return UNIVERSITY_ADMISSION_AUDIT_STATUS.NOT_CHECKED;
  if (matched.some((record) => record.dataAvailability === 'confirmed-cut' || record.dataAvailability === 'cut70-only' || record.dataAvailability === 'cut50-only')) return UNIVERSITY_ADMISSION_AUDIT_STATUS.CONFIRMED_CUT;
  if (matched.some((record) => record.dataAvailability === 'average-only')) return UNIVERSITY_ADMISSION_AUDIT_STATUS.AVERAGE_ONLY;
  if (matched.some((record) => record.dataAvailability === 'not-published')) return UNIVERSITY_ADMISSION_AUDIT_STATUS.NOT_PUBLISHED;
  return UNIVERSITY_ADMISSION_AUDIT_STATUS.NOT_CHECKED;
};

const recordDates = (records) => records.map((record) => record.updatedAt).filter(Boolean).sort();

export const UNIVERSITY_AUDIT_2026 = Object.freeze(
  UNIVERSITIES
    .filter(({ region }) => UNIVERSITY_AUDIT_REGIONS_2026.includes(region))
    .map((university) => {
      const records = RESULTS_2026.filter((record) => record.university === university.name);
      const dates = recordDates(records);
      const subjectFromOfficialTable = ADIGA_CUT_AUDIT_IDS_2026.subject.has(university.universityId);
      const comprehensiveFromOfficialTable = ADIGA_CUT_AUDIT_IDS_2026.comprehensive.has(university.universityId);
      const recordSourceUrls = [...new Set(records.map((record) => record.sourceUrl).filter(Boolean))];
      const auditSource = auditSourceUrl(university);
      return Object.freeze({
        universityId: university.universityId,
        universityName: university.name,
        region: university.region,
        referenceYear: 2026,
        homepageUrl: university.homepageUrl,
        admissionsUrl: university.admissionsUrl,
        adigaUrl: university.adigaUrl,
        subjectAdmissionStatus: subjectFromOfficialTable ? 'confirmed-cut' : auditStatusFromRecords(records, '학생부교과'),
        comprehensiveAdmissionStatus: comprehensiveFromOfficialTable ? 'confirmed-cut' : auditStatusFromRecords(records, '학생부종합'),
        // 공식 결과 레코드 또는 어디가 결과 표를 확인한 경우에만 확인일·출처를 연결한다.
        checkedAt: subjectFromOfficialTable || comprehensiveFromOfficialTable ? AUDIT_CHECKED_AT : dates.at(-1) ?? null,
        sourceUrls: Object.freeze(subjectFromOfficialTable || comprehensiveFromOfficialTable
          ? [...new Set([...recordSourceUrls, auditSource].filter(Boolean))]
          : recordSourceUrls),
      });
    }),
);

export const UNIVERSITY_AUDIT_SUMMARY_2026 = Object.freeze(
  UNIVERSITY_AUDIT_REGIONS_2026.reduce((summary, region) => {
    const rows = UNIVERSITY_AUDIT_2026.filter((item) => item.region === region);
    const count = (field, status) => rows.filter((item) => item[field] === status).length;
    summary[region] = Object.freeze({
      total: rows.length,
      audited: rows.filter((item) => item.subjectAdmissionStatus !== 'not-checked' || item.comprehensiveAdmissionStatus !== 'not-checked').length,
      subjectConfirmedCut: count('subjectAdmissionStatus', 'confirmed-cut'),
      subjectAverageOnly: count('subjectAdmissionStatus', 'average-only'),
      subjectNotPublished: count('subjectAdmissionStatus', 'not-published'),
      comprehensiveDataAvailable: rows.filter((item) => ['confirmed-cut', 'average-only'].includes(item.comprehensiveAdmissionStatus)).length,
      unconfirmed: rows.filter((item) => item.subjectAdmissionStatus === 'not-checked' && item.comprehensiveAdmissionStatus === 'not-checked').map((item) => item.universityName),
    });
    return summary;
  }, {}),
);

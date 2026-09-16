import { admissionResultsByYear } from '../admission-results/index.mjs';
import { normalizeAdmissionRecord } from '../admission-record-normalizer.mjs';
import { UNIVERSITIES } from './universities.mjs';
import { universityAudit2026SeoulVerified as universityAudit2026Seoul } from './university-audits/2026-verified/seoul.mjs';
import { universityAudit2026GyeonggiVerified as universityAudit2026Gyeonggi } from './university-audits/2026-verified/gyeonggi.mjs';
import { universityAudit2026IncheonVerified as universityAudit2026Incheon } from './university-audits/2026-verified/incheon.mjs';
import { universityAudit2026BusanVerified as universityAudit2026Busan } from './university-audits/2026-verified/busan.mjs';
import { universityAudit2026UlsanVerified as universityAudit2026Ulsan } from './university-audits/2026-verified/ulsan.mjs';
import { universityAudit2026GyeongnamVerified as universityAudit2026Gyeongnam } from './university-audits/2026-verified/gyeongnam.mjs';
import { universityAudit2026DaeguVerified as universityAudit2026Daegu } from './university-audits/2026-verified/daegu.mjs';
import { universityAudit2026GyeongbukVerified as universityAudit2026Gyeongbuk } from './university-audits/2026-verified/gyeongbuk.mjs';
import { universityAudit2026DaejeonVerified as universityAudit2026Daejeon } from './university-audits/2026-verified/daejeon.mjs';
import { universityAudit2026SejongVerified as universityAudit2026Sejong } from './university-audits/2026-verified/sejong.mjs';
import { universityAudit2026ChungnamVerified as universityAudit2026Chungnam } from './university-audits/2026-verified/chungnam.mjs';
import { universityAudit2026ChungbukVerified as universityAudit2026Chungbuk } from './university-audits/2026-verified/chungbuk.mjs';
import { universityAudit2026GwangjuVerified as universityAudit2026Gwangju } from './university-audits/2026-verified/gwangju.mjs';
import { universityAudit2026JeonnamVerified as universityAudit2026Jeonnam } from './university-audits/2026-verified/jeonnam.mjs';
import { universityAudit2026JeonbukVerified as universityAudit2026Jeonbuk } from './university-audits/2026-verified/jeonbuk.mjs';
import { universityAudit2026Gangwon } from './university-audits/2026/gangwon.mjs';
import { universityAudit2026Jeju } from './university-audits/2026/jeju.mjs';

/**
 * 대학 단위 감사 상태는 모집단위별 입시결과 레코드와 별개다.
 * 레코드가 없다는 사실만으로 전형 부재·미공개를 추정하지 않으며, 조사 전에는 not-checked를 사용한다.
 */
export const UNIVERSITY_AUDIT_REGIONS_2026 = Object.freeze([
  '서울특별시',
  '경기도',
  '인천광역시',
  '부산광역시',
  '울산광역시',
  '경상남도',
  '대구광역시',
  '경상북도',
  '대전광역시',
  '세종특별자치시',
  '충청남도',
  '충청북도',
  '광주광역시',
  '전라남도',
  '전북특별자치도',
  '강원특별자치도',
  '제주특별자치도',
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
const GENERATED_AUDITS = Object.freeze([
  ...universityAudit2026Seoul,
  ...universityAudit2026Gyeonggi,
  ...universityAudit2026Incheon,
  ...universityAudit2026Busan,
  ...universityAudit2026Ulsan,
  ...universityAudit2026Gyeongnam,
  ...universityAudit2026Daegu,
  ...universityAudit2026Gyeongbuk,
  ...universityAudit2026Daejeon,
  ...universityAudit2026Sejong,
  ...universityAudit2026Chungnam,
  ...universityAudit2026Chungbuk,
  ...universityAudit2026Gwangju,
  ...universityAudit2026Jeonnam,
  ...universityAudit2026Jeonbuk,
  ...universityAudit2026Gangwon,
  ...universityAudit2026Jeju,
]);
const GENERATED_AUDIT_BY_CODE = new Map(GENERATED_AUDITS.map((item) => [item.universityId.replace('adiga-', ''), item]));

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
const resolvedStatus = (generatedStatus, recordStatus) => recordStatus === UNIVERSITY_ADMISSION_AUDIT_STATUS.NOT_CHECKED
  ? generatedStatus ?? recordStatus
  : recordStatus;

export const UNIVERSITY_AUDIT_2026 = Object.freeze(
  UNIVERSITIES
    .filter(({ region }) => UNIVERSITY_AUDIT_REGIONS_2026.includes(region))
    .map((university) => {
      const records = RESULTS_2026.filter((record) => record.university === university.name);
      const dates = recordDates(records);
      const generatedAudit = GENERATED_AUDIT_BY_CODE.get(university.adigaCode);
      const recordSourceUrls = [...new Set(records.map((record) => record.sourceUrl).filter(Boolean))];
      const auditSource = auditSourceUrl(university);
      return Object.freeze({
        universityId: university.universityId,
        universityName: university.name,
        region: university.region,
        referenceYear: 2026,
        homepageUrl: generatedAudit?.homepageUrl ?? university.homepageUrl,
        admissionsUrl: generatedAudit?.admissionsUrl ?? university.admissionsUrl,
        adigaUrl: university.adigaUrl,
        subjectAdmissionStatus: resolvedStatus(generatedAudit?.subjectAdmissionStatus, auditStatusFromRecords(records, '학생부교과')),
        comprehensiveAdmissionStatus: resolvedStatus(generatedAudit?.comprehensiveAdmissionStatus, auditStatusFromRecords(records, '학생부종합')),
        checkedAt: generatedAudit?.checkedAt ?? dates.at(-1) ?? null,
        sourceUrls: Object.freeze([...new Set([
          ...recordSourceUrls,
          ...(generatedAudit?.sourceUrls ?? []),
          ...(generatedAudit ? [auditSource] : []),
        ].filter(Boolean))]),
        auditState: generatedAudit?.auditState ?? (records.length ? 'completed-from-result-records' : 'not-checked'),
        failureReason: generatedAudit?.failureReason ?? null,
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

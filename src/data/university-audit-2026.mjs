import { UNIVERSITIES } from './universities.mjs';

/** 서울·경기·인천 대학 기본정보/입시결과 분리 감사 현황. */
export const UNIVERSITY_AUDIT_REGIONS_2026 = Object.freeze([
  '서울특별시',
  '경기도',
  '인천광역시',
]);

export const UNIVERSITY_AUDIT_2026 = Object.freeze(
  UNIVERSITIES
    .filter(({ region }) => UNIVERSITY_AUDIT_REGIONS_2026.includes(region))
    .map((university) => ({
      universityId: university.universityId,
      universityName: university.name,
      region: university.region,
      basicInfoRegistered: true,
      officialHomepageConfirmed: Boolean(university.homepageUrl),
      admissionsUrlConfirmed: Boolean(university.admissionsUrl),
      adigaUrlConfirmed: Boolean(university.adigaUrl),
      studentRecordResult2026Confirmed: university.admissionResultsAvailable,
      cut50Confirmed: false,
      cut70Confirmed: university.admissionResultsAvailable,
      reason: university.admissionResultsAvailable
        ? '공식 2026 학생부교과 결과가 지역 파일에 등록됨'
        : '공식 2026 학생부교과 50%·70% cut 확인 전',
    })),
);

export const UNIVERSITY_AUDIT_SUMMARY_2026 = Object.freeze(
  UNIVERSITY_AUDIT_REGIONS_2026.reduce((summary, region) => {
    const rows = UNIVERSITY_AUDIT_2026.filter((item) => item.region === region);
    summary[region] = {
      total: rows.length,
      basicInfoRegistered: rows.filter((item) => item.basicInfoRegistered).length,
      resultConfirmed: rows.filter((item) => item.studentRecordResult2026Confirmed).length,
      cut50Confirmed: rows.filter((item) => item.cut50Confirmed).length,
      cut70Confirmed: rows.filter((item) => item.cut70Confirmed).length,
      unconfirmed: rows.filter((item) => !item.studentRecordResult2026Confirmed).map((item) => item.universityName),
    };
    return summary;
  }, {}),
);

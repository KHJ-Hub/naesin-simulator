import { createOfficialAdmissionResult } from '../../admission-result-factory.mjs?v=20261026-admission-period1';

// 모집시기를 포함한 공식 행별 확인 내역: docs/daeshin-result-conflicts-2026.md
// 컷의 대소관계가 이례적인 행도 어디가 공개 원문 그대로 보존한다.
const rows = [
  ['신학과', '목사추천전형', '0013122', '수시', 6.2, 1.8],
  ['신학과', '목사추천전형', '0013122', '정시(다)', 3.3, 5.8],
  ['선교학부', '일반전형', '0245823', '수시', 6.7, 9],
  ['선교학부', '일반전형', '0245823', '정시(다)', 6.8, 7.9],
  ['선교학부 글로벌비즈니스전공', '일반전형', '0249078', '수시', 6.5, 7.9],
  ['선교학부 글로벌비즈니스전공', '일반전형', '0249078', '정시(다)', 7.5, 8],
  ['문화예술학부 뷰티케어전공', '일반전형', '0249874', '수시', 5.8, 5.1],
  ['문화예술학부 뷰티케어전공', '일반전형', '0249874', '정시(다)', 7.2, 7.9],
];

// 각 모집단위 팝업의 '학과계열'을 직접 확인한 값이다.
const academicFieldByDepartment = {
  '신학과': 'humanities',
  '선교학부': 'humanities',
  '선교학부 글로벌비즈니스전공': 'humanities',
  '문화예술학부 뷰티케어전공': 'arts',
};

export const admissionResults2026Daeshin = Object.freeze(rows.map(([department, admissionName, ruCd, admissionPeriod, cut50Original, cut70Original]) => createOfficialAdmissionResult({
  university: '대신대학교',
  region: '경상북도',
  referenceYear: 2026,
  department, admissionName, admissionPeriod,
  academicField: academicFieldByDepartment[department],
  admissionCategory: '학생부교과',
  cut50Original, cut70Original,
  eligibilityType: admissionName === '일반전형' ? 'general' : 'unknown',
  sourceUrl: `https://www.adiga.kr/ucp/cls/uni/classUnivAdmssPopup.do?ruCd=${ruCd}&searchSyr=2026&unvCd=0000093`,
  updatedAt: '2026-10-26',
})));

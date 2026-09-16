import { admissionResults2026 } from '../admission-results-2026.mjs';
import { admissionResults2026UlsanVerified } from './verified/ulsan.mjs';

const normalizeAdmissionName = (value) => String(value ?? '')
  .replace(/^학생부(?:교과|종합)(?:전형)?\s*\(/, '')
  .replace(/\)$/, '')
  .replace(/\s/g, '')
  .trim();

const verifiedRegionalEligibility = new Map(
  admissionResults2026
    .filter((item) => item.region === '울산광역시' && item.eligibilityType === 'regional' && item.regionalEligibility?.verified)
    .map((item) => [
      [item.university, item.department, item.admissionCategory, normalizeAdmissionName(item.admissionName)].join('|'),
      item,
    ]),
);

const canonicalKey = (item) => [
  item.university,
  item.department,
  item.admissionCategory,
  normalizeAdmissionName(item.admissionName),
].join('|');

const verifiedKeys = new Set(admissionResults2026UlsanVerified.map(canonicalKey));
const unmatchedExistingResults = admissionResults2026.filter(
  (item) => item.region === '울산광역시' && !verifiedKeys.has(canonicalKey(item)),
);

export const admissionResults2026Ulsan = Object.freeze(
  [
    ...admissionResults2026UlsanVerified.map((item) => {
      const verified = verifiedRegionalEligibility.get(canonicalKey(item));
      if (!verified) return item;
      return Object.freeze({
        ...item,
        regionalEligibility: verified.regionalEligibility,
        regionalEligibilityConfirmed: true,
        eligibilityVerification: verified.eligibilityVerification,
        studentDefaultVisible: verified.studentDefaultVisible,
      });
    }),
    // 어디가 설치학과 목록에 나타나지 않지만 기존 공식 자료에서 확인된
    // 의예과처럼 새 결과와 충돌하지 않는 항목은 원본을 그대로 보존한다.
    ...unmatchedExistingResults,
  ],
);

import { admissionResults2026 } from '../admission-results-2026.mjs';
import { admissionResults2026BusanVerified } from './verified/busan.mjs';

const normalizeAdmissionName = (value) => String(value ?? '')
  .replace(/^학생부(?:교과|종합)(?:전형)?\s*\(/, '')
  .replace(/\)$/, '')
  .trim();

// 앞선 공식 모집요강 감사에서 부산 학생 지원 가능 지역까지 확인한
// 지역인재 자격 정보는 새 모집단위별 cut 레코드에만 병합한다.
const verifiedRegionalEligibility = new Map(
  admissionResults2026
    .filter((item) => item.region === '부산광역시' && item.eligibilityType === 'regional' && item.regionalEligibility?.verified)
    .map((item) => [
      [item.university, item.department, item.admissionCategory, normalizeAdmissionName(item.admissionName)].join('|'),
      item,
    ]),
);

export const admissionResults2026Busan = Object.freeze(
  admissionResults2026BusanVerified.map((item) => {
    const verified = verifiedRegionalEligibility.get(
      [item.university, item.department, item.admissionCategory, item.admissionName].join('|'),
    );
    if (!verified) return item;
    return Object.freeze({
      ...item,
      regionalEligibility: verified.regionalEligibility,
      regionalEligibilityConfirmed: true,
      eligibilityVerification: verified.eligibilityVerification,
      studentDefaultVisible: verified.studentDefaultVisible,
    });
  }),
);

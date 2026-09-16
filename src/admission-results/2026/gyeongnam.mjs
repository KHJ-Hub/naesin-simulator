import { admissionResults2026 } from '../admission-results-2026.mjs';
import { admissionResults2026GyeongnamVerified } from './verified/gyeongnam.mjs';

const normalizeAdmissionName = (value) => {
  let normalized = String(value ?? '').trim();
  for (const prefix of ['학생부교과(', '학생부종합(']) {
    if (normalized.startsWith(prefix) && normalized.endsWith(')')) {
      normalized = normalized.slice(prefix.length, -1);
    }
  }
  return normalized.replace(/\s/g, '');
};

const canonicalKey = (item) => [
  item.university,
  item.department,
  item.admissionCategory,
  normalizeAdmissionName(item.admissionName),
].join('|');

const existingResults = admissionResults2026.filter((item) => item.region === '경상남도');
const verifiedRegionalEligibility = new Map(
  existingResults
    .filter((item) => item.eligibilityType === 'regional' && item.regionalEligibility?.verified)
    .map((item) => [canonicalKey(item), item]),
);
const verifiedKeys = new Set(admissionResults2026GyeongnamVerified.map(canonicalKey));
const unmatchedExistingResults = existingResults.filter((item) => !verifiedKeys.has(canonicalKey(item)));

export const admissionResults2026Gyeongnam = Object.freeze([
  ...admissionResults2026GyeongnamVerified.map((item) => {
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
  ...unmatchedExistingResults,
]);

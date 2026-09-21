import { normalizeAdmissionMajorName } from './admission-major-taxonomy.mjs?v=20260922-official-field1';
import {
  ADMISSION_ACADEMIC_FIELD_OVERRIDES_2026,
  ADMISSION_ACADEMIC_FIELD_VERIFICATION_SUMMARY_2026,
} from './data/admission-academic-field-overrides-2026.mjs?v=20260922-official-field1';

const normalizeUniversityKey = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\s+/g, '')
  .trim();

const normalizeDepartmentKey = (value) => normalizeAdmissionMajorName(value)
  .normalize('NFKC')
  .replace(/\s+/g, '')
  .trim();

const byUniversityId = new Map();
const byUniversityName = new Map();

ADMISSION_ACADEMIC_FIELD_OVERRIDES_2026.forEach(([universityId, university, rawDepartment, academicField, status]) => {
  const item = Object.freeze({ universityId, university, department: rawDepartment, academicField, status });
  const department = normalizeDepartmentKey(item.department);
  if (!department) return;
  if (item.universityId) byUniversityId.set(`${item.universityId}\u0001${department}`, item);
  byUniversityName.set(`${normalizeUniversityKey(item.university)}\u0001${department}`, item);
});

/** 2026 모집단위별 공식 검증값을 반환한다. 미확정 검토 항목도 status 추적을 위해 반환한다. */
export function resolveAdmissionAcademicFieldVerification(record = {}) {
  const year = Number(record.referenceYear ?? record.year);
  if (year !== 2026) return null;
  const department = normalizeDepartmentKey(record.department);
  if (!department) return null;
  const universityId = String(record.universityId ?? '').trim();
  if (universityId) {
    const byId = byUniversityId.get(`${universityId}\u0001${department}`);
    if (byId) return byId;
  }
  return byUniversityName.get(`${normalizeUniversityKey(record.university)}\u0001${department}`) ?? null;
}

export function getAdmissionAcademicFieldVerificationSummary() {
  return ADMISSION_ACADEMIC_FIELD_VERIFICATION_SUMMARY_2026;
}

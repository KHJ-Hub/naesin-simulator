export const STUDENT_BACKUP_TYPE = 'naesin-simulator-student-backup';
export const STUDENT_BACKUP_SCHEMA_VERSION = 1;

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function isLegacyStudentBackup(value) {
  if (!isObject(value) || !Array.isArray(value.actual) || !isObject(value.student)) return false;
  const knownKeys = ['targetAverage', 'weighted', 'quickAverages', 'inputModes', 'admissionInterests', 'calculated', 'goalCalculated'];
  return knownKeys.some((key) => Object.hasOwn(value, key));
}

function migrateLegacyStudentBackup(value) {
  return {
    ...value,
    backupType: STUDENT_BACKUP_TYPE,
    schemaVersion: STUDENT_BACKUP_SCHEMA_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : null,
  };
}

function validateCurrentStudentBackup(value) {
  if (value.backupType !== STUDENT_BACKUP_TYPE) {
    throw new TypeError('내신 설계 노트에서 만든 학생 백업 파일이 아닙니다.');
  }
  const version = Number(value.schemaVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError('백업 파일의 버전 정보를 확인할 수 없습니다.');
  }
  if (version > STUDENT_BACKUP_SCHEMA_VERSION) {
    throw new RangeError('현재 사이트보다 새로운 버전에서 만든 백업 파일입니다. 사이트를 새로고침한 뒤 다시 시도해 주세요.');
  }
  if (!isObject(value.student) || !Array.isArray(value.actual)) {
    throw new TypeError('학생 정보 또는 성적 데이터가 누락된 백업 파일입니다.');
  }
}

export function createStudentBackup(profile = {}, exportedAt = new Date().toISOString()) {
  const cloned = structuredClone(isObject(profile) ? profile : {});
  return {
    ...cloned,
    backupType: STUDENT_BACKUP_TYPE,
    schemaVersion: STUDENT_BACKUP_SCHEMA_VERSION,
    exportedAt,
  };
}

export function parseStudentBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ''));
  } catch {
    throw new TypeError('백업 파일이 올바른 JSON 형식이 아닙니다.');
  }
  if (!isObject(parsed)) {
    throw new TypeError('내신 설계 노트 학생 백업 형식이 아닙니다.');
  }

  const normalized = parsed.schemaVersion == null
    ? (isLegacyStudentBackup(parsed) ? migrateLegacyStudentBackup(parsed) : null)
    : parsed;
  if (!normalized) {
    throw new TypeError('내신 설계 노트 학생 백업 형식이 아닙니다.');
  }
  validateCurrentStudentBackup(normalized);
  return structuredClone(normalized);
}

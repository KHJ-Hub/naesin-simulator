export function createStudentBackup(profile = {}, exportedAt = new Date().toISOString()) {
  return { ...structuredClone(profile), exportedAt };
}

export function parseStudentBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ''));
  } catch {
    throw new TypeError('백업 파일이 올바른 JSON이 아닙니다.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.actual)) {
    throw new TypeError('내신 시뮬레이터 백업 형식이 아닙니다.');
  }
  return structuredClone(parsed);
}

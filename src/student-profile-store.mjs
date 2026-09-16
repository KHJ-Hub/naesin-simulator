export const LEGACY_STUDENT_STORAGE_KEY = 'naesin-simulator:v1';
export const STUDENT_PROFILES_STORAGE_KEY = 'naesin-student-profiles:v1';
export const CURRENT_STUDENT_ID_STORAGE_KEY = 'naesin-current-student-id:v1';
export const STUDENT_PROFILE_MIGRATION_KEY = 'naesin-student-profiles:migrated:v1';
export const STUDENT_DRAFT_STORAGE_KEY = 'naesin-student-draft:v1';

const defaultStorage = () => globalThis.localStorage;
const validStudentNumber = (value) => /^\d{5}$/.test(String(value ?? ''));
const cleanStudentNumber = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 5);
const cleanStudentName = (value) => String(value ?? '').trim().slice(0, 30);
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function readJson(storage, key, fallback = null) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function profileIdentity(profile = {}) {
  return {
    studentNumber: cleanStudentNumber(profile.studentNumber ?? profile.studentId ?? profile.student?.studentId),
    name: cleanStudentName(profile.name ?? profile.studentName ?? profile.student?.studentName ?? profile.student?.name),
  };
}

function normalizeProfile(profile = {}, studentNumber, name) {
  const id = cleanStudentNumber(studentNumber ?? profileIdentity(profile).studentNumber);
  const studentName = cleanStudentName(name ?? profileIdentity(profile).name);
  if (!validStudentNumber(id)) throw new TypeError('학번은 숫자 5자리로 입력해주세요.');
  if (!studentName) throw new TypeError('이름을 입력해주세요.');
  return {
    ...clone(profile),
    studentNumber: id,
    name: studentName,
    student: {
      ...(clone(profile.student) ?? {}),
      studentId: id,
      studentName,
    },
  };
}

function readContainer(storage = defaultStorage()) {
  const saved = readJson(storage, STUDENT_PROFILES_STORAGE_KEY, {});
  const source = saved?.studentProfiles && typeof saved.studentProfiles === 'object'
    ? saved.studentProfiles
    : {};
  const studentProfiles = {};
  Object.entries(source).forEach(([key, profile]) => {
    try {
      const normalized = normalizeProfile(profile, key);
      studentProfiles[normalized.studentNumber] = normalized;
    } catch {
      // 유효하지 않은 학생번호의 데이터는 다른 프로필로 섞지 않는다.
    }
  });
  return { version: 1, studentProfiles };
}

function writeContainer(studentProfiles, storage = defaultStorage()) {
  const payload = {
    version: 1,
    studentProfiles: clone(studentProfiles),
    savedAt: new Date().toISOString(),
  };
  storage?.setItem(STUDENT_PROFILES_STORAGE_KEY, JSON.stringify(payload));
  return clone(payload.studentProfiles);
}

export function getStudentProfiles(storage = defaultStorage()) {
  return clone(readContainer(storage).studentProfiles);
}

export function getCurrentStudentId(storage = defaultStorage()) {
  const id = cleanStudentNumber(storage?.getItem(CURRENT_STUDENT_ID_STORAGE_KEY));
  return validStudentNumber(id) && getStudentProfiles(storage)[id] ? id : null;
}

export function getCurrentStudentProfile(storage = defaultStorage()) {
  const id = getCurrentStudentId(storage);
  return id ? clone(getStudentProfiles(storage)[id]) : null;
}

export function createStudentProfile(studentNumber, name, profileData = {}, storage = defaultStorage()) {
  const normalized = normalizeProfile(profileData, studentNumber, name);
  const profiles = getStudentProfiles(storage);
  if (profiles[normalized.studentNumber]) {
    storage?.setItem(CURRENT_STUDENT_ID_STORAGE_KEY, normalized.studentNumber);
    clearStudentDraft(storage);
    return clone(profiles[normalized.studentNumber]);
  }
  profiles[normalized.studentNumber] = normalized;
  writeContainer(profiles, storage);
  storage?.setItem(CURRENT_STUDENT_ID_STORAGE_KEY, normalized.studentNumber);
  clearStudentDraft(storage);
  return clone(normalized);
}

/** 현재 학생을 먼저 저장한 뒤 다른 학생으로 전환한다. */
export function selectStudentProfile(studentId, { currentProfile = null, storage = defaultStorage() } = {}) {
  const targetId = cleanStudentNumber(studentId);
  if (!validStudentNumber(targetId) || !getStudentProfiles(storage)[targetId]) return null;
  if (currentProfile && getCurrentStudentId(storage)) saveCurrentStudentProfile(currentProfile, storage);
  const profiles = getStudentProfiles(storage);
  storage?.setItem(CURRENT_STUDENT_ID_STORAGE_KEY, targetId);
  clearStudentDraft(storage);
  return clone(profiles[targetId]);
}

/** 현재 학생을 보존한 채 새 학생 입력용 빈 상태를 시작한다. */
export function startNewStudentProfile({ currentProfile = null, initialProfile = {}, storage = defaultStorage() } = {}) {
  if (currentProfile && getCurrentStudentId(storage)) saveCurrentStudentProfile(currentProfile, storage);
  storage?.removeItem(CURRENT_STUDENT_ID_STORAGE_KEY);
  saveStudentDraft(initialProfile, storage);
  return clone(initialProfile);
}

export function saveCurrentStudentProfile(profile, storage = defaultStorage()) {
  const currentId = getCurrentStudentId(storage);
  if (!currentId) return null;
  const current = getStudentProfiles(storage)[currentId];
  const normalized = normalizeProfile(profile, currentId, profileIdentity(profile).name || current.name);
  const profiles = getStudentProfiles(storage);
  profiles[currentId] = normalized;
  writeContainer(profiles, storage);
  return clone(normalized);
}

/** JSON 백업 복구처럼 명시적인 복원 동작에서만 같은 학번의 프로필을 교체한다. */
export function restoreStudentProfile(profile, storage = defaultStorage()) {
  const identity = profileIdentity(profile);
  const normalized = normalizeProfile(profile, identity.studentNumber, identity.name);
  const profiles = getStudentProfiles(storage);
  profiles[normalized.studentNumber] = normalized;
  writeContainer(profiles, storage);
  storage?.setItem(CURRENT_STUDENT_ID_STORAGE_KEY, normalized.studentNumber);
  clearStudentDraft(storage);
  return clone(normalized);
}

/** 학생번호·이름과 관심 대학은 유지하고 성적·목표 입력만 교체한다. */
export function resetCurrentStudentInput(resetData = {}, storage = defaultStorage()) {
  const current = getCurrentStudentProfile(storage);
  if (!current) return null;
  const next = {
    ...clone(resetData),
    studentNumber: current.studentNumber,
    name: current.name,
    student: { studentId: current.studentNumber, studentName: current.name },
    admissionInterests: clone(current.admissionInterests ?? []),
  };
  return saveCurrentStudentProfile(next, storage);
}

export function deleteStudentProfile(studentId, storage = defaultStorage()) {
  const id = cleanStudentNumber(studentId);
  const profiles = getStudentProfiles(storage);
  if (!profiles[id]) return false;
  delete profiles[id];
  writeContainer(profiles, storage);
  if (getCurrentStudentId(storage) === id || storage?.getItem(CURRENT_STUDENT_ID_STORAGE_KEY) === id) {
    const nextId = Object.keys(profiles).sort()[0] ?? null;
    if (nextId) storage?.setItem(CURRENT_STUDENT_ID_STORAGE_KEY, nextId);
    else storage?.removeItem(CURRENT_STUDENT_ID_STORAGE_KEY);
  }
  return true;
}

export function clearAllStudentProfiles(storage = defaultStorage()) {
  storage?.removeItem(STUDENT_PROFILES_STORAGE_KEY);
  storage?.removeItem(CURRENT_STUDENT_ID_STORAGE_KEY);
  storage?.removeItem(STUDENT_DRAFT_STORAGE_KEY);
  storage?.removeItem(LEGACY_STUDENT_STORAGE_KEY);
  storage?.setItem(STUDENT_PROFILE_MIGRATION_KEY, 'cleared');
}

export function saveStudentDraft(profile, storage = defaultStorage()) {
  storage?.setItem(STUDENT_DRAFT_STORAGE_KEY, JSON.stringify(clone(profile)));
  return clone(profile);
}

export function getStudentDraft(storage = defaultStorage()) {
  return clone(readJson(storage, STUDENT_DRAFT_STORAGE_KEY, null));
}

export function clearStudentDraft(storage = defaultStorage()) {
  storage?.removeItem(STUDENT_DRAFT_STORAGE_KEY);
}

/** 기존 단일 저장값은 유효한 학번·이름이 있을 때 첫 프로필로 한 번만 이전한다. */
export function migrateLegacyStudentData({ storage = defaultStorage(), transform = (value) => value } = {}) {
  if (storage?.getItem(STUDENT_PROFILE_MIGRATION_KEY)) return { migrated: false, reason: 'already-migrated' };
  const legacy = readJson(storage, LEGACY_STUDENT_STORAGE_KEY, null);
  if (!legacy || typeof legacy !== 'object') return { migrated: false, reason: 'no-legacy-data' };
  const prepared = transform(clone(legacy));
  const identity = profileIdentity(prepared);
  if (!validStudentNumber(identity.studentNumber) || !identity.name) {
    saveStudentDraft(prepared, storage);
    return { migrated: false, reason: 'invalid-student-identity' };
  }
  const profiles = getStudentProfiles(storage);
  if (!profiles[identity.studentNumber]) {
    profiles[identity.studentNumber] = normalizeProfile(prepared, identity.studentNumber, identity.name);
    writeContainer(profiles, storage);
  }
  storage?.setItem(CURRENT_STUDENT_ID_STORAGE_KEY, identity.studentNumber);
  storage?.setItem(STUDENT_PROFILE_MIGRATION_KEY, new Date().toISOString());
  storage?.removeItem(LEGACY_STUDENT_STORAGE_KEY);
  clearStudentDraft(storage);
  return { migrated: true, studentId: identity.studentNumber, profile: clone(profiles[identity.studentNumber]) };
}

export function getStudentProfileStartup(storage = defaultStorage()) {
  const profiles = getStudentProfiles(storage);
  const ids = Object.keys(profiles).sort();
  const currentStudentId = getCurrentStudentId(storage) ?? (ids.length === 1 ? ids[0] : null);
  if (currentStudentId && !getCurrentStudentId(storage)) storage?.setItem(CURRENT_STUDENT_ID_STORAGE_KEY, currentStudentId);
  return Object.freeze({
    mode: ids.length === 0 ? 'new' : ids.length === 1 ? 'resume' : 'select',
    profileCount: ids.length,
    currentStudentId,
    currentProfile: currentStudentId ? clone(profiles[currentStudentId]) : null,
    profiles: clone(profiles),
  });
}

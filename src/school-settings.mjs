export const SCHOOL_SETTINGS_STORAGE_KEY = 'naesin-school-settings:v1';

/** 현재 운영 학교의 기본값. 학생 프로필과 분리해 기기 공통 설정으로 유지한다. */
export const DEFAULT_SCHOOL_SETTINGS = Object.freeze({
  schoolRegion: '부산광역시',
  schoolGender: 'male',
  schoolType: '일반고',
});

export function normalizeSchoolSettings(settings = {}) {
  return Object.freeze({
    ...DEFAULT_SCHOOL_SETTINGS,
    ...(settings && typeof settings === 'object' ? settings : {}),
    schoolRegion: String(settings?.schoolRegion ?? DEFAULT_SCHOOL_SETTINGS.schoolRegion).trim() || DEFAULT_SCHOOL_SETTINGS.schoolRegion,
    schoolGender: ['male', 'female', 'coeducational'].includes(settings?.schoolGender)
      ? settings.schoolGender
      : DEFAULT_SCHOOL_SETTINGS.schoolGender,
    schoolType: String(settings?.schoolType ?? DEFAULT_SCHOOL_SETTINGS.schoolType).trim() || DEFAULT_SCHOOL_SETTINGS.schoolType,
  });
}

export function getSchoolSettings(storage = globalThis.localStorage) {
  try {
    return normalizeSchoolSettings(JSON.parse(storage?.getItem(SCHOOL_SETTINGS_STORAGE_KEY) || '{}'));
  } catch {
    return normalizeSchoolSettings();
  }
}

export function saveSchoolSettings(settings, storage = globalThis.localStorage) {
  const normalized = normalizeSchoolSettings(settings);
  storage?.setItem(SCHOOL_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

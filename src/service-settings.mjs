import {
  ENABLE_ADMISSION_COMPARISON,
  ENABLE_INTEREST_COMPARISON,
  ENABLE_LOCAL_ADMISSION_COMPARISON,
  ENABLE_TEACHER_QUICK_MODE,
} from './feature-flags.mjs';
import { FEEDBACK_GAS_URL } from './feedback-config.mjs';

export const SERVICE_SETTINGS_SCHEMA_VERSION = 1;
export const SERVICE_SETTINGS_STORAGE_KEY = 'naesin-service-settings:v1';
export const SERVICE_NOTICE_LEVELS = Object.freeze(['normal', 'info', 'important']);
export const SERVICE_NOTICE_MESSAGE_MAX_LENGTH = 300;

export const DEFAULT_SERVICE_SETTINGS = Object.freeze({
  schemaVersion: SERVICE_SETTINGS_SCHEMA_VERSION,
  noticeEnabled: false,
  noticeMessage: '',
  noticeLevel: 'info',
});

const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function normalizeServiceSettings(settings = {}) {
  const source = safeObject(settings);
  const noticeMessage = typeof source.noticeMessage === 'string'
    ? source.noticeMessage.replace(/\r\n?/g, '\n').trim().slice(0, SERVICE_NOTICE_MESSAGE_MAX_LENGTH)
    : DEFAULT_SERVICE_SETTINGS.noticeMessage;
  return Object.freeze({
    schemaVersion: SERVICE_SETTINGS_SCHEMA_VERSION,
    noticeEnabled: typeof source.noticeEnabled === 'boolean'
      ? source.noticeEnabled
      : DEFAULT_SERVICE_SETTINGS.noticeEnabled,
    noticeMessage,
    noticeLevel: SERVICE_NOTICE_LEVELS.includes(source.noticeLevel)
      ? source.noticeLevel
      : DEFAULT_SERVICE_SETTINGS.noticeLevel,
  });
}

export function loadServiceSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SERVICE_SETTINGS_STORAGE_KEY);
    return raw ? normalizeServiceSettings(JSON.parse(raw)) : normalizeServiceSettings();
  } catch {
    return normalizeServiceSettings();
  }
}

export function saveServiceSettings(settings, storage = globalThis.localStorage) {
  const normalized = normalizeServiceSettings(settings);
  storage?.setItem(SERVICE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetServiceSettings(storage = globalThis.localStorage) {
  storage?.removeItem(SERVICE_SETTINGS_STORAGE_KEY);
  return normalizeServiceSettings();
}

export function serviceFeatureStates() {
  return Object.freeze([
    Object.freeze({ key: 'feedback', label: '학생 의견', enabled: Boolean(String(FEEDBACK_GAS_URL ?? '').trim()), note: '의견 저장 endpoint 설정 기준' }),
    Object.freeze({ key: 'teacherQuickMode', label: '교사용 빠른 상담', enabled: ENABLE_TEACHER_QUICK_MODE, note: '코드 설정 · 변경 후 배포 필요' }),
    Object.freeze({ key: 'admissionComparison', label: '입결 비교', enabled: ENABLE_ADMISSION_COMPARISON, note: '코드 설정 · 변경 후 배포 필요' }),
    Object.freeze({ key: 'localAdmissionComparison', label: '부산권 비교', enabled: ENABLE_LOCAL_ADMISSION_COMPARISON, note: '코드 설정 · 변경 후 배포 필요' }),
    Object.freeze({ key: 'interestComparison', label: '관심 대학 비교', enabled: ENABLE_INTEREST_COMPARISON, note: '코드 설정 · 변경 후 배포 필요' }),
  ]);
}


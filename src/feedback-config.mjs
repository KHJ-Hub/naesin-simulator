/**
 * Google Apps Script를 웹 앱으로 배포한 뒤 /exec URL을 한 곳에만 입력한다.
 * 비밀번호나 관리자 토큰은 절대 이 파일에 넣지 않는다.
 */
export const FEEDBACK_GAS_URL = 'https://script.google.com/macros/s/AKfycbz0GoJURnj8SI2geuLoIg1eBffUzOkCCN2CAbEFYZ9IlLdHIXF0wtMzJm_daXkauj767g/exec';

export const FEEDBACK_MESSAGE_MAX_LENGTH = 1200;
export const FEEDBACK_ADMIN_NOTE_MAX_LENGTH = 800;
export const FEEDBACK_ADMIN_SESSION_KEY = 'naesin-feedback-admin-session';
export const FEEDBACK_LAST_SUBMIT_SESSION_KEY = 'naesin-feedback-last-submit';
export const FEEDBACK_SUBMIT_COOLDOWN_MS = 30_000;

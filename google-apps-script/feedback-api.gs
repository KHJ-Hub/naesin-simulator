/**
 * 배정고 내신 설계 노트 익명 의견 API
 *
 * Script Properties 필수값:
 * - FEEDBACK_SHEET_ID: 의견을 저장할 Google Sheet ID
 * - FEEDBACK_ADMIN_PASSWORD: 관리자 의견함 로그인 비밀번호
 * 선택값:
 * - FEEDBACK_SHEET_NAME: 기본값 "학생 의견"
 */

var FEEDBACK_HEADERS = [
  'id', '접수일시', '의견 종류', '의견 내용', '학년', '앱 버전', '빌드일',
  '현재 화면', '화면 크기', '브라우저 정보', '처리상태', '관리자 메모'
];
var FEEDBACK_CATEGORIES = ['오류가 있어요', '사용하기 불편해요', '기능 제안', '입결 데이터 관련', '기타'];
var FEEDBACK_STATUSES = ['신규', '확인중', '반영완료', '보류'];
var FEEDBACK_GRADES = ['', '1학년', '2학년', '3학년'];
var FEEDBACK_MESSAGE_MAX_LENGTH = 1200;
var FEEDBACK_NOTE_MAX_LENGTH = 800;
var FEEDBACK_SESSION_SECONDS = 21600;
var FEEDBACK_CREATE_BURST_SECONDS = 10;
var FEEDBACK_CREATE_BURST_MAX = 60;
var FEEDBACK_CREATE_WINDOW_SECONDS = 60;
var FEEDBACK_CREATE_WINDOW_MAX = 180;
var FEEDBACK_DUPLICATE_SECONDS = 120;
var FEEDBACK_LOGIN_MAX_FAILURES = 5;
var FEEDBACK_LOGIN_WINDOW_SECONDS = 900;
var FEEDBACK_LOGIN_LOCKOUT_SECONDS = 900;
var FEEDBACK_CREATE_FIELDS = [
  'category', 'message', 'grade', 'appVersion', 'buildDate', 'currentSection',
  'viewport', 'userAgent', 'submittedAt'
];

function doGet() {
  return feedbackJson_({ ok: false, error: 'method_not_allowed' });
}

function doPost(e) {
  try {
    var request = feedbackParseRequest_(e);
    if (request.action === 'createFeedback') return feedbackJson_(feedbackCreate_(request.payload));
    if (request.action === 'adminLogin') return feedbackJson_(feedbackAdminLogin_(request.payload));
    if (request.action === 'adminLogout') return feedbackJson_(feedbackAdminLogout_(request.adminToken));
    if (request.action === 'listFeedback') {
      feedbackAssertAllowedFields_(request.payload, []);
      feedbackRequireAdmin_(request.adminToken);
      return feedbackJson_({ ok: true, feedback: feedbackList_() });
    }
    if (request.action === 'updateFeedback') {
      feedbackRequireAdmin_(request.adminToken);
      return feedbackJson_(feedbackUpdate_(request.payload));
    }
    return feedbackJson_({ ok: false, error: 'invalid_request' });
  } catch (error) {
    var safeErrors = ['invalid_request', 'unauthorized', 'not_found', 'rate_limited', 'not_configured'];
    var code = safeErrors.indexOf(String(error && error.message)) >= 0 ? String(error.message) : 'internal_error';
    return feedbackJson_({ ok: false, error: code });
  }
}

function feedbackJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function feedbackParseRequest_(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 20000) throw new Error('invalid_request');
  var parsed;
  try { parsed = JSON.parse(raw); } catch (error) { throw new Error('invalid_request'); }
  if (!feedbackIsPlainObject_(parsed)) throw new Error('invalid_request');
  feedbackAssertAllowedFields_(parsed, ['action', 'payload', 'adminToken']);
  if (parsed.payload != null && !feedbackIsPlainObject_(parsed.payload)) throw new Error('invalid_request');
  if (parsed.adminToken != null && typeof parsed.adminToken !== 'string') throw new Error('invalid_request');
  return {
    action: feedbackText_(parsed.action, 40),
    payload: parsed.payload || {},
    adminToken: feedbackText_(parsed.adminToken, 200)
  };
}

function feedbackIsPlainObject_(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function feedbackAssertAllowedFields_(value, allowedFields) {
  if (!feedbackIsPlainObject_(value)) throw new Error('invalid_request');
  var allowed = {};
  allowedFields.forEach(function (field) { allowed[field] = true; });
  Object.keys(value).forEach(function (field) {
    if (!allowed[field]) throw new Error('invalid_request');
  });
}

function feedbackRequiredText_(value, maxLength) {
  if (typeof value !== 'string') throw new Error('invalid_request');
  var text = value.replace(/\u0000/g, '').trim();
  if (!text || text.length > maxLength) throw new Error('invalid_request');
  return text;
}

function feedbackOptionalText_(value, maxLength) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('invalid_request');
  var text = value.replace(/\u0000/g, '').trim();
  if (text.length > maxLength) throw new Error('invalid_request');
  return text;
}

function feedbackText_(value, maxLength) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, maxLength);
}

// Prevent student text from being interpreted as a spreadsheet formula.
function feedbackSafeSheetText_(value) {
  var text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function feedbackConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var sheetId = feedbackText_(properties.getProperty('FEEDBACK_SHEET_ID'), 200);
  var adminPassword = String(properties.getProperty('FEEDBACK_ADMIN_PASSWORD') || '');
  var sheetName = feedbackText_(properties.getProperty('FEEDBACK_SHEET_NAME'), 80) || '학생 의견';
  if (!sheetId || !adminPassword) throw new Error('not_configured');
  return { sheetId: sheetId, adminPassword: adminPassword, sheetName: sheetName };
}

function feedbackSheet_() {
  var config = feedbackConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.sheetId);
  var sheet = spreadsheet.getSheetByName(config.sheetName) || spreadsheet.insertSheet(config.sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length).setValues([FEEDBACK_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function feedbackCreate_(payload) {
  feedbackAssertAllowedFields_(payload, FEEDBACK_CREATE_FIELDS);
  var category = feedbackRequiredText_(payload.category, 40);
  var rawMessage = feedbackRequiredText_(payload.message, FEEDBACK_MESSAGE_MAX_LENGTH);
  var grade = feedbackOptionalText_(payload.grade, 10);
  if (FEEDBACK_CATEGORIES.indexOf(category) < 0) throw new Error('invalid_request');
  if (FEEDBACK_GRADES.indexOf(grade) < 0) throw new Error('invalid_request');
  var record = {
    id: Utilities.getUuid(),
    submittedAt: new Date().toISOString(),
    category: category,
    message: rawMessage,
    grade: grade,
    appVersion: feedbackOptionalText_(payload.appVersion, 30),
    buildDate: feedbackOptionalText_(payload.buildDate, 30),
    currentSection: feedbackOptionalText_(payload.currentSection, 100) || '확인 불가',
    viewport: feedbackOptionalText_(payload.viewport, 30),
    userAgent: feedbackOptionalText_(payload.userAgent, 400),
    status: '신규',
    adminNote: ''
  };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('rate_limited');
  try {
    var cache = CacheService.getScriptCache();
    var fingerprint = feedbackCreateFingerprint_(record);
    feedbackAssertCreateAllowed_(cache, fingerprint);
    var sheet = feedbackSheet_();
    var nextRow = Math.max(2, sheet.getLastRow() + 1);
    var range = sheet.getRange(nextRow, 1, 1, FEEDBACK_HEADERS.length);
    range.setNumberFormat('@');
    range.setValues([feedbackRecordToRow_(record)]);
    feedbackRememberCreate_(cache, fingerprint);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: record.id };
}

function feedbackCreateFingerprint_(record) {
  var source = [record.category, record.message, record.grade, record.currentSection, record.viewport, record.userAgent].join('\n');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8);
  return digest.map(function (value) {
    return ('0' + ((value + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function feedbackCacheCount_(cache, key) {
  var value = Number(cache.get(key));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function feedbackAssertCreateAllowed_(cache, fingerprint) {
  if (cache.get('feedback-create-duplicate:' + fingerprint)) throw new Error('rate_limited');
  if (feedbackCacheCount_(cache, 'feedback-create-burst') >= FEEDBACK_CREATE_BURST_MAX) throw new Error('rate_limited');
  if (feedbackCacheCount_(cache, 'feedback-create-window') >= FEEDBACK_CREATE_WINDOW_MAX) throw new Error('rate_limited');
}

function feedbackRememberCreate_(cache, fingerprint) {
  cache.put('feedback-create-duplicate:' + fingerprint, '1', FEEDBACK_DUPLICATE_SECONDS);
  cache.put('feedback-create-burst', String(feedbackCacheCount_(cache, 'feedback-create-burst') + 1), FEEDBACK_CREATE_BURST_SECONDS);
  cache.put('feedback-create-window', String(feedbackCacheCount_(cache, 'feedback-create-window') + 1), FEEDBACK_CREATE_WINDOW_SECONDS);
}

function feedbackAdminLogin_(payload) {
  feedbackAssertAllowedFields_(payload, ['password']);
  var password = feedbackRequiredText_(payload.password, 200);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('rate_limited');
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get('feedback-admin-login-lockout')) throw new Error('rate_limited');
    var config = feedbackConfig_();
    if (password !== config.adminPassword) {
      var failures = feedbackCacheCount_(cache, 'feedback-admin-login-failures') + 1;
      if (failures >= FEEDBACK_LOGIN_MAX_FAILURES) {
        cache.remove('feedback-admin-login-failures');
        cache.put('feedback-admin-login-lockout', '1', FEEDBACK_LOGIN_LOCKOUT_SECONDS);
        throw new Error('rate_limited');
      }
      cache.put('feedback-admin-login-failures', String(failures), FEEDBACK_LOGIN_WINDOW_SECONDS);
      throw new Error('unauthorized');
    }
    cache.remove('feedback-admin-login-failures');
    cache.remove('feedback-admin-login-lockout');
    var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    cache.put('feedback-admin:' + token, '1', FEEDBACK_SESSION_SECONDS);
    return { ok: true, adminToken: token, expiresIn: FEEDBACK_SESSION_SECONDS };
  } finally {
    lock.releaseLock();
  }
}

function feedbackAdminLogout_(token) {
  var value = feedbackText_(token, 200);
  if (value) CacheService.getScriptCache().remove('feedback-admin:' + value);
  return { ok: true };
}

function feedbackRequireAdmin_(token) {
  var value = feedbackText_(token, 200);
  if (!value || CacheService.getScriptCache().get('feedback-admin:' + value) !== '1') throw new Error('unauthorized');
}

function feedbackList_() {
  var sheet = feedbackSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, FEEDBACK_HEADERS.length).getValues()
    .map(feedbackRowToRecord_)
    .filter(function (item) { return Boolean(item.id); })
    .sort(function (a, b) { return String(b.submittedAt).localeCompare(String(a.submittedAt)); });
}

function feedbackUpdate_(payload) {
  feedbackAssertAllowedFields_(payload, ['id', 'status', 'adminNote']);
  var id = feedbackRequiredText_(payload.id, 100);
  var status = feedbackRequiredText_(payload.status, 20);
  var rawNote = feedbackOptionalText_(payload.adminNote, FEEDBACK_NOTE_MAX_LENGTH);
  if (FEEDBACK_STATUSES.indexOf(status) < 0) throw new Error('invalid_request');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('rate_limited');
  try {
    var sheet = feedbackSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('not_found');
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    var index = -1;
    for (var i = 0; i < ids.length; i += 1) {
      if (ids[i][0] === id) { index = i + 2; break; }
    }
    if (index < 0) throw new Error('not_found');
    sheet.getRange(index, 11, 1, 2).setNumberFormat('@');
    sheet.getRange(index, 11, 1, 2).setValues([[status, feedbackSafeSheetText_(rawNote)]]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: id, status: status, adminNote: rawNote };
}

function feedbackRecordToRow_(item) {
  return [item.id, item.submittedAt, item.category, feedbackSafeSheetText_(item.message), item.grade, item.appVersion,
    item.buildDate, feedbackSafeSheetText_(item.currentSection), item.viewport,
    feedbackSafeSheetText_(item.userAgent), item.status, feedbackSafeSheetText_(item.adminNote)];
}

function feedbackRowToRecord_(row) {
  return {
    id: String(row[0] || ''),
    submittedAt: row[1] instanceof Date ? row[1].toISOString() : String(row[1] || ''),
    category: String(row[2] || ''),
    message: String(row[3] || ''),
    grade: String(row[4] || ''),
    appVersion: String(row[5] || ''),
    buildDate: String(row[6] || ''),
    currentSection: String(row[7] || ''),
    viewport: String(row[8] || ''),
    userAgent: String(row[9] || ''),
    status: FEEDBACK_STATUSES.indexOf(String(row[10] || '')) >= 0 ? String(row[10]) : '신규',
    adminNote: String(row[11] || '')
  };
}

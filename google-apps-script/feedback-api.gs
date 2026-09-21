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

function doGet() {
  return feedbackJson_({ ok: false, error: 'method_not_allowed' });
}

function doPost(e) {
  try {
    var request = feedbackParseRequest_(e);
    if (request.action === 'createFeedback') return feedbackJson_(feedbackCreate_(request.payload));
    if (request.action === 'adminLogin') return feedbackJson_(feedbackAdminLogin_(request.payload));
    if (request.action === 'listFeedback') {
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
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid_request');
  return {
    action: feedbackText_(parsed.action, 40),
    payload: parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {},
    adminToken: feedbackText_(parsed.adminToken, 200)
  };
}

function feedbackText_(value, maxLength) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, maxLength);
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
  var category = feedbackText_(payload.category, 40);
  var rawMessage = String(payload.message == null ? '' : payload.message).replace(/\u0000/g, '').trim();
  var grade = feedbackText_(payload.grade, 10);
  if (FEEDBACK_CATEGORIES.indexOf(category) < 0 || !rawMessage || rawMessage.length > FEEDBACK_MESSAGE_MAX_LENGTH) throw new Error('invalid_request');
  if (FEEDBACK_GRADES.indexOf(grade) < 0) throw new Error('invalid_request');
  var record = {
    id: Utilities.getUuid(),
    submittedAt: new Date().toISOString(),
    category: category,
    message: rawMessage,
    grade: grade,
    appVersion: feedbackText_(payload.appVersion, 30),
    buildDate: feedbackText_(payload.buildDate, 30),
    currentSection: feedbackText_(payload.currentSection, 100) || '확인 불가',
    viewport: feedbackText_(payload.viewport, 30),
    userAgent: feedbackText_(payload.userAgent, 400),
    status: '신규',
    adminNote: ''
  };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('rate_limited');
  try {
    var sheet = feedbackSheet_();
    var nextRow = Math.max(2, sheet.getLastRow() + 1);
    var range = sheet.getRange(nextRow, 1, 1, FEEDBACK_HEADERS.length);
    range.setNumberFormat('@');
    range.setValues([feedbackRecordToRow_(record)]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: record.id };
}

function feedbackAdminLogin_(payload) {
  var password = String(payload.password || '');
  var config = feedbackConfig_();
  if (!password || password !== config.adminPassword) throw new Error('unauthorized');
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('feedback-admin:' + token, '1', FEEDBACK_SESSION_SECONDS);
  return { ok: true, adminToken: token, expiresIn: FEEDBACK_SESSION_SECONDS };
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
  var id = feedbackText_(payload.id, 100);
  var status = feedbackText_(payload.status, 20);
  var rawNote = String(payload.adminNote == null ? '' : payload.adminNote).replace(/\u0000/g, '').trim();
  if (!id || FEEDBACK_STATUSES.indexOf(status) < 0 || rawNote.length > FEEDBACK_NOTE_MAX_LENGTH) throw new Error('invalid_request');
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
    sheet.getRange(index, 11, 1, 2).setValues([[status, rawNote]]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: id, status: status, adminNote: rawNote };
}

function feedbackRecordToRow_(item) {
  return [item.id, item.submittedAt, item.category, item.message, item.grade, item.appVersion,
    item.buildDate, item.currentSection, item.viewport, item.userAgent, item.status, item.adminNote];
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, teacherConsultHtml, styles] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../teacher-consult.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
]);

test('자동저장과 수동 백업 안내를 안전 안내 카드 한 곳에 통합한다', () => {
  assert.doesNotMatch(html, /class="backup-guidance"/);
  assert.match(html, /현재 화면에서만 안전하게 계산해요/);
  assert.match(html, /입력한 성적은 서버로 전송되거나 브라우저에 자동 저장되지 않아요\./);
  assert.match(html, /다음에 이어서 사용하려면[\s\S]*‘내 데이터 백업’[\s\S]*다시 접속한 뒤[\s\S]*‘백업 불러오기’[\s\S]*복원해 주세요\./);
  assert.match(html, /‘백업 필요’<\/span>가 보이면 마지막 백업 뒤에 바뀐 내용이 있어요\./);
  assert.equal((html.match(/class="backup-action-label"/g) ?? []).length, 3);
  assert.match(styles, /\.notice-card \.backup-action-label\s*\{/);
});

test('학생 데이터 변경은 백업 상태로만 알리고 저장소에 쓰지 않으며 이탈 시에만 경고한다', () => {
  assert.match(html, /id="backup-status"[^>]*aria-live="polite"/);
  assert.match(app, /createStudentBackupFingerprint/);
  assert.match(app, /function setBackupBaseline/);
  assert.match(app, /window\.addEventListener\('beforeunload', handleStudentBeforeUnload\)/);
  assert.match(app, /window\.removeEventListener\('beforeunload', handleStudentBeforeUnload\)/);
  assert.match(app, /setBackupBaseline\(\{ completed: true \}\)/);
  assert.match(app, /백업 파일을 만들지 못했어요\. 다시 시도해 주세요\./);
  assert.match(styles, /\.backup-status\s*\{/);
  assert.match(styles, /\.top-actions > \.backup-action-stack\s*\{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 2;/);
  assert.match(styles, /\.backup-status\s*\{[\s\S]*?position: absolute;[\s\S]*?top: 50%;/);
});

test('학생 화면은 학번과 이름만 받고 다중 프로필 조작 UI를 만들지 않는다', () => {
  assert.match(html, /id="student-id"/);
  assert.match(html, /id="student-name"/);
  ['student-profile-select', 'new-student-button', 'delete-student-button', 'clear-students-button']
    .forEach((id) => assert.doesNotMatch(html, new RegExp(`id="${id}"`)));
});

test('학생 앱은 개인 데이터를 localStorage에서 읽거나 쓰지 않는다', () => {
  assert.doesNotMatch(app, /student-profile-store|student-runtime-storage|studentStorage/);
  assert.match(app, /function loadState\(\)\s*{[\s\S]*?return defaultState\(\);/);
  assert.match(app, /function saveState\(\)\s*{[\s\S]*?return state;/);
  assert.equal((app.match(/localStorage/g) ?? []).length, 1);
  assert.match(app, /getSchoolSettings\(localStorage\)/);
});

test('초기화는 학생·성적·목표·관심 대학을 포함한 세션 전체를 빈 상태로 되돌린다', () => {
  assert.match(app, /confirm\('입력한 학생 데이터와 성적을 초기화할까요\?'\)/);
  assert.match(app, /state = defaultState\(\);/);
  assert.doesNotMatch(app, /const student = \{ \.\.\.state\.student \}/);
  assert.doesNotMatch(app, /const admissionInterests = \[\.\.\.state\.admissionInterests\]/);
});

test('학생용 주요 버튼과 백업 문구만 유지한다', () => {
  ['결과표 인쇄 · PDF 저장', '내 데이터 초기화', '내 데이터 백업', '백업 불러오기']
    .forEach((label) => assert.match(html, new RegExp(label)));
  assert.doesNotMatch(html, />JSON 내보내기</);
  assert.doesNotMatch(html, />JSON 불러오기</);
});

test('결과표 인쇄는 PDF 저장 안내와 임시 문서 제목만 사용하고 학생 상태를 저장하지 않는다', () => {
  assert.match(html, /id="print-button"[^>]*>결과표 인쇄 · PDF 저장<\/button>/);
  assert.match(app, /printStudentReport/);
  assert.match(app, /PDF가 필요하면 인쇄 화면에서 'PDF로 저장'을 선택해 주세요\./);
  const printHandler = app.match(/\$\('#print-button'\)\.addEventListener\('click', \(\) => \{([\s\S]*?)\n\}\);/);
  assert.ok(printHandler);
  assert.match(printHandler[1], /renderPrintReport\(\)/);
  assert.doesNotMatch(printHandler[1], /saveState|refreshBackupDirtyState|setBackupBaseline/);
  assert.match(styles, /@media \(max-width: 430px\)[\s\S]*?#print-button[\s\S]*?white-space: normal/);
});

test('공유용 브랜딩은 서비스명과 제작자 보조 문구를 분리한다', () => {
  assert.match(html, /<title>배정고 내신 설계 노트<\/title>/);
  assert.match(html, /<h1>배정고 내신 설계 노트<\/h1>/);
  assert.match(html, /현정T 제작 · 학생용 내신 시뮬레이터/);
  assert.doesNotMatch(html, /현정T의 내신 설계 노트/);
});

test('교사용 빠른 상담은 숨김 과목관리 진입과 분리된 경로를 사용한다', () => {
  assert.match(html, /class="teacher-consult-link" href="\.\/teacher-consult\.html" hidden data-teacher-quick-mode-link/);
  assert.match(html, /🧑‍🏫 교사용 빠른 상담/);
  assert.match(teacherConsultHtml, /<h1>교사용 빠른 상담<\/h1>/);
  assert.match(teacherConsultHtml, /href="\.\/index\.html"/);
  assert.match(app, /ENABLE_TEACHER_QUICK_MODE/);
  assert.match(app, /teacherQuickModeLink\.hidden = !ENABLE_TEACHER_QUICK_MODE/);
  assert.match(app, /setupHiddenTeacherEntry\(\{ triggerSelector = '#teacher-entry-trigger', targetUrl = '\.\/teacher\.html'/);
  assert.match(app, /setupHiddenTeacherEntry\(\);/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, studentApp] = await Promise.all([
  readFile(new URL('../teacher-consult.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/teacher-consult-app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
]);

test('빠른 상담 입력·결과·입결·인쇄·새 상담 UI가 실제 화면에 연결된다', () => {
  ['consult-current-grade', 'consult-completed-semester', 'consult-target-grade', 'consult-results', 'consult-admission-results', 'consult-print-button', 'new-consult-button']
    .forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  assert.match(html, /학생용 내신 설계로 돌아가기/);
  assert.doesNotMatch(html, /빠른 상담 모드 준비 중/);
  assert.match(html, /src\/teacher-consult-app\.mjs/);
});
test('관심 대학은 localStorage 영구저장 없이 세션 상태와 공통 관심대학 함수만 사용한다', () => {
  assert.match(app, /state\.admissionInterests = toggleAdmissionInterest/);
  assert.match(app, /buildQuickConsultPrintModel\(state, consultationResult\)/);
  assert.doesNotMatch(app, /localStorage\.setItem|sessionStorage|saveState/);
  assert.match(app, /state = createQuickConsultationState\(\)/);
});

test('새 상담은 확인 후 입력·관심대학·필터·인쇄 상태를 함께 초기화한다', () => {
  assert.match(app, /confirm\('현재 상담 내용을 초기화하고 새 상담을 시작할까요\?'\)/);
  assert.match(app, /admissionFilters = defaultAdmissionFilters\(\)/);
  assert.match(app, /resetAdmissionUiState\(\)/);
  assert.match(app, /consult-form'\)\.reset\(\)/);
  assert.match(app, /consult-results'\)\.hidden = true/);
});

test('학생용 숨김 관리자 진입은 기존 teacher.html 경로를 그대로 유지한다', () => {
  assert.match(studentApp, /setupHiddenTeacherEntry\(\{ triggerSelector = '#teacher-entry-trigger', targetUrl = '\.\/teacher\.html'/);
  assert.match(studentApp, /setupHiddenTeacherEntry\(\);/);
});

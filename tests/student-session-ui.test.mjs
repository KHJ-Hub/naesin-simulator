import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
]);

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
  ['결과표 인쇄', '내 데이터 초기화', '내 데이터 백업', '백업 불러오기']
    .forEach((label) => assert.match(html, new RegExp(label)));
  assert.doesNotMatch(html, />JSON 내보내기</);
  assert.doesNotMatch(html, />JSON 불러오기</);
});

test('공유용 브랜딩은 서비스명과 제작자 보조 문구를 분리한다', () => {
  assert.match(html, /<title>내신 설계 노트<\/title>/);
  assert.match(html, /<h1>내신 설계 노트<\/h1>/);
  assert.match(html, /현정T 제작 · 학생용 내신 시뮬레이터/);
  assert.doesNotMatch(html, /현정T의 내신 설계 노트/);
});

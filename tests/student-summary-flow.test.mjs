import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('상단 히어로 카드를 제거하고 안전 안내 다음에 학생 정보가 이어진다', () => {
  assert.equal(html.includes('class="hero-grid"'), false);
  assert.equal(html.includes('현재까지의 흐름을 한눈에'), false);
  assert.equal(html.includes('내 성적을 확인하고<br'), false);
  assert.ok(html.indexOf('class="topbar"') < html.indexOf('class="notice-card"'));
  assert.ok(html.indexOf('class="notice-card"') < html.indexOf('class="panel student-panel"'));
});

test('상단 4개 요약 카드 대신 계산 버튼 아래에 현재 내신 결과를 둔다', () => {
  assert.equal(html.includes('id="summary-cards"'), false);
  assert.equal(html.includes('id="current-grade-result"'), true);
  assert.ok(html.indexOf('id="current-grade-result"') > html.indexOf('id="calculate-button"'));
  assert.equal(app.includes('function renderSummary()'), false);
  assert.equal(app.includes('function renderCurrentGradeResult()'), true);
});

test('계산 전에는 숫자 기본값 대신 안내하고 계산 후 유효한 현재 내신만 표시한다', () => {
  assert.match(app, /if \(!state\.calculated \|\| !Number\.isFinite\(current\)\)/);
  assert.match(app, /성적을 입력하고 내신을 계산해 보세요\./);
  assert.match(app, /계산된 현재 내신/);
});

test('학기별 카드는 기존 상세·간편 완료 판정으로 상태를 표시한다', () => {
  assert.match(html, /id="semester-cards"/);
  assert.match(app, /function semesterCardView\(semesterId\)/);
  assert.match(app, /상세 입력 완료/);
  assert.match(app, /간편 입력 완료/);
  assert.match(app, /입력 중/);
  assert.match(app, /입력 전/);
  assert.match(app, /aria-expanded=/);
});

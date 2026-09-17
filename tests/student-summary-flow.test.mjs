import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

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

test('학기 탭은 기존 학기 완료 판정으로 입력 완료 표시를 제공한다', () => {
  assert.match(app, /const completed = new Set\(completedSemesterIds\(\)\)/);
  assert.match(app, /입력 완료/);
  assert.match(app, /aria-label=/);
});

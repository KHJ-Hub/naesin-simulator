import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, styles] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
]);

test('성적 입력은 별도 간편·상세 섹션 대신 학기별 카드 한 곳에서 제공된다', () => {
  assert.match(html, /id="semester-cards" class="semester-card-list"/);
  assert.doesNotMatch(html, /id="semester-tabs"/);
  assert.doesNotMatch(html, /id="semester-input-mode"/);
  assert.match(app, /SEMESTERS\.map\(\(semester\) =>/);
  assert.match(app, /학기 평균으로 간단히 입력/);
  assert.match(app, /과목별로 자세히 입력/);
});

test('학기 카드는 독립 헤더와 접근 가능한 펼침 상태를 사용한다', () => {
  assert.match(app, /let expandedSemesterId = state\.activeSemester/);
  assert.match(app, /data-semester-toggle=/);
  assert.match(app, /aria-expanded=/);
  assert.match(app, /semester-card-body[\s\S]*hidden/);
  assert.match(styles, /\.semester-card-header[\s\S]*min-height: 66px/);
  assert.match(styles, /\.semester-card-body\[hidden\][\s\S]*display: none/);
});

test('간편 평균은 1~5 범위로 기존 quickAverages에 저장한다', () => {
  assert.match(app, /data-quick-average=/);
  assert.match(app, /validAverageInput\(value\)/);
  assert.match(app, /state\.quickAverages\[semesterId\] = Number\(value\.toFixed\(2\)\)/);
  assert.match(app, /학기 평균은 1\.00~5\.00 범위로 입력해 주세요/);
});

test('입력 방식 전환은 기존 간편·상세 데이터를 삭제하지 않고 inputModes만 바꾼다', () => {
  assert.match(app, /state\.inputModes\[semesterId\] = modeButton\.dataset\.inputMode/);
  assert.doesNotMatch(app, /delete state\.quickAverages\[semesterId\][\s\S]{0,120}modeButton/);
  assert.match(app, /과목별 입력값을 기준으로 계산합니다\. 간편 평균도 보관되어 있습니다/);
});

test('상세 입력 완료값이 간편 평균보다 우선하는 기존 계산 규칙을 유지한다', () => {
  assert.match(app, /if \(status\.complete\) output\.push\(\.\.\.status\.valid\);\s*else if \(Number\.isFinite\(quick\)/);
  assert.match(app, /if \(status\.complete\) return \{ badge: '상세 입력 완료'/);
});

test('모바일은 입력 방식과 계산 영역을 한 열로 배치하고 터치 높이를 유지한다', () => {
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.semester-mode-options \{ grid-template-columns: 1fr/);
  assert.match(styles, /\.semester-mode-option[\s\S]*?min-height: 60px/);
  assert.match(styles, /\.grade-calculation-actions \{ grid-template-columns: 1fr/);
});

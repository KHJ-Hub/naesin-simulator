import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  COLLAPSIBLE_STEP_IDS,
  bindPrintExpansion,
  closeSteps,
  expandForPrint,
  markStepsReady,
  openStep,
  scrollStepIntoView,
} from '../src/step-sections.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');

const step = (open = false) => ({ open, dataset: {} });

test('openStep은 접힌 단계만 펼치고 없는 요소는 무시한다', () => {
  const closed = step(false);
  openStep(closed);
  assert.equal(closed.open, true);
  openStep(closed);
  assert.equal(closed.open, true);
  assert.doesNotThrow(() => openStep(null));
});

test('closeSteps는 모든 단계를 접는다', () => {
  const a = step(true);
  const b = step(true);
  closeSteps([a, null, b]);
  assert.equal(a.open, false);
  assert.equal(b.open, false);
});

test('markStepsReady는 안내 문구를 고르는 표시값만 바꾼다', () => {
  const a = step(false);
  markStepsReady([a], true);
  assert.equal(a.dataset.ready, 'true');
  assert.equal(a.open, false);
  markStepsReady([a], false);
  assert.equal('ready' in a.dataset, false);
});

test('인쇄용 펼침은 이전 열림 상태를 그대로 되돌린다', () => {
  const opened = step(true);
  const closed = step(false);
  const restore = expandForPrint([opened, closed]);
  assert.equal(opened.open, true);
  assert.equal(closed.open, true);
  restore();
  assert.equal(opened.open, true);
  assert.equal(closed.open, false);
});

test('beforeprint에서 모두 펼치고 afterprint에서 되돌리며 중복 호출에도 처음 상태를 지킨다', () => {
  const listeners = {};
  const fakeWindow = {
    addEventListener: (name, handler) => { listeners[name] = handler; },
    removeEventListener: (name) => { delete listeners[name]; },
  };
  const a = step(false);
  const b = step(true);
  const dispose = bindPrintExpansion([a, b], fakeWindow);
  listeners.beforeprint();
  listeners.beforeprint();
  assert.deepEqual([a.open, b.open], [true, true]);
  listeners.afterprint();
  assert.deepEqual([a.open, b.open], [false, true]);
  dispose();
  assert.equal(listeners.beforeprint, undefined);
  assert.equal(listeners.afterprint, undefined);
});

test('스크롤은 상단바가 붙어 있으면 그 높이만큼 비우고 움직임 줄이기 설정을 따른다', () => {
  const calls = [];
  const element = { getBoundingClientRect: () => ({ top: 500 }) };
  const documentRef = { querySelector: () => ({ getBoundingClientRect: () => ({ height: 100 }) }) };
  const windowFor = (position, reduce) => ({
    scrollY: 200,
    scrollTo: (options) => calls.push(options),
    getComputedStyle: () => ({ position }),
    matchMedia: () => ({ matches: reduce }),
  });
  scrollStepIntoView(element, { windowRef: windowFor('sticky', false), documentRef });
  scrollStepIntoView(element, { windowRef: windowFor('static', true), documentRef });
  assert.deepEqual(calls[0], { top: 500 + 200 - (100 + 10 + 12), behavior: 'smooth' });
  assert.deepEqual(calls[1], { top: 500 + 200 - 12, behavior: 'auto' });
  assert.doesNotThrow(() => scrollStepIntoView(null));
});

test('STEP 3·4만 처음부터 접힌 details이고 STEP 1·2는 그대로 보인다', () => {
  for (const id of Object.values(COLLAPSIBLE_STEP_IDS)) {
    const tag = html.match(new RegExp(`<details[^>]*id="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `${id}는 details여야 해요`);
    assert.doesNotMatch(tag, /\sopen[\s>=]/, `${id}는 처음에 접혀 있어야 해요`);
    const block = html.slice(html.indexOf(tag));
    assert.match(block.slice(0, 900), /<summary[^>]*>[\s\S]*내신을 계산하면 열려요[\s\S]*<\/summary>/);
  }
  assert.doesNotMatch(html, /<details[^>]*student-section|<details[^>]*grade-input|<details[^>]*simulator-panel/);
  assert.match(html, /<section class="step-section" aria-labelledby="student-section-title">/);
  assert.match(html, /<section class="step-section" aria-labelledby="grade-input-title">/);
});

test('STEP 번호는 1~4가 한 번씩 순서대로 나오고 예전 표기는 없다', () => {
  assert.deepEqual([...html.matchAll(/STEP (\d) \/ 4/g)].map((match) => match[1]), ['1', '2', '3', '4']);
  assert.doesNotMatch(html, /class="eyebrow">STEP/);
});

test('접어도 입력값이 남도록 주요 입력 요소가 모두 단계 안쪽에 남아 있다', () => {
  const analysis = html.slice(html.indexOf('id="analysis-section"'), html.indexOf('id="admission-section"'));
  for (const id of ['target-average', 'weighted-toggle', 'goal-calculate-button', 'goal-result', 'semester-summary', 'grade-position', 'subject-summary']) {
    assert.match(analysis, new RegExp(`id="${id}"`), `${id}`);
  }
  const admission = html.slice(html.indexOf('id="admission-section"'), html.indexOf('<footer'));
  for (const id of ['admission-reference-panel', 'admission-region', 'admission-university', 'admission-department', 'admission-view-button', 'admission-interests']) {
    assert.match(admission, new RegExp(`id="${id}"`), `${id}`);
  }
});

test('계산 성공·백업 복원·초기화·인쇄 시점에 단계 펼침이 연결된다', () => {
  assert.match(app, /calculate-button'\)\.addEventListener\('click'[\s\S]*?if \(isCalculationReady\(\)\) \{ openStep\(stepSections\.analysis\);[\s\S]*?scrollStepIntoView\(stepSections\.analysis\)/);
  assert.doesNotMatch(app, /openStep\(stepSections\.admission\)/);
  assert.match(app, /showToast\('백업 데이터를 불러왔어요\.'\);\s*if \(isCalculationReady\(\)\) openStep\(stepSections\.analysis\);/);
  assert.match(app, /reset-button'\)\.addEventListener\('click'[\s\S]*?render\(\);\s*closeSteps\(stepSectionList\);/);
  assert.match(app, /bindPrintExpansion\(stepSectionList, window\)/);
  assert.match(app, /markStepsReady\(stepSectionList, state\.calculated && Number\.isFinite\(current\)\)/);
});

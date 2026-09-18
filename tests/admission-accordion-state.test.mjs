import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT,
  ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT,
  createAdmissionAccordionState,
} from '../src/admission-accordion-state.mjs';

const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('교과·학종 결과 그룹은 모두 기본 접힘이다', () => {
  const state = createAdmissionAccordionState();
  assert.equal(state.isExpanded('similar'), false);
  assert.equal(state.isExpanded('higher'), false);
  assert.equal(state.isExpanded('lower'), false);
  assert.equal(state.isExpanded('comprehensive-similar'), false);
  assert.equal(state.isExpanded('comprehensive-higher'), false);
  assert.equal(state.isExpanded('comprehensive-lower'), false);
  assert.equal(state.isExpanded('comprehensive-unavailable'), false);
});

test('각 결과 그룹은 다른 그룹에 영향을 주지 않고 독립적으로 토글된다', () => {
  const state = createAdmissionAccordionState();
  assert.equal(state.toggle('similar'), true);
  assert.equal(state.toggle('similar'), false);
  assert.equal(state.toggle('higher'), true);
  assert.equal(state.toggle('lower'), true);
  assert.equal(state.isExpanded('similar'), false);
  assert.equal(state.isExpanded('higher'), true);
  assert.equal(state.isExpanded('lower'), true);
});

test('학생부종합 그룹에도 같은 상태 규칙을 적용하고 필터 초기화 시 기본값으로 돌아간다', () => {
  const state = createAdmissionAccordionState();
  assert.equal(state.isExpanded('comprehensive-similar'), false);
  assert.equal(state.isExpanded('comprehensive-higher'), false);
  state.toggle('comprehensive-higher');
  state.toggle('comprehensive-similar');
  assert.equal(state.isExpanded('comprehensive-higher'), true);
  assert.equal(state.isExpanded('comprehensive-similar'), true);
  state.reset();
  assert.equal(state.isExpanded('comprehensive-similar'), false);
  assert.equal(state.isExpanded('comprehensive-higher'), false);
});

test('대학은 10개씩, 대학 내부 모집단위는 5개씩 표시한다', () => {
  assert.equal(ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT, 10);
  assert.equal(ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT, 5);
});

test('모집단위가 정확히 1개인 대학에만 단일 카드 레이아웃 클래스를 적용한다', () => {
  assert.match(appSource, /group\.resultCount === 1 \? ' is-single' : ''/);
  assert.match(appSource, /admission-university-results\$\{resultLayoutClass\}/);
});

test('단일 모집단위는 전체 폭을 쓰고 복수 모집단위의 기존 그리드는 유지한다', () => {
  assert.match(styleSource, /\.admission-university-results\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styleSource, /@media \(min-width:\s*1200px\)[\s\S]*?\.admission-university-results\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styleSource, /\.admission-university-results\.is-single\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('단일 카드 내부 가로 배치는 태블릿부터 적용되고 모바일은 1열을 유지한다', () => {
  assert.match(styleSource, /@media \(min-width:\s*768px\)[\s\S]*?\.admission-university-results\.is-single \.admission-department-card\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(260px,\s*1\.15fr\)/);
  assert.match(styleSource, /@media \(max-width:\s*767px\)[\s\S]*?\.admission-university-results\s*\{\s*grid-template-columns:\s*1fr/);
});

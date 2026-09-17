import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT,
  ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT,
  createAdmissionAccordionState,
} from '../src/admission-accordion-state.mjs';

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

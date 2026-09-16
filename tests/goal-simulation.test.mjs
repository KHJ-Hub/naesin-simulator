import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateScenarioSemesterResults,
  createGoalScenarioSummaries,
  createScenarioTargets,
} from '../src/goal-simulation.mjs';

const actual = [
  { semesterId: '1-1', subjectName: '국어', credit: 4, gradeValue: 2 },
  { semesterId: '1-1', subjectName: '수학', credit: 4, gradeValue: 3 },
];

const remaining = [
  { semesterId: '1-2', subjectName: '영어', credit: 4 },
  { semesterId: '1-2', subjectName: '사회', credit: 3 },
  { semesterId: '2-1', subjectName: '수학', credit: 4 },
  { semesterId: '2-1', subjectName: '과학', credit: 3 },
  { semesterId: '2-2', subjectName: '국어', credit: 4 },
  { semesterId: '3-1', subjectName: '영어', credit: 3 },
  { semesterId: '3-2', subjectName: '시뮬레이션 제외 과목', credit: 3 },
];

test('동일 학기의 여러 과목을 학점 합계가 있는 한 줄로 집계한다', () => {
  const targets = createScenarioTargets(remaining, 2.25, 'balanced');
  assert.deepEqual(targets.map(({ semesterId, credit }) => ({ semesterId, credit })), [
    { semesterId: '1-2', credit: 7 },
    { semesterId: '2-1', credit: 7 },
    { semesterId: '2-2', credit: 4 },
    { semesterId: '3-1', credit: 3 },
  ]);
});

test('과목 단위 목표가 들어와도 실제 학점 가중 학기 평균으로 집계한다', () => {
  const rows = aggregateScenarioSemesterResults([
    { semesterId: '1-2', credit: 4, target: 2 },
    { semesterId: '1-2', credit: 2, target: 3 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].semesterId, '1-2');
  assert.equal(rows[0].target, 7 / 3);
});

test('세 시나리오 모두 학기별 unique key와 고정 순서를 사용한다', () => {
  const scenarios = createGoalScenarioSummaries(actual, remaining, 2.25, true);
  assert.deepEqual(scenarios.map(({ mode }) => mode), ['balanced', 'early', 'late']);
  scenarios.forEach(({ semesterResults }) => {
    const ids = semesterResults.map(({ semesterId }) => semesterId);
    assert.deepEqual(ids, ['1-2', '2-1', '2-2', '3-1']);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(semesterResults.length <= 5);
  });
});

test('초반 집중형과 후반 상승형은 과목이 아니라 학기 전체에 서로 다른 목표를 준다', () => {
  const scenarios = createGoalScenarioSummaries(actual, remaining, 2.25, true);
  const early = scenarios.find(({ mode }) => mode === 'early').semesterResults;
  const late = scenarios.find(({ mode }) => mode === 'late').semesterResults;
  assert.ok(early[0].target < early[1].target);
  assert.ok(late.at(-1).target < late[0].target);
});

test('각 시나리오에는 예상 최종 내신이 정확히 하나만 존재한다', () => {
  const scenarios = createGoalScenarioSummaries(actual, remaining, 2.25, true);
  scenarios.forEach((scenario) => {
    assert.equal(Object.hasOwn(scenario, 'finalAverage'), true);
    assert.equal(Object.keys(scenario).filter((key) => key === 'finalAverage').length, 1);
    assert.equal(Number.isFinite(scenario.finalAverage), true);
  });
});

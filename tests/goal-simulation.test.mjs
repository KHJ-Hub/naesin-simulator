import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateScenarioSemesterResults,
  createGoalScenarioSummaries,
  createScenarioTargets,
  getRemainingSimulationSemesters,
} from '../src/goal-simulation.mjs';
import { calculateRequiredRemainingAverage } from '../src/grade-calculator.mjs';

test('중간 학기가 비어 있어도 3-1까지 미입력 학기를 모두 남은 학기로 분류한다', () => {
  assert.deepEqual(
    getRemainingSimulationSemesters(['1-1', '2-1']).map(({ id }) => id),
    ['1-2', '2-2', '3-1'],
  );
  assert.deepEqual(getRemainingSimulationSemesters([]), []);
});

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
  assert.ok(early.every((item, index) => index === 0 || item.target > early[index - 1].target));
  assert.ok(late.every((item, index) => index === 0 || item.target < late[index - 1].target));
  assert.ok(early.every((item, index) => index === 0 || item.target - early[index - 1].target <= 0.2 + Number.EPSILON));
  assert.ok(late.every((item, index) => index === 0 || late[index - 1].target - item.target <= 0.2 + Number.EPSILON));
});

test('각 시나리오에는 예상 최종 내신이 정확히 하나만 존재한다', () => {
  const scenarios = createGoalScenarioSummaries(actual, remaining, 2.25, true);
  scenarios.forEach((scenario) => {
    assert.equal(Object.hasOwn(scenario, 'finalAverage'), true);
    assert.equal(Object.keys(scenario).filter((key) => key === 'finalAverage').length, 1);
    assert.equal(Number.isFinite(scenario.finalAverage), true);
  });
});

test('1학기 4.00·목표 2.50·남은 4학기에서 세 시나리오가 목표에 근접한다', () => {
  const current = [{ semesterId: '1-1', subjectName: '1학기 평균', credit: 1, gradeValue: 4 }];
  const future = ['1-2', '2-1', '2-2', '3-1'].map((semesterId) => ({
    semesterId,
    subjectName: `${semesterId} 평균`,
    credit: 1,
  }));
  const required = calculateRequiredRemainingAverage(current, future, 2.5, false);
  const scenarios = createGoalScenarioSummaries(current, future, required, false);
  const balanced = scenarios.find(({ mode }) => mode === 'balanced').semesterResults.map(({ target }) => target);
  const early = scenarios.find(({ mode }) => mode === 'early').semesterResults.map(({ target }) => target);
  const late = scenarios.find(({ mode }) => mode === 'late').semesterResults.map(({ target }) => target);

  assert.equal(new Set(balanced).size, 1);
  assert.ok(early.every((target, index) => index === 0 || target > early[index - 1]));
  assert.ok(late.every((target, index) => index === 0 || target < late[index - 1]));
  assert.ok(new Set(early.map((target) => target.toFixed(6))).size > 2);
  assert.ok(new Set(late.map((target) => target.toFixed(6))).size > 2);
  scenarios.forEach(({ finalAverage }) => assert.ok(Math.abs(finalAverage - 2.5) <= 0.01));
});

test('남은 2학기는 완만한 앞뒤 차이를 만들고 1학기는 세 시나리오가 동일하다', () => {
  const twoSemesters = remaining.filter(({ semesterId }) => ['1-2', '2-1'].includes(semesterId));
  const twoEarly = createScenarioTargets(twoSemesters, 2.5, 'early', true);
  const twoLate = createScenarioTargets(twoSemesters, 2.5, 'late', true);
  assert.ok(twoEarly[0].target < twoEarly[1].target);
  assert.ok(twoLate[0].target > twoLate[1].target);
  assert.ok(Math.abs(twoEarly[1].target - twoEarly[0].target) <= 0.2 + Number.EPSILON);

  const oneSemester = remaining.filter(({ semesterId }) => semesterId === '1-2');
  const singleTargets = ['balanced', 'early', 'late'].map((mode) => createScenarioTargets(oneSemester, 2.5, mode, true));
  singleTargets.forEach((targets) => assert.equal(targets[0].target, 2.5));
});

test('학점 가중 여부에 맞춰 시나리오 평균을 각각 정규화한다', () => {
  const uneven = [
    { semesterId: '1-2', subjectName: '국어', credit: 6 },
    { semesterId: '2-1', subjectName: '수학', credit: 2 },
    { semesterId: '2-2', subjectName: '영어', credit: 2 },
    { semesterId: '3-1', subjectName: '과학', credit: 2 },
  ];
  const weightedTargets = createScenarioTargets(uneven, 2.4, 'early', true);
  const unweightedTargets = createScenarioTargets(uneven, 2.4, 'early', false);
  const weightedMean = weightedTargets.reduce((sum, item) => sum + item.target * item.credit, 0)
    / weightedTargets.reduce((sum, item) => sum + item.credit, 0);
  const unweightedMean = unweightedTargets.reduce((sum, item) => sum + item.target * item.count, 0)
    / unweightedTargets.reduce((sum, item) => sum + item.count, 0);

  assert.ok(Math.abs(weightedMean - 2.4) < 1e-10);
  assert.ok(Math.abs(unweightedMean - 2.4) < 1e-10);
  assert.notDeepEqual(weightedTargets.map(({ target }) => target), unweightedTargets.map(({ target }) => target));
});

test('1~5 경계에서는 목표를 벗어나지 않으며 불가능 목표는 기존 필요 평균 판정에 남긴다', () => {
  const nearBest = createScenarioTargets(remaining, 1.05, 'early', true);
  const nearWorst = createScenarioTargets(remaining, 4.95, 'late', true);
  [...nearBest, ...nearWorst].forEach(({ target }) => assert.ok(target >= 1 && target <= 5));

  const impossible = calculateRequiredRemainingAverage(
    [{ semesterId: '2-2', subjectName: '현재', credit: 1, gradeValue: 5 }],
    [{ semesterId: '3-1', subjectName: '남은 학기', credit: 1 }],
    1,
    false,
  );
  assert.ok(impossible < 1);
});

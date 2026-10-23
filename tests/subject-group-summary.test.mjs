import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCurrentGradeModel } from '../src/semester-grade-model.mjs';
import { calculateSubjectGroupAverages } from '../src/grade-calculator.mjs';
import { buildSubjectGroupSummaryDisplay, describeSubjectGroupAverage } from '../src/subject-group-summary.mjs';
import { buildPrintReportModel, renderPrintReport } from '../src/print-report.mjs';

const semesterRows = (semesterId) => [
  { semesterId, subjectName: '국어', subjectGroup: '국어', credit: 4, gradeValue: 2, gradingType: 'grade' },
  { semesterId, subjectName: '수학', subjectGroup: '수학', credit: 4, gradeValue: 4, gradingType: 'grade' },
];
const stateFor = (ids) => ({ actual: ids.flatMap(semesterRows), quickAverages: {}, weighted: true, calculated: true });
function displayFor(state) {
  const current = buildCurrentGradeModel(state);
  const rows = current.completedSemesters.flatMap((semester) => semester.source === 'detailed' ? semester.validRows : []);
  return buildSubjectGroupSummaryDisplay(calculateSubjectGroupAverages(rows, state.weighted), {
    overallAverage: current.average, completedSemesterCount: current.completedSemesters.length,
  });
}

test('1개 완료 학기는 평균을 유지하고 모든 평가를 숨기며 안내를 표시한다', () => {
  const display = displayFor(stateFor(['1-1']));
  assert.equal(display.completedSemesterCount, 1);
  assert.equal(display.showEvaluation, false);
  assert.equal(display.contextLabel, '1개 학기 기준');
  assert.match(display.notice, /현재 입력한 학기 기준/);
  assert.deepEqual(display.items.map(({ average, evaluation }) => [average, evaluation]), [[2, ''], [4, '']]);
});

test('2개·3개 완료 학기는 기존 평가를 표시하고 계산값을 유지한다', () => {
  for (const ids of [['1-1', '1-2'], ['1-1', '1-2', '2-1']]) {
    const state = stateFor(ids);
    const display = displayFor(state);
    assert.equal(display.completedSemesterCount, ids.length);
    assert.equal(display.showEvaluation, true);
    assert.equal(display.notice, '');
    assert.deepEqual(display.items.map(({ evaluation }) => evaluation), ['강점', '향상 필요']);
    assert.equal(buildCurrentGradeModel(state).average, 3);
  }
});

test('판정 임계값은 기존 평균 차이 기준을 유지하고 계산 전에는 판정하지 않는다', () => {
  assert.deepEqual([2, 3, 3.5, 4, 5].map((average) => describeSubjectGroupAverage(average, 3)),
    ['강점', '유지 권장', '조금 더 올리면 좋아요', '향상 필요', '우선 관리 권장']);
  assert.equal(describeSubjectGroupAverage(2, null), '');
  assert.equal(buildSubjectGroupSummaryDisplay([{ average: 2 }], { completedSemesterCount: 2 }).showEvaluation, false);
});

test('미완료 학기와 성취도 전용 학기는 완료 학기 수에 포함하지 않는다', () => {
  const state = stateFor(['1-1']);
  state.actual.push(...semesterRows('1-2').map((row, i) => ({ ...row, gradeValue: i ? '' : 2 })));
  state.actual.push({ semesterId: '2-1', subjectName: '음악', subjectGroup: '예술', credit: 2, gradingType: 'achievement', achievement: 'A' });
  assert.equal(displayFor(state).completedSemesterCount, 1);
  assert.equal(displayFor(state).showEvaluation, false);
  assert.deepEqual(displayFor(state).items.map(({ subjectGroup }) => subjectGroup), ['국어', '수학']);
});

test('간편·상세 혼합도 실제 완료 학기를 세고 기존 상세 분석 불가 처리를 유지한다', () => {
  const state = stateFor(['1-1']);
  state.quickAverages['1-2'] = 3;
  const model = buildPrintReportModel(state);
  assert.equal(model.current.completedSemesterCount, 2);
  assert.equal(model.subjects.completedSemesterCount, 2);
  assert.equal(model.subjects.available, false);
  assert.deepEqual(model.subjects.items, []);
});

test('인쇄도 1개 학기에서는 숫자와 안내만, 2개 이상에서는 기존 평가를 표시한다', () => {
  for (const ids of [['1-1'], ['1-1', '1-2'], ['1-1', '1-2', '2-1']]) {
    const state = stateFor(ids);
    const model = buildPrintReportModel(state);
    assert.deepEqual(model.subjects.items, displayFor(state).items);
    const section = renderPrintReport(model).match(/<section class="print-subject-section">[\s\S]*?<\/section>/)[0];
    assert.match(section, /2\.00/);
    assert.match(section, /4\.00/);
    if (ids.length === 1) {
      assert.doesNotMatch(section, /<th>해석<\/th>|<td>강점<\/td>|<td>향상 필요<\/td>/);
      assert.match(section, /1개 학기 기준/);
    } else {
      assert.match(section, /<td>강점<\/td>/);
      assert.match(section, /<td>향상 필요<\/td>/);
    }
  }
});

test('학생 화면은 인쇄와 같은 표시 모델 및 완료 학기 수를 사용한다', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const render = app.slice(app.indexOf('function renderSubjectSummary()'), app.indexOf('function admissionOptions'));
  assert.match(render, /buildSubjectGroupSummaryDisplay/);
  assert.match(render, /completedSemesterCount: currentModel.completedSemesters.length/);
  assert.match(render, /display.showEvaluation \? `<small>/);
});

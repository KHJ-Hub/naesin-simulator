import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuickConsultation, createQuickConsultationState } from '../src/quick-consultation.mjs';
import { buildQuickConsultPrintModel, renderPrintReport } from '../src/print-report.mjs';

test('1학년 1학기 완료·현재 1.35·목표 1.50 상담을 동일 학기 비중으로 계산한다', () => {
  const result = calculateQuickConsultation({ currentAverage: 1.35, completedSemesterId: '1-1', targetAverage: 1.5 });
  assert.equal(result.valid, true);
  assert.equal(result.completedSemesterCount, 1);
  assert.equal(result.remainingSemesterCount, 4);
  assert.equal(result.requiredAverage, 1.54);
  assert.equal(result.scenarios.length, 3);
  result.scenarios.forEach((scenario) => assert.ok(Math.abs(scenario.finalAverage - 1.5) <= 0.01));
});
test('2학년 1학기 완료·현재 2.30·목표 2.00의 남은 두 학기 필요 평균은 1.55다', () => {
  const result = calculateQuickConsultation({ currentAverage: 2.3, completedSemesterId: '2-1', targetAverage: 2 });
  assert.equal(result.valid, true);
  assert.equal(result.remainingSemesterCount, 2);
  assert.equal(result.requiredAverage, 1.55);
  assert.deepEqual(result.scenarios[0].semesterResults.map(({ semesterId }) => semesterId), ['2-2', '3-1']);
});

test('선택 학기 평균은 표시용으로 보존하지만 누적 내신 직접 입력 계산을 바꾸지 않는다', () => {
  const result = calculateQuickConsultation({
    currentAverage: 2.3,
    completedSemesterId: '2-1',
    targetAverage: 2,
    semesterAverages: { '1-1': 3.1, '1-2': 2.5, '2-1': 1.8, '2-2': 1.2 },
  });
  assert.equal(result.requiredAverage, 1.55);
  assert.equal(result.semesterAverages['1-1'], 3.1);
  assert.equal(result.semesterAverages['2-2'], null);
});

test('입력 범위와 선택 학번 형식을 검증하고 달성 불가능한 목표를 제한한다', () => {
  const invalid = calculateQuickConsultation({ studentId: '123', currentAverage: 0.9, completedSemesterId: '', targetAverage: 6 });
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), ['completedSemesterId', 'currentAverage', 'studentId', 'targetAverage']);

  const impossible = calculateQuickConsultation({ currentAverage: 5, completedSemesterId: '2-2', targetAverage: 1 });
  assert.equal(impossible.achievable, false);
  assert.equal(impossible.scenarios.length, 0);
  assert.equal(impossible.highestReachableAverage, 4.2);
});

test('새 상담 상태는 학생정보·성적·관심대학이 모두 빈 세션 상태다', () => {
  assert.deepEqual(createQuickConsultationState(), {
    studentName: '', studentId: '', currentAverage: '', completedSemesterId: '', targetAverage: '',
    semesterAverages: {}, admissionInterests: [],
  });
});

test('교사용 인쇄 모델은 직접 입력 안내와 세션 관심 대학을 포함한다', () => {
  const state = {
    studentName: '김학생',
    studentId: '10101',
    admissionInterests: [{
      referenceYear: 2026,
      university: '상담대학교',
      department: '경제학과',
      admissionName: '일반전형',
      admissionCategory: '학생부교과',
      cut70Original: 3.2,
      cut70Converted: 2.1,
      sourceUrl: 'https://example.edu/result',
    }],
  };
  const result = calculateQuickConsultation({ ...state, currentAverage: 2.3, completedSemesterId: '2-1', targetAverage: 2 });
  const model = buildQuickConsultPrintModel(state, result, { now: new Date('2026-09-18T00:00:00+09:00') });
  const html = renderPrintReport(model);
  assert.equal(model.quickConsult, true);
  assert.equal(model.interests.subject.length, 1);
  assert.match(html, /교사용 빠른 상담 결과/);
  assert.match(html, /현재 내신 직접 입력을 기반으로 한 상담용 참고 결과입니다/);
  assert.match(html, /상담대학교/);
  assert.doesNotMatch(html, /교과별 요약/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrintReportModel, renderPrintReport } from '../src/print-report.mjs';

function baseState() {
  return {
    student: { studentId: '10101', studentName: '김민지' },
    calculated: true,
    goalCalculated: true,
    weighted: true,
    targetAverage: '2.50',
    quickAverages: { '1-1': 4, '1-2': 3 },
    actual: [
      { id: 'korean', semesterId: '1-1', subjectName: '공통국어1', subjectGroup: '국어', credit: 4, gradeValue: 2, gradingType: 'grade' },
      { id: 'math', semesterId: '1-1', subjectName: '공통수학1', subjectGroup: '수학', credit: 4, gradeValue: 2, gradingType: 'grade' },
      { id: 'music', semesterId: '1-1', subjectName: '음악', subjectGroup: '기타', credit: 2, achievement: 'A', gradingType: 'achievement', fiveLevelEligible: false },
    ],
    admissionInterests: [
      {
        referenceYear: 2026,
        university: '교과대학교',
        department: '경영학과',
        admissionName: '일반전형',
        admissionCategory: 'student-record-subject',
        cut50Original: null,
        cut70Original: 3.4,
        cut50Converted: null,
        cut70Converted: 2.5,
        comparisonBasis: 'current',
        comparisonScore: 4.8,
        sourceUrl: 'https://example.edu/subject',
      },
      {
        referenceYear: 2026,
        university: '종합대학교',
        department: '사회학과',
        admissionName: '학생부종합',
        admissionCategory: 'student-record-comprehensive',
        averageGradeOriginal: 3.2,
        averageGradeConverted: 1.9,
        comparisonReferenceType: 'average-grade',
        comparisonBasis: 'reference',
      },
    ],
    profiles: { '20202': { studentName: '다른 학생' } },
  };
}

const remainingRecords = [
  { semesterId: '2-1', subjectName: '국어', credit: 4 },
  { semesterId: '2-1', subjectName: '수학', credit: 4 },
  { semesterId: '2-2', subjectName: '영어', credit: 4 },
  { semesterId: '3-1', subjectName: '사회', credit: 3 },
];

test('현재 학생만 사용하고 모든 학기의 입력 상태를 명확하게 만든다', () => {
  const model = buildPrintReportModel(baseState(), { remainingRecords, now: new Date('2026-09-17T00:00:00+09:00') });
  assert.equal(model.student.studentId, '10101');
  assert.equal(model.student.studentName, '김민지');
  assert.equal(JSON.stringify(model).includes('다른 학생'), false);
  assert.equal(model.semesters.length, 5);
  assert.equal(model.semesters.find(({ id }) => id === '2-1').statusLabel, '미입력');
});

test('상세입력 완료 학기는 저장된 간편입력보다 우선한다', () => {
  const model = buildPrintReportModel(baseState(), { remainingRecords });
  const first = model.semesters.find(({ id }) => id === '1-1');
  assert.equal(first.source, 'detailed');
  assert.equal(first.average, 2);
  assert.equal(model.semesters.find(({ id }) => id === '1-2').source, 'quick');
  assert.match(model.current.calculationBasis, /상세 입력 학점 \+ 간편 입력/);
});

test('세 목표 시나리오는 학기별 한 줄만 포함하고 중복되지 않는다', () => {
  const model = buildPrintReportModel(baseState(), { remainingRecords });
  assert.deepEqual(model.goal.scenarios.map(({ name }) => name), ['균형형', '초반 집중형', '후반 상승형']);
  model.goal.scenarios.forEach((scenario) => {
    const ids = scenario.semesterResults.map(({ semesterId }) => semesterId);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, ['2-1', '2-2', '3-1']);
  });
});

test('인쇄용 목표 시나리오는 학기별 하나의 통합 표로 출력한다', () => {
  const html = renderPrintReport(buildPrintReportModel(baseState(), { remainingRecords }));
  assert.equal((html.match(/class="print-scenario-table"/g) ?? []).length, 1);
  assert.match(html, /<th>학기<\/th><th>균형형<\/th><th>초반 집중형<\/th><th>후반 상승형<\/th>/);
  assert.equal((html.match(/예상 최종 내신/g) ?? []).length, 1);
});

test('인쇄 결과는 성적·목표 뒤에 관심 대학·안내가 자연스럽게 이어진다', () => {
  const html = renderPrintReport(buildPrintReportModel(baseState(), { remainingRecords }));
  const primary = html.indexOf('print-sheet-primary');
  const secondary = html.indexOf('print-sheet-secondary');
  assert.ok(primary >= 0 && secondary > primary);
  assert.ok(html.indexOf('목표 내신 시뮬레이션') < secondary);
  assert.ok(html.indexOf('관심 대학 전년도 입시결과 참고') > secondary);
  assert.ok(html.indexOf('안내') > secondary);
  assert.match(html, /print-sheet-secondary--has-interests/);
});

test('관심 대학이 없으면 인쇄 결과가 불필요한 새 페이지를 강제하지 않는다', () => {
  const state = baseState();
  state.admissionInterests = [];
  const html = renderPrintReport(buildPrintReportModel(state, { remainingRecords }));
  assert.doesNotMatch(html, /print-sheet-secondary--has-interests/);
});

test('공식 출처는 긴 URL 대신 대학별 공식 자료 링크로 축약한다', () => {
  const state = baseState();
  state.admissionInterests.push({ ...state.admissionInterests[0], department: '경제학과' });
  const html = renderPrintReport(buildPrintReportModel(state, { remainingRecords }));
  assert.match(html, /href="https:\/\/example\.edu\/subject">교과대학교 공식 자료<\/a>/);
  assert.equal((html.match(/교과대학교 공식 자료/g) ?? []).length, 1);
  assert.doesNotMatch(html, /교과대학교 \(https:\/\/example\.edu\/subject\)/);
});

test('학생이 먼저 보는 핵심 내신 수치는 인쇄용 강조 클래스를 가진다', () => {
  const html = renderPrintReport(buildPrintReportModel(baseState(), { remainingRecords }));
  assert.equal((html.match(/class="print-key-metric"/g) ?? []).length, 3);
  assert.match(html, /print-scenario-final/);
});

test('인쇄 안내문은 세로 공간을 줄이는 단일 요약 그리드로 묶는다', () => {
  const html = renderPrintReport(buildPrintReportModel(baseState(), { remainingRecords }));
  assert.equal((html.match(/class="print-notice-grid"/g) ?? []).length, 1);
  assert.equal((html.match(/class="print-note"/g) ?? []).length >= 3, true);
});

test('관심 대학만 교과와 학종으로 분리하고 최신 내신으로 비교값을 다시 계산한다', () => {
  const model = buildPrintReportModel(baseState(), { remainingRecords });
  assert.equal(model.interests.subject.length, 1);
  assert.equal(model.interests.comprehensive.length, 1);
  const subject = model.interests.subject[0];
  assert.equal(subject.comparisonBasisLabel, '현재 내신');
  assert.equal(subject.comparisonValue, model.current.average);
  assert.notEqual(subject.comparisonValue, 4.8);
  assert.equal(subject.difference, Number((2.5 - model.current.average).toFixed(2)));
  assert.equal(subject.cut50Original, null);
});

test('학종 평균등급을 cut으로 오인하거나 직접 비교하지 않는다', () => {
  const comprehensive = buildPrintReportModel(baseState(), { remainingRecords }).interests.comprehensive[0];
  assert.equal(comprehensive.referenceLabel, '평균등급');
  assert.equal(comprehensive.referenceOriginal, 3.2);
  assert.equal(comprehensive.referenceConverted, 1.9);
  assert.equal(comprehensive.cut50Original, null);
  assert.equal(comprehensive.cut70Original, null);
  assert.equal(comprehensive.difference, null);
});

test('기본 결과표는 과목별 상세표를 출력하지 않고 null 값을 안전하게 표시한다', () => {
  const model = buildPrintReportModel(baseState(), { remainingRecords });
  const html = renderPrintReport(model);
  assert.equal(model.courseAppendix.included, false);
  assert.doesNotMatch(html, /부록 · 과목별 상세 성적/);
  assert.match(html, /교과대학교/);
  assert.match(html, /종합대학교/);
  assert.match(html, /공개 입결/);
  assert.match(html, /원본 3\.40 · 70% cut/);
  assert.match(html, /현재 내신/);
});

test('관심 대학 표는 학생 상담에 필요한 핵심 열만 출력하고 빈 전형 표는 만들지 않는다', () => {
  const state = baseState();
  state.admissionInterests = [state.admissionInterests[0]];
  const html = renderPrintReport(buildPrintReportModel(state, { remainingRecords }));
  assert.match(html, /모집단위 · 전형/);
  assert.doesNotMatch(html, /자료 상태/);
  assert.doesNotMatch(html, /<h3>학생부종합<\/h3>/);
});

test('관심 대학이 없으면 결과표에 명확한 빈 상태를 표시한다', () => {
  const state = baseState();
  state.admissionInterests = [];
  const html = renderPrintReport(buildPrintReportModel(state, { remainingRecords }));
  assert.match(html, /저장된 관심 대학이 없습니다\./);
});

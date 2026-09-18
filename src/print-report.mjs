import {
  SEMESTERS,
  calculateOverallAverage,
  calculateSubjectGroupAverages,
  calculateTotalCredits,
  calculateRequiredRemainingAverage,
  validAverageInput,
} from './grade-calculator.mjs';
import { createGoalScenarioSummaries } from './goal-simulation.mjs';
import { admissionDifference } from './admission-reference.mjs';

const SEMESTER_ORDER = new Map(SEMESTERS.map(({ id }, index) => [id, index]));

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fixed(value) {
  const number = numberOrNull(value);
  return number === null ? null : Number(number.toFixed(2));
}

function isGradeCourse(record = {}) {
  return (!record.gradingType || ['grade', 'both'].includes(record.gradingType)) && record.fiveLevelEligible !== false;
}

function isValidGrade(record = {}) {
  const grade = numberOrNull(record.gradeValue);
  const credit = numberOrNull(record.credit);
  return isGradeCourse(record) && grade !== null && grade >= 1 && grade <= 5 && credit !== null && credit > 0;
}

function statusForSemester(state, semester) {
  const rows = (Array.isArray(state.actual) ? state.actual : []).filter((record) => record.semesterId === semester.id);
  const gradeRows = rows.filter(isGradeCourse);
  const validRows = gradeRows.filter(isValidGrade);
  const detailedComplete = gradeRows.length > 0 && validRows.length === gradeRows.length;
  const quickAverage = numberOrNull(state.quickAverages?.[semester.id]);
  const hasQuick = validAverageInput(quickAverage);
  let source = 'missing';
  let effectiveRows = [];

  if (detailedComplete) {
    source = 'detailed';
    effectiveRows = validRows;
  } else if (hasQuick) {
    source = 'quick';
    effectiveRows = [{
      id: `print-quick-${semester.id}`,
      semesterId: semester.id,
      subjectName: `${semester.label} 평균`,
      subjectGroup: '',
      credit: 1,
      gradeValue: quickAverage,
      source: 'quick',
    }];
  } else if (validRows.length) {
    source = 'partial';
    effectiveRows = validRows;
  }

  const labels = {
    detailed: '상세입력 완료',
    quick: gradeRows.length ? '간편입력 · 상세 미완료' : '간편입력',
    partial: `상세입력 일부 (${validRows.length}/${gradeRows.length}과목)`,
    missing: '미입력',
  };

  return {
    ...semester,
    source,
    statusLabel: labels[source],
    complete: source === 'detailed' || source === 'quick',
    enteredCourseCount: validRows.length,
    totalCourseCount: gradeRows.length,
    effectiveRows,
  };
}

function uniqueSemesterLabels(records = []) {
  return [...new Set(records.map((record) => record.semesterId))]
    .filter((id) => SEMESTER_ORDER.has(id))
    .sort((a, b) => SEMESTER_ORDER.get(a) - SEMESTER_ORDER.get(b))
    .map((id) => SEMESTERS.find((semester) => semester.id === id)?.label ?? id);
}

function highestReachableAverage(actual, remaining, weighted) {
  if (!actual.length || !remaining.length) return null;
  const actualWeight = weighted ? calculateTotalCredits(actual) : actual.length;
  const remainingWeight = weighted ? calculateTotalCredits(remaining, false) : remaining.length;
  if (!actualWeight || !remainingWeight) return null;
  const actualTotal = actual.reduce((sum, record) => sum + Number(record.gradeValue) * (weighted ? Number(record.credit) : 1), 0);
  return fixed((actualTotal + remainingWeight) / (actualWeight + remainingWeight));
}

function uniqueScenarioSemesterResults(results = []) {
  const grouped = new Map();
  results.forEach((item) => {
    if (!SEMESTER_ORDER.has(item.semesterId)) return;
    const target = numberOrNull(item.target);
    const credit = numberOrNull(item.credit) ?? 1;
    if (target === null || credit <= 0) return;
    const current = grouped.get(item.semesterId) ?? { semesterId: item.semesterId, total: 0, weight: 0 };
    current.total += target * credit;
    current.weight += credit;
    grouped.set(item.semesterId, current);
  });
  return [...grouped.values()]
    .sort((a, b) => SEMESTER_ORDER.get(a.semesterId) - SEMESTER_ORDER.get(b.semesterId))
    .map((item) => ({
      semesterId: item.semesterId,
      label: SEMESTERS.find((semester) => semester.id === item.semesterId)?.label ?? item.semesterId,
      target: fixed(item.total / item.weight),
    }));
}

function isComprehensive(item = {}) {
  const category = String(item.admissionCategory ?? item.category ?? '');
  return category === 'student-record-comprehensive' || category === '학생부종합';
}

function interestReference(item = {}) {
  const requestedType = item.comparisonReferenceType;
  const candidates = requestedType === 'average-grade'
    ? [['평균등급', item.averageGradeOriginal, item.averageGradeConverted, 'average-grade']]
    : requestedType === 'cut50'
      ? [['50% cut', item.cut50Original ?? item.cut50, item.cut50Converted, 'cut50']]
      : requestedType === 'cut70'
        ? [['70% cut', item.cut70Original ?? item.cut70, item.cut70Converted, 'cut70']]
        : [
          ['평균등급', item.averageGradeOriginal, item.averageGradeConverted, 'average-grade'],
          ['70% cut', item.cut70Original ?? item.cut70, item.cut70Converted, 'cut70'],
          ['50% cut', item.cut50Original ?? item.cut50, item.cut50Converted, 'cut50'],
        ];
  const selected = candidates.find(([, original, converted]) => numberOrNull(original) !== null || numberOrNull(converted) !== null);
  if (!selected) return { type: requestedType ?? null, label: '공개 내신 자료', original: null, converted: null };
  return { type: selected[3], label: selected[0], original: fixed(selected[1]), converted: fixed(selected[2]) };
}

function buildInterest(item, currentAverage, targetAverage) {
  const comprehensive = isComprehensive(item);
  const comparisonBasis = item.comparisonBasis === 'target' ? 'target' : item.comparisonBasis === 'reference' ? 'reference' : 'current';
  const comparisonValue = comparisonBasis === 'target' ? targetAverage : comparisonBasis === 'current' ? currentAverage : null;
  const comparisonLabel = comparisonBasis === 'target' ? '목표 내신' : comparisonBasis === 'current' ? '현재 내신' : '전년도 등록자 내신 참고';
  const reference = interestReference(item);
  const cut70Converted = fixed(item.cut70Converted);
  return {
    university: String(item.university ?? ''),
    department: String(item.department ?? ''),
    admissionName: String(item.admissionName ?? ''),
    referenceYear: numberOrNull(item.referenceYear),
    admissionCategory: comprehensive ? 'student-record-comprehensive' : 'student-record-subject',
    cut50Original: fixed(item.cut50Original ?? item.cut50),
    cut70Original: fixed(item.cut70Original ?? item.cut70),
    cut50Converted: fixed(item.cut50Converted),
    cut70Converted,
    comparisonBasis,
    comparisonBasisLabel: comparisonLabel,
    comparisonValue: fixed(comparisonValue),
    difference: comprehensive || comparisonValue === null || cut70Converted === null
      ? null
      : admissionDifference(comparisonValue, cut70Converted),
    comparisonReferenceType: reference.type,
    referenceLabel: reference.label,
    referenceOriginal: reference.original,
    referenceConverted: reference.converted,
    sourceUrl: String(item.sourceUrl ?? ''),
    dataAvailability: item.dataAvailability ?? null,
    conversionDataset: item.conversionDataset ?? null,
    isApproximate: item.isApproximate === true,
  };
}

export function buildPrintReportModel(state = {}, { remainingRecords = [], now = new Date(), includeCourseAppendix = false } = {}) {
  const semesterStatuses = SEMESTERS.map((semester) => statusForSemester(state, semester));
  const effective = semesterStatuses.flatMap((semester) => semester.effectiveRows);
  const hasQuick = semesterStatuses.some((semester) => semester.source === 'quick');
  const hasDetailed = semesterStatuses.some((semester) => ['detailed', 'partial'].includes(semester.source));
  const weighted = state.weighted !== false;
  const currentAverage = state.calculated ? calculateOverallAverage(effective, weighted) : null;
  const targetAverage = validAverageInput(state.targetAverage) ? fixed(state.targetAverage) : null;
  const detailedCredits = calculateTotalCredits(effective.filter((record) => record.source !== 'quick'));
  const quickSemesterCount = semesterStatuses.filter((semester) => semester.source === 'quick').length;
  const completedSemesters = semesterStatuses.filter((semester) => semester.complete).map((semester) => semester.label);
  const enteredCourseCount = semesterStatuses.reduce((sum, semester) => sum + semester.enteredCourseCount, 0);
  const totalCourseCount = semesterStatuses.reduce((sum, semester) => sum + semester.totalCourseCount, 0);

  const semesters = semesterStatuses.map((semester) => ({
    id: semester.id,
    label: semester.label,
    source: semester.source,
    statusLabel: semester.statusLabel,
    average: semester.effectiveRows.length ? calculateOverallAverage(semester.effectiveRows, weighted) : null,
  }));

  let calculationBasis = '입력된 성적 없음';
  let creditSummary = '입력된 상세 과목 없음';
  if (hasDetailed && hasQuick) {
    calculationBasis = '상세 입력 학점 + 간편 입력 학기 포함 참고 계산';
    creditSummary = `상세 입력 ${detailedCredits.toFixed(1)}학점 + 간편 입력 ${quickSemesterCount}개 학기`;
  } else if (hasQuick) {
    calculationBasis = '학기 평균 기준 단순 계산';
    creditSummary = `학기 평균 기반 계산 (${quickSemesterCount}개 학기)`;
  } else if (hasDetailed) {
    calculationBasis = weighted ? '실제 입력 교과 학점 가중 평균' : '과목 동일 비중 평균';
    creditSummary = `실제 입력 교과 학점 합계 ${detailedCredits.toFixed(1)}학점`;
  }

  const remaining = Array.isArray(remainingRecords) ? remainingRecords : [];
  let goal = null;
  if (state.calculated && state.goalCalculated && currentAverage !== null && targetAverage !== null && remaining.length) {
    const goalWeighted = !hasQuick;
    const required = calculateRequiredRemainingAverage(effective, remaining, targetAverage, goalWeighted);
    if (required !== null) {
      const scenarios = required >= 1 && required <= 5
        ? createGoalScenarioSummaries(effective, remaining, required, goalWeighted).map((scenario) => ({
          mode: scenario.mode,
          name: scenario.name,
          semesterResults: uniqueScenarioSemesterResults(scenario.semesterResults),
          finalAverage: fixed(scenario.finalAverage),
        }))
        : [];
      goal = {
        targetAverage,
        completedSemesters,
        remainingSemesters: uniqueSemesterLabels(remaining),
        requiredAverage: fixed(required),
        achievable: required >= 1 && required <= 5,
        highestReachableAverage: highestReachableAverage(effective, remaining, goalWeighted),
        calculationBasis: goalWeighted ? '상세 입력 과목의 학점 가중 기준' : '학기 평균 동일 비중 기준',
        scenarios,
      };
    }
  }

  const interests = (Array.isArray(state.admissionInterests) ? state.admissionInterests : [])
    .map((item) => buildInterest(item, currentAverage, targetAverage));

  const courseAppendixRows = (Array.isArray(state.actual) ? state.actual : []).map((record) => ({
    semesterId: record.semesterId,
    semesterLabel: SEMESTERS.find((semester) => semester.id === record.semesterId)?.label ?? record.semesterId,
    subjectName: record.subjectName,
    subjectGroup: record.subjectGroup,
    credit: numberOrNull(record.credit),
    gradeValue: fixed(record.gradeValue),
    achievement: record.achievement || null,
    includedInGradeAverage: isGradeCourse(record),
  }));

  return {
    title: '학생 내신 · 학업 설계 상담 결과표',
    student: {
      studentId: String(state.student?.studentId ?? ''),
      studentName: String(state.student?.studentName ?? ''),
      generatedAt: new Intl.DateTimeFormat('ko-KR').format(now),
    },
    current: {
      average: fixed(currentAverage),
      completedSemesters,
      completedSemesterCount: completedSemesters.length,
      inputStatus: `${enteredCourseCount} / ${totalCourseCount}과목 등급 입력`,
      enteredCourseCount,
      totalCourseCount,
      calculationBasis,
      creditSummary,
      hasQuickAverage: hasQuick,
    },
    semesters,
    subjects: {
      available: !hasQuick && effective.length > 0,
      message: hasQuick ? '교과별 분석은 과목별 상세 입력 시 확인할 수 있습니다.' : '입력된 상세 성적이 없습니다.',
      items: hasQuick ? [] : calculateSubjectGroupAverages(effective, weighted).filter((item) => item.average !== null),
    },
    goal,
    interests: {
      subject: interests.filter((item) => item.admissionCategory === 'student-record-subject'),
      comprehensive: interests.filter((item) => item.admissionCategory === 'student-record-comprehensive'),
    },
    courseAppendix: {
      included: includeCourseAppendix,
      rows: courseAppendixRows,
    },
    notices: {
      conversion: '5등급 환산값은 부산교육청의 실제 학생 성적 분포 자료를 기반으로 한 참고값이며, 대학의 실제 2028학년도 평가 기준 또는 합격 가능성을 의미하지 않습니다.',
      comprehensive: '학생부종합전형은 내신 성적뿐 아니라 과목 선택, 세부능력 및 특기사항 등 학생부 전체를 종합적으로 평가합니다. 전년도 등록자 내신은 참고자료로만 활용하세요.',
    },
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function fmt(value) {
  return numberOrNull(value) === null ? '-' : Number(value).toFixed(2);
}

function listText(values = []) {
  return values.length ? values.map(escapeHtml).join(', ') : '-';
}

function semesterRows(model) {
  return model.semesters.map((semester) => `<tr><td>${escapeHtml(semester.label)}</td><td>${semester.average === null ? '미입력' : fmt(semester.average)}</td><td>${escapeHtml(semester.statusLabel)}</td></tr>`).join('');
}

function scenarioHtml(goal) {
  if (!goal?.scenarios?.length) return '';
  return goal.scenarios.map((scenario) => `<h3>${escapeHtml(scenario.name)}</h3><table><thead><tr><th>남은 학기</th><th>목표 평균</th></tr></thead><tbody>${scenario.semesterResults.map((semester) => `<tr><td>${escapeHtml(semester.label)}</td><td>${fmt(semester.target)}</td></tr>`).join('')}<tr><th>예상 최종 내신</th><th>${fmt(scenario.finalAverage)}</th></tr></tbody></table>`).join('');
}

function subjectInterestRows(items = []) {
  if (!items.length) return '<tr><td colspan="9">저장된 학생부교과 관심 대학이 없습니다.</td></tr>';
  return items.map((item) => `<tr><td>${escapeHtml(item.university)}</td><td>${escapeHtml(item.department)}</td><td>${escapeHtml(item.admissionName)}</td><td>${item.referenceYear ?? '-'}</td><td>${fmt(item.cut50Original)} / ${fmt(item.cut70Original)}</td><td>${fmt(item.cut50Converted)} / ${fmt(item.cut70Converted)}</td><td>${escapeHtml(item.comparisonBasisLabel)} ${fmt(item.comparisonValue)}</td><td>${item.difference === null ? '-' : `${item.difference >= 0 ? '+' : ''}${fmt(item.difference)}`}</td><td>${escapeHtml(item.dataAvailability ?? '-')}</td></tr>`).join('');
}

function comprehensiveInterestRows(items = []) {
  if (!items.length) return '<tr><td colspan="7">저장된 학생부종합 관심 대학이 없습니다.</td></tr>';
  return items.map((item) => `<tr><td>${escapeHtml(item.university)}</td><td>${escapeHtml(item.department)}</td><td>${escapeHtml(item.admissionName)}</td><td>${item.referenceYear ?? '-'}</td><td>${escapeHtml(item.referenceLabel)}</td><td>${fmt(item.referenceOriginal)}</td><td>${fmt(item.referenceConverted)}</td></tr>`).join('');
}

function sourceNotes(model) {
  const items = [...model.interests.subject, ...model.interests.comprehensive].filter((item) => item.sourceUrl);
  if (!items.length) return '';
  return `<p class="print-note">공식 출처: ${items.map((item) => `<span>${escapeHtml(item.university)} (${escapeHtml(item.sourceUrl)})</span>`).join(' · ')}</p>`;
}

export function renderPrintReport(model) {
  const goal = model.goal;
  const subjects = model.subjects.items.length
    ? model.subjects.items.map((item) => `<tr><td>${escapeHtml(item.subjectGroup)}</td><td>${fmt(item.average)}</td></tr>`).join('')
    : `<tr><td colspan="2">${escapeHtml(model.subjects.message)}</td></tr>`;
  const goalHtml = goal
    ? `<div class="print-summary"><div><span>목표 내신</span><strong>${fmt(goal.targetAverage)}</strong></div><div><span>필요한 남은 학기 평균</span><strong>${goal.achievable ? fmt(goal.requiredAverage) : '-'}</strong></div></div><p>완료 학기: ${listText(goal.completedSemesters)}</p><p>남은 학기: ${listText(goal.remainingSemesters)}</p><p class="print-note">계산 기준: ${escapeHtml(goal.calculationBasis)}</p>${goal.achievable ? scenarioHtml(goal) : `<p>현재 설정한 목표에는 도달하기 어렵습니다. 남은 모든 성적을 1등급으로 가정한 최고 도달 가능 내신은 <strong>${fmt(goal.highestReachableAverage)}</strong>입니다.</p>`}`
    : '<p>계산된 목표 내신 시뮬레이션이 없습니다.</p>';

  const appendix = model.courseAppendix.included
    ? `<section><h2>부록 · 과목별 상세 성적</h2><table><thead><tr><th>학기</th><th>과목</th><th>학점</th><th>등급/성취도</th><th>내신 반영</th></tr></thead><tbody>${model.courseAppendix.rows.map((row) => `<tr><td>${escapeHtml(row.semesterLabel)}</td><td>${escapeHtml(row.subjectName)}</td><td>${row.credit ?? '-'}</td><td>${row.gradeValue === null ? escapeHtml(row.achievement ?? '-') : fmt(row.gradeValue)}</td><td>${row.includedInGradeAverage ? '반영' : '미반영'}</td></tr>`).join('')}</tbody></table></section>`
    : '';

  const interestReport = model.interests.subject.length || model.interests.comprehensive.length
    ? `<h3>학생부교과</h3><table><thead><tr><th>대학</th><th>모집단위</th><th>전형명</th><th>학년도</th><th>9등급 원본 50/70</th><th>5등급 환산 50/70</th><th>비교 기준</th><th>차이</th><th>자료 상태</th></tr></thead><tbody>${subjectInterestRows(model.interests.subject)}</tbody></table><h3>학생부종합</h3><table><thead><tr><th>대학</th><th>모집단위</th><th>전형명</th><th>학년도</th><th>자료 유형</th><th>원본값</th><th>5등급 환산 참고</th></tr></thead><tbody>${comprehensiveInterestRows(model.interests.comprehensive)}</tbody></table>${sourceNotes(model)}`
    : '<p>저장된 관심 대학이 없습니다.</p>';

  return `<div class="print-page"><h1>${escapeHtml(model.title)}</h1><dl class="print-student"><div><dt>학번</dt><dd>${escapeHtml(model.student.studentId || '-')}</dd></div><div><dt>이름</dt><dd>${escapeHtml(model.student.studentName || '-')}</dd></div><div><dt>작성일</dt><dd>${escapeHtml(model.student.generatedAt)}</dd></div></dl><section><h2>현재 성적 요약</h2><div class="print-summary"><div><span>현재 전체 내신</span><strong>${fmt(model.current.average)}</strong></div><div><span>입력 완료 학기</span><strong>${model.current.completedSemesterCount} / ${SEMESTERS.length}</strong></div><div><span>성적 입력</span><strong>${escapeHtml(model.current.inputStatus)}</strong></div></div><p>계산 기준: ${escapeHtml(model.current.calculationBasis)}</p><p>학점 정보: ${escapeHtml(model.current.creditSummary)}</p></section><section><h2>학기별 성적 분석</h2><table><thead><tr><th>학기</th><th>평균 등급</th><th>입력 상태</th></tr></thead><tbody>${semesterRows(model)}</tbody></table></section><section><h2>교과별 요약</h2><table><thead><tr><th>교과군</th><th>평균 등급</th></tr></thead><tbody>${subjects}</tbody></table></section><section><h2>목표 내신 시뮬레이션</h2>${goalHtml}</section><section><h2>관심 대학 전년도 입시결과 참고</h2>${interestReport}</section>${appendix}<section><h2>안내</h2><p class="print-note">${escapeHtml(model.notices.conversion)}</p><p class="print-note">${escapeHtml(model.notices.comprehensive)}</p><p class="print-note">본 결과표는 성적 수치와 전년도 공개 자료를 확인하기 위한 상담 참고자료이며 대학 합격 가능성을 의미하지 않습니다.</p></section></div>`;
}

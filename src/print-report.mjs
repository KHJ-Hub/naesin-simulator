import {
  SEMESTERS,
  calculateSubjectGroupAverages,
  calculateTotalCredits,
  calculateRequiredRemainingAverage,
  validAverageInput,
} from './grade-calculator.mjs';
import { createGoalScenarioSummaries } from './goal-simulation.mjs';
import { admissionDifference } from './admission-reference-core.mjs';
import { buildStudentGradeModels } from './semester-grade-model.mjs';

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

export function buildPrintReportModel(state = {}, { remainingRecords = null, now = new Date(), includeCourseAppendix = false } = {}) {
  const gradeModels = buildStudentGradeModels(state);
  const semesterStatuses = gradeModels.current.semesters;
  const effective = gradeModels.current.semesterRecords;
  const detailedRecords = gradeModels.current.completedSemesters
    .flatMap((semester) => semester.source === 'detailed' ? semester.validRows : []);
  const hasQuick = gradeModels.current.hasQuick;
  const hasDetailed = gradeModels.current.hasDetailed;
  const weighted = state.weighted !== false;
  const currentAverage = state.calculated ? gradeModels.current.average : null;
  const targetAverage = validAverageInput(state.targetAverage) ? fixed(state.targetAverage) : null;
  const detailedCredits = calculateTotalCredits(detailedRecords);
  const quickSemesterCount = semesterStatuses.filter((semester) => semester.source === 'quick').length;
  const completedSemesters = semesterStatuses.filter((semester) => semester.complete).map((semester) => semester.label);
  const enteredCourseCount = semesterStatuses.reduce((sum, semester) => sum + semester.enteredCourseCount, 0);
  const totalCourseCount = semesterStatuses.reduce((sum, semester) => sum + semester.totalCourseCount, 0);

  const semesters = semesterStatuses.map((semester) => ({
    id: semester.id,
    label: semester.label,
    source: semester.source,
    statusLabel: semester.statusLabel,
    average: semester.complete ? semester.average : null,
  }));

  const calculationBasis = gradeModels.current.calculationBasis;
  const catalogContext = state.catalogContext && typeof state.catalogContext === 'object' ? state.catalogContext : null;
  const catalogBasis = catalogContext?.status === 'supported'
    ? `${catalogContext.entryYear}학년도 입학생 과목 기준`
    : catalogContext?.status === 'unsupported'
      ? `${catalogContext.entryYear}학년도 상세 과목 미지원 · 간편입력 기준`
      : null;
  let creditSummary = '입력된 상세 과목 없음';
  if (hasDetailed && hasQuick) {
    creditSummary = `상세 입력 ${detailedCredits.toFixed(1)}학점 · 간편 입력 ${quickSemesterCount}개 학기 · 학기별 동일 비중`;
  } else if (hasQuick) {
    creditSummary = `학기 평균 기반 계산 (${quickSemesterCount}개 학기)`;
  } else if (hasDetailed) {
    creditSummary = `상세 입력 교과 ${detailedCredits.toFixed(1)}학점 · 학기별 동일 비중`;
  }

  const remaining = Array.isArray(remainingRecords) ? remainingRecords : gradeModels.remaining.remainingRecords;
  let goal = null;
  if (state.calculated && state.goalCalculated && currentAverage !== null && targetAverage !== null && remaining.length) {
    const goalWeighted = false;
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
        calculationBasis,
        missingPastSemesters: gradeModels.remaining.missingPastSemesters.map(({ label }) => label),
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
    title: '배정고 내신 설계 노트',
    reportLabel: '학생 상담용 내신 요약 결과표',
    reportDescription: '',
    quickConsult: false,
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
      catalogEntryYear: catalogContext?.entryYear ?? null,
      catalogBasis,
      creditSummary,
      hasQuickAverage: hasQuick,
    },
    semesters,
    subjects: {
      available: !hasQuick && effective.length > 0,
      message: hasQuick ? '교과별 분석은 과목별 상세 입력 시 확인할 수 있습니다.' : '입력된 상세 성적이 없습니다.',
      items: hasQuick ? [] : calculateSubjectGroupAverages(detailedRecords, weighted).filter((item) => item.average !== null),
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

/** 교사용 빠른 상담의 직접 입력값을 기존 결과표 모델에 맞춘다. */
export function buildQuickConsultPrintModel(state = {}, result = {}, { now = new Date() } = {}) {
  const currentAverage = numberOrNull(result.currentAverage);
  const targetAverage = numberOrNull(result.targetAverage);
  const completedIds = new Set((result.completedSemesters ?? []).map((semester) => semester.id));
  const semesters = SEMESTERS.map((semester) => {
    const average = numberOrNull(result.semesterAverages?.[semester.id]);
    return {
      id: semester.id,
      label: semester.label,
      source: average === null ? 'quick-consult' : 'quick-average',
      statusLabel: completedIds.has(semester.id)
        ? (average === null ? '완료 · 개별 평균 미입력' : '학기 평균 입력')
        : '남은 학기',
      average: completedIds.has(semester.id) ? fixed(average) : null,
    };
  });
  const interests = (Array.isArray(state.admissionInterests) ? state.admissionInterests : [])
    .map((item) => buildInterest(item, currentAverage, targetAverage));
  const goal = result.valid ? {
    targetAverage: fixed(targetAverage),
    completedSemesters: (result.completedSemesters ?? []).map((semester) => semester.label),
    remainingSemesters: (result.remainingSemesters ?? []).map((semester) => semester.label),
    requiredAverage: fixed(result.requiredAverage),
    achievable: result.achievable === true,
    noRemaining: Number(result.remainingSemesterCount ?? 0) === 0,
    highestReachableAverage: fixed(result.highestReachableAverage),
    calculationBasis: '학기 평균 동일 비중 기준 (빠른 상담)',
    scenarios: (result.scenarios ?? []).map((scenario) => ({
      mode: scenario.mode,
      name: scenario.name,
      semesterResults: uniqueScenarioSemesterResults(scenario.semesterResults),
      finalAverage: fixed(scenario.finalAverage),
    })),
  } : null;

  return {
    title: '배정고 내신 설계 노트',
    reportLabel: '교사용 빠른 상담 결과',
    reportDescription: '현재 내신 직접 입력을 기반으로 한 상담용 참고 결과입니다.',
    quickConsult: true,
    student: {
      studentId: String(state.studentId ?? result.studentId ?? ''),
      studentName: String(state.studentName ?? result.studentName ?? ''),
      generatedAt: new Intl.DateTimeFormat('ko-KR').format(now),
    },
    current: {
      average: fixed(currentAverage),
      completedSemesters: (result.completedSemesters ?? []).map((semester) => semester.label),
      completedSemesterCount: Number(result.completedSemesterCount ?? 0),
      inputStatus: '현재 내신 직접 입력',
      enteredCourseCount: 0,
      totalCourseCount: 0,
      calculationBasis: '빠른 상담 직접 입력',
      creditSummary: '과목별 학점 미반영',
      hasQuickAverage: true,
    },
    semesters,
    subjects: {
      available: false,
      message: '빠른 상담 모드에서는 교과별 분석을 제공하지 않습니다.',
      items: [],
    },
    goal,
    interests: {
      subject: interests.filter((item) => item.admissionCategory === 'student-record-subject'),
      comprehensive: interests.filter((item) => item.admissionCategory === 'student-record-comprehensive'),
    },
    courseAppendix: { included: false, rows: [] },
    notices: {
      conversion: '5등급 환산값은 부산교육청의 실제 학생 성적 분포 자료를 기반으로 한 참고값이며, 대학의 실제 평가 기준 또는 합격 가능성을 의미하지 않습니다.',
      comprehensive: '빠른 상담 결과는 입력한 현재 내신을 학기 평균 기준으로 단순 계산한 참고값입니다. 정확한 학점 가중 계산은 학생용 상세 입력을 이용하세요.',
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
  const semesterOrder = [];
  const seen = new Set();
  goal.scenarios.forEach((scenario) => {
    scenario.semesterResults.forEach((semester) => {
      const key = semester.semesterId ?? semester.label;
      if (seen.has(key)) return;
      seen.add(key);
      semesterOrder.push({ key, label: semester.label });
    });
  });
  const header = goal.scenarios.map((scenario) => `<th>${escapeHtml(scenario.name)}</th>`).join('');
  const rows = semesterOrder.map((semester) => `<tr><th>${escapeHtml(semester.label)}</th>${goal.scenarios.map((scenario) => {
    const result = scenario.semesterResults.find((item) => (item.semesterId ?? item.label) === semester.key);
    return `<td>${fmt(result?.target)}</td>`;
  }).join('')}</tr>`).join('');
  const finalRow = `<tr class="print-scenario-final"><th>예상 최종 내신</th>${goal.scenarios.map((scenario) => `<td>${fmt(scenario.finalAverage)}</td>`).join('')}</tr>`;
  return `<table class="print-scenario-table"><thead><tr><th>학기</th>${header}</tr></thead><tbody>${rows}${finalRow}</tbody></table>`;
}

function subjectInterestRows(items = []) {
  return items.map((item) => {
    const useCut70 = numberOrNull(item.cut70Original) !== null || numberOrNull(item.cut70Converted) !== null;
    const cutLabel = useCut70 ? '70% cut' : '50% cut';
    const original = useCut70 ? item.cut70Original : item.cut50Original;
    const converted = useCut70 ? item.cut70Converted : item.cut50Converted;
    const difference = item.difference === null ? '-' : `${item.difference >= 0 ? '+' : ''}${fmt(item.difference)}`;
    return `<tr><td>${escapeHtml(item.university)}</td><td><strong>${escapeHtml(item.department)}</strong><span class="print-subline">${escapeHtml(item.admissionName)}</span></td><td>${item.referenceYear ?? '-'}</td><td><strong>${fmt(converted)}</strong><span class="print-subline">원본 ${fmt(original)} · ${cutLabel}</span></td><td>${escapeHtml(item.comparisonBasisLabel)} ${fmt(item.comparisonValue)}</td><td class="print-difference">${difference}</td></tr>`;
  }).join('');
}

function comprehensiveInterestRows(items = []) {
  return items.map((item) => `<tr><td>${escapeHtml(item.university)}</td><td><strong>${escapeHtml(item.department)}</strong><span class="print-subline">${escapeHtml(item.admissionName)}</span></td><td>${item.referenceYear ?? '-'}</td><td><strong>${fmt(item.referenceConverted)}</strong><span class="print-subline">원본 ${fmt(item.referenceOriginal)} · ${escapeHtml(item.referenceLabel)}</span></td></tr>`).join('');
}

function sourceNotes(model) {
  const seen = new Set();
  const items = [...model.interests.subject, ...model.interests.comprehensive].filter((item) => {
    if (!item.sourceUrl) return false;
    const key = `${item.university}|${item.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!items.length) return '';
  return `<p class="print-source-note"><strong>공식 출처</strong>${items.map((item) => `<a href="${escapeHtml(item.sourceUrl)}">${escapeHtml(item.university)} 공식 자료</a>`).join(' · ')}</p>`;
}

export function renderPrintReport(model) {
  const goal = model.goal;
  const subjects = model.subjects.items.length
    ? model.subjects.items.map((item) => `<tr><td>${escapeHtml(item.subjectGroup)}</td><td>${fmt(item.average)}</td></tr>`).join('')
    : `<tr><td colspan="2">${escapeHtml(model.subjects.message)}</td></tr>`;
  const goalResultHtml = goal?.noRemaining
    ? '<p>3학년 1학기까지 완료되어 남은 시뮬레이션 학기가 없습니다. 현재 내신과 목표 내신을 상담 참고값으로 확인하세요.</p>'
    : goal?.achievable
      ? scenarioHtml(goal)
      : `<p>현재 설정한 목표에는 도달하기 어렵습니다. 남은 모든 성적을 1등급으로 가정한 최고 도달 가능 내신은 <strong>${fmt(goal?.highestReachableAverage)}</strong>입니다.</p>`;
  const missingPastNotice = goal?.missingPastSemesters?.length
    ? `<p class="print-note">${escapeHtml(goal.missingPastSemesters.join(', '))} 성적이 비어 있어 현재 평균에서 제외했습니다. 이전 학기 성적을 확인해 주세요.</p>`
    : '';
  const goalHtml = goal
    ? `<div class="print-summary print-goal-summary"><div class="print-key-metric"><span>목표 내신</span><strong>${fmt(goal.targetAverage)}</strong></div><div class="print-key-metric"><span>필요한 남은 학기 평균</span><strong>${goal.noRemaining || !goal.achievable ? '-' : fmt(goal.requiredAverage)}</strong></div></div><p class="print-meta-row"><span>완료 학기: ${listText(goal.completedSemesters)}</span><span>남은 학기: ${listText(goal.remainingSemesters)}</span><span>계산 기준: ${escapeHtml(goal.calculationBasis)}</span></p>${missingPastNotice}${goalResultHtml}`
    : '<p>계산된 목표 내신 시뮬레이션이 없습니다.</p>';

  const appendix = model.courseAppendix.included
    ? `<section><h2>부록 · 과목별 상세 성적</h2><table><thead><tr><th>학기</th><th>과목</th><th>학점</th><th>등급/성취도</th><th>내신 반영</th></tr></thead><tbody>${model.courseAppendix.rows.map((row) => `<tr><td>${escapeHtml(row.semesterLabel)}</td><td>${escapeHtml(row.subjectName)}</td><td>${row.credit ?? '-'}</td><td>${row.gradeValue === null ? escapeHtml(row.achievement ?? '-') : fmt(row.gradeValue)}</td><td>${row.includedInGradeAverage ? '반영' : '미반영'}</td></tr>`).join('')}</tbody></table></section>`
    : '';

  const subjectInterestReport = model.interests.subject.length
    ? `<div class="print-interest-group"><h3>학생부교과</h3><table><thead><tr><th>대학</th><th>모집단위 · 전형</th><th>학년도</th><th>공개 입결<br>(5등급 참고 / 원본)</th><th>비교 기준</th><th>차이</th></tr></thead><tbody>${subjectInterestRows(model.interests.subject)}</tbody></table></div>`
    : '';
  const comprehensiveInterestReport = model.interests.comprehensive.length
    ? `<div class="print-interest-group"><h3>학생부종합</h3><table><thead><tr><th>대학</th><th>모집단위 · 전형</th><th>학년도</th><th>전년도 등록자 내신 참고<br>(5등급 참고 / 원본)</th></tr></thead><tbody>${comprehensiveInterestRows(model.interests.comprehensive)}</tbody></table></div>`
    : '';
  const interestReport = subjectInterestReport || comprehensiveInterestReport
    ? `${subjectInterestReport}${comprehensiveInterestReport}${sourceNotes(model)}`
    : '<p>저장된 관심 대학이 없습니다.</p>';
  const secondaryClass = subjectInterestReport || comprehensiveInterestReport
    ? 'print-sheet print-sheet-secondary print-sheet-secondary--has-interests'
    : 'print-sheet print-sheet-secondary';

  const subjectSection = model.quickConsult ? '' : `<section class="print-subject-section"><h2>교과별 요약</h2><table class="print-subject-table"><thead><tr><th>교과군</th><th>평균 등급</th></tr></thead><tbody>${subjects}</tbody></table></section>`;
  const reportDescription = model.reportDescription ? `<p class="print-report-description">${escapeHtml(model.reportDescription)}</p>` : '';
  const catalogBasis = model.current.catalogBasis ? `<span>과목 기준: ${escapeHtml(model.current.catalogBasis)}</span>` : '';
  return `<div class="print-page"><div class="print-sheet print-sheet-primary"><header class="print-report-header"><p>${escapeHtml(model.reportLabel || '학생 상담용 내신 요약 결과표')}</p><h1>${escapeHtml(model.title)}</h1>${reportDescription}</header><dl class="print-student"><div><dt>학번</dt><dd>${escapeHtml(model.student.studentId || '-')}</dd></div><div><dt>이름</dt><dd>${escapeHtml(model.student.studentName || '-')}</dd></div><div><dt>작성일</dt><dd>${escapeHtml(model.student.generatedAt)}</dd></div></dl><section class="print-current-section"><h2>현재 성적 요약</h2><div class="print-summary"><div class="print-key-metric"><span>현재 전체 내신</span><strong>${fmt(model.current.average)}</strong></div><div><span>입력 완료 학기</span><strong>${model.current.completedSemesterCount} / ${SEMESTERS.length}</strong></div><div><span>성적 입력</span><strong>${escapeHtml(model.current.inputStatus)}</strong></div></div><p class="print-meta-row"><span>계산 기준: ${escapeHtml(model.current.calculationBasis)}</span>${catalogBasis}<span>학점 정보: ${escapeHtml(model.current.creditSummary)}</span></p></section><section class="print-semester-section"><h2>학기별 성적 분석</h2><table class="print-semester-table"><thead><tr><th>학기</th><th>평균 등급</th><th>입력 상태</th></tr></thead><tbody>${semesterRows(model)}</tbody></table></section>${subjectSection}<section class="print-goal-section"><h2>목표 내신 시뮬레이션</h2>${goalHtml}</section></div><div class="${secondaryClass}"><section class="print-admission-section"><h2>관심 대학 전년도 입시결과 참고</h2>${interestReport}</section>${appendix}<section class="print-notice-section"><h2>안내</h2><div class="print-notice-grid"><p class="print-note">${escapeHtml(model.notices.conversion)}</p><p class="print-note">${escapeHtml(model.notices.comprehensive)}</p><p class="print-note">본 결과표는 성적 수치와 전년도 공개 자료를 확인하기 위한 상담 참고자료이며 대학 합격 가능성을 의미하지 않습니다.</p></div></section></div></div>`;
}

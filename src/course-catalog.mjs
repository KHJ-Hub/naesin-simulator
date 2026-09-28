/**
 * 학생용 과목 카탈로그. 2025·2026 입학생은 학교 공식 편성표를 각각 따른다.
 * 2027 입학생 편성표는 미확정이므로 이 모듈에 포함하지 않는다.
 */
export const COURSE_CATALOG_VERSION = 3;
export const ACTIVE_ENTRY_YEAR = 2026;
/** 공식 표에 있으나 학교 수정 중이라 학생용 과목 데이터로 등록하지 않은 연도다. */
export const UNCONFIRMED_ENTRY_YEARS = Object.freeze([2027]);

export const OFFICIAL_CURRICULUM_SOURCES = Object.freeze({
  2025: Object.freeze({ type: 'school-curriculum-plan', document: '2027학년도 교육과정 운영표 및 편성표 (260903)', sourceDate: '2026-09-03', section: '2025학년도 신입생 3개년 교육과정 편성표', status: 'confirmed' }),
  2026: Object.freeze({ type: 'school-curriculum-plan', document: '2027학년도 교육과정 운영표 및 편성표 (260903)', sourceDate: '2026-09-03', section: '2026학년도 신입생 3개년 교육과정 편성표', status: 'confirmed' }),
});

/** 안내·검증용 선택량이며 미래 학기 가중치에는 사용하지 않는다. */
export const ENTRY_YEAR_CATALOG_METADATA = Object.freeze({
  2025: Object.freeze({ source: OFFICIAL_CURRICULUM_SOURCES[2025], studentChoiceCredits: Object.freeze({ '2-1': 24, '2-2': 24, '3-1': 24, '3-2': 15 }) }),
  2026: Object.freeze({ source: OFFICIAL_CURRICULUM_SOURCES[2026], studentChoiceCredits: Object.freeze({ '2-1': 21, '2-2': 21, '3-1': 27, '3-2': 18 }) }),
});

const rules = {
  five: ['grade', true, false, 'none'], ae: ['achievement', false, true, 'a-e'], ac: ['achievement', false, true, 'a-c'], pass: ['passfail', false, false, 'pass'], both: ['both', true, false, 'a-e'],
  // 편성표에는 성적 처리 방식이 적히지 않은 신규 과목에만 사용한다. 값을 추정하지 않는다.
  unconfirmed: ['unconfirmed', false, false, 'unconfirmed'],
};
const make = (entryYear, id, subjectName, grade, semester, subjectGroup, credit, curriculumCategory, requirement = 'elective', rule = 'five', extra = {}) => {
  const [gradingType, fiveLevelEligible, achievementOnly, achievementScale] = rules[rule];
  return { id, entryYear, subjectName, grade, semester, semesterId: `${grade}-${semester}`, subjectGroup, credit, curriculumCategory, requirement, gradingType, fiveLevelEligible, achievementOnly, achievementScale, availability: requirement === 'elective' ? 'planned' : 'school-designated', classConditions: [], duplicateSelectionWarning: false, autoGenerate: false, source: OFFICIAL_CURRICULUM_SOURCES[entryYear], ...extra };
};
const designated = (entryYear, id, name, grade, semester, group, credit, category = 'common', rule = 'five', extra = {}) => make(entryYear, id, name, grade, semester, group, credit, category, 'school-designated', rule, extra);
const firstGrade = (entryYear, id, name, semester, group, credit, rule = 'five', extra = {}) => designated(entryYear, id, name, 1, semester, group, credit, 'common', rule, { autoGenerate: true, ...extra });
const elective = (entryYear, grade, semester, group, category, names, rule = 'five', extra = {}) => names.map((name) => make(entryYear, `${grade}-${semester}-${name}`, name, grade, semester, group, 3, category, 'elective', rule, extra));

const FIRST_GRADE_CORE = (entryYear) => [
  firstGrade(entryYear, 'common-korean-1', '공통국어1', 1, '국어', 4), firstGrade(entryYear, 'common-korean-2', '공통국어2', 2, '국어', 4),
  firstGrade(entryYear, 'common-math-1', '공통수학1', 1, '수학', 4), firstGrade(entryYear, 'common-math-2', '공통수학2', 2, '수학', 4),
  firstGrade(entryYear, 'common-english-1', '공통영어1', 1, '영어', 4), firstGrade(entryYear, 'common-english-2', '공통영어2', 2, '영어', 4),
  firstGrade(entryYear, 'history-1', '한국사1', 1, '사회', 3), firstGrade(entryYear, 'history-2', '한국사2', 2, '사회', 3),
  firstGrade(entryYear, 'social-1', '통합사회1', 1, '사회', 4), firstGrade(entryYear, 'social-2', '통합사회2', 2, '사회', 4),
  firstGrade(entryYear, 'science-1', '통합과학1', 1, '과학', 4), firstGrade(entryYear, 'science-2', '통합과학2', 2, '과학', 4),
  firstGrade(entryYear, 'lab-1', '과학탐구실험1', 1, '과학', 1, 'ac'), firstGrade(entryYear, 'lab-2', '과학탐구실험2', 2, '과학', 1, 'ac'),
  firstGrade(entryYear, 'pe-1', '체육1', 1, '체육', 2, 'ac'), firstGrade(entryYear, 'pe-2', '체육2', 2, '체육', 2, 'ac'),
];
const firstGradeClassCourses = (entryYear, firstClasses, secondClasses) => [
  firstGrade(entryYear, 'music-1', '음악', 1, '예술', 2, 'ac', { classConditions: firstClasses }), firstGrade(entryYear, 'music-2', '음악', 2, '예술', 2, 'ac', { classConditions: secondClasses }),
  firstGrade(entryYear, 'art-1', '미술', 1, '예술', 2, 'ac', { classConditions: secondClasses }), firstGrade(entryYear, 'art-2', '미술', 2, '예술', 2, 'ac', { classConditions: firstClasses }),
  firstGrade(entryYear, 'health-1', '보건', 1, '교양', 2, 'pass', { classConditions: firstClasses }), firstGrade(entryYear, 'health-2', '보건', 2, '교양', 2, 'pass', { classConditions: secondClasses }),
  firstGrade(entryYear, 'career-1', '진로와 직업', 1, '교양', 2, 'pass', { classConditions: secondClasses }), firstGrade(entryYear, 'career-2', '진로와 직업', 2, '교양', 2, 'pass', { classConditions: firstClasses }),
];

/**
 * 공식 편성표의 학생 자율 과목 풀. 표는 과목별 고정 학기를 지정하지 않고
 * 학기별 선택량만 정하므로, 상세입력에서는 각 상위 학기에서 선택 가능한 학교
 * 개설 과목으로 제공한다. 개인별 실제 이수는 학생이 직접 추가한 과목만 남는다.
 */
const UPPER_CHOICE_POOL = [
  ['국어', 'general', ['화법과 언어', '독서와 작문', '문학']],
  ['국어', 'career', ['주제 탐구 독서', '문학과 영상']],
  ['국어', 'fusion', ['독서 토론과 글쓰기', '매체 의사소통', '언어생활 탐구']],
  ['수학', 'general', ['대수', '미적분Ⅰ', '확률과 통계']],
  ['수학', 'career', ['기하', '미적분Ⅱ', '경제 수학', '인공지능 수학', '고급 미적분']],
  ['수학', 'fusion', ['수학과제 탐구']],
  ['영어', 'general', ['영어Ⅰ', '영어Ⅱ', '영어 독해와 작문']],
  ['영어', 'career', ['영미 문학 읽기', '영어 발표와 토론', '심화 영어']],
  ['영어', 'fusion', ['미디어 영어', '세계 문화와 영어']],
  ['사회', 'general', ['세계시민과 지리', '세계사', '사회와 문화', '현대사회와 윤리']],
  ['사회', 'career', ['한국지리 탐구', '정치', '법과 사회', '경제', '윤리와 사상', '국제 관계의 이해']],
  ['사회', 'fusion', ['여행지리', '사회문제 탐구', '금융과 경제생활', '윤리문제 탐구'], 'ae'],
  ['과학', 'general', ['물리학', '화학', '생명과학', '지구과학']],
  ['과학', 'career', ['역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계', '세포와 물질 대사', '생물의 유전', '지구시스템과학', '행성우주과학']],
  ['과학', 'fusion', ['과학의 역사와 문화', '기후변화와 환경생태', '융합과학 탐구'], 'ae'],
  ['제2외국어', 'career', ['심화 일본어', '일본어 회화']],
  ['기술·가정/정보', 'career', ['인공지능 기초']],
  ['기술·가정/정보', 'fusion', ['소프트웨어와 생활']],
];
const upperChoices = (entryYear, extraPool = []) => [2, 3].flatMap((grade) => [1, 2].flatMap((semester) => [...UPPER_CHOICE_POOL, ...extraPool].flatMap(([group, category, names, rule = 'five']) => elective(
  entryYear, grade, semester, group, category, names, rule, { selectionGroup: 'student-choice-pool', semesterAssignment: 'curriculum-choice-pool' },
))));
const researchCourses = (entryYear, schedule) => schedule.map(([id, name, grade, semester, credit]) => make(entryYear, id, name, grade, semester, '교양', credit, 'fusion', 'elective', 'five', { selectionGroup: 'research-elective' }));

const build2026 = () => {
  const firstClasses = ['1', '2', '3']; const secondClasses = ['4', '5', '6'];
  return [
    ...FIRST_GRADE_CORE(2026), ...firstGradeClassCourses(2026, firstClasses, secondClasses),
    designated(2026, 'sports-life-2', '스포츠 생활2', 2, 1, '체육', 2, 'fusion', 'ac'), designated(2026, 'sports-life-1', '스포츠 생활1', 2, 2, '체육', 2, 'fusion', 'ac'), designated(2026, 'sports-culture', '스포츠 문화', 3, 1, '체육', 2, 'career', 'ac'), designated(2026, 'sports-science', '스포츠 과학', 3, 2, '체육', 2, 'career', 'ac'), designated(2026, 'ecology', '생태와 환경', 3, 2, '교양', 2, 'general', 'pass'), designated(2026, 'psychology', '인간과 심리', 3, 2, '교양', 3, 'career', 'pass'),
    designated(2026, 'art-create-a', '미술 창작', 2, 1, '예술', 3, 'career', 'ac', { classConditions: firstClasses }), designated(2026, 'music-create-a', '음악 연주와 창작', 2, 1, '예술', 3, 'career', 'ac', { classConditions: secondClasses }), designated(2026, 'music-create-b', '음악 연주와 창작', 2, 2, '예술', 3, 'career', 'ac', { classConditions: firstClasses }), designated(2026, 'art-create-b', '미술 창작', 2, 2, '예술', 3, 'career', 'ac', { classConditions: secondClasses }),
    designated(2026, 'japanese-a', '일본어', 2, 1, '제2외국어', 4, 'general', 'five', { classConditions: firstClasses, selectionGroup: 'second-language' }), designated(2026, 'chinese-a', '중국어', 2, 1, '제2외국어', 4, 'general', 'five', { classConditions: firstClasses, selectionGroup: 'second-language' }), designated(2026, 'japanese-b', '일본어', 2, 2, '제2외국어', 4, 'general', 'five', { classConditions: secondClasses, selectionGroup: 'second-language' }), designated(2026, 'chinese-b', '중국어', 2, 2, '제2외국어', 4, 'general', 'five', { classConditions: secondClasses, selectionGroup: 'second-language' }), designated(2026, 'info-a', '정보', 2, 1, '정보', 4, 'general', 'five', { classConditions: secondClasses }), designated(2026, 'info-b', '정보', 2, 2, '정보', 4, 'general', 'five', { classConditions: firstClasses }),
    ...upperChoices(2026), ...researchCourses(2026, [['research-basic', '주제 탐구(R&E) 기초', 1, 1, 1], ['research-advanced', '주제 탐구(R&E) 심화', 1, 2, 1], ['research-project-1', '탐구 프로젝트(R&E) Ⅰ', 2, 1, 2], ['research-project-2', '탐구 프로젝트(R&E) Ⅱ', 2, 2, 2], ['research-question', '질문 기반 주제 탐구', 3, 1, 2]]),
  ];
};
const build2025 = () => {
  const firstClasses = ['1', '2', '3', '4']; const secondClasses = ['5', '6', '7'];
  return [
    ...FIRST_GRADE_CORE(2025), ...firstGradeClassCourses(2025, firstClasses, secondClasses),
    designated(2025, 'sports-culture', '스포츠 문화', 2, 1, '체육', 1, 'career', 'ac'), designated(2025, 'sports-science', '스포츠 과학', 2, 2, '체육', 1, 'career', 'ac'), designated(2025, 'sports-life-1', '스포츠 생활1', 3, 1, '체육', 3, 'fusion', 'ac'), designated(2025, 'sports-life-2', '스포츠 생활2', 3, 2, '체육', 2, 'fusion', 'ac'),
    designated(2025, 'music-appreciation', '음악 감상과 비평', 3, 1, '예술', 2, 'career', 'unconfirmed', { gradingSource: 'curriculum-plan-unconfirmed' }), designated(2025, 'music-culture', '음악과 문화', 3, 2, '예술', 2, 'career', 'unconfirmed', { gradingSource: 'curriculum-plan-unconfirmed' }),
    designated(2025, 'ecology', '생태와 환경', 3, 2, '교양', 3, 'general', 'pass'), designated(2025, 'psychology', '인간과 심리', 3, 2, '교양', 3, 'career', 'pass'),
    designated(2025, 'art-create-a', '미술 창작', 2, 1, '예술', 2, 'career', 'ac', { classConditions: firstClasses }), designated(2025, 'music-create-a', '음악 연주와 창작', 2, 1, '예술', 2, 'career', 'ac', { classConditions: secondClasses }), designated(2025, 'music-create-b', '음악 연주와 창작', 2, 2, '예술', 2, 'career', 'ac', { classConditions: firstClasses }), designated(2025, 'art-create-b', '미술 창작', 2, 2, '예술', 2, 'career', 'ac', { classConditions: secondClasses }),
    designated(2025, 'japanese-a', '일본어', 2, 1, '제2외국어', 3, 'general', 'five', { classConditions: firstClasses, selectionGroup: 'second-language' }), designated(2025, 'chinese-a', '중국어', 2, 1, '제2외국어', 3, 'general', 'five', { classConditions: firstClasses, selectionGroup: 'second-language' }), designated(2025, 'japanese-b', '일본어', 2, 2, '제2외국어', 3, 'general', 'five', { classConditions: secondClasses, selectionGroup: 'second-language' }), designated(2025, 'chinese-b', '중국어', 2, 2, '제2외국어', 3, 'general', 'five', { classConditions: secondClasses, selectionGroup: 'second-language' }), designated(2025, 'info-a', '정보', 2, 1, '정보', 3, 'general', 'five', { classConditions: secondClasses }), designated(2025, 'info-b', '정보', 2, 2, '정보', 3, 'general', 'five', { classConditions: firstClasses }),
    ...upperChoices(2025, [['체육', 'career', ['운동과 건강', '스포츠 경기 체력']]]), ...researchCourses(2025, [['research-basic', '주제 탐구(R&E) 기초', 2, 1, 1], ['research-advanced', '주제 탐구(R&E) 심화', 2, 2, 1], ['research-question', '질문 기반 주제 탐구', 3, 1, 2]]),
  ];
};

export const SCHOOL_COURSES = [...build2025(), ...build2026()].map((item, displayOrder) => ({ ...item, active: item.active !== false, enabled: item.enabled !== false, displayOrder, duplicateSelectionWarning: item.requirement === 'elective' })).sort((a, b) => a.displayOrder - b.displayOrder);

export const coursesForSemester = (semesterId, entryYear = ACTIVE_ENTRY_YEAR) => SCHOOL_COURSES.filter((course) => course.entryYear === entryYear && course.semesterId === semesterId);
export const commonCourses = (entryYear = ACTIVE_ENTRY_YEAR, classNumber = null) => SCHOOL_COURSES.filter((course) => course.entryYear === entryYear && course.autoGenerate && (!course.classConditions.length || course.classConditions.includes(String(classNumber))));
export const courseById = (id, entryYear = null) => SCHOOL_COURSES.find((course) => course.id === id && (entryYear === null || course.entryYear === Number(entryYear))) ?? null;
export const gradingInputs = (gradingType) => ({ grade: ['grade', 'both'].includes(gradingType), achievement: ['achievement', 'both'].includes(gradingType), passfail: gradingType === 'passfail' });
export const recordFromCourse = (course, id) => ({ id, courseId: course.id, entryYear: course.entryYear, semesterId: course.semesterId, subjectName: course.subjectName, subjectGroup: course.subjectGroup, credit: course.credit, gradingType: course.gradingType, fiveLevelEligible: course.fiveLevelEligible, achievementOnly: course.achievementOnly, achievementScale: course.achievementScale, requirement: course.requirement, selectionGroup: course.selectionGroup ?? null, gradeValue: '', achievement: '' });

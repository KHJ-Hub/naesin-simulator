import { ACTIVE_ENTRY_YEAR } from './course-catalog.mjs?v=20260914-grading-types2';
import { catalogCourses, upsertCatalogCourse, disableCatalogCourse, resetCatalogOverrides, sortCoursesForDisplay } from './course-catalog-store.mjs?v=20260914-teacher-store2';

const $ = (selector) => document.querySelector(selector);
let courses = catalogCourses();
let editingId = null;
let statusFilter = 'all';
const openSemesters = new Set();
const filters = { year: String(ACTIVE_ENTRY_YEAR) };
const makeId = () => `course-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isActive = (course) => course.active !== false && course.enabled !== false;
const requirementLabel = (value) => ({ common: '공통', elective: '선택', 'school-designated': '학교 지정' }[value] ?? '선택');
const gradingLabel = (value) => ({ grade: '등급 산출', achievement: '성취도', both: '등급+성취도' }[value] ?? '성적 처리');
function toast(message) { $('#teacher-toast').textContent = message; clearTimeout(toast.timer); toast.timer = setTimeout(() => { $('#teacher-toast').textContent = ''; }, 2400); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
function semesterKey(grade, semester) { return `${grade}-${semester}`; }
function yearCourses() { return courses.filter((course) => String(course.entryYear) === filters.year); }
function matchesStatus(course) { return statusFilter === 'all' || (statusFilter === 'active' ? isActive(course) : !isActive(course)); }
function renderFilters() {
  const years = [...new Set([ACTIVE_ENTRY_YEAR, ...courses.map((course) => Number(course.entryYear))])].sort((a, b) => a - b);
  $('#filter-year').innerHTML = years.map((year) => `<option value="${year}">${year}학년도 입학생</option>`).join('');
  $('#filter-year').value = filters.year;
  document.querySelectorAll('[data-status-filter]').forEach((button) => button.classList.toggle('is-selected', button.dataset.statusFilter === statusFilter));
}
function courseCard(course) {
  const active = isActive(course);
  return `<article class="teacher-course-card ${active ? '' : 'is-inactive'}"><div class="teacher-course-main"><strong>${escapeHtml(course.subjectName)}</strong><div class="teacher-course-meta"><span>${escapeHtml(course.subjectGroup)}</span><span>${course.credit}학점</span><span>${gradingLabel(course.gradingType)}</span><span>${requirementLabel(course.requirement)}</span></div><small>${active ? '학생 화면에 표시됨' : '학생 화면에 표시되지 않음'}</small></div><div class="teacher-course-actions"><span class="status-chip ${active ? '' : 'is-off'}">${active ? '개설 ON' : '개설 OFF'}</span><button class="quiet-button" data-edit="${escapeHtml(course.id)}">수정</button><button class="quiet-button" data-disable="${escapeHtml(course.id)}">${active ? '비활성화' : '활성화'}</button></div></article>`;
}
function renderBrowser() {
  const all = yearCourses();
  const visible = all.filter(matchesStatus);
  $('#course-count').textContent = `${all.length}개 과목 · 개설 ${all.filter(isActive).length}개 · 미개설 ${all.filter((course) => !isActive(course)).length}개`;
  const gradeSections = [1, 2, 3].map((grade) => {
    const gradeCourses = all.filter((course) => Number(course.grade) === grade);
    if (!gradeCourses.length) return '';
    const semesterSections = [1, 2].map((semester) => {
      const semesterCourses = gradeCourses.filter((course) => Number(course.semester) === semester);
      if (!semesterCourses.length) return '';
      const semesterVisible = semesterCourses.filter(matchesStatus);
      const activeCount = semesterCourses.filter(isActive).length;
      const inactiveCount = semesterCourses.length - activeCount;
      const key = semesterKey(grade, semester);
      const body = semesterVisible.length ? sortCoursesForDisplay(semesterVisible).map(courseCard).join('') : '<p class="empty-state">현재 필터에 맞는 과목이 없습니다.</p>';
      return `<details class="teacher-semester" data-semester="${key}" ${openSemesters.has(key) ? 'open' : ''}><summary><span>${grade}학년 ${semester}학기</span><em>${semesterCourses.length}개 과목</em><small>개설 ${activeCount} · 미개설 ${inactiveCount}</small></summary><div class="teacher-semester-toolbar"><span class="muted">${semesterCourses.length}개 과목 관리</span><button class="quiet-button" data-add-grade="${grade}" data-add-semester="${semester}">+ 이 학기에 과목 추가</button></div><div class="teacher-course-list">${body}</div></details>`;
    }).join('');
    return semesterSections ? `<section class="teacher-grade-section"><h3>${grade}학년</h3>${semesterSections}</section>` : '';
  }).join('');
  $('#course-browser').innerHTML = gradeSections || '<p class="empty-state">선택한 입학생 연도에 등록된 과목이 없습니다.</p>';
}
function openEditor(course = null, context = {}) {
  editingId = course?.id ?? null;
  $('#editor-title').textContent = course ? '과목 수정' : '과목 추가';
  $('#course-id').value = course?.id ?? '';
  $('#course-year').value = course?.entryYear ?? filters.year;
  $('#course-grade').value = course?.grade ?? context.grade ?? '1';
  $('#course-semester').value = course?.semester ?? context.semester ?? '1';
  $('#course-name').value = course?.subjectName ?? '';
  $('#course-group').value = course?.subjectGroup ?? '';
  $('#course-credit').value = course?.credit ?? 3;
  $('#course-grading').value = course?.gradingType ?? 'grade';
  $('#course-requirement').value = course?.requirement ?? 'elective';
  $('#course-order').value = course?.displayOrder ?? courses.length;
  $('#course-active').checked = course?.active !== false;
  $('#course-enabled').checked = course?.enabled !== false;
  $('#course-editor').hidden = false;
  $('#course-name').focus();
}
function closeEditor() { editingId = null; $('#course-editor').hidden = true; }
function formCourse() {
  const grade = Number($('#course-grade').value); const semester = Number($('#course-semester').value); const gradingType = $('#course-grading').value;
  return { id: editingId || makeId(), entryYear: Number($('#course-year').value), grade, semester, semesterId: `${grade}-${semester}`, subjectName: $('#course-name').value.trim(), subjectGroup: $('#course-group').value.trim(), credit: Number($('#course-credit').value), gradingType, fiveLevelEligible: ['grade','both'].includes(gradingType), achievementOnly: gradingType === 'achievement', achievementScale: gradingType === 'grade' ? 'none' : 'a-e', curriculumCategory: 'teacher-managed', requirement: $('#course-requirement').value, availability: 'teacher-managed', classConditions: [], autoGenerate: $('#course-requirement').value === 'common' && grade === 1, active: $('#course-active').checked, enabled: $('#course-enabled').checked, displayOrder: Number($('#course-order').value), duplicateSelectionWarning: false };
}
renderFilters(); renderBrowser();
$('#filter-year').addEventListener('change', (event) => { filters.year = event.target.value; openSemesters.clear(); renderBrowser(); });
document.querySelector('.teacher-status-filter').addEventListener('click', (event) => { const button = event.target.closest('[data-status-filter]'); if (!button) return; statusFilter = button.dataset.statusFilter; renderFilters(); renderBrowser(); });
$('#course-browser').addEventListener('toggle', (event) => { const details = event.target.closest('[data-semester]'); if (!details) return; if (details.open) openSemesters.add(details.dataset.semester); else openSemesters.delete(details.dataset.semester); }, true);
$('#course-browser').addEventListener('click', (event) => {
  const editId = event.target.dataset.edit; const disableId = event.target.dataset.disable; const addGrade = event.target.dataset.addGrade;
  if (editId) { openEditor(courses.find((course) => course.id === editId)); return; }
  if (addGrade) { const key = semesterKey(addGrade, event.target.dataset.addSemester); openSemesters.add(key); openEditor(null, { grade: addGrade, semester: event.target.dataset.addSemester }); return; }
  if (disableId) { const course = courses.find((item) => item.id === disableId); courses = course && !isActive(course) ? upsertCatalogCourse({ ...course, active: true, enabled: true }) : disableCatalogCourse(disableId); renderFilters(); renderBrowser(); toast(`${course?.subjectName ?? '과목'} 개설 상태를 변경했습니다.`); }
});
$('#add-course').addEventListener('click', () => openEditor());
$('#course-form').addEventListener('submit', (event) => { event.preventDefault(); const course = formCourse(); if (!course.subjectName || !course.subjectGroup || !course.entryYear || !course.credit) { toast('과목명·교과군·학점·연도를 확인해 주세요.'); return; } openSemesters.add(semesterKey(course.grade, course.semester)); courses = upsertCatalogCourse(course); filters.year = String(course.entryYear); renderFilters(); renderBrowser(); closeEditor(); toast('과목 정보를 저장했습니다.'); });
$('#reset-catalog').addEventListener('click', () => { if (!confirm('선생님이 저장한 과목 변경을 모두 지우고 기본 카탈로그로 되돌릴까요?')) return; courses = resetCatalogOverrides(); openSemesters.clear(); renderFilters(); renderBrowser(); toast('기본 카탈로그로 되돌렸습니다.'); });
$('#cancel-edit').addEventListener('click', closeEditor); $('#cancel-edit-bottom').addEventListener('click', closeEditor);

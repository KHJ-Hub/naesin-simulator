import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAX_ADMISSION_INTEREST_COMPARISONS,
  buildAdmissionInterestComparison,
  reconcileAdmissionInterestComparisonSelection,
} from '../src/admission-interest-comparison.mjs';
import { admissionInterestKey } from '../src/admission-reference-store.mjs';

const subject = (overrides = {}) => ({
  referenceYear: 2026,
  universityId: 'pusan-national',
  university: '부산대학교',
  department: '경제학부',
  admissionName: '학생부교과전형',
  admissionCategory: '학생부교과',
  cut50Original: 2.7,
  cut70Original: 3,
  cut50Converted: 1.68,
  cut70Converted: 1.84,
  comparisonReferenceType: 'cut70',
  ...overrides,
});

const comprehensive = (overrides = {}) => ({
  referenceYear: 2026,
  universityId: 'dong-a',
  university: '동아대학교',
  department: '경영학과',
  admissionName: '잠재능력우수자',
  admissionCategory: '학생부종합',
  averageGradeOriginal: 3.4,
  averageGradeConverted: 2.05,
  comparisonReferenceType: 'average-grade',
  ...overrides,
});

test('관심 대학 비교는 최대 3개만 선택하고 삭제된 항목을 즉시 제외한다', () => {
  const interests = [
    subject(),
    subject({ university: '국립부경대학교', universityId: 'pukyong-national', department: '경제학과' }),
    subject({ university: '세종대학교', universityId: 'sejong', department: '경제학과' }),
    comprehensive(),
  ];
  const keys = interests.map(admissionInterestKey);
  assert.equal(MAX_ADMISSION_INTEREST_COMPARISONS, 3);
  assert.deepEqual(reconcileAdmissionInterestComparisonSelection(interests, keys), keys.slice(0, 3));
  assert.deepEqual(reconcileAdmissionInterestComparisonSelection(interests.slice(1), keys), keys.slice(1, 4));
});

test('교과 비교는 원본·환산 cut을 구분하고 현재·목표 차이를 기존 함수 기준으로 계산한다', () => {
  const model = buildAdmissionInterestComparison([
    subject(),
    subject({ university: '국립부경대학교', universityId: 'pukyong-national', department: '경제학과', cut70Converted: 2.2 }),
  ], { currentGrade: 2, targetGrade: 1.8 });
  assert.equal(model.canCompare, true);
  assert.equal(model.subject.length, 2);
  assert.equal(model.comprehensive.length, 0);
  assert.equal(model.subject[0].cut50Original, 2.7);
  assert.equal(model.subject[0].cut70Original, 3);
  assert.equal(model.subject[0].ownershipLabel, '국립');
  assert.equal(model.subject[1].currentDifference, 0.2);
  assert.equal(model.subject[1].targetDifference, 0.4);
});

test('학종은 평균등급을 cut으로 바꾸지 않고 별도 참고 그룹에 둔다', () => {
  const model = buildAdmissionInterestComparison([
    comprehensive(),
    comprehensive({ university: '부산대학교', universityId: 'pusan-national', department: '사회학과' }),
  ], { currentGrade: 2, targetGrade: 1.8 });
  assert.equal(model.subject.length, 0);
  assert.equal(model.comprehensive.length, 2);
  assert.equal(model.comprehensive[0].primaryReference.kind, 'average');
  assert.equal(model.comprehensive[0].cut50Original, null);
  assert.equal(model.comprehensive[0].cut70Original, null);
  assert.equal(model.comprehensive[0].averageGradeOriginal, 3.4);
});

test('교과와 학종 혼합 선택은 같은 표에 섞지 않고 두 그룹으로 분리한다', () => {
  const model = buildAdmissionInterestComparison([subject(), comprehensive()], { currentGrade: 2 });
  assert.equal(model.mixed, true);
  assert.equal(model.subject.length, 1);
  assert.equal(model.comprehensive.length, 1);
});

test('학생 UI는 관심 대학 2개부터 비교 버튼을 만들고 선택·삭제를 위임 처리한다', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /interests\.length >= MIN_ADMISSION_INTEREST_COMPARISONS[\s\S]*?관심 대학 비교하기/);
  assert.match(app, /data-admission-interest-compare-select/);
  assert.match(app, /admissionInterestComparisonSelection\.size >= MAX_ADMISSION_INTEREST_COMPARISONS/);
  assert.match(app, /renderAdmissionInterestComparisonTable\(comparison\.subject, 'subject'\)[\s\S]*?renderAdmissionInterestComparisonTable\(comparison\.comprehensive, 'comprehensive'\)/);
  assert.match(app, /updateAdmissionInterest\(removeButton\.dataset\.admissionRemove, 'remove'\)/);
  assert.match(styles, /\.interest-compare-table-scroll[\s\S]*?overflow-x:\s*auto/);
  assert.match(styles, /\.interest-compare-entry\s*\{[\s\S]*?margin:\s*18px 0 10px/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.interest-compare-table/);
});

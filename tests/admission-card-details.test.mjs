import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdmissionCardDetailItems, renderAdmissionCardDetails } from '../src/admission-card-details.mjs';

const baseRecord = {
  referenceYear: 2026,
  university: '검증대학교',
  department: '컴퓨터공학과',
  admissionName: '일반전형',
  admissionCategory: '학생부교과',
  cut70Original: 3.2,
  cut70Converted: 1.98,
  eligibilityType: 'general',
  source: '대입정보포털 어디가',
  sourceUrl: 'https://example.edu/result',
};

test('기본 카드 정보 외 상세 데이터가 없으면 세부 정보 DOM을 만들지 않는다', () => {
  assert.deepEqual(getAdmissionCardDetailItems(baseRecord), []);
  const html = renderAdmissionCardDetails(baseRecord);
  assert.equal(html, '');
  assert.doesNotMatch(html, /<details|세부 정보/);
});

test('상세 데이터가 하나라도 있으면 닫힌 세부 정보 아코디언을 만든다', () => {
  const html = renderAdmissionCardDetails({ ...baseRecord, recruitmentCount: 24 });
  assert.match(html, /^<details class="admission-card-details">/);
  assert.match(html, /<summary>세부 정보<\/summary>/);
  assert.match(html, /모집인원 <b>24명<\/b>/);
  assert.doesNotMatch(html, /<details[^>]*\sopen/);
});

test('교과의 50% cut이 있으면 원본과 환산값을 실제 상세정보로 표시한다', () => {
  const items = getAdmissionCardDetailItems({ ...baseRecord, cut50Original: 2.91, cut50Converted: 1.79 });
  assert.equal(items.some((item) => item.key === 'cut50-original' && item.value === 2.91), true);
  assert.equal(items.some((item) => item.key === 'cut50-converted' && item.value === 1.79), true);
  assert.match(renderAdmissionCardDetails({ ...baseRecord, cut50Original: 2.91 }), /50% cut 원본/);
});

test('학종 평균등급은 cut으로 바꾸지 않고 평균등급 상세정보로 표시한다', () => {
  const record = {
    ...baseRecord,
    admissionCategory: '학생부종합',
    averageGradeOriginal: 3.41,
    averageGradeConverted: 2.06,
  };
  const items = getAdmissionCardDetailItems(record);
  assert.equal(items.some((item) => item.key === 'average-original' && item.label === '평균등급 원본'), true);
  assert.equal(items.some((item) => item.key === 'cut50-original'), false);
  assert.match(renderAdmissionCardDetails(record), /평균등급 환산 참고/);
});

test('지원자격과 지역인재 설명이 있으면 세부 정보에 포함한다', () => {
  const html = renderAdmissionCardDetails({
    ...baseRecord,
    eligibilityType: 'regional',
    regionalEligibility: {
      requirementSummary: '부산·울산·경남 소재 고교 전 교육과정 이수자',
      eligibleSchoolRegions: ['부산', '울산', '경남'],
      verified: true,
    },
  });
  assert.match(html, /지원자격 유형/);
  assert.match(html, /지역인재 지원자격/);
  assert.match(html, /부산·울산·경남/);
});

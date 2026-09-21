import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getAdmissionCardDetailItems,
  getOfficialAdigaUrl,
  hasMeaningfulDetails,
  hasMeaningfulValue,
  renderAdmissionCardDetails,
  renderAdmissionCardSupplement,
} from '../src/admission-card-details.mjs';

const app = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

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
  assert.equal(hasMeaningfulDetails(baseRecord), false);
  assert.deepEqual(getAdmissionCardDetailItems(baseRecord), []);
  const html = renderAdmissionCardDetails(baseRecord);
  assert.equal(html, '');
  assert.doesNotMatch(html, /data-admission-card-details-toggle|세부 정보/);
});

test('상세 데이터가 하나라도 있으면 접근 가능한 닫힌 세부 정보 버튼을 만든다', () => {
  assert.equal(hasMeaningfulDetails({ ...baseRecord, recruitmentCount: 24 }), true);
  const html = renderAdmissionCardDetails({ ...baseRecord, recruitmentCount: 24 });
  assert.match(html, /^<div class="admission-card-details">/);
  assert.match(html, /<button type="button" class="admission-card-details-toggle" data-admission-card-details-toggle aria-expanded="false">/);
  assert.match(html, /<span class="admission-card-details-icon" aria-hidden="true">▶<\/span>/);
  assert.match(html, /<div class="admission-card-details-body" hidden>/);
  assert.match(html, /모집인원 <b>24명<\/b>/);
});

test('모집인원·경쟁률·50% cut·평균등급은 각각 단독으로도 실제 상세정보다', () => {
  const cases = [
    { recruitmentCount: 1 },
    { competitionRate: 1.25 },
    { cut50Original: 2.5 },
    { averageGradeOriginal: 2.7 },
  ];
  cases.forEach((detail) => {
    assert.equal(hasMeaningfulDetails({ ...baseRecord, ...detail }), true);
    assert.match(renderAdmissionCardDetails({ ...baseRecord, ...detail }), /data-admission-card-details-toggle/);
  });
});

test('null·undefined·공백·빈 배열·빈 객체는 상세정보로 오인하지 않는다', () => {
  const emptyValues = [null, undefined, '', '   ', [], {}];
  emptyValues.forEach((value) => assert.equal(hasMeaningfulValue(value), false));
  const record = {
    ...baseRecord,
    recruitmentCount: [],
    competitionRate: {},
    cut50Original: '   ',
    cut50Converted: [],
    averageGradeOriginal: {},
    averageGradeConverted: '',
    additionalAdmissionInfo: {},
    eligibilityDescription: [],
    regionalEligibility: {
      requirementSummary: '   ',
      eligibleSchoolRegions: [],
      additionalRequirements: {},
    },
  };
  assert.equal(hasMeaningfulDetails(record), false);
  assert.deepEqual(getAdmissionCardDetailItems(record), []);
  assert.equal(renderAdmissionCardDetails(record), '');
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

test('추가 상세정보가 없고 대학 메타데이터에 공식 어디가 URL이 있으면 링크만 표시한다', () => {
  const item = {
    ...baseRecord,
    universityInfo: {
      adigaUrl: 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?unvCd=0000014',
    },
  };
  assert.equal(hasMeaningfulDetails(item), false);
  assert.match(getOfficialAdigaUrl(item), /^https:\/\/www\.adiga\.kr\//);
  const html = renderAdmissionCardSupplement(item);
  assert.doesNotMatch(html, /data-admission-card-details-toggle|세부 정보/);
  assert.match(html, /대학어디가에서 자세히 보기/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('실제 상세정보가 있으면 어디가 링크 대신 작동 가능한 세부정보 아코디언을 표시한다', () => {
  const html = renderAdmissionCardSupplement({
    ...baseRecord,
    recruitmentCount: 24,
    universityInfo: { adigaUrl: 'https://www.adiga.kr/detail' },
  });
  assert.match(html, /<button type="button" class="admission-card-details-toggle" data-admission-card-details-toggle aria-expanded="false">/);
  assert.match(html, /<div class="admission-card-details-body" hidden>/);
  assert.doesNotMatch(html, /대학어디가에서 자세히 보기/);
});

test('세부정보와 확인된 대학어디가 URL이 모두 없으면 카드 하단 컨트롤을 만들지 않는다', () => {
  assert.equal(renderAdmissionCardSupplement(baseRecord), '');
  assert.equal(renderAdmissionCardSupplement({ ...baseRecord, universityInfo: { adigaUrl: '' } }), '');
  assert.equal(renderAdmissionCardSupplement({ ...baseRecord, universityInfo: { adigaUrl: 'https://example.com/university' } }), '');
});

test('세부정보 출처 링크는 안전한 웹 URL에만 생성하고 새 탭 보호 속성을 사용한다', () => {
  const safe = renderAdmissionCardDetails({ ...baseRecord, recruitmentCount: 1, sourceUrl: 'https://example.edu/result' });
  assert.match(safe, /target="_blank" rel="noopener noreferrer"/);
  const unsafe = renderAdmissionCardDetails({ ...baseRecord, recruitmentCount: 1, sourceUrl: 'javascript:alert(1)' });
  assert.doesNotMatch(unsafe, /href="javascript:/);
});

test('세부정보 버튼 클릭은 결과 컨테이너 위임으로 펼침 상태·화살표·aria-expanded를 함께 바꾼다', () => {
  assert.match(app, /event\.target\.matches\?\.\('\[data-admission-university-accordion\]'\)/);
  assert.match(app, /#admission-reference-result'[\s\S]*?closest\('\[data-admission-card-details-toggle\]'\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?aria-expanded[\s\S]*?body\.hidden = !isExpanded[\s\S]*?isExpanded \? '▼' : '▶'/);
  assert.doesNotMatch(app, /closest\('\.admission-card-details > summary'\)/);
});

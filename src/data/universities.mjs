/**
 * 대학 기본정보. 입시결과 행에는 대학명과 URL을 반복 저장하지 않는다.
 * 확인되지 않은 공식 홈페이지·입학처 주소는 추측하지 않고 null로 둔다.
 */
export const UNIVERSITIES = Object.freeze([
  ['pusan-national', '부산대학교', '부산광역시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000014'],
  ['pukyong-national', '국립부경대학교', '부산광역시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000013'],
  ['dong-eui', '동의대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000107'],
  ['dong-a', '동아대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000105'],
  ['busan-catholic', '부산가톨릭대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000114'],
  ['kosin', '고신대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000071'],
  ['ulsan', '울산대학교', '울산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000158'],
  ['gyeongsang-national', '경상국립대학교', '경상남도', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000007'],
  ['changwon-national', '국립창원대학교', '경상남도', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000028'],
  ['inje', '인제대학교', '경상남도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000164'],
  ['kyungnam', '경남대학교', '경상남도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000059'],
].map(([universityId, name, region, establishmentType, adigaUrl]) => ({
  universityId, name, region, establishmentType,
  homepageUrl: null, admissionsUrl: null, adigaUrl,
})));

export const UNIVERSITY_BY_ID = Object.freeze(Object.fromEntries(UNIVERSITIES.map((item) => [item.universityId, item])));
export const UNIVERSITY_BY_NAME = Object.freeze(Object.fromEntries(UNIVERSITIES.map((item) => [item.name, item])));


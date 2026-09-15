import { universities2026Seoul } from './university-regions/2026/seoul.mjs';
import { universities2026Gyeonggi } from './university-regions/2026/gyeonggi.mjs';
import { universities2026Incheon } from './university-regions/2026/incheon.mjs';
import { universities2026Busan } from './university-regions/2026/busan.mjs';
import { universities2026Ulsan } from './university-regions/2026/ulsan.mjs';

/**
 * 대학 기본정보. 입시결과 행에는 대학명과 URL을 반복 저장하지 않는다.
 * 확인되지 않은 공식 홈페이지·입학처 주소는 추측하지 않고 null로 둔다.
 */
const LEGACY_UNIVERSITIES = [
  ['pusan-national', '부산대학교', '부산광역시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000014'],
  ['pukyong-national', '국립부경대학교', '부산광역시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000013'],
  ['dong-eui', '동의대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000107'],
  ['dong-a', '동아대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000105'],
  ['busan-catholic', '부산가톨릭대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000114'],
  ['kosin', '고신대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000071'],
  ['silla', '신라대학교', '부산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000144'],
  ['ulsan', '울산대학교', '울산광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000158'],
  ['gyeongsang-national', '경상국립대학교', '경상남도', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000007'],
  ['changwon-national', '국립창원대학교', '경상남도', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000028'],
  ['inje', '인제대학교', '경상남도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000164'],
  ['kyungnam', '경남대학교', '경상남도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000059'],
  ['incheon-national', '인천대학교', '인천광역시', '국립대법인', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0002660'],
  ['gachon', '가천대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000063'],
  // 서울·경기·인천 대학 기본정보(입결 확보 여부와 별도 관리)
  ['methodist-theological', '감리교신학대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000050'],
  ['gangseo', '강서대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000079'],
  ['konkuk', '건국대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000052'],
  ['kyunghee', '경희대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000066'],
  ['korea', '고려대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000069'],
  ['kwangwoon', '광운대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000074'],
  ['kookmin', '국민대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000078'],
  ['duk-sung', '덕성여자대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000099'],
  ['dongguk', '동국대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000100'],
  ['dongduk', '동덕여자대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000102'],
  ['myongji', '명지대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000109'],
  ['sahmyook', '삼육대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000116'],
  ['sangmyung', '상명대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000117'],
  ['sogang', '서강대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000120'],
  ['seokyeong', '서경대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000121'],
  ['seoultech', '서울과학기술대학교', '서울특별시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000036'],
  ['snue', '서울교육대학교', '서울특별시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000255'],
  ['scu', '서울기독대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000098'],
  ['snu', '서울대학교', '서울특별시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000019'],
  ['uos', '서울시립대학교', '서울특별시', '공립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000040'],
  ['swu', '서울여자대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000126'],
  ['seoul-han-young', '서울한영대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000205'],
  ['sungconghoe', '성공회대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000132'],
  ['sungkyunkwan', '성균관대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000133'],
  ['sungshin', '성신여자대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000136'],
  ['sejong', '세종대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000138'],
  ['sookmyung', '숙명여자대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000141'],
  ['soongsil', '숭실대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000143'],
  ['yonsei', '연세대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000149'],
  ['ewha', '이화여자대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000163'],
  ['presbyterian', '장로회신학대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000170'],
  ['chungang', '중앙대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000175'],
  ['chongshin', '총신대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000180'],
  ['chugye', '추계예술대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000181'],
  ['korean-bible', '한국성서대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000191'],
  ['hufs', '한국외국어대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000192'],
  ['knsu', '한국체육대학교', '서울특별시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000032'],
  ['hansung', '한성대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000200'],
  ['hanyang', '한양대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000203'],
  ['hongik', '홍익대학교', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000212'],
  ['gangnam', '강남대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000051'],
  ['kyonggi', '경기대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000056'],
  ['dae-jin', '대진대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000097'],
  ['luther', '루터대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000108'],
  ['myongji-yongin', '명지대학교(제2캠퍼스)', '서울특별시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000111'],
  ['seoul-theological', '서울신학대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000125'],
  ['seoul-jangsin', '서울장신대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000127'],
  ['sungkyul', '성결대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000131'],
  ['suwon-catholic', '수원가톨릭대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000139'],
  ['suwon', '수원대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000140'],
  ['shinhan', '신한대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0002712'],
  ['ashin', '아신대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000145'],
  ['ajou', '아주대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000146'],
  ['anyang', '안양대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000147'],
  ['yongin', '용인대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000156'],
  ['eulji', '을지대학교', '대전광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000161'],
  ['cha', '차의과학대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000187'],
  ['calvin', '칼빈대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000184'],
  ['pyeongtaek', '평택대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000186'],
  ['hankyong', '한경국립대학교', '경기도', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000037'],
  ['tukorea', '한국공학대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000247'],
  ['kau', '한국항공대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000194'],
  ['hansei', '한세대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000201'],
  ['hanshin', '한신대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000202'],
  ['hanyang-erica', '한양대학교(ERICA)', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000204'],
  ['hyupsung', '협성대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000207'],
  ['hwasung', '화성의과학대학교', '경기도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000233'],
  ['gyeongin', '경인교육대학교', '인천광역시', '국립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000256'],
  ['incheon-catholic', '인천가톨릭대학교', '인천광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000168'],
  ['inha', '인하대학교', '인천광역시', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000169'],
  ['chungwoon', '청운대학교', '충청남도', '사립', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000284'],
].map(([universityId, name, region, establishmentType, adigaUrl]) => ({
  universityId, name, region, establishmentType,
  adigaCode: adigaUrl.match(/unvCd=(\d+)/)?.[1] ?? null,
  homepageUrl: null, admissionsUrl: null, adigaUrl,
  admissionResultsAvailable: ![
    'methodist-theological', 'gangseo', 'konkuk', 'kyunghee', 'korea', 'kwangwoon',
    'kookmin', 'duk-sung', 'dongguk', 'dongduk', 'myongji', 'sahmyook', 'sangmyung',
    'sogang', 'seokyeong', 'seoultech', 'snue', 'scu', 'snu', 'uos', 'swu',
    'seoul-han-young', 'sungconghoe', 'sungkyunkwan', 'sungshin', 'sejong', 'sookmyung',
    'soongsil', 'yonsei', 'ewha', 'presbyterian', 'chungang', 'chongshin', 'chugye',
    'korean-bible', 'hufs', 'knsu', 'hansung', 'hanyang', 'hongik', 'gangnam', 'kyonggi',
    'dae-jin', 'luther', 'myongji-yongin', 'seoul-theological', 'seoul-jangsin', 'sungkyul',
    'suwon-catholic', 'suwon', 'shinhan', 'ashin', 'ajou', 'anyang', 'yongin', 'eulji',
    'cha', 'calvin', 'pyeongtaek', 'hankyong', 'tukorea', 'kau', 'hansei', 'hanshin',
    'hanyang-erica', 'hyupsung', 'hwasung', 'gyeongin', 'incheon-catholic', 'inha', 'chungwoon',
  ].includes(universityId),
}));

const mergeCatalogs = (...catalogs) => {
  const merged = new Map();
  for (const university of catalogs.flat()) {
    const key = university.adigaCode || university.name;
    const current = merged.get(key);
    merged.set(key, current
      ? { ...current, ...university, universityId: current.universityId || university.universityId }
      : university);
  }
  return [...merged.values()];
};

export const UNIVERSITIES = Object.freeze(mergeCatalogs(
  LEGACY_UNIVERSITIES,
  universities2026Seoul,
  universities2026Gyeonggi,
  universities2026Incheon,
  universities2026Busan,
  universities2026Ulsan,
));

export const UNIVERSITY_BY_ID = Object.freeze(Object.fromEntries(UNIVERSITIES.map((item) => [item.universityId, item])));
export const UNIVERSITY_BY_NAME = Object.freeze(Object.fromEntries(UNIVERSITIES.map((item) => [item.name, item])));

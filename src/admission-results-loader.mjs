const DATA_VERSION = '20260919-readiness1';
const REGION_MODULES = Object.freeze({
  busan: `./admission-results/2026/busan.mjs?v=${DATA_VERSION}`,
  ulsan: `./admission-results/2026/ulsan.mjs?v=${DATA_VERSION}`,
  gyeongnam: `./admission-results/2026/gyeongnam.mjs?v=${DATA_VERSION}`,
  incheon: `./admission-results/2026/incheon.mjs?v=${DATA_VERSION}`,
  gyeonggi: `./admission-results/2026/gyeonggi.mjs?v=${DATA_VERSION}`,
  seoul: `./admission-results/2026/seoul.mjs?v=${DATA_VERSION}`,
  daegu: `./admission-results/2026/daegu.mjs?v=${DATA_VERSION}`,
  gyeongbuk: `./admission-results/2026/gyeongbuk.mjs?v=${DATA_VERSION}`,
  daejeon: `./admission-results/2026/daejeon.mjs?v=${DATA_VERSION}`,
  sejong: `./admission-results/2026/sejong.mjs?v=${DATA_VERSION}`,
  chungnam: `./admission-results/2026/chungnam.mjs?v=${DATA_VERSION}`,
  chungbuk: `./admission-results/2026/chungbuk.mjs?v=${DATA_VERSION}`,
  gwangju: `./admission-results/2026/gwangju.mjs?v=${DATA_VERSION}`,
  jeonnam: `./admission-results/2026/jeonnam.mjs?v=${DATA_VERSION}`,
  jeonbuk: `./admission-results/2026/jeonbuk.mjs?v=${DATA_VERSION}`,
  gangwon: `./admission-results/2026/gangwon.mjs?v=${DATA_VERSION}`,
  jeju: `./admission-results/2026/jeju.mjs?v=${DATA_VERSION}`,
});

const REGION_KEYS = Object.freeze({
  서울특별시: 'seoul', 서울: 'seoul',
  경기도: 'gyeonggi', 경기: 'gyeonggi',
  인천광역시: 'incheon', 인천: 'incheon',
  부산광역시: 'busan', 부산: 'busan',
  울산광역시: 'ulsan', 울산: 'ulsan',
  경상남도: 'gyeongnam', 경남: 'gyeongnam',
  대구광역시: 'daegu', 대구: 'daegu',
  경상북도: 'gyeongbuk', 경북: 'gyeongbuk',
  대전광역시: 'daejeon', 대전: 'daejeon',
  세종특별자치시: 'sejong', 세종: 'sejong',
  충청남도: 'chungnam', 충남: 'chungnam',
  충청북도: 'chungbuk', 충북: 'chungbuk',
  광주광역시: 'gwangju', 광주: 'gwangju',
  전라남도: 'jeonnam', 전남: 'jeonnam',
  전북특별자치도: 'jeonbuk', 전북: 'jeonbuk',
  강원특별자치도: 'gangwon', 강원: 'gangwon',
  제주특별자치도: 'jeju', 제주: 'jeju',
});

const cache = new Map();

/** 필요한 지역 데이터만 동적으로 불러온다. 새 지역은 REGION_MODULES에 추가한다. */
export async function loadAdmissionResultsByRegion(region) {
  const modulePath = REGION_MODULES[region];
  if (!modulePath) return [];
  if (!cache.has(region)) {
    const module = await import(modulePath);
    cache.set(region, Object.values(module).find((value) => Array.isArray(value)) ?? []);
  }
  return cache.get(region);
}

export function clearAdmissionResultsCache() { cache.clear(); }
export const admissionResultRegions = Object.freeze(Object.keys(REGION_MODULES));
export function admissionResultRegionKey(region) {
  const value = String(region ?? '').trim();
  return REGION_MODULES[value] ? value : REGION_KEYS[value] ?? null;
}

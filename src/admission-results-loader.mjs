const REGION_MODULES = Object.freeze({
  busan: './admission-results/2026/busan.mjs',
  ulsan: './admission-results/2026/ulsan.mjs',
  gyeongnam: './admission-results/2026/gyeongnam.mjs',
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


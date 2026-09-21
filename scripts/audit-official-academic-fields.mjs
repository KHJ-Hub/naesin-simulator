import { admissionResultRegions, loadAdmissionResultsByRegion } from '../src/admission-results-loader.mjs';
import {
  inferAcademicFieldFromDepartment,
  normalizeAcademicField,
  normalizeAdmissionRecord,
} from '../src/admission-record-normalizer.mjs';
import { UNIVERSITY_BY_NAME } from '../src/data/universities.mjs';
import { writeFile } from 'node:fs/promises';

const TARGET_FIELDS = new Set(['other', 'unknown']);
const VERIFIED_AT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const OUTPUT_FILE = new URL('../src/data/admission-academic-field-verifications-2026.mjs', import.meta.url);
const RUNTIME_OUTPUT_FILE = new URL('../src/data/admission-academic-field-overrides-2026.mjs', import.meta.url);

// 대학어디가의 공식 분류가 광역계열인 경우에만 대학 공식 자료를 추가 확인한다.
// 모집단위명만으로 추정하지 않고, 입학 후 전공 선택 구조 또는 공식 모집 계열이 확인된 항목만 적는다.
const SUPPLEMENTAL_VERIFICATIONS = new Map([
  ['국립창원대학교\u0001사림아너스학부', {
    academicField: 'open-major', sourceType: 'official-university',
    sourceTitle: '국립창원대학교 사림아너스학부 소개', sourceUrl: 'https://www.changwon.ac.kr/srh/main.do',
    note: '공식 학부 안내에서 자율전공학부로 소개하며, 무전공으로 시작해 전공을 탐색한 뒤 선택하는 구조를 확인',
  }],
  ['성신여자대학교\u0001창의융합학부(첨단분야전공)', {
    academicField: 'natural', sourceType: 'official-admissions',
    sourceTitle: '성신여자대학교 2026학년도 입시결과', sourceUrl: 'https://apply.sungshin.ac.kr/sungshin/susi/index.html',
    note: '공식 입시결과의 모집단위 계열에서 자연으로 명시',
  }],
  ['한성대학교\u0001상상력인재학부', {
    academicField: 'open-major', sourceType: 'official-university',
    sourceTitle: '한성대학교 상상력인재학부 소개', sourceUrl: 'https://www.hansung.ac.kr/HmnRsrc/index.do',
    note: '공식 학부 안내에서 자율전공학부로 소개하며 1년간 탐색 후 트랙을 선택하는 구조를 확인',
  }],
  ['한양대학교\u0001한양인터칼리지학부', {
    academicField: 'open-major', sourceType: 'official-admissions',
    sourceTitle: '한양대학교 2026학년도 정시 신입학 모집요강', sourceUrl: 'https://site.hanyang.ac.kr/documents/11081467/444203522/1.%2B2026%ED%95%99%EB%85%84%EB%8F%84%2B%ED%95%9C%EC%96%91%EB%8C%80%ED%95%99%EA%B5%90%2B%EC%8B%A0%EC%9E%85%ED%95%99%2B%EC%A0%95%EC%8B%9C%2B%EB%AA%A8%EC%A7%91%EC%9A%94%EA%B0%95%28%EC%B5%9C%EC%A2%85%29.pdf/04ad6e94-c021-b39e-b7d7-1854bfba9958?t=1766714577027',
    note: '공식 모집요강에서 입학 후 2학년 진급 시 선택 가능한 학과 중 전공을 선택하는 구조를 확인',
  }],
  ['경북대학교\u0001자율미래인재학부', {
    academicField: 'open-major', sourceType: 'official-university',
    sourceTitle: '경북대학교 자율미래인재학부 전공 선택 안내', sourceUrl: 'https://www.knu.ac.kr/wbbs/wbbs/contents/index.action?menu_idx=&menu_url=edu%2Facademic03_01_15',
    note: '공식 안내에서 1학년 탐색 후 여러 학문 분야 중 학과를 선택하는 구조를 확인',
  }],
  ['동국대학교(WISE)(분교)\u0001글로컬인재학부', {
    academicField: 'open-major', sourceType: 'official-university',
    sourceTitle: '동국대학교 WISE 글로컬인재학부 소개', sourceUrl: 'https://openmajor.dongguk.ac.kr/HOME/free/sub.htm?nav_code=fre1624235653',
    note: '공식 학부 안내에서 자유전공학부의 후속 조직이며 1년 탐색 후 전공을 선택하는 구조를 확인',
  }],
  ['중부대학교\u0001자율설계학부', {
    academicField: 'open-major', sourceType: 'official-university',
    sourceTitle: '중부대학교 자율설계학부 안내', sourceUrl: 'https://joongbu.ac.kr/menu.es?mid=j10301000000',
    note: '공식 안내에서 1학년 후 기존 전공 또는 자기설계전공을 선택하는 구조를 확인',
  }],
  ['유원대학교\u0001자율설계학부', {
    academicField: 'open-major', sourceType: 'official-university',
    sourceTitle: '유원대학교 자율설계학부 소개', sourceUrl: 'https://www.u1.ac.kr/autonomy/intro/intro.do',
    note: '공식 학부 안내에서 입학 후 탐색을 거쳐 적성에 맞는 전공을 선택하는 구조를 확인',
  }],
  ['유원대학교\u0001창의설계학부', {
    academicField: 'open-major', sourceType: 'official-university',
    sourceTitle: '유원대학교 창의설계학부 비전', sourceUrl: 'https://sse.u1.ac.kr/creative/intro/vision.do',
    note: '공식 학부 안내에서 1년 탐색 후 여러 계열의 전공을 선택하거나 설계하는 구조를 확인',
  }],
  ['위덕대학교\u0001라이프융합학과', {
    academicField: null, sourceType: 'official-university',
    sourceTitle: '위덕대학교 라이프융합학과 소개', sourceUrl: 'https://ipsi.uu.ac.kr/bbs/content.php?co_id=0407&sub_id=32',
    note: '대학어디가는 광역계열로 표시하고 공식 학과 안내는 모듈형 교육과정을 설명하지만, 단일 계열 또는 입학 후 타 전공 선택 구조를 확정할 근거가 없어 미분류 유지',
  }],
]);

const decodeHtml = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, ' ')
  .trim();

function officialClassUrl(sourceUrl) {
  try {
    const source = new URL(sourceUrl);
    if (!/(^|\.)adiga\.kr$/i.test(source.hostname)) return null;
    const ruCd = source.searchParams.get('ruCd');
    const unvCd = source.searchParams.get('unvCd');
    if (!ruCd || !unvCd) return null;
    const url = new URL('https://www.adiga.kr/ucp/cls/uni/classUnivDetail.do');
    url.searchParams.set('menuId', 'PCCLSINF2000');
    url.searchParams.set('ruCd', ruCd);
    url.searchParams.set('searchSyr', source.searchParams.get('searchSyr') || '2026');
    url.searchParams.set('unvCd', unvCd);
    return url.href;
  } catch {
    return null;
  }
}

function canonicalFieldFromOfficialCategory(category, department) {
  const value = String(category ?? '').replace(/\s/g, '');
  if (/인문사회계열|인문계열/.test(value)) return 'humanities';
  if (/자연과학계열|자연계열|공학계열|의약계열/.test(value)) return 'natural';
  if (/예체능계열|예술계열|체육계열/.test(value)) return 'arts';
  if (/광역계열/.test(value) && /(자유전공|자율전공|무전공)/.test(department)) return 'open-major';
  return null;
}

function parseOfficialClassPage(html) {
  const block = String(html).match(/<div\s+class=["']classTit["'][\s\S]*?<div\s+class=["']innerClsTit["'][\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!block) return null;
  return { department: decodeHtml(block[1]), officialCategory: decodeHtml(block[2]) };
}

async function fetchOfficialPage(url, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 academic-field-audit/1.0' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

const rawRecords = (await Promise.all(admissionResultRegions.map(loadAdmissionResultsByRegion))).flat();
const targetRecords = rawRecords
  .map((raw) => {
    const normalized = normalizeAdmissionRecord(raw);
    const baselineAcademicField = raw.academicField != null || raw.field != null
      ? normalizeAcademicField(raw.academicField ?? raw.field)
      : inferAcademicFieldFromDepartment(raw.department);
    return { raw, normalized: { ...normalized, academicField: baselineAcademicField } };
  })
  .filter(({ normalized }) => TARGET_FIELDS.has(normalized.academicField));

const uniqueTargets = [...new Map(targetRecords.map(({ raw, normalized }) => {
  const key = [normalized.university, normalized.department].join('\u0001');
  return [key, {
    universityId: UNIVERSITY_BY_NAME[normalized.university]?.universityId ?? normalized.universityId ?? null,
    university: normalized.university,
    department: normalized.department,
    originalAcademicField: normalized.academicField,
    sourceUrl: officialClassUrl(raw.sourceUrl),
  }];
})).values()];

const audited = await mapWithConcurrency(uniqueTargets, 6, async (target) => {
  if (!target.sourceUrl) return { ...target, status: 'no-official-url' };
  try {
    const parsed = parseOfficialClassPage(await fetchOfficialPage(target.sourceUrl));
    if (!parsed) return { ...target, status: 'official-page-unreadable' };
    const directField = canonicalFieldFromOfficialCategory(parsed.officialCategory, target.department);
    const supplemental = directField ? null : SUPPLEMENTAL_VERIFICATIONS.get(`${target.university}\u0001${target.department}`);
    const academicField = directField ?? supplemental?.academicField ?? null;
    return {
      ...target,
      academicField,
      officialDepartment: parsed.department,
      officialCategory: parsed.officialCategory,
      sourceType: supplemental?.sourceType ?? 'adiga-official',
      sourceTitle: supplemental?.sourceTitle ?? `${target.university} ${parsed.department} 학과정보`,
      sourceUrl: supplemental?.sourceUrl ?? target.sourceUrl,
      adigaSourceUrl: target.sourceUrl,
      verifiedAt: VERIFIED_AT,
      note: supplemental?.note ?? (academicField
        ? `대학어디가 학과정보에서 ${parsed.officialCategory}로 명시`
        : `공식 분류(${parsed.officialCategory})와 대학 공식 자료를 확인했지만 학생용 네 계열 중 하나로 안전하게 확정하지 않음`),
      status: academicField ? 'verified' : 'official-category-unmapped',
    };
  } catch (error) {
    return { ...target, status: 'fetch-failed', error: String(error?.message ?? error) };
  }
});

const fieldCounts = audited.reduce((counts, item) => {
  if (item.academicField) counts[item.academicField] = (counts[item.academicField] ?? 0) + 1;
  return counts;
}, {});
const statusCounts = audited.reduce((counts, item) => {
  counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}, {});

const exportRows = audited
  .map(({ error, originalAcademicField, ...item }) => ({
    ...item,
    academicField: item.academicField ?? null,
    status: item.status === 'verified' ? 'official-verified' : 'official-reviewed-unresolved',
  }))
  .sort((a, b) => a.university.localeCompare(b.university, 'ko') || a.department.localeCompare(b.department, 'ko'));

if (process.argv.includes('--write')) {
  const incompleteAudit = audited.filter((item) => ['fetch-failed', 'no-official-url', 'official-page-unreadable'].includes(item.status));
  if (incompleteAudit.length) {
    throw new Error(`공식 자료를 확인하지 못한 ${incompleteAudit.length}개 항목이 있어 검증 파일을 덮어쓰지 않습니다.`);
  }
  const summary = {
    verifiedAt: VERIFIED_AT,
    targetRecordCount: targetRecords.length,
    targetUniversityCount: new Set(uniqueTargets.map((item) => item.university)).size,
    targetDepartmentCount: uniqueTargets.length,
    verifiedDepartmentCount: exportRows.filter((item) => item.status === 'official-verified').length,
    unresolvedDepartmentCount: exportRows.filter((item) => item.status !== 'official-verified').length,
    fieldCounts,
    statusCounts,
  };
  const moduleSource = `// 이 파일은 scripts/audit-official-academic-fields.mjs로 생성합니다.\n`
    + `// 원본 입결 수치는 변경하지 않고, 공식 출처로 확인한 모집단위 계열만 우선 적용합니다.\n`
    + `export const ADMISSION_ACADEMIC_FIELD_VERIFICATIONS_2026 = Object.freeze(${JSON.stringify(exportRows, null, 2)}.map(Object.freeze));\n\n`
    + `export const ADMISSION_ACADEMIC_FIELD_VERIFICATION_SUMMARY_2026 = Object.freeze(${JSON.stringify(summary, null, 2)});\n`;
  const runtimeRows = exportRows.map((item) => [
    item.universityId,
    item.university,
    item.department,
    item.academicField,
    item.status,
  ]);
  const runtimeSource = `// 공식 검증 전체 메타데이터에서 생성한 학생 화면용 최소 override입니다.\n`
    + `export const ADMISSION_ACADEMIC_FIELD_OVERRIDES_2026 = Object.freeze(${JSON.stringify(runtimeRows, null, 2)}.map(Object.freeze));\n\n`
    + `export const ADMISSION_ACADEMIC_FIELD_VERIFICATION_SUMMARY_2026 = Object.freeze(${JSON.stringify(summary, null, 2)});\n`;
  await writeFile(OUTPUT_FILE, moduleSource, 'utf8');
  await writeFile(RUNTIME_OUTPUT_FILE, runtimeSource, 'utf8');
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  targetRecordCount: targetRecords.length,
  targetUniversityCount: new Set(uniqueTargets.map((item) => item.university)).size,
  targetDepartmentCount: uniqueTargets.length,
  fieldCounts,
  statusCounts,
  verified: audited.filter((item) => item.status === 'verified'),
  unresolved: audited.filter((item) => item.status !== 'verified'),
}, null, 2));

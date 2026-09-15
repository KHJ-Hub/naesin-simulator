#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REGIONS = Object.freeze({
  seoul: ['01', '서울특별시'], gyeonggi: ['08', '경기도'], incheon: ['04', '인천광역시'],
  busan: ['02', '부산광역시'], ulsan: ['07', '울산광역시'], gyeongnam: ['15', '경상남도'],
  daegu: ['03', '대구광역시'], gyeongbuk: ['14', '경상북도'], daejeon: ['06', '대전광역시'],
  sejong: ['17', '세종특별자치시'], chungnam: ['11', '충청남도'], chungbuk: ['10', '충청북도'],
  gwangju: ['05', '광주광역시'], jeonnam: ['13', '전라남도'], jeonbuk: ['12', '전북특별자치도'],
  gangwon: ['09', '강원특별자치도'], jeju: ['16', '제주특별자치도'],
});

const args = process.argv.slice(2);
const [regionSlug] = args;
const dryRun = args.includes('--dry-run');
const printRecords = args.includes('--print-records');
const universityCode = args.find((item) => item.startsWith('--university='))?.split('=')[1] ?? null;
if (!REGIONS[regionSlug]) {
  console.error(`usage: node scripts/audit-adiga-class-results-2026.mjs <${Object.keys(REGIONS).join('|')}> [--university=code] [--dry-run] [--print-records]`);
  process.exit(2);
}

const [areaCode, regionName] = REGIONS[regionSlug];
const BASE = 'https://www.adiga.kr';
const RESULT_YEAR = 2026;
const SUBJECT_LIST_YEAR = 2026;
const checkedAt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function text(value = '') {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

async function get(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 600);
    }
  }
  throw lastError;
}

async function listUniversities() {
  const landing = await get(`${BASE}/ucp/uvt/uni/univView.do?menuId=PCUVTINF2000`);
  const html = await landing.text();
  const csrf = html.match(/<form id="frm"[\s\S]*?name="_csrf" value="([^"]+)"/)?.[1];
  if (!csrf) throw new Error('CSRF token not found');
  const cookie = landing.headers.get('set-cookie')?.split(';')[0] ?? '';
  const body = new URLSearchParams({
    _csrf: csrf,
    'pagination.currentPage': '1',
    'pagination.cntPerPage': '100',
    searchSyr: '2027',
    unvSeCd: '10',
    searchArea: areaCode,
  });
  const response = await get(`${BASE}/ucp/uvt/uni/univAjax.do`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body,
  });
  const fragment = await response.text();
  return [...fragment.matchAll(/<a[^>]+class="selectUniv"[^>]+code="(\d+)"[^>]*>([^<]+)<\/a>/g)]
    .map((match) => ({ adigaCode: match[1], name: text(match[2]).replace(/\[본교\]$/, '').replace(/\[(제\d+캠퍼스|분교)\]$/, '($1)') }))
    .filter((item) => universityCode == null || item.adigaCode === universityCode);
}

function parseTableGrid(rawTable) {
  const rows = [...rawTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const grid = [];
  const spans = [];
  for (const rowMatch of rows) {
    const row = [];
    for (let column = 0; column < spans.length; column += 1) {
      if (spans[column]?.remaining > 0) row[column] = spans[column].value;
    }
    for (const cell of rowMatch[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      let column = 0;
      while (row[column] !== undefined) column += 1;
      const colspan = Number(cell[1].match(/colspan=["']?(\d+)/i)?.[1] ?? 1);
      const rowspan = Number(cell[1].match(/rowspan=["']?(\d+)/i)?.[1] ?? 1);
      const value = text(cell[2]);
      for (let offset = 0; offset < colspan; offset += 1) {
        row[column + offset] = value;
        if (rowspan > 1) spans[column + offset] = { value, remaining: rowspan };
      }
    }
    grid.push(row);
    for (let column = 0; column < spans.length; column += 1) {
      if (spans[column]?.remaining > 0) spans[column].remaining -= 1;
    }
  }
  return grid;
}

const toGrade = (value) => {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!/^(?:[1-8](?:\.\d+)?|9(?:\.0+)?)$/.test(normalized)) return null;
  const number = Number(normalized);
  return number >= 1 && number <= 9 ? number : null;
};

function classifyEligibility(admissionName) {
  const name = admissionName.replace(/\s/g, '');
  if (/농어촌/.test(name)) return 'rural';
  if (/특성화고|마이스터고/.test(name)) return 'vocational';
  if (/지역인재|지역혁신인재|지역교과/.test(name)) return 'regional';
  if (/학교장추천|추천형|추천전형|지역균형/.test(name)) return 'school-recommendation';
  if (/고른기회|기회균형/.test(name)) return 'unknown';
  if (/국가보훈|보훈|기초생활|차상위|한부모|사회통합|사회배려|장애|특수교육|기회균등|재직자|성인학습|북한이탈/.test(name)) return 'special';
  if (/일반|교과성적우수|학업성적우수|학생부우수|자기추천|서류형|면접형/.test(name)) return 'general';
  return 'unknown';
}

function normalizeAdmissionName(value) {
  return String(value ?? '')
    .trim()
    .replace(/^학생부(?:교과|종합)(?:전형)?\s*\(/, '')
    .replace(/\)$/, '')
    .replace(/^(?:수시모집|정시모집)\s*/, '')
    .trim();
}

async function listDepartmentCodes(adigaCode) {
  const baseUrl = `${BASE}/ucp/uvt/uni/univDetailSubject.do?menuId=PCUVTINF2000&searchSyr=${SUBJECT_LIST_YEAR}&unvCd=${adigaCode}`;
  const firstHtml = await (await get(`${baseUrl}&pagination.currentPage=1&pagination.cntPerPage=9`)).text();
  const pageNumbers = [...firstHtml.matchAll(/fnSearch\((\d+)\)/g)].map((match) => Number(match[1]));
  const lastPage = Math.max(1, ...pageNumbers);
  const remainingPages = Array.from({ length: lastPage - 1 }, (_, index) => index + 2);
  const remainingHtml = await mapWithConcurrency(remainingPages, 4, async (page) => (
    await (await get(`${baseUrl}&pagination.currentPage=${page}&pagination.cntPerPage=9`)).text()
  ));
  return [...new Set([firstHtml, ...remainingHtml].flatMap((html) => (
    [...html.matchAll(/fnDetailPage\(&quot;(\d+)&quot;\)/g)].map((match) => match[1])
  )))];
}

function resultTable(html) {
  return [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .find((table) => /전형유형/.test(text(table)) && /환산등급/.test(text(table))) ?? null;
}

function parsePopup(html, university, sourceUrl) {
  const headingHtml = html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '';
  const baseDepartment = text(headingHtml).split('/')[0]?.trim();
  const course = text(headingHtml.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
  const department = course && course !== '일반과정' ? `${baseDepartment} (${course})` : baseDepartment;
  const table = resultTable(html);
  if (!department || !table) return { records: [], observed: new Set() };
  const grid = parseTableGrid(table);
  const headerRows = grid.slice(0, 4);
  const paths = Array.from({ length: Math.max(...grid.map((row) => row.length)) }, (_, column) => headerRows.map((row) => row[column]).filter(Boolean).join(' '));
  const cut50Column = paths.findIndex((path) => /학생부/.test(path) && /환산등급/.test(path) && /50%/.test(path));
  const cut70Column = paths.findIndex((path) => /학생부/.test(path) && /환산등급/.test(path) && /70%/.test(path));
  if (cut50Column < 0 && cut70Column < 0) return { records: [], observed: new Set() };

  const observed = new Set();
  const records = [];
  for (const row of grid.slice(4)) {
    const type = row[1] ?? '';
    const admissionCategory = /학생부위주\(교과\)/.test(type) ? '학생부교과'
      : /학생부위주\(종합\)/.test(type) ? '학생부종합' : null;
    if (!admissionCategory) continue;
    observed.add(admissionCategory);
    const admissionName = normalizeAdmissionName(row[2]);
    if (!admissionName) continue;
    const cut50Original = cut50Column >= 0 ? toGrade(row[cut50Column]) : null;
    const cut70Original = cut70Column >= 0 ? toGrade(row[cut70Column]) : null;
    if (cut50Original == null && cut70Original == null) continue;
    records.push({
      university: university.name,
      region: regionName,
      department,
      admissionName,
      admissionCategory,
      cut50Original,
      cut70Original,
      averageGradeOriginal: null,
      dataAvailability: cut50Original != null && cut70Original != null ? 'confirmed-cut'
        : cut70Original != null ? 'cut70-only' : 'cut50-only',
      eligibilityType: classifyEligibility(admissionName),
      sourceUrl,
    });
  }
  return { records, observed };
}

async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function uniqueRecords(records) {
  const unique = new Map();
  const conflicts = new Set();
  for (const record of records) {
    const key = [record.university, record.department, record.admissionName, record.admissionCategory].join('|');
    const values = [record.cut50Original, record.cut70Original].join('|');
    if (!unique.has(key)) unique.set(key, { record, values });
    else if (unique.get(key).values !== values) conflicts.add(key);
  }
  return {
    records: [...unique.entries()].filter(([key]) => !conflicts.has(key)).map(([, value]) => value.record),
    conflicts: [...conflicts],
  };
}

const universities = await listUniversities();
const auditRows = [];
const allRecords = [];
for (let index = 0; index < universities.length; index += 1) {
  const university = universities[index];
  process.stdout.write(`[${index + 1}/${universities.length}] ${university.name} ... `);
  try {
    const departmentCodes = await listDepartmentCodes(university.adigaCode);
    const parsed = await mapWithConcurrency(departmentCodes, 4, async (departmentCode) => {
      const sourceUrl = `${BASE}/ucp/cls/uni/classUnivAdmssPopup.do?ruCd=${departmentCode}&searchSyr=${RESULT_YEAR}&unvCd=${university.adigaCode}`;
      const html = await (await get(sourceUrl)).text();
      await sleep(30);
      return parsePopup(html, university, sourceUrl);
    });
    const observed = new Set(parsed.flatMap((item) => [...item.observed]));
    const unique = uniqueRecords(parsed.flatMap((item) => item.records));
    allRecords.push(...unique.records);
    const status = (category) => unique.records.some((record) => record.admissionCategory === category)
      ? 'confirmed-cut'
      : observed.has(category) ? 'not-published'
        : category === '학생부교과' ? 'no-subject-admission' : 'no-comprehensive-admission';
    auditRows.push({
      universityId: `adiga-${university.adigaCode}`,
      universityName: university.name,
      region: regionName,
      referenceYear: RESULT_YEAR,
      subjectAdmissionStatus: status('학생부교과'),
      comprehensiveAdmissionStatus: status('학생부종합'),
      checkedAt,
      sourceUrls: unique.records.length ? [...new Set(unique.records.map((record) => record.sourceUrl))] : [],
      auditState: unique.conflicts.length ? 'completed-with-parser-warnings' : 'completed',
      failureReason: unique.conflicts.length ? `${unique.conflicts.length} conflicting result keys excluded` : null,
    });
    process.stdout.write(`${departmentCodes.length} departments, ${unique.records.length} records\n`);
  } catch (error) {
    auditRows.push({
      universityId: `adiga-${university.adigaCode}`,
      universityName: university.name,
      region: regionName,
      referenceYear: RESULT_YEAR,
      subjectAdmissionStatus: 'not-checked',
      comprehensiveAdmissionStatus: 'not-checked',
      checkedAt,
      sourceUrls: [],
      auditState: 'failed',
      failureReason: String(error.message ?? error),
    });
    process.stdout.write(`FAILED: ${error.message}\n`);
  }
}

const resultExport = `admissionResults2026${regionSlug[0].toUpperCase()}${regionSlug.slice(1)}Verified`;
const auditExport = `universityAudit2026${regionSlug[0].toUpperCase()}${regionSlug.slice(1)}Verified`;
if (!dryRun) {
  await mkdir(path.join('src', 'admission-results', '2026', 'verified'), { recursive: true });
  await mkdir(path.join('src', 'data', 'university-audits', '2026-verified'), { recursive: true });
  const resultModule = `import { createOfficialAdmissionResult } from '../../admission-result-factory.mjs';\n\nconst rows = ${JSON.stringify(allRecords, null, 2)};\n\nexport const ${resultExport} = Object.freeze(rows.map(createOfficialAdmissionResult));\n`;
  const auditModule = `// 공식 대입정보포털 어디가 2026학년도 모집단위별 입시결과 팝업에서 ${checkedAt} 확인.\nexport const ${auditExport} = Object.freeze(${JSON.stringify(auditRows, null, 2)});\n`;
  await writeFile(path.join('src', 'admission-results', '2026', 'verified', `${regionSlug}.mjs`), resultModule);
  await writeFile(path.join('src', 'data', 'university-audits', '2026-verified', `${regionSlug}.mjs`), auditModule);
}

const summary = {
  region: regionName,
  resultYear: RESULT_YEAR,
  dryRun,
  universities: universities.length,
  audited: auditRows.filter((item) => item.auditState !== 'failed').length,
  records: allRecords.length,
  subject: allRecords.filter((item) => item.admissionCategory === '학생부교과').length,
  comprehensive: allRecords.filter((item) => item.admissionCategory === '학생부종합').length,
  failed: auditRows.filter((item) => item.auditState === 'failed').length,
  warnings: auditRows.filter((item) => item.auditState === 'completed-with-parser-warnings').length,
};
console.log(JSON.stringify(summary));
if (printRecords) console.log(JSON.stringify(allRecords, null, 2));

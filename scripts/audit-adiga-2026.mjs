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
const [regionSlug] = process.argv.slice(2);
if (!REGIONS[regionSlug]) {
  console.error(`usage: node scripts/audit-adiga-2026.mjs <${Object.keys(REGIONS).join('|')}>`);
  process.exit(2);
}

const [areaCode, regionName] = REGIONS[regionSlug];
const BASE = 'https://www.adiga.kr';
const LIST_URL = `${BASE}/ucp/uvt/uni/univView.do?menuId=PCUVTINF2000`;
const checkedAt = new Date().toISOString().slice(0, 10);
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
      if (attempt < attempts) await sleep(attempt * 750);
    }
  }
  throw lastError;
}

async function listUniversities() {
  const landing = await get(LIST_URL);
  const html = await landing.text();
  const csrf = html.match(/<form id="frm"[\s\S]*?name="_csrf" value="([^"]+)"/)?.[1];
  if (!csrf) throw new Error('CSRF token not found');
  const cookie = landing.headers.get('set-cookie')?.split(';')[0] ?? '';
  const body = new URLSearchParams({
    _csrf: csrf,
    'pagination.currentPage': '1',
    'pagination.cntPerPage': '100',
    searchSyr: '2027', unvSeCd: '10', searchArea: areaCode,
  });
  const response = await get(`${BASE}/ucp/uvt/uni/univAjax.do`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body,
  });
  const fragment = await response.text();
  return [...fragment.matchAll(/<a[^>]+class="selectUniv"[^>]+code="(\d+)"[^>]*>([^<]+)<\/a>/g)]
    .map((match) => ({ adigaCode: match[1], displayName: text(match[2]) }));
}

function parseExternalUrl(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`fnOpenNewUrl\\(&quot;([^&]+)&quot;\\)[^>]*>${escaped}<`, 'i'));
  if (!match) return null;
  const raw = decodeHtml(match[1]).replace(/\\\//g, '/').trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function normalizeUniversityName(displayName) {
  return displayName.replace(/\[본교\]$/, '').replace(/\[(제\d+캠퍼스|분교)\]$/, '($1)');
}

function parseTableGrid(rawTable) {
  const rows = [...rawTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const grid = [];
  const spans = [];
  for (const rowMatch of rows) {
    const row = [];
    for (let col = 0; col < spans.length; col += 1) {
      if (spans[col]?.remaining > 0) row[col] = spans[col].value;
    }
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)];
    let col = 0;
    for (const cell of cells) {
      while (row[col] !== undefined) col += 1;
      const attrs = cell[1];
      const value = text(cell[2]);
      const colspan = Number(attrs.match(/colspan=["']?(\d+)/i)?.[1] ?? 1);
      const rowspan = Number(attrs.match(/rowspan=["']?(\d+)/i)?.[1] ?? 1);
      for (let offset = 0; offset < colspan; offset += 1) {
        row[col + offset] = value;
        if (rowspan > 1) spans[col + offset] = { value, remaining: rowspan };
      }
      col += colspan;
    }
    grid.push(row);
    for (let index = 0; index < spans.length; index += 1) {
      if (spans[index]?.remaining > 0) spans[index].remaining -= 1;
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
  if (/국가보훈|보훈|기초생활|차상위|한부모|사회통합|사회배려|장애|특수교육|기회균등|재직자|성인학습/.test(name)) return 'special';
  if (/일반|교과성적우수|학업성적우수|학생부우수|자기추천|서류형|면접형/.test(name)) return 'general';
  return 'unknown';
}

function extractResultTables(html, university) {
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const records = [];
  const observed = { subject: false, comprehensive: false, subjectGradeTable: false, comprehensiveGradeTable: false };
  const errors = [];
  for (const rawTable of tables) {
    const flat = text(rawTable);
    const category = /학생부교과/.test(flat) ? '학생부교과' : /학생부종합/.test(flat) ? '학생부종합' : null;
    if (!category) continue;
    const key = category === '학생부교과' ? 'subject' : 'comprehensive';
    observed[key] = true;
    if (!/학생부등급|교과성적/.test(flat) || !/(50\s*%\s*cut|70\s*%\s*cut|평균등급|평균)/i.test(flat)) continue;
    observed[`${key}GradeTable`] = true;
    const grid = parseTableGrid(rawTable);
    if (!grid.length) continue;
    const firstRow = grid[0].filter(Boolean);
    if (!firstRow.some((value) => /모집\s*단위/.test(value))) continue;
    const admissionName = firstRow.find((value) => value.includes(category)) ?? category;
    const specificAdmissionName = admissionName.replace(category, '').replace(/[()\s]/g, '');
    // 전형명이 없는 통합표는 여러 전형의 행을 구분할 수 없으므로 자동 반영하지 않는다.
    if (specificAdmissionName.length < 2) {
      errors.push(`${category}: admission name not resolved`);
      continue;
    }
    const dataStart = grid.findIndex((row, index) => index > 0 && row.some((value, column) => column > 0 && toGrade(value) != null) && !/모집인원|경쟁률|최종등록자/.test(row[0] ?? ''));
    if (dataStart < 0) continue;
    const headerRows = grid.slice(0, dataStart);
    const width = Math.max(...grid.map((row) => row.length));
    const paths = Array.from({ length: width }, (_, column) => headerRows.map((row) => row[column]).filter(Boolean).join(' '));
    const gradeColumn = (percent) => paths.findIndex((path) => /학생부등급|교과성적/.test(path) && new RegExp(`${percent}\\s*%\\s*cut`, 'i').test(path));
    let cut50Column = gradeColumn(50);
    let cut70Column = gradeColumn(70);
    if (cut50Column < 0 || cut70Column < 0) {
      const gradeParentColumns = paths.map((path, index) => /학생부등급|교과성적/.test(path) ? index : -1).filter((index) => index >= 0);
      if (gradeParentColumns.length === 2 && paths[gradeParentColumns[0]].includes('50') && paths[gradeParentColumns[1]].includes('70')) {
        [cut50Column, cut70Column] = gradeParentColumns;
      }
    }
    const averageColumn = paths.findIndex((path) => /학생부등급|교과성적/.test(path) && /평균/.test(path) && !/%\s*cut/i.test(path));
    if (cut50Column < 0 && cut70Column < 0 && averageColumn < 0) {
      errors.push(`${admissionName}: grade columns not resolved`);
      continue;
    }
    for (const row of grid.slice(dataStart)) {
      const department = row[0]?.trim();
      if (!department || department.length > 80 || /모집단위|합계|계$|※/.test(department)
        || /^(서울|세종|부산|울산|경남|경기|인천|대구|경북|대전|충남|충북|광주|전남|전북|강원|제주)$/.test(department)
        || /^(?:\S\s+){2,}\S$/.test(department)) continue;
      const cut50Original = cut50Column >= 0 ? toGrade(row[cut50Column]) : null;
      const cut70Original = cut70Column >= 0 ? toGrade(row[cut70Column]) : null;
      const averageGradeOriginal = averageColumn >= 0 ? toGrade(row[averageColumn]) : null;
      if (cut50Original == null && cut70Original == null && averageGradeOriginal == null) continue;
      records.push({
        university: university.name, region: regionName, department, admissionName,
        admissionCategory: category, cut50Original, cut70Original, averageGradeOriginal,
        dataAvailability: cut50Original != null && cut70Original != null ? 'confirmed-cut'
          : cut70Original != null ? 'cut70-only' : cut50Original != null ? 'cut50-only' : 'average-only',
        eligibilityType: classifyEligibility(admissionName), sourceUrl: university.adigaUrl,
      });
    }
  }
  const unique = new Map();
  const conflicts = new Set();
  for (const record of records) {
    const key = [record.university, record.department, record.admissionName, record.admissionCategory].join('|');
    const values = [record.cut50Original, record.cut70Original, record.averageGradeOriginal].join('|');
    if (!unique.has(key)) unique.set(key, { record, values });
    else if (unique.get(key).values !== values) conflicts.add(key);
  }
  if (conflicts.size) errors.push(`${conflicts.size} conflicting result keys excluded`);
  return {
    records: [...unique.entries()].filter(([key]) => !conflicts.has(key)).map(([, value]) => value.record),
    observed,
    errors,
  };
}

function statusFor(category, extraction, pageText) {
  const records = extraction.records.filter((record) => record.admissionCategory === category);
  if (records.some((record) => ['confirmed-cut', 'cut70-only', 'cut50-only'].includes(record.dataAvailability))) return 'confirmed-cut';
  if (records.some((record) => record.dataAvailability === 'average-only')) return 'average-only';
  const key = category === '학생부교과' ? 'subject' : 'comprehensive';
  if (extraction.observed[key] || pageText.includes(category)) return 'not-published';
  return category === '학생부교과' ? 'no-subject-admission' : 'no-comprehensive-admission';
}

function mjs(value, exportName) {
  return `// 공식 대입정보포털 어디가 2026학년도 페이지에서 ${checkedAt} 확인.\nexport const ${exportName} = Object.freeze(${JSON.stringify(value, null, 2)});\n`;
}

const universities = await listUniversities();
const auditRows = [];
const resultRows = [];
for (let index = 0; index < universities.length; index += 1) {
  const listed = universities[index];
  const name = normalizeUniversityName(listed.displayName);
  const adigaUrl = `${BASE}/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=${listed.adigaCode}`;
  const university = { universityId: `adiga-${listed.adigaCode}`, adigaCode: listed.adigaCode, name, region: regionName, establishmentType: null, homepageUrl: null, admissionsUrl: null, adigaUrl };
  process.stdout.write(`[${index + 1}/${universities.length}] ${name} ... `);
  try {
    const response = await get(adigaUrl);
    const html = await response.text();
    university.homepageUrl = parseExternalUrl(html, '홈페이지');
    university.admissionsUrl = parseExternalUrl(html, '입시홈페이지');
    const extraction = extractResultTables(html, university);
    const pageText = text(html);
    resultRows.push(...extraction.records);
    auditRows.push({
      universityId: university.universityId, universityName: name, region: regionName, referenceYear: 2026,
      subjectAdmissionStatus: statusFor('학생부교과', extraction, pageText),
      comprehensiveAdmissionStatus: statusFor('학생부종합', extraction, pageText),
      checkedAt, sourceUrls: [adigaUrl], homepageUrl: university.homepageUrl, admissionsUrl: university.admissionsUrl,
      auditState: extraction.errors.length ? 'completed-with-parser-warnings' : 'completed',
      failureReason: extraction.errors.length ? extraction.errors.join('; ') : null,
    });
    process.stdout.write(`${extraction.records.length} records\n`);
  } catch (error) {
    auditRows.push({
      universityId: university.universityId, universityName: name, region: regionName, referenceYear: 2026,
      subjectAdmissionStatus: 'not-checked', comprehensiveAdmissionStatus: 'not-checked', checkedAt,
      sourceUrls: [adigaUrl], homepageUrl: null, admissionsUrl: null, auditState: 'failed', failureReason: String(error.message ?? error),
    });
    process.stdout.write(`FAILED: ${error.message}\n`);
  }
  await sleep(150);
}

const catalog = auditRows.map((audit, index) => ({
  universityId: audit.universityId,
  adigaCode: universities[index].adigaCode,
  name: audit.universityName,
  region: regionName,
  establishmentType: null,
  homepageUrl: audit.homepageUrl,
  admissionsUrl: audit.admissionsUrl,
  adigaUrl: audit.sourceUrls[0],
  admissionResultsAvailable: resultRows.some((record) => record.university === audit.universityName),
}));

await mkdir(path.join('src', 'data', 'university-regions', '2026'), { recursive: true });
await mkdir(path.join('src', 'data', 'university-audits', '2026'), { recursive: true });
await mkdir(path.join('src', 'admission-results', '2026', 'generated'), { recursive: true });
await writeFile(path.join('src', 'data', 'university-regions', '2026', `${regionSlug}.mjs`), mjs(catalog, `universities2026${regionSlug[0].toUpperCase()}${regionSlug.slice(1)}`));
await writeFile(path.join('src', 'data', 'university-audits', '2026', `${regionSlug}.mjs`), mjs(auditRows, `universityAudit2026${regionSlug[0].toUpperCase()}${regionSlug.slice(1)}`));
const resultExport = `admissionResults2026${regionSlug[0].toUpperCase()}${regionSlug.slice(1)}Generated`;
const resultModule = `import { createOfficialAdmissionResult } from '../../admission-result-factory.mjs';\n\nconst rows = ${JSON.stringify(resultRows, null, 2)};\n\nexport const ${resultExport} = Object.freeze(rows.map(createOfficialAdmissionResult));\n`;
await writeFile(path.join('src', 'admission-results', '2026', 'generated', `${regionSlug}.mjs`), resultModule);
console.log(JSON.stringify({ region: regionName, universities: catalog.length, records: resultRows.length, failed: auditRows.filter((row) => row.auditState === 'failed').length, warnings: auditRows.filter((row) => row.auditState === 'completed-with-parser-warnings').length }));

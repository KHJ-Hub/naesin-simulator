import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { uniqueRecords } from '../scripts/lib/adiga-result-records.mjs';
import { admissionResults2026Daeshin as rows } from '../src/admission-results/2026/verified/daeshin.mjs';
import { admissionResults2026GyeongbukVerified as previous } from '../src/admission-results/2026/verified/gyeongbuk.mjs';
import { admissionResultsByYear, admissionResultsByRegion2026 } from '../src/admission-results/index.mjs';
import { admissionInterestKey, normalizeAdmissionInterests } from '../src/admission-reference-store.mjs';
import { normalizeAdmissionRecord, validateAdmissionRecord } from '../src/admission-record-normalizer.mjs';
import { filterAdmissionRecords } from '../src/admission-filter-options.mjs';
import { buildAdmissionDataDashboard } from '../src/admission-data-dashboard-core.mjs';
import { UNIVERSITIES } from '../src/data/universities.mjs';
import { UNIVERSITY_AUDIT_2026 } from '../src/data/university-audit-2026.mjs';
import { buildPrintReportModel, renderPrintReport } from '../src/print-report.mjs';

test('대신대 4개 충돌은 수시/정시 8개 공식 결과로 보존하고 원문 수치를 보정하지 않는다', () => {
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map(admissionInterestKey)).size, 8);
  assert.equal(new Set(rows.map(r => r.department)).size, 4);
  assert.deepEqual(rows.map(r => [r.admissionPeriod, r.cut50Original, r.cut70Original]), [
    ['수시',6.2,1.8], ['정시(다)',3.3,5.8], ['수시',6.7,9], ['정시(다)',6.8,7.9],
    ['수시',6.5,7.9], ['정시(다)',7.5,8], ['수시',5.8,5.1], ['정시(다)',7.2,7.9],
  ]);
  for (const row of rows) {
    assert.deepEqual(validateAdmissionRecord(row), []);
    assert.equal(normalizeAdmissionRecord(row).admissionPeriod, row.admissionPeriod);
    assert.equal(row.admissionCategory, '학생부교과');
    assert.equal(row.dataAvailability, 'confirmed-cut');
    assert.ok(row.sourceUrl.includes('unvCd=0000093'));
    assert.equal(row.averageGradeOriginal, null);
  }
});

test('수집 dedupe는 모집시기를 구분하고 진짜 동일키 값 충돌은 여전히 제외한다', () => {
  assert.equal(uniqueRecords([...rows, ...rows]).records.length, 8);
  assert.deepEqual(uniqueRecords(rows).conflicts, []);
  const conflict = uniqueRecords([rows[0], {...rows[0], cut70Original: 2}]);
  assert.equal(conflict.records.length, 0);
  assert.deepEqual(conflict.conflicts, [admissionInterestKey(rows[0])]);
  const { admissionPeriod, ...legacy } = rows[0];
  assert.equal(admissionInterestKey(legacy), '2026|대신대학교|신학과|학생부교과|목사추천전형');
});

test('파서는 공식 첫 열 모집시기를 버리지 않는다', async () => {
  const source = await readFile(new URL('../scripts/audit-adiga-class-results-2026.mjs', import.meta.url), 'utf8');
  const context = vm.createContext({ regionName:'경상북도', RESULT_YEAR:2026 });
  const start = source.indexOf('function decodeHtml(');
  const end = source.indexOf('const universities = await listUniversities();');
  vm.runInContext(source.slice(start,end),context);
  // 원표의 학생부 환산등급 50/70 열과 모집시기 첫 열을 재현한다.
  const header = Array.from({length:19},(_,i)=> i===1?'전형유형':i===14?'학생부 환산등급 50%':i===15?'학생부 환산등급 70%':'').map(s=>`<th>${s}</th>`).join('');
  const data = period => `<tr>${[period,'학생부위주(교과)','학생부교과(일반전형)',...Array(11).fill('-'),'6.7','9','-','-','-'].map(s=>`<td>${s}</td>`).join('')}</tr>`;
  context.html=`<h2>선교학부 / 대신대학교 <span>일반과정</span></h2><table>${Array(4).fill(`<tr>${header}</tr>`).join('')}${data('수시')}${data('정시(다)')}</table>`;
  const parsed=vm.runInContext("parsePopup(html,{name:'대신대학교'},'https://www.adiga.kr/')",context);
  assert.deepEqual(Array.from(parsed.records,r=>r.admissionPeriod),['수시','정시(다)']);
  assert.equal(uniqueRecords(parsed.records).records.length,2);
});

test('전국 감사에서 대신대 소스경고가 실제 결과 복구로 해소되고 다른 경북 결과는 불변이다', () => {
  const otherUniversities = admissionResultsByRegion2026.gyeongbuk.filter(r=>r.university!=='대신대학교');
  assert.equal(otherUniversities.length,1353);
  assert.deepEqual(otherUniversities, previous.filter(r=>r.university!=='대신대학교'));
  assert.equal(admissionResultsByYear[2026].length,16259+8);
  const dashboard=buildAdmissionDataDashboard(admissionResultsByYear[2026],UNIVERSITIES,{universityAudits:UNIVERSITY_AUDIT_2026});
  assert.equal(dashboard.universities.find(r=>r.university==='대신대학교').total,8);
  assert.equal(dashboard.warnings.filter(r=>r.university==='대신대학교').length,0);
  assert.equal(UNIVERSITY_AUDIT_2026.find(r=>r.universityName==='대신대학교').failureReason,null);
});

test('대신대 학생 검색은 두 모집시기를 보존하고 학종 결과를 만들지 않는다', () => {
  const data=rows.map(normalizeAdmissionRecord);
  assert.equal(filterAdmissionRecords(data,{university:'대신대학교',admissionCategory:'학생부교과'}).length,8);
  assert.equal(filterAdmissionRecords(data,{department:'글로벌비즈니스'}).length,2);
  assert.equal(filterAdmissionRecords(data,{admissionCategory:'학생부종합'}).length,0);
});

test('관심 대학 JSON 복원과 인쇄에서도 수시와 정시를 구분한다', () => {
  const restored=normalizeAdmissionInterests(JSON.parse(JSON.stringify(rows)));
  assert.equal(restored.length,8);
  assert.equal(new Set(restored.map(admissionInterestKey)).size,8);
  const model=buildPrintReportModel({admissionInterests:restored});
  const html=renderPrintReport(model);
  assert.match(html,/목사추천전형 · 수시/);
  assert.match(html,/목사추천전형 · 정시\(다\)/);
});

test('관리자 원본 수치 표시는 미공개 평균을 0으로 만들지 않고 모집시기를 구분한다', async () => {
  const source=await readFile(new URL('../src/teacher-admission-dashboard.mjs',import.meta.url),'utf8');
  const definition=source.match(/const valueLabel = [^\n]+/)[0];
  const context=vm.createContext({});
  vm.runInContext(definition,context);
  assert.equal(vm.runInContext('valueLabel(null)',context),'-');
  assert.equal(vm.runInContext('valueLabel(1.8)',context),'1.80');
  assert.match(source,/record\.admissionPeriod/);
});

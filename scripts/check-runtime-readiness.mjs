import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ADMISSION_REFERENCE_DATA } from '../src/admission-reference.mjs';
import { ADMISSION_VIEW_MODES, prepareAdmissionResultView } from '../src/admission-result-view.mjs';

function staticImportGraph(entry) {
  const seen = new Set();
  const visit = (file) => {
    const absolute = resolve(file.split('?')[0]);
    if (seen.has(absolute) || !existsSync(absolute)) return;
    seen.add(absolute);
    const source = readFileSync(absolute, 'utf8');
    const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) {
      if (match[1].startsWith('.')) visit(resolve(dirname(absolute), match[1]));
    }
  };
  visit(entry);
  return [...seen];
}

const initialModules = staticImportGraph('src/app.mjs');
const benchmarkTimes = [];
for (let index = 0; index < 30; index += 1) {
  const startedAt = performance.now();
  prepareAdmissionResultView(ADMISSION_REFERENCE_DATA, {
    admissionViewMode: ADMISSION_VIEW_MODES.SUBJECT,
    filters: {
      region: index % 2 ? '부산광역시' : '',
      ownership: index % 3 === 0 ? 'national' : '',
      university: '',
      field: index % 4 === 0 ? 'natural' : '',
      department: index % 5 === 0 ? '공학' : '',
      admissionName: '',
      schoolRegion: '부산광역시',
      schoolGender: 'male',
    },
    comparisonValue: 2,
    comparisonEnabled: true,
  });
  benchmarkTimes.push(performance.now() - startedAt);
}
benchmarkTimes.sort((left, right) => left - right);

const report = {
  admissionRecords: ADMISSION_REFERENCE_DATA.length,
  filterIterations: benchmarkTimes.length,
  filterAverageMs: Number((benchmarkTimes.reduce((sum, value) => sum + value, 0) / benchmarkTimes.length).toFixed(2)),
  filterP95Ms: Number(benchmarkTimes[Math.floor(benchmarkTimes.length * 0.95) - 1].toFixed(2)),
  filterMaxMs: Number(benchmarkTimes.at(-1).toFixed(2)),
  initialStaticModuleCount: initialModules.length,
  initialStaticJsBytes: initialModules.reduce((sum, file) => sum + statSync(file).size, 0),
  htmlBytes: statSync('index.html').size,
  cssBytes: statSync('styles.css').size,
  largestInitialModules: initialModules
    .map((file) => ({ file: relative(process.cwd(), file), bytes: statSync(file).size }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 5),
};

console.log(JSON.stringify(report, null, 2));

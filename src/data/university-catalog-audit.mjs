import {
  ADMISSION_REGION_ORDER,
  getAvailableUniversities,
  normalizeAdmissionRegion,
} from '../admission-filter-options.mjs';

const koSort = (left, right) => String(left).localeCompare(String(right), 'ko');
const cleanName = (value) => String(value ?? '').trim();
const uniqueBy = (items, keyOf) => [...new Map(items.map((item) => [keyOf(item), item])).values()];

function groupDuplicates(items, keyOf, type) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyOf(item);
    if (!key) return;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });
  return [...groups]
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => Object.freeze({ type, key, entries: Object.freeze(entries) }));
}

/** ID, 어디가 코드, 동일 지역·대학명 기준의 중복을 각각 탐지한다. */
export function findDuplicateUniversities(universities = []) {
  const canonical = universities.map((item) => ({
    ...item,
    name: cleanName(item.name),
    region: normalizeAdmissionRegion(item.region),
  }));
  return Object.freeze([
    ...groupDuplicates(canonical, (item) => item.universityId, 'universityId'),
    ...groupDuplicates(canonical, (item) => item.adigaCode, 'adigaCode'),
    ...groupDuplicates(canonical, (item) => item.name && `${item.region}\u0000${item.name}`, 'name-region'),
  ]);
}

function masterMatch(official, masters) {
  if (official.adigaCode) {
    const byCode = masters.find((item) => item.adigaCode === official.adigaCode);
    if (byCode) return byCode;
  }
  return masters.find((item) => item.name === official.name);
}

function recordMatch(record, masters) {
  if (record.universityId) {
    const byId = masters.find((item) => item.universityId === record.universityId);
    if (byId) return byId;
  }
  return masters.find((item) => item.name === record.university);
}

const issueLabel = (item) => Object.freeze({
  universityId: item.universityId ?? null,
  university: item.name ?? item.university ?? null,
  region: normalizeAdmissionRegion(item.region),
});

/**
 * 어디가 공식 스냅샷·대학 마스터·학생 드롭다운·입시결과 연결을 전국 단위로 대조한다.
 * 데이터 보정은 하지 않고, 발견된 차이를 명시적인 감사 결과로 반환한다.
 */
export function auditUniversityCatalog({
  officialUniversities = [],
  universities = [],
  admissionResults = [],
  regions = ADMISSION_REGION_ORDER,
} = {}) {
  const official = officialUniversities.map((item) => ({
    ...item,
    name: cleanName(item.name),
    region: normalizeAdmissionRegion(item.region),
  }));
  const masters = universities.map((item) => ({
    ...item,
    name: cleanName(item.name),
    region: normalizeAdmissionRegion(item.region),
  }));
  const results = admissionResults.map((item) => ({
    ...item,
    university: cleanName(item.university),
    region: normalizeAdmissionRegion(item.region),
  }));

  const officialMissingFromMaster = official.filter((item) => !masterMatch(item, masters));
  const masterDuplicates = findDuplicateUniversities(masters);
  const resultWithoutUniversityId = results.filter((item) => !item.universityId);
  const resultWithoutMaster = results.filter((item) => !recordMatch(item, masters));
  const resultNameMismatches = results.filter((item) => {
    const matched = recordMatch(item, masters);
    return matched && item.university !== matched.name;
  });

  const officialRegionMismatches = official.flatMap((item) => {
    const matched = masterMatch(item, masters);
    return matched && item.region !== matched.region
      ? [Object.freeze({ university: item.name, officialRegion: item.region, masterRegion: matched.region })]
      : [];
  });
  const resultRegionMismatches = results.flatMap((item) => {
    const matched = recordMatch(item, masters);
    return matched && item.region !== matched.region
      ? [Object.freeze({ university: item.university, resultRegion: item.region, masterRegion: matched.region })]
      : [];
  });

  const regionNames = [...new Set([
    ...regions,
    ...official.map((item) => item.region),
    ...masters.map((item) => item.region),
  ].filter(Boolean))];

  const byRegion = regionNames.map((region) => {
    const officialRegion = official.filter((item) => item.region === region);
    const masterRegion = masters.filter((item) => item.region === region);
    const resultRegion = results.filter((item) => item.region === region);
    const dropdownNames = getAvailableUniversities(admissionResults, { region }, universities);
    const dropdownSet = new Set(dropdownNames);
    const missingFromDropdown = masterRegion.filter((item) => !dropdownSet.has(item.name));
    const missingFromMaster = officialRegion.filter((item) => !masterMatch(item, masters));
    const duplicateGroups = masterDuplicates.filter((group) => group.entries.some((item) => item.region === region));
    const regionMismatches = [
      ...officialRegionMismatches.filter((item) => item.officialRegion === region || item.masterRegion === region),
      ...resultRegionMismatches.filter((item) => item.resultRegion === region || item.masterRegion === region),
    ];
    const resultUniversityCount = new Set(resultRegion.map((item) => item.university).filter(Boolean)).size;

    return Object.freeze({
      region,
      officialUniversityCount: uniqueBy(officialRegion, (item) => item.adigaCode || item.name).length,
      registeredUniversityCount: uniqueBy(masterRegion, (item) => item.universityId || item.name).length,
      dropdownUniversityCount: dropdownNames.length,
      admissionResultUniversityCount: resultUniversityCount,
      missingUniversityCount: missingFromMaster.length + missingFromDropdown.length,
      duplicateUniversityCount: duplicateGroups.length,
      regionMismatchCount: regionMismatches.length,
      missingFromMaster: Object.freeze(missingFromMaster.map(issueLabel)),
      missingFromDropdown: Object.freeze(missingFromDropdown.map(issueLabel)),
      duplicateGroups: Object.freeze(duplicateGroups),
      regionMismatches: Object.freeze(regionMismatches),
    });
  });

  return Object.freeze({
    totals: Object.freeze({
      officialUniversityCount: uniqueBy(official, (item) => item.adigaCode || `${item.region}\u0000${item.name}`).length,
      registeredUniversityCount: uniqueBy(masters, (item) => item.universityId || `${item.region}\u0000${item.name}`).length,
      dropdownUniversityCount: byRegion.reduce((sum, item) => sum + item.dropdownUniversityCount, 0),
      admissionResultUniversityCount: new Set(results.map((item) => item.university).filter(Boolean)).size,
      officialMissingFromMasterCount: officialMissingFromMaster.length,
      masterMissingFromDropdownCount: byRegion.reduce((sum, item) => sum + item.missingFromDropdown.length, 0),
      resultWithoutUniversityIdCount: resultWithoutUniversityId.length,
      resultWithoutMasterCount: resultWithoutMaster.length,
      resultNameMismatchCount: resultNameMismatches.length,
      duplicateUniversityCount: masterDuplicates.length,
      regionMismatchCount: officialRegionMismatches.length + resultRegionMismatches.length,
    }),
    byRegion: Object.freeze(byRegion),
    issues: Object.freeze({
      officialMissingFromMaster: Object.freeze(officialMissingFromMaster.map(issueLabel)),
      resultWithoutUniversityId: Object.freeze(resultWithoutUniversityId.map(issueLabel)),
      resultWithoutMaster: Object.freeze(resultWithoutMaster.map(issueLabel)),
      resultNameMismatches: Object.freeze(resultNameMismatches.map((item) => {
        const matched = recordMatch(item, masters);
        return Object.freeze({
          universityId: item.universityId,
          resultName: item.university,
          masterName: matched?.name ?? null,
          region: item.region,
        });
      })),
      duplicateUniversities: Object.freeze(masterDuplicates),
      officialRegionMismatches: Object.freeze(officialRegionMismatches),
      resultRegionMismatches: Object.freeze(resultRegionMismatches),
    }),
  });
}

export function sortUniversityAuditIssues(items = []) {
  return [...items].sort((left, right) => koSort(left.university ?? left.resultName, right.university ?? right.resultName));
}

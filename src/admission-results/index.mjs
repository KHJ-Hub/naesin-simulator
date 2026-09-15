import { admissionResults2026Regional } from './2026/index.mjs';
export { admissionResultsByRegion2026 } from './2026/index.mjs';
export { loadAdmissionResultsByRegion, clearAdmissionResultsCache, admissionResultRegions } from '../admission-results-loader.mjs';

export const admissionResultsByYear = Object.freeze({ 2026: admissionResults2026Regional });
export const availableAdmissionResultYears = Object.freeze(Object.keys(admissionResultsByYear).map(Number));

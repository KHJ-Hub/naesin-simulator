import { admissionResults2026 } from './admission-results-2026.mjs';

export const admissionResultsByYear = Object.freeze({ 2026: admissionResults2026 });
export const availableAdmissionResultYears = Object.freeze(Object.keys(admissionResultsByYear).map(Number));

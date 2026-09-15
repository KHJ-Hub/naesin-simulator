import { admissionResults2026Busan } from './busan.mjs';
import { admissionResults2026Ulsan } from './ulsan.mjs';
import { admissionResults2026Gyeongnam } from './gyeongnam.mjs';
import { admissionResults2026Incheon } from './incheon.mjs';

export const admissionResultsByRegion2026 = Object.freeze({
  busan: admissionResults2026Busan,
  ulsan: admissionResults2026Ulsan,
  gyeongnam: admissionResults2026Gyeongnam,
  incheon: admissionResults2026Incheon,
});
export const admissionResults2026Regional = Object.freeze([
  ...admissionResults2026Busan,
  ...admissionResults2026Ulsan,
  ...admissionResults2026Gyeongnam,
  ...admissionResults2026Incheon,
]);

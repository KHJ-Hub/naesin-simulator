import { admissionResults2026Busan } from './busan.mjs';
import { admissionResults2026Ulsan } from './ulsan.mjs';
import { admissionResults2026Gyeongnam } from './gyeongnam.mjs';

export const admissionResultsByRegion2026 = Object.freeze({
  busan: admissionResults2026Busan,
  ulsan: admissionResults2026Ulsan,
  gyeongnam: admissionResults2026Gyeongnam,
});
export const admissionResults2026Regional = Object.freeze([
  ...admissionResults2026Busan,
  ...admissionResults2026Ulsan,
  ...admissionResults2026Gyeongnam,
]);


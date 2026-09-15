import { admissionResults2026Busan } from './busan.mjs';
import { admissionResults2026Ulsan } from './ulsan.mjs';
import { admissionResults2026Gyeongnam } from './gyeongnam.mjs';
import { admissionResults2026Incheon } from './incheon.mjs';
import { admissionResults2026Gyeonggi } from './gyeonggi.mjs';
import { admissionResults2026Seoul } from './seoul.mjs';
import { admissionResults2026Daegu } from './daegu.mjs';
import { admissionResults2026Gyeongbuk } from './gyeongbuk.mjs';
import { admissionResults2026Daejeon } from './daejeon.mjs';
import { admissionResults2026Sejong } from './sejong.mjs';
import { admissionResults2026Chungnam } from './chungnam.mjs';

export const admissionResultsByRegion2026 = Object.freeze({
  busan: admissionResults2026Busan,
  ulsan: admissionResults2026Ulsan,
  gyeongnam: admissionResults2026Gyeongnam,
  incheon: admissionResults2026Incheon,
  gyeonggi: admissionResults2026Gyeonggi,
  seoul: admissionResults2026Seoul,
  daegu: admissionResults2026Daegu,
  gyeongbuk: admissionResults2026Gyeongbuk,
  daejeon: admissionResults2026Daejeon,
  sejong: admissionResults2026Sejong,
  chungnam: admissionResults2026Chungnam,
});
export const admissionResults2026Regional = Object.freeze([
  ...admissionResults2026Busan,
  ...admissionResults2026Ulsan,
  ...admissionResults2026Gyeongnam,
  ...admissionResults2026Incheon,
  ...admissionResults2026Gyeonggi,
  ...admissionResults2026Seoul,
  ...admissionResults2026Daegu,
  ...admissionResults2026Gyeongbuk,
  ...admissionResults2026Daejeon,
  ...admissionResults2026Sejong,
  ...admissionResults2026Chungnam,
]);

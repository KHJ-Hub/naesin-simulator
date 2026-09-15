/**
 * 대입정보포털 어디가의 2026학년도 전형 결과 중
 * 부산·울산·경남 지역 대학에서 공식 표로 확인한 항목만 담는다.
 *
 * 어디가 페이지에 자료 갱신일이 별도로 표시되지 않은 경우 updatedAt은 null이다.
 * cut 값이 공개되지 않은 모집단위는 임의로 보완하지 않고 이 모듈에서 제외한다.
 */
const ADIGA_SOURCE = '대입정보포털 어디가';
import { convertGrade9ToGrade5, DEFAULT_BUSAN_CONVERSION_DATASET } from '../grade-conversion/grade9-to-grade5.mjs';
import { classifyAdmissionEligibility } from '../admission-eligibility.mjs';
const BUSAN_NATIONAL = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000014';
const ULSAN = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000158';
const GYEONGSANG_NATIONAL = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000007';
const PUKYONG = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000013';
const DONG_EUI = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000107';
const CHANGWON = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000028';
const DONG_A = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000105';
const BUSAN_CATHOLIC = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000114';
const KOSIN = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000071';
const INJE = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000164';
const KYUNGNAM = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000059';
const INCHEON = 'https://admission.inu.ac.kr/detail.do?board_seq=15139&categoryid=52&menuurl=4428MQNdeF7ekIPFWbVCAg%3D%3D&pageNo=1&userpwd=';
const GACHON = 'https://admission.gachon.ac.kr/admission/html/rolling/resultView.asp?BOARD_IDX=30155&page=1&s_cate=BBS0401&s_code=BOARD_TITLE';
const INHA_ADIGA = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=0000169';

const item = (university, region, department, admissionName, category, cut50, cut70, source, updatedAt = null, sourceName = source === INCHEON ? '인천대학교 입학처' : ADIGA_SOURCE) => {
  const converted50 = cut50 == null ? null : convertGrade9ToGrade5(cut50, DEFAULT_BUSAN_CONVERSION_DATASET);
  const converted70 = cut70 == null ? null : convertGrade9ToGrade5(cut70, DEFAULT_BUSAN_CONVERSION_DATASET);
  const eligibility = classifyAdmissionEligibility({ admissionName });
  return {
    referenceYear: 2026, university, region, field: null, department, admissionName,
    // 기존 category는 호환용으로 보존하며 admissionCategory를 새 기준 필드로 사용한다.
    admissionCategory: category, admissionType: null, category, cut50, cut70,
    cut50Original: cut50, cut70Original: cut70,
    cut50Converted: converted50?.convertedValue ?? null, cut70Converted: converted70?.convertedValue ?? null,
    averageGradeOriginal: null, averageGradeConverted: null,
    eligibilityType: eligibility.eligibilityType,
    eligibilityVerification: eligibility.eligibilityVerification,
    regionalEligibilityConfirmed: false,
    studentDefaultVisible: eligibility.studentDefaultVisible,
    // 인천대 공식 자료는 70% cut만 공개했음을 자료 확인 단계에서 명시했다.
    dataAvailability: source === INCHEON ? 'cut70-only' : 'confirmed-cut',
    conversionDataset: DEFAULT_BUSAN_CONVERSION_DATASET,
    interpolation: { cut50: Boolean(converted50?.interpolation), cut70: Boolean(converted70?.interpolation) },
    conversionMethod: 'busan-grade5-cumulative-anchor-interpolation-v1',
    conversionBasis: '부산광역시교육청학력개발원 진로진학지원센터 98개교 15,978명 고2 1학기 누적 등급평균 분석 자료',
    conversionSampleSize: 15978, conversionSchoolCount: 98, convertedScale: 5, isApproximate: true,
    source: sourceName, sourceUrl: source, updatedAt,
  };
};

export const admissionResults2026 = Object.freeze([
  item('부산대학교', '부산광역시', '물리교육과', '학생부교과(학생부교과전형)', '학생부교과', 3.35, 3.67, BUSAN_NATIONAL),
  item('부산대학교', '부산광역시', '생물교육과', '학생부교과(학생부교과전형)', '학생부교과', 2.86, 2.97, BUSAN_NATIONAL),
  item('부산대학교', '부산광역시', '수학교육과', '학생부교과(학생부교과전형)', '학생부교과', 2.10, 2.28, BUSAN_NATIONAL),
  item('부산대학교', '부산광역시', '건축공학과', '학생부종합(학생부종합전형)', '학생부종합', 2.79, 2.92, BUSAN_NATIONAL),
  item('부산대학교', '부산광역시', '화학교육과', '학생부종합(학생부종합전형)', '학생부종합', 2.28, 2.96, BUSAN_NATIONAL),

  item('울산대학교', '울산광역시', '디자인융합학부', '학생부교과(일반교과 전형)', '학생부교과', 4.30, 4.60, ULSAN),
  item('울산대학교', '울산광역시', '바이오메디컬헬스학부', '학생부교과(일반교과 전형)', '학생부교과', 3.60, 3.50, ULSAN),
  item('울산대학교', '울산광역시', '경영경제융합학부', '학생부교과(일반교과 전형)', '학생부교과', 4.00, 4.40, ULSAN),
  item('울산대학교', '울산광역시', '의예과', '학생부교과(지역교과 전형)', '학생부교과', 1.03, 1.00, ULSAN),

  item('경상국립대학교', '경상남도', '지역시스템공학과', '학생부교과(일반전형)', '학생부교과', 4.99, 5.45, GYEONGSANG_NATIONAL),
  item('경상국립대학교', '경상남도', '생물교육과', '학생부교과(일반전형)', '학생부교과', 3.57, 3.66, GYEONGSANG_NATIONAL),
  item('경상국립대학교', '경상남도', '국어교육과', '학생부교과(일반전형)', '학생부교과', 2.91, 2.98, GYEONGSANG_NATIONAL),
  item('경상국립대학교', '경상남도', '국어교육과', '학생부교과(지역인재전형)', '학생부교과', 2.89, 2.93, GYEONGSANG_NATIONAL),
  item('경상국립대학교', '경상남도', '경제학부', '학생부교과(지역인재전형)', '학생부교과', 4.23, 4.46, GYEONGSANG_NATIONAL),
  item('경상국립대학교', '경상남도', '간호학과', '학생부교과(지역인재전형)', '학생부교과', 2.72, 2.77, GYEONGSANG_NATIONAL),

  item('국립부경대학교', '부산광역시', '과학컴퓨팅학과', '학생부교과(교과성적우수인재)', '학생부교과', 3.80, 3.86, PUKYONG),
  item('국립부경대학교', '부산광역시', '법학과', '학생부교과(교과성적우수인재)', '학생부교과', 3.26, 3.51, PUKYONG),
  item('국립부경대학교', '부산광역시', '국제통상학부', '학생부교과(교과성적우수인재)', '학생부교과', 3.05, 3.14, PUKYONG),
  item('국립부경대학교', '부산광역시', '행정복지학부', '학생부교과(교과성적우수인재)', '학생부교과', 3.28, 3.38, PUKYONG),
  item('국립부경대학교', '부산광역시', '법학과', '학생부교과(지역혁신인재)', '학생부교과', 2.87, 2.88, PUKYONG),
  item('국립부경대학교', '부산광역시', '국제통상학부', '학생부교과(지역혁신인재)', '학생부교과', 3.10, 3.16, PUKYONG),

  item('동의대학교', '부산광역시', '법학과', '학생부교과(일반고교과전형)', '학생부교과', 4.00, 4.16, DONG_EUI),
  item('동의대학교', '부산광역시', '문헌정보학과', '학생부교과(일반고교과전형)', '학생부교과', 3.91, 4.16, DONG_EUI),
  item('동의대학교', '부산광역시', '사회복지학과', '학생부교과(일반고교과전형)', '학생부교과', 3.91, 4.08, DONG_EUI),

  item('국립창원대학교', '경상남도', '건축학부 건축공학전공', '학생부교과(학업성적우수자전형)', '학생부교과', 4.48, 4.52, CHANGWON),
  item('국립창원대학교', '경상남도', '건축학부 건축학전공', '학생부교과(학업성적우수자전형)', '학생부교과', 3.77, 3.83, CHANGWON),
  item('국립창원대학교', '경상남도', '국제관계학과', '학생부교과(학업성적우수자전형)', '학생부교과', 4.17, 4.23, CHANGWON),

  item('동아대학교', '부산광역시', '컴퓨터・AI공학부 AI학과', '학생부교과(교과성적우수자전형)', '학생부교과', 3.83, 4.33, DONG_A),
  item('동아대학교', '부산광역시', '조경학과', '학생부교과(교과성적우수자전형)', '학생부교과', 3.58, 3.83, DONG_A),
  item('동아대학교', '부산광역시', '건축학과', '학생부교과(교과성적우수자전형)', '학생부교과', 3.17, 3.33, DONG_A),
  item('동아대학교', '부산광역시', '교육학과', '학생부교과(교과성적우수자전형)', '학생부교과', 3.08, 3.33, DONG_A),
  item('동아대학교', '부산광역시', '경찰학과', '학생부교과(교과성적우수자전형)', '학생부교과', 3.00, 3.08, DONG_A),
  item('동아대학교', '부산광역시', '조경학과', '학생부교과(지역인재교과전형)', '학생부교과', 3.17, 3.42, DONG_A),
  item('동아대학교', '부산광역시', '건축학과', '학생부교과(지역인재교과전형)', '학생부교과', 3.17, 3.42, DONG_A),
  item('동아대학교', '부산광역시', '교육학과', '학생부교과(지역인재교과전형)', '학생부교과', 2.67, 2.83, DONG_A),

  item('부산가톨릭대학교', '부산광역시', '간호학과', '학생부교과(교과성적우수자전형)', '학생부교과', 1.92, 1.92, BUSAN_CATHOLIC),
  item('부산가톨릭대학교', '부산광역시', '병원경영학과', '학생부교과(교과성적우수자전형)', '학생부교과', 4.00, 4.00, BUSAN_CATHOLIC),
  item('부산가톨릭대학교', '부산광역시', '언어청각치료학과', '학생부교과(교과성적우수자전형)', '학생부교과', 3.58, 3.58, BUSAN_CATHOLIC),
  item('부산가톨릭대학교', '부산광역시', '사회복지학과', '학생부교과(교과성적우수자전형)', '학생부교과', 4.00, 4.00, BUSAN_CATHOLIC),
  item('부산가톨릭대학교', '부산광역시', '유통마케팅학과', '학생부교과(교과성적우수자전형)', '학생부교과', 4.50, 4.50, BUSAN_CATHOLIC),
  item('부산가톨릭대학교', '부산광역시', '컴퓨터정보공학과', '학생부교과(교과성적우수자전형)', '학생부교과', 4.75, 4.75, BUSAN_CATHOLIC),

  item('고신대학교', '부산광역시', '의예과', '학생부교과(일반고전형)', '학생부교과', 1.23, 1.28, KOSIN),
  item('고신대학교', '부산광역시', '기독교교육과', '학생부교과(일반고전형)', '학생부교과', 3.93, 4.52, KOSIN),
  item('고신대학교', '부산광역시', '언어청각치료학과', '학생부교과(일반고전형)', '학생부교과', 4.07, 4.47, KOSIN),
  item('고신대학교', '부산광역시', '유아교육과', '학생부교과(일반고전형)', '학생부교과', 3.83, 3.88, KOSIN),
  item('고신대학교', '부산광역시', '사회복지학과', '학생부교과(일반고전형)', '학생부교과', 4.03, 4.13, KOSIN),
  item('고신대학교', '부산광역시', '자율전공학부', '학생부교과(일반고전형)', '학생부교과', 4.56, 5.13, KOSIN),
  item('고신대학교', '부산광역시', '간호학과', '학생부교과(지역인재전형)', '학생부교과', 2.24, 2.27, KOSIN),
  item('고신대학교', '부산광역시', '의예과', '학생부교과(지역인재전형)', '학생부교과', 1.27, 1.31, KOSIN),

  item('인제대학교', '경상남도', '반려동물보건학과', '학생부교과(학생부교과전형)', '학생부교과', 3.50, 3.70, INJE),
  item('인제대학교', '경상남도', '경영계열', '학생부교과(학생부교과전형)', '학생부교과', 5.10, 5.40, INJE),
  item('인제대학교', '경상남도', '특수교육과', '학생부교과(학생부교과전형)', '학생부교과', 3.90, 4.00, INJE),
  item('인제대학교', '경상남도', '컴퓨터・AI계열', '학생부교과(학생부교과전형)', '학생부교과', 4.70, 5.10, INJE),
  item('인제대학교', '경상남도', '의생명보건계열', '학생부교과(학생부교과전형)', '학생부교과', 4.20, 4.50, INJE),
  item('인제대학교', '경상남도', '미디어・콘텐츠계열', '학생부교과(학생부교과전형)', '학생부교과', 5.05, 5.40, INJE),
  item('인제대학교', '경상남도', '약학과', '학생부교과(지역인재Ⅱ전형)', '학생부교과', 1.16, 1.22, INJE),
  item('인제대학교', '경상남도', '간호학과', '학생부교과(지역인재Ⅰ전형)', '학생부교과', 1.90, 2.00, INJE),

  item('경남대학교', '경상남도', '보건의료정보학과', '학생부교과(일반전형)', '학생부교과', 4.80, 5.00, KYUNGNAM),
  item('경남대학교', '경상남도', '국어교육과', '학생부교과(일반전형)', '학생부교과', 2.70, 3.10, KYUNGNAM),
  item('경남대학교', '경상남도', '영어교육과', '학생부교과(일반전형)', '학생부교과', 2.80, 3.10, KYUNGNAM),
  item('경남대학교', '경상남도', '사회복지학과', '학생부교과(일반전형)', '학생부교과', 3.90, 4.20, KYUNGNAM),
  item('경남대학교', '경상남도', '행정학과', '학생부교과(일반전형)', '학생부교과', 3.90, 4.30, KYUNGNAM),
  item('경남대학교', '경상남도', '경찰학과', '학생부교과(일반전형)', '학생부교과', 3.50, 3.80, KYUNGNAM),
  item('경남대학교', '경상남도', '국어교육과', '학생부교과(지역인재전형)', '학생부교과', 2.80, 3.00, KYUNGNAM),
  item('경남대학교', '경상남도', '영어교육과', '학생부교과(지역인재전형)', '학생부교과', 2.90, 3.10, KYUNGNAM),
  item('경남대학교', '경상남도', '사회복지학과', '학생부교과(지역인재전형)', '학생부교과', 4.20, 4.60, KYUNGNAM),
  item('경남대학교', '경상남도', '수학교육과', '학생부교과(지역인재전형)', '학생부교과', 3.10, 3.40, KYUNGNAM),

  // 인천대학교 입학처의 2026학년도 수시모집 결과표는 최종등록자 70% cut만 공개한다.
  // 50% cut은 추정하지 않고 null로 유지한다.
  item('인천대학교', '인천광역시', '국어국문학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.10, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '영어영문학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.24, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '독어독문학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.05, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '불어불문학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.05, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '일본지역문화학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.24, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '중어중국학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.06, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '수학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.81, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '물리학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.94, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '화학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.70, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '패션산업학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.08, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '해양학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.98, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '사회복지학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.98, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '미디어커뮤니케이션학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.24, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '문헌정보학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.24, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '창의인재개발학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.24, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '행정학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.97, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '정치외교학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.07, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '경제학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.88, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', 'Global Trade & Service학부', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.89, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '소비자학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.73, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '기계공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.76, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '전기공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.78, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '전자공학부', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.65, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '산업경영공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.82, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '신소재공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.66, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '안전공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.02, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '에너지화학공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.38, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '바이오-로봇시스템공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.00, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '컴퓨터공학부', '학생부교과(교과성적우수자전형)', '학생부교과', null, 2.93, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '정보통신공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.01, INCHEON, '2026-04-01'),
  item('인천대학교', '인천광역시', '임베디드시스템공학과', '학생부교과(교과성적우수자전형)', '학생부교과', null, 3.19, INCHEON, '2026-04-01'),

  item('가천대학교', '경기도', '약학과', '학생부교과(학생부우수자전형)', '학생부교과', 2.39, 2.69, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '의예과', '학생부교과(학생부우수자전형)', '학생부교과', 1.71, 1.81, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '경영학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.60, 3.90, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '회계세무학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.52, 3.53, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '관광경영학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.66, 3.76, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '의료산업경영학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.85, 3.87, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '금융·빅데이터학부', '학생부교과(학생부우수자전형)', '학생부교과', 3.37, 3.51, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '경제학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.51, 3.83, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '응용통계학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.51, 3.55, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '심리학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.18, 3.28, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '미디어커뮤니케이션학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.54, 3.86, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '사회복지학과', '학생부교과(학생부우수자전형)', '학생부교과', 4.06, 4.14, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '유아교육학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.51, 3.79, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', '패션산업학과', '학생부교과(학생부우수자전형)', '학생부교과', 3.79, 3.90, GACHON, '2026-05-29', '가천대학교 입학처'),
  item('가천대학교', '경기도', 'AI인문대학', '학생부교과(학생부우수자전형)', '학생부교과', 3.78, 3.95, GACHON, '2026-05-29', '가천대학교 입학처'),

  // 어디가의 "선발인원 3명 이하 모집단위 전형별 공개" 표를 개별 학과에 임의 배정하지 않고 합산 모집단위로 보존한다.
  item('인하대학교', '인천광역시', '선발인원 3명 이하 모집단위 합산', '학생부종합(농어촌학생)', '학생부종합', 2.92, 3.20, INHA_ADIGA),
  item('인하대학교', '인천광역시', '선발인원 3명 이하 모집단위 합산', '학생부종합(고른기회)', '학생부종합', 3.46, 3.86, INHA_ADIGA),
]);

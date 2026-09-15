/**
 * 대입정보포털 어디가의 2026학년도 전형 결과 중
 * 부산·울산·경남 지역 대학에서 공식 표로 확인한 항목만 담는다.
 *
 * 어디가 페이지에 자료 갱신일이 별도로 표시되지 않은 경우 updatedAt은 null이다.
 * cut 값이 공개되지 않은 모집단위는 임의로 보완하지 않고 이 모듈에서 제외한다.
 */
const ADIGA_SOURCE = '대입정보포털 어디가';
const BUSAN_NATIONAL = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000014';
const ULSAN = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000158';
const GYEONGSANG_NATIONAL = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000007';
const PUKYONG = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000013';
const DONG_EUI = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000107';
const CHANGWON = 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000028';

const item = (university, region, department, admissionName, category, cut50, cut70, source) => ({
  referenceYear: 2026,
  university,
  region,
  field: null,
  department,
  admissionName,
  admissionType: category,
  category,
  cut50,
  cut70,
  source: ADIGA_SOURCE,
  sourceUrl: source,
  updatedAt: null,
});

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
]);

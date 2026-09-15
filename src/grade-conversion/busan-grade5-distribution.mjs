/**
 * 부산광역시교육청학력개발원 진로진학지원센터 공식 PDF 대응표.
 * 각 행은 [5등급제 평균등급, 9등급제 대응 평균등급]이다.
 * 원문 표에 없는 중간값은 이 기준점 사이에서만 보간한다.
 */
export const BUSAN_GRADE5_G1_2SEM_14331 = Object.freeze([
  [1.00, 1.15], [1.08, 1.59], [1.16, 1.78], [1.24, 1.98], [1.33, 2.14],
  [1.42, 2.32], [1.50, 2.45], [1.66, 2.72], [1.83, 3.03], [2.00, 3.35],
  [2.16, 3.60], [2.33, 3.91], [2.50, 4.20], [2.66, 4.46], [2.83, 4.73],
  [3.00, 5.03], [3.16, 5.28], [3.33, 5.58], [3.50, 5.86], [3.66, 6.08],
  [3.83, 6.37], [4.00, 6.67], [4.16, 6.93], [4.33, 7.20], [4.50, 7.48],
  [4.66, 7.71], [4.83, 8.00], [5.00, 9.00],
]);

export const BUSAN_GRADE5_G2_1SEM_15978 = Object.freeze([
  [1.00, 1.09], [1.04, 1.38], [1.08, 1.47], [1.16, 1.68], [1.24, 1.87],
  [1.33, 2.07], [1.42, 2.25], [1.50, 2.39], [1.66, 2.66], [1.83, 2.98],
  [2.00, 3.30], [2.16, 3.58], [2.33, 3.87], [2.50, 4.18], [2.66, 4.45],
  [2.83, 4.72], [3.00, 5.03], [3.16, 5.30], [3.33, 5.58], [3.50, 5.87],
  [3.66, 6.12], [3.83, 6.40], [4.00, 6.71], [4.16, 6.99], [4.33, 7.28],
  [4.50, 7.54], [4.66, 7.80], [4.83, 8.12], [5.00, 9.00],
]);

export const BUSAN_CONVERSION_DATASETS = Object.freeze({
  'busan-grade5-g1-2sem-14331': Object.freeze({
    id: 'busan-grade5-g1-2sem-14331',
    label: '부산 고1 1~2학기 누적', schoolCount: 88, sampleSize: 14331,
    sourceTitle: '부산광역시교육청 관내 고교 5등급제 1학년 2학기까지 등급평균 분석 자료',
    sourceDocument: '부산광역시교육청 관내 고교 5등급제 1학년 2학기까지 등급평균 분석 자료(배포용).pdf',
    sourceType: 'official', sourceUrl: null, anchors: BUSAN_GRADE5_G1_2SEM_14331,
  }),
  'busan-grade5-g2-1sem-15978': Object.freeze({
    id: 'busan-grade5-g2-1sem-15978',
    label: '부산 고2 1학기 누적', schoolCount: 98, sampleSize: 15978,
    sourceTitle: '부산광역시교육청 관내 고교 5등급제 2학년 1학기 누적 등급평균 분석 자료',
    sourceDocument: '부산광역시교육청 관내 고교 5등급제 2학년 1학기 누적 등급평균 분석 자료(홈페이지 탑재용).pdf',
    sourceType: 'official', sourceUrl: 'https://www.pen.go.kr/main/na/ntt/selectNttInfo.do?bbsId=2286&mi=30397&nttSn=1179461', anchors: BUSAN_GRADE5_G2_1SEM_15978,
  }),
});

export const DEFAULT_BUSAN_CONVERSION_DATASET = 'busan-grade5-g2-1sem-15978';

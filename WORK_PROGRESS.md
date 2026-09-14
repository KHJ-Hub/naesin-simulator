# 현재 작업

## 작업 목표

기존 배정고 수강설계 프로젝트와 분리된 내신 시뮬레이터를 공개 정적 웹사이트로 구축하고 GitHub Pages에 배포한다.

## 완료

- `KHJ-Hub/naesin-simulator` 별도 저장소를 `main` 브랜치로 초기화
- 핑크/보라 카드형 반응형 학생 화면 작성
- 실제·예상 성적, 학기별 입력 UI 작성
- 학점 가중 평균 및 목표 내신 계산 모듈 작성
- 브라우저 localStorage 저장과 JSON 내보내기/복구 UI 연결
- GitHub Pages 자동 배포 workflow 작성
- 공개 Pages 초기 렌더링 오류 수정 (`record-type-label`, `weighted-average`의 잘못된 DOM 참조 제거·정정)
- 교사용 학생 결과표 및 A4 인쇄 / 브라우저 PDF 저장 레이아웃 추가
- 학생 정보(이름, 학년·반, 번호)를 localStorage 상태 및 JSON 백업·복구에 포함
- JSON 복구 시 상태·레코드 정규화 추가
- 2022 개정 교육과정 5등급제(1~5등급) 계산 검증과 입력 선택 UI로 전환
- `src/course-catalog.mjs`에 관리자 화면·일괄 등록으로 확장 가능한 학교 과목 카탈로그 계층 추가
- 1학년 공통 과목 자동 생성, 2·3학년 학교 개설 과목 선택, 계산 버튼 기반 분석·목표 시뮬레이션 추가

## 진행 중

- GitHub Pages에 수정 사항 배포 및 공개 URL 확인 완료

## 남은 작업

- 저장소 Settings에서 Pages 소스를 GitHub Actions로 확인
- 선택적 개선: 계산 모듈 외 앱 UI 자동화 테스트를 저장소 테스트 스크립트로 정식 편입
- 실제 학교의 입학생 연도별 확정 과목·학점표를 수령해 `src/course-catalog.mjs`의 임시 목록을 교체

## 중요 결정사항

- 기존 `plan` 프로젝트와 완전히 분리하며 기존 학생/교사/D1 데이터는 변경하지 않는다.
- 실제 성적과 시뮬레이션 성적은 별도 배열로 관리한다.
- 성적 데이터는 현재 브라우저에만 저장하며 인증·서버·D1을 사용하지 않는다.
- 계산은 UI와 분리한 `src/grade-calculator.mjs`에서 수행한다.
- 결과표는 A4 인쇄 CSS를 사용하며, PDF 파일은 브라우저의 인쇄 기능으로 사용자가 저장한다.
- 5등급제 전환에 따라 목표·입력 등급은 1.00~5.00 범위로 제한한다. 성적 데이터는 계속 localStorage에만 저장한다.

## 변경된 파일

- `index.html`: 내신 입력·요약 화면
- `styles.css`: 핑크/보라 반응형 디자인
- `src/grade-calculator.mjs`: 계산 엔진
- `src/app.mjs`: 입력, 저장, 백업/복구, 렌더링
- `tests/grade-calculator.test.mjs`: 계산 테스트
- `README.md`, `.gitignore`, `.github/workflows/deploy-pages.yml`
- `tests/fixtures/browser-backup.json`: 개인정보가 아닌 브라우저 복구 검증용 예제 데이터
- `src/course-catalog.mjs`: 학교 과목 카탈로그와 공통/선택 과목 조회 계층

## DB 변경

- 없음. 정적 사이트이며 localStorage만 사용한다.

## 테스트 상태

- `node tests/grade-calculator.test.mjs`: 4 passed
- `npm test`: 현재 환경에서 Node 자식 프로세스 권한(`spawn EPERM`)으로 실행 불가. 계산 테스트 직접 실행은 통과.
- `node --check src/app.mjs`: 통과
- `git diff --check`: 통과
- 로컬 Chromium: 실제/예상 탭, 학기 탭, 성적 입력, 목표 계산, localStorage 유지, JSON 복구, 결과표 내용 확인 및 콘솔 오류 없음
- 로컬 Chromium: 1학년 공통 과목 자동 생성, 2학년 과목 선택, 1~5등급 선택, 계산 버튼, 목표 시뮬레이션·시나리오 및 콘솔 오류 없음
- 공개 GitHub Pages: HTTP 200, 요약 카드 4개·학기 탭 5개·결과표 인쇄 버튼·A4 CSS 확인 및 콘솔 오류 없음
- GitHub Actions `Deploy to GitHub Pages`: `705dba3` 성공. 이전 모듈 캐시와 새 HTML 혼합을 방지하도록 버전 쿼리로 엔트리·계산·카탈로그 모듈을 로드
- 공개 GitHub Pages 최종 브라우저 확인: 1학년 공통 과목 자동 생성, 1~5등급 선택, 계산·목표 버튼, 학기 탭 렌더링 및 콘솔 오류 없음
- GitHub Actions `Deploy to GitHub Pages`: `configure-pages` 실패 (Pages 미활성화로 확인)
- GitHub Pages `pages build and deployment`: 성공 (`b47d452`)
- 공개 URL: HTTP 200 확인 (`https://khj-hub.github.io/naesin-simulator/`)
- `index.html`, `styles.css`, `src/app.mjs`, `src/grade-calculator.mjs`: 모두 HTTP 200

## Git 상태

- `b47d452 docs: record pages activation requirement` pushed to `origin/main`

## 다음 작업 시작점

선택적 개선으로 앱 UI 자동화 테스트를 저장소 테스트 스크립트에 편입한다.

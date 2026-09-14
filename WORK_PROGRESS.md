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
- 2026학년도 입학생 선택과목 안내 책자 기반으로 실제 3개년 과목·학점·학기·성적 처리 카탈로그 반영
- 1학년 반별 학교 지정 과목 조건 및 5등급/성취도 A-E·A-C/P 처리 구분 반영

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
- `tests/course-catalog.test.mjs`: 2026 입학생 공통·반별 과목 및 성적 처리 검증

## DB 변경

- 없음. 정적 사이트이며 localStorage만 사용한다.

## 테스트 상태

- `node tests/grade-calculator.test.mjs`: 4 passed
- `npm test`: 현재 환경에서 Node 자식 프로세스 권한(`spawn EPERM`)으로 실행 불가. 계산 테스트 직접 실행은 통과.
- `node --check src/app.mjs`: 통과
- `git diff --check`: 통과
- 로컬 Chromium: 실제/예상 탭, 학기 탭, 성적 입력, 목표 계산, localStorage 유지, JSON 복구, 결과표 내용 확인 및 콘솔 오류 없음
- 로컬 Chromium: 1학년 공통 과목 자동 생성, 2학년 과목 선택, 1~5등급 선택, 계산 버튼, 목표 시뮬레이션·시나리오 및 콘솔 오류 없음
- `node tests/course-catalog.test.mjs`: 2 passed, `node tests/grade-calculator.test.mjs`: 5 passed
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

## 2026학년도 실제 과목 카탈로그 반영

- `2026 선택과목안내자료 1학년.pdf`를 기준으로 2026학년도 입학생의 1~3학년 과목을 `src/course-catalog.mjs`에 반영했다. 자료에 최종 개설이 수요·교원 여건에 따라 달라질 수 있다고 명시된 선택 과목은 `planned`로 표시한다.
- 1학년 공통 과목은 자동 생성하고, 학년·반에 `1~6반`을 입력하면 반별 지정 음악·미술·보건·진로와 직업 과목을 함께 생성한다. 2·3학년은 안내 자료상 개설 예정 과목만 목록에서 선택한다.
- 과목마다 학년·학기·교과군·학점·공통/선택·성적 처리 방식·5등급 산출 여부·성취도 전용 여부를 보관한다. A~C, A~E, P 과목은 등급 선택을 표시하지 않아 내신 평균에서 제외한다.

## 최근 테스트 및 공개 검증

- `node tests/grade-calculator.test.mjs`: 5 passed
- `node tests/course-catalog.test.mjs`: 3 passed
- `git diff --check`: 통과
- 공개 GitHub Pages: HTTP 200 및 실제 브라우저에서 1학년 1학기 공통 8과목 렌더링 확인. `과학탐구실험1`은 등급 선택 없이 `등급 미산출`과 A~C 성취도만 표시되고, 브라우저 콘솔 오류가 없음을 확인했다.
- GitHub Pages의 장기 모듈 캐시가 이전 `app.mjs`를 재사용하지 않도록 엔트리 모듈 버전 쿼리를 갱신했다.

## 학기별 간편·상세 입력 개선

- 학기마다 `간편 입력`과 `과목별 상세 입력`을 전환할 수 있도록 확장했다.
- 간편 평균은 1.00~5.00만 허용하고 `quickAverages`에, 입력 방식은 `inputModes`에 실제/예상 성적별로 각각 저장한다. 기존 과목별 성적 배열과 함께 JSON 백업·복구된다.
- 상세 과목의 등급 입력이 해당 학기에 완료되면 상세 평균을 우선 사용하고, 그렇지 않으면 입력한 학기 평균을 사용한다. 화면에 현재 사용 출처와 간편값 보관 상태를 표시한다.
- 간편 입력 학기가 있으면 교과별 분석을 숨기고 `교과별 분석은 과목별 상세 입력 시 이용할 수 있습니다.` 안내를 표시한다. 과목별 상세 모드에서는 기존 교과 분석을 유지한다.
- 공개 브라우저에서 간편 평균 2.14 입력 후 전체 평균·학기 평균·교과 분석 제한을 확인했고, 예상 성적 간편 평균을 추가한 뒤 목표 필요 평균과 시나리오가 계산되는 것을 확인했다. 상세 등급을 모두 입력하면 간편값을 보관한 채 상세 평균과 교과 분석을 우선 사용하는 흐름도 확인했다.
- 예상 성적을 별도로 입력하지 않아도 현재까지 입력한 학기 다음의 남은 학기를 자동으로 계산 대상으로 삼아 필요한 평균과 목표 시나리오를 표시하도록 보완했다.

## 반응형 UI 전면 점검

- 모바일 우선 CSS로 재구성하고 767px 이하, 768~1199px, 1200px 이상 구간을 분리했다.
- 학기 탭은 한 줄 텍스트와 가로 스크롤을 사용하고, 상단 작업 버튼은 모바일 2열 그리드로 배치했다. 버튼·입력·탭의 터치 높이는 최소 44px로 맞췄다.
- 1200px 이상에서는 앱 최대폭을 1440px로 넓히고 요약 4열·분석 2~3열·과목 입력 확장 레이아웃을 사용한다. 768~1199px에서는 요약 2열과 정보/입력 분리형을 유지한다.
- 제목·요약 숫자·설명에 `clamp()`를 적용하고, 한국어 단어 중간 줄바꿈과 페이지 가로 넘침을 줄이도록 `word-break: keep-all`, `overflow-wrap`, `minmax()`를 적용했다.
- 로컬 브라우저 데스크톱 viewport(1280px)에서 `scrollWidth === clientWidth`, 학기 탭 높이 44px, 상단 작업 버튼 높이 44px를 확인했다. 요청된 360/390/430/768/1024/1366/1920px 구간은 CSS 미디어쿼리 규칙을 각각 대조했다.

## 성적 처리 타입별 입력 UI 정리

- `course-catalog.mjs`의 `gradingType`을 `grade`, `achievement`, `both`로 명시하고 성취도 범위는 `achievementScale`로 분리했다.
- 등급 과목은 1~5등급 select만, 성취도 과목은 해당 A/B/C·A~E·P 입력만, `both` 과목은 두 입력을 표시하도록 렌더링 계약을 정리했다.
- 모바일 과목 카드는 과목명 → 교과군·학점 → 필요한 입력칸 → 작은 삭제 버튼 순서로 배치하며, 입력칸은 가로로 눌리지 않도록 별도 grid로 구성했다.
- 등급 평균 계산은 `grade`·`both`의 등급만 반영하고 성취도 전용 과목은 제외한다. 로컬 신규 브라우저에서 공통 과목의 등급 select와 과학탐구실험·체육의 성취도 전용 select를 실제 확인했다.

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

## 진행 중

- GitHub 저장소에서 Pages 기능이 아직 활성화되지 않아 첫 workflow가 `configure-pages` 단계에서 실패함

## 남은 작업

- 저장소 Settings에서 Pages 소스를 GitHub Actions로 확인
- Pages 활성화 후 Actions 재실행 및 공개 URL HTTP 확인

## 중요 결정사항

- 기존 `plan` 프로젝트와 완전히 분리하며 기존 학생/교사/D1 데이터는 변경하지 않는다.
- 실제 성적과 시뮬레이션 성적은 별도 배열로 관리한다.
- 성적 데이터는 현재 브라우저에만 저장하며 인증·서버·D1을 사용하지 않는다.
- 계산은 UI와 분리한 `src/grade-calculator.mjs`에서 수행한다.

## 변경된 파일

- `index.html`: 내신 입력·요약 화면
- `styles.css`: 핑크/보라 반응형 디자인
- `src/grade-calculator.mjs`: 계산 엔진
- `src/app.mjs`: 입력, 저장, 백업/복구, 렌더링
- `tests/grade-calculator.test.mjs`: 계산 테스트
- `README.md`, `.gitignore`, `.github/workflows/deploy-pages.yml`

## DB 변경

- 없음. 정적 사이트이며 localStorage만 사용한다.

## 테스트 상태

- `npm test`: 4 passed
- `node --check src/app.mjs`: 통과
- `git diff --check`: 통과
- GitHub Actions `Deploy to GitHub Pages`: `configure-pages` 실패 (Pages 미활성화로 확인)
- 공개 URL: 현재 HTTP 404 (Pages 활성화 전)

## Git 상태

- `d0b065f feat: create standalone grade simulator` pushed to `origin/main`

## 다음 작업 시작점

GitHub 저장소 Settings → Pages → Source를 `GitHub Actions`로 저장한다. 이후 workflow 재실행과 `https://khj-hub.github.io/naesin-simulator/` HTTP 200을 확인한다.

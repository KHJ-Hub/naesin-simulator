# Project workflow

코드 수정, 테스트, 검증, Git 작업은 현재 사용 중인 AI 개발 환경(Codex 또는 Claude Code)에서 직접 수행합니다.

- 브라우저 확인이 필요하면 현재 사용 중인 AI 개발 환경에서 사용할 수 있는 일반 브라우저·테스트 도구를 사용한다.

## 배포 절차

이 사이트는 GitHub Pages로 배포되어 학생들이 사용 중이며, main에 푸시하면 바로 반영된다.

- 수정 후 `npm test`를 실행하고, 전부 통과하면 작업 단위별로 커밋한 뒤 main에 푸시한다.
- 푸시 후 https://khj-hub.github.io/naesin-simulator/ 에서 `src/app-version.mjs`의 버전을 확인해 배포 반영 여부를 보고한다.
- 테스트가 하나라도 실패하거나 확신이 없으면 푸시하지 않고 멈춰서 이유를 알린다.

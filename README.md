# 내신 시뮬레이터

배정고 수강설계 사이트와 분리해 운영하는 공개 정적 웹 도구입니다. 실제 성적은 서버로 전송하지 않고 사용 중인 브라우저의 `localStorage`에만 저장합니다.

## 사용

- 실제 성적과 예상 성적을 학기별로 입력
- 학점 가중/단순 평균 전환
- 목표 내신과 남은 평균 시뮬레이션
- JSON 백업·복구

공개 주소는 GitHub Pages 설정 후 `https://khj-hub.github.io/naesin-simulator/`가 됩니다. 저장소의 `main`에 push하면 `.github/workflows/deploy-pages.yml`이 자동 배포합니다.

## 개발

```bash
npm test
```

이 프로젝트에는 로그인, 학생 개인정보, D1 데이터베이스를 넣지 않습니다. 브라우저 저장소를 삭제하면 기록도 함께 삭제될 수 있으므로 JSON 내보내기로 백업하세요.

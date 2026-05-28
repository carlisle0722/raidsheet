# 로스트아크 원정대 캐릭터 검색

캐릭터명을 입력하면 Lost Ark Open API의 `GET /characters/{characterName}/siblings` 엔드포인트로 같은 원정대의 캐릭터 목록을 불러오는 웹앱입니다.

## 구조

```text
public/
  index.html
  app.js
  styles.css

api/
  roster.js
  health.js

server.js
vercel.json
```

- `public/`: 브라우저에 보이는 정적 화면입니다.
- `api/roster.js`: Vercel 서버리스 함수입니다. 로스트아크 API 키를 숨기고 대신 API를 호출합니다.
- `server.js`: 로컬에서 `http://localhost:5173`으로 테스트할 때만 쓰는 작은 서버입니다.

## 로컬 실행

```powershell
npm start
```

브라우저에서 `http://localhost:5173`을 열면 됩니다.

이 PC처럼 일반 `node` 실행이 막혀 있으면 아래 명령을 쓰면 됩니다.

```powershell
.\start.cmd
```

## Vercel 배포

1. GitHub에 이 폴더를 저장소로 올립니다.
2. Vercel에서 `Add New Project`를 누르고 GitHub 저장소를 선택합니다.
3. Vercel 프로젝트 설정의 `Environment Variables`에 아래 값을 추가합니다.

```text
LOSTARK_API_KEY=새로 발급받은 로스트아크 API 키
```

4. 배포합니다.

Vercel은 루트의 `api/` 폴더를 서버리스 함수로 인식합니다. 그래서 브라우저가 `/api/roster`를 호출하면 Vercel 함수가 실행되고, 그 함수가 로스트아크 Open API를 대신 호출합니다.

## 보안

`.env`는 로컬 테스트용입니다. `.gitignore`에 포함되어 있으므로 GitHub에 올리지 마세요. 이미 채팅이나 저장소에 노출된 키는 STOVE 개발자 콘솔에서 새로 발급받는 편이 안전합니다.

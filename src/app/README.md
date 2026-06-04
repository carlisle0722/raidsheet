# app source layout

브라우저는 루트의 `app.js`를 실행하지만, 유지보수는 이 폴더의 분리된 소스 파일에서 합니다.

파일 순서:

1. `00-bootstrap.js` - 상수, 상태, DOM 요소, 이벤트 연결, 초기 로딩
2. `01-roster-owned-tab.js` - 기본 렌더링, 보유 캐릭터 탭, 캐릭터 조회/편성 목록
3. `02-missing-raids.js` - 누락 레이드 사이드 패널과 누락 레이드 필터
4. `03-raid-planner.js` - 레이드 편성 표, 편집/저장/필터/순서 변경
5. `04-tools-album-memo.js` - 공용 조회 헬퍼, 프로필 이미지, 앨범, 경매계산기, 메모
6. `05-persistence-utils.js` - 원격/로컬 저장소, 정규화, 공용 유틸리티

수정 후 루트에서 아래 명령을 실행하면 `app.js`가 다시 생성됩니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-app.ps1
```


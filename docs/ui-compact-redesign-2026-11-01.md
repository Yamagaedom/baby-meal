# UI/UX 정리 — 2026-11-01

## 기본 뼈대
- 흰 배경, 중립 회색 본문, 초록색 주요 행동으로 역할을 구분한다.
- 모서리: 배지 2px, 입력·버튼 4px, 카드 6px, 대화상자 최대 8px.
- 모바일 좌우 여백 20px, 데스크톱 40px. 하단 메뉴와 본문 사이 안전 여백 확보.
- 제목 24/28px, 카드 제목 16px, 본문 16px, 보조 정보 14px 중심. 입력은 16px로 모바일 확대 방지.
- 버튼 44px 이상, 주요 버튼 48px. 하단 메뉴 레이블은 12px.

## 기능 구현
- 전체 레시피 수는 그대로 표시하고 12개 단위로 더보기. 필터 결과가 바뀌면 첫 12개부터 표시.
- 홈 간식은 2개만 먼저 표시하고 더보기/접기 제공. 최근 잘 먹은 메뉴는 3개와 전체 기록 링크.
- 레시피의 먹은 기록과 후기 작성, 마이페이지의 비밀번호·복구 코드·탈퇴는 선택 시 펼침.
- 알레르기·상위 월령 경고, 영양 추정의 불확실성 및 출처는 상시 확인 가능.
- 영양 카드의 박스를 줄이고 구분선 기반 표로 재구성.
- 상세 필터 적용 전의 낡은 결과 개수 대신 '필터 적용하기'로 표시.

## UI·접근성
- native details/summary로 키보드와 스크린리더 지원, 접어도 작성 중 값 유지.
- 아코디언 ID는 인스턴스별로 유일하며 긴 제목은 잘리지 않음.
- 후기 요청은 언마운트 시 취소해 비동기 상태 갱신 방지.

## 참고 자료와 한계
- 노션 요청 링크는 웹 도구에서 본문 접근 실패. 해당 문서를 읽었다고 간주하지 않음.
- Toss Design System: https://toss.tech/article/toss-design-system
- NAVER 앱 공식 소개: https://navercorp.com/media/pressReleasesDetail?seq=2278
- Apple Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- 특정 앱을 복제하지 않고 일관된 컴포넌트, 목적별 탐색, 정보 위계 원칙을 적용.

## 요구사항·버그·엣지케이스 검토
- lint, TypeScript 검사, 프로덕션 빌드 통과.
- 로컬 Chromium: 6개 주요 화면 가로 넘침 없음, Axe serious/critical 0건, 12개씩 더보기 및 양식 접기/펼치기 통과.
- 기존 주간 식단 생성→확정→조리→재고 차감 테스트 통과.
- 운영 배포 READY: 1fd87ac6cd7c3511034b124b749ec7334efbc8ba / dpl_EpQWgaHcky3enGWdPUkEaeN5wAVE.
- https://baby-meal-tau.vercel.app 에서 compact-ui, weekly-plan, catalog-repair 모두 통과.
- 운영 목록 121개 / 1단계 55개, 출처 표시·알레르기 차단·1회분 영양값 유지 확인.
- 목록 검증의 로딩 대기 누락을 수정하고 재검증함. 테스트 임시 계정 삭제 완료.
- 후기가 없는 레시피는 평점 차트 생략, 후기 있는 경우 상세 분포 접기.

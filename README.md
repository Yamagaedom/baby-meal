# 오늘 뭐 먹지, 아가? (`baby-meal`)

12~48개월 유아식·간식 아이디어 추천 웹앱 (기준 문서: `docs/PRD.md` v0.3)

## 기술 스택

- **프론트엔드 / 서버**: Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS 4
- **데이터베이스**: PostgreSQL (운영: Supabase 무료 플랜 / 로컬: Prisma Postgres `prisma dev`) + Prisma ORM 7
- **인증**: 자체 구현 ID/PW (`@node-rs/argon2` 해시 + `httpOnly` 세션 쿠키 + DB 세션 테이블, 개인정보 미수집)
- **검증**: Zod + 규칙 기반 유아식 안전 검증(`src/lib/safety`)
- **테스트**: Vitest(단위/통합 + v8 커버리지), Playwright(E2E)

## 새 PC에서 로컬 실행 방법

### 사전 요구사항

- Node.js 22 이상 (Node 24 권장)

### 1) 의존성 설치

```bash
cd baby-meal
npm install
```

### 2) 환경 변수 파일 준비

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

별도의 PostgreSQL이나 Docker가 없어도 로컬 Prisma Postgres 서버를 띄울 수 있습니다:

```bash
npx prisma dev -n baby-meal -P 54329
```

출력된 `DATABASE_URL`과 `SHADOW_DATABASE_URL`을 `.env`에 설정합니다:

```env
DATABASE_URL="postgres://postgres:postgres@localhost:54329/template1?sslmode=disable&connection_limit=10&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0"
SHADOW_DATABASE_URL="postgres://postgres:postgres@localhost:51215/template1?sslmode=disable&connection_limit=10&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0"
SESSION_SECRET="local-dev-only-session-secret-change-in-production-32chars"
GEMINI_API_KEY=""
YOUTUBE_API_KEY=""
AI_DAILY_GLOBAL_LIMIT="100"
```

> Supabase 무료 플랜 등 외부 PostgreSQL을 사용할 경우 해당 연결 문자열을 `DATABASE_URL`에 입력하면 됩니다.

### 3) DB 마이그레이션 · 클라이언트 생성 · 시드 적재

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

시드 실행 시 **식재료 사전 220종**, 안전 검증을 통과한 **샘플 레시피 30개**, **개발용 테스트 계정 1개**(`testparent1` / `test1234`)가 적재됩니다.

### 4) 개발 서버 실행 및 헬스체크 확인

```bash
npm run dev
```

브라우저 또는 `curl`로 `http://localhost:3000/api/health`를 호출하면 DB 연결 상태와 적재된 식재료·레시피 건수가 반환됩니다.

## 주요 npm 스크립트

| 명령어 | 설명 |
|---|---|
| `npm run dev` | Next.js 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 정적 검사 |
| `npm run typecheck` | TypeScript 타입 검사 (`tsc --noEmit`) |
| `npm run test` | Vitest 단위·통합 테스트 |
| `npm run test:coverage` | 도메인 핵심 모듈(`lib/age`, `lib/safety`, `lib/validation`) 커버리지 측정 |
| `npm run test:e2e` | Playwright E2E 테스트 |
| `npm run db:migrate` | Prisma 마이그레이션 실행 |
| `npm run db:generate` | Prisma Client 코드 생성 |
| `npm run db:seed` | 식재료 사전·샘플 레시피·테스트 계정 시드 |

## 폴더 구조

```text
src/
  app/
    (auth)/           # 인증 라우트 그룹 (로그인·가입·복구코드)
    (main)/           # 메인 서비스 라우트 그룹
    api/health/       # DB 연결 헬스체크 API
  features/
    auth/ profile/ recommend/ recipe/ ingredient-search/
    serving/ meal-log/ ai-generation/ report/
  lib/
    age/              # 월령 자동 계산·연령 단계 매핑 (PRF-01~03, AGE-02)
    db/               # Prisma Client 싱글턴
    domain/           # 도메인 공통 타입
    safety/           # 알레르기·월령·나트륨·분량 규칙 검증 (REC-02, AGE-03/05, AI-05)
    validation/       # 공통 Zod 스키마 (ACC-02/03/08, PRF-01, SRV-01)
  components/         # 공용 UI 컴포넌트 (3단계 구현 예정)
prisma/
  schema.prisma       # PostgreSQL 데이터 모델 (PRD 6장)
  migrations/         # SQL 마이그레이션 이력
  seed/               # 식재료 사전(220종) 및 샘플 레시피(30개)
docs/
  PRD.md              # PRD v0.3
tests/
  unit/               # 단위·DB 무결성 테스트
  e2e/                # Playwright E2E 테스트
```

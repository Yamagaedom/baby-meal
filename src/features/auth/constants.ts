export const SESSION_COOKIE_NAME = "bm_session";
export const ACTIVE_BABY_COOKIE_NAME = "bm_active_baby";

/** ACC-06: 로그인 5회 연속 실패 시 10분 잠금 */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MINUTES = 10;
export const LOCK_DURATION_MS = LOCK_DURATION_MINUTES * 60 * 1000;

/** 세션 만료 시간 */
export const DEFAULT_SESSION_HOURS = 24;
export const REMEMBER_ME_DAYS = 30;

/** 가입 속도 제한: 동일 IP 기준 10분 내 최대 10회 */
export const SIGNUP_RATE_WINDOW_MS = 10 * 60 * 1000;
export const SIGNUP_RATE_MAX_ATTEMPTS = 10;

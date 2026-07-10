/**
 * lib/settings.ts — toss-trader 클라이언트 설정 (v1.1.1)
 *
 * Telegram confirm 모드 (런타임 사용자 토글):
 * - telegram: 메시지 발송 + [확인]/[취소] inline button (기존)
 * - auto: 메시지 발송 안 함, 즉시 confirmed (Telegram 봇 미설정 사용자)
 * - off: confirm 자체 비활성화 (paper 거래만, 가드 5에서 차단)
 *
 * 저장: localStorage (브라우저별). 서버 env (TELEGRAM_CONFIRM_MODE)는 기본값.
 *
 * v0.3 단순화: BYOK 폼 0 (auth/시크릿 안 다룸). UI 토글만 추가.
 */

export type TelegramConfirmMode = "telegram" | "auto" | "off";

export const TELEGRAM_CONFIRM_MODES: ReadonlyArray<{
  value: TelegramConfirmMode;
  label: string;
  description: string;
}> = [
  {
    value: "telegram",
    label: "Telegram 메시지",
    description: "Telegram 봇 메시지 발송 → [확인]/[취소] inline button 클릭. 실전 안전.",
  },
  {
    value: "auto",
    label: "자동 확인",
    description: "메시지 발송 안 함, 즉시 confirmed. dev/test/봇 미설정 시.",
  },
  {
    value: "off",
    label: "비활성화",
    description: "confirm 자체 안 함. paper 거래만, 실계좌 주문 차단.",
  },
] as const;

const STORAGE_KEY = "toss-trader:confirm-mode";

// ─── localStorage 헬퍼 (브라우저 전용) ──────────────────────
export function loadConfirmMode(): TelegramConfirmMode {
  if (typeof window === "undefined") return getDefaultMode();
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "telegram" || v === "auto" || v === "off") return v;
  } catch {
    // localStorage 비활성/SSR/iframe 등
  }
  return getDefaultMode();
}

export function saveConfirmMode(mode: TelegramConfirmMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

// ─── 서버 기본값 (env 또는 "telegram") ──────────────────────
export function getDefaultMode(): TelegramConfirmMode {
  // 서버에서 process.env.TELEGRAM_CONFIRM_MODE 읽기 (Next 16 Edge Function도 env 접근 가능)
  const v = (typeof process !== "undefined" ? process.env?.TELEGRAM_CONFIRM_MODE : undefined) ?? "telegram";
  if (v === "telegram" || v === "auto" || v === "off") return v;
  return "telegram";
}

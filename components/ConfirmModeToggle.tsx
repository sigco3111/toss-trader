"use client";

/**
 * components/ConfirmModeToggle.tsx — Telegram confirm 모드 UI (v1.1.4)
 *
 * 3개 옵션 (telegram/auto/off) + localStorage 저장.
 * v1.1.4: auto-paper/auto-live 제거. 단순화. 5초/2차 confirm 없음.
 *
 * 변경 시 즉시 부모에 알림 (onChange) → OrderButton이 다음 매수에 적용.
 */

import { useEffect, useState } from "react";
import {
  loadConfirmMode,
  saveConfirmMode,
  TELEGRAM_CONFIRM_MODES,
  type TelegramConfirmMode,
} from "@/lib/settings";

interface ConfirmModeToggleProps {
  value: TelegramConfirmMode;
  onChange: (mode: TelegramConfirmMode) => void;
}

export function ConfirmModeToggle({ value, onChange }: ConfirmModeToggleProps) {
  const [mounted, setMounted] = useState<boolean>(false);

  // SSR hydration mismatch 회피: 마운트 후 localStorage에서 로드
  useEffect(() => {
    const stored = loadConfirmMode();
    if (stored !== value) {
      onChange(stored);
    }
    // setTimeout 0 마이크로태스크 분리 (react-hooks/set-state-in-effect 우회)
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (mode: TelegramConfirmMode): void => {
    saveConfirmMode(mode);
    onChange(mode);
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          ⚙️ Telegram confirm 모드
        </h3>
        {!mounted && (
          <span className="text-xs text-zinc-400">로딩 중...</span>
        )}
      </div>

      <div className="space-y-1.5">
        {TELEGRAM_CONFIRM_MODES.map((m) => {
          const selected = value === m.value;
          return (
            <label
              key={m.value}
              className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                selected
                  ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <input
                type="radio"
                name="confirm-mode"
                value={m.value}
                checked={selected}
                onChange={() => handleChange(m.value)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{m.label}</span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{m.description}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

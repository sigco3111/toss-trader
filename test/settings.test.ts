/**
 * test/settings.test.ts — toss-trader 클라이언트 설정 TDD (v1.1.4)
 *
 * v1.1.4: 4-모드 → 3-모드 단순화 (telegram/auto/off)
 * v1.1.2/v1.1.3의 auto-paper/auto-live 제거
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadConfirmMode,
  saveConfirmMode,
  getDefaultMode,
  isValidMode,
  TELEGRAM_CONFIRM_MODES,
  type TelegramConfirmMode,
} from "@/lib/settings";

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string): string | null => storage[k] ?? null,
  setItem: (k: string, v: string): void => {
    storage[k] = v;
  },
  removeItem: (k: string): void => {
    delete storage[k];
  },
  clear: (): void => {
    for (const k of Object.keys(storage)) delete storage[k];
  },
  key: (i: number): string | null => Object.keys(storage)[i] ?? null,
  get length(): number {
    return Object.keys(storage).length;
  },
};

describe("TELEGRAM_CONFIRM_MODES", () => {
  it("3개 옵션 (telegram/auto/off) — v1.1.4 단순화", () => {
    expect(TELEGRAM_CONFIRM_MODES).toHaveLength(3);
    const values = TELEGRAM_CONFIRM_MODES.map((m) => m.value);
    expect(values).toEqual(["telegram", "auto", "off"]);
  });

  it("v1.1.2/v1.1.3의 auto-paper/auto-live 제거됨", () => {
    const values = TELEGRAM_CONFIRM_MODES.map((m) => m.value);
    expect(values).not.toContain("auto-paper");
    expect(values).not.toContain("auto-live");
  });

  it("각 옵션에 label + description 존재", () => {
    for (const m of TELEGRAM_CONFIRM_MODES) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});

describe("isValidMode", () => {
  it("유효한 모드 → true", () => {
    expect(isValidMode("telegram")).toBe(true);
    expect(isValidMode("auto")).toBe(true);
    expect(isValidMode("off")).toBe(true);
  });

  it("잘못된 모드 → false (v1.1.2/v1.1.3 옵션 포함)", () => {
    expect(isValidMode("invalid")).toBe(false);
    expect(isValidMode("auto-paper")).toBe(false); // v1.1.2 무효
    expect(isValidMode("auto-live")).toBe(false); // v1.1.2/v1.1.3 무효
    expect(isValidMode(null)).toBe(false);
    expect(isValidMode(undefined)).toBe(false);
    expect(isValidMode(123)).toBe(false);
  });
});

describe("loadConfirmMode", () => {
  beforeEach(() => {
    localStorageMock.clear();
    delete process.env.TELEGRAM_CONFIRM_MODE;
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.unstubAllGlobals();
  });

  it("localStorage 비어있음 + env 없음 → 'telegram' 기본", () => {
    expect(loadConfirmMode()).toBe("telegram");
  });

  it("localStorage 'auto' → 'auto'", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "auto");
    expect(loadConfirmMode()).toBe("auto");
  });

  it("localStorage 'off' → 'off'", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "off");
    expect(loadConfirmMode()).toBe("off");
  });

  it("localStorage 잘못된 값 → 'telegram' fallback", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "invalid");
    expect(loadConfirmMode()).toBe("telegram");
  });

  it("localStorage 'auto-paper' (v1.1.2) → 'telegram' fallback (v1.1.4 무효)", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "auto-paper");
    expect(loadConfirmMode()).toBe("telegram");
  });

  it("localStorage 'auto-live' (v1.1.2/v1.1.3) → 'telegram' fallback (v1.1.4 무효)", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "auto-live");
    expect(loadConfirmMode()).toBe("telegram");
  });

  it("env TELEGRAM_CONFIRM_MODE=auto + localStorage 비어있음 → 'auto'", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto";
    expect(loadConfirmMode()).toBe("auto");
  });

  it("env 'auto-paper' (v1.1.2) → 'telegram' fallback", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto-paper";
    expect(loadConfirmMode()).toBe("telegram");
  });
});

describe("saveConfirmMode", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.unstubAllGlobals();
  });

  it("3개 모드 save → load로 읽기", () => {
    const modes: TelegramConfirmMode[] = ["telegram", "auto", "off"];
    for (const m of modes) {
      saveConfirmMode(m);
      expect(loadConfirmMode()).toBe(m);
    }
  });
});

describe("getDefaultMode", () => {
  beforeEach(() => {
    delete process.env.TELEGRAM_CONFIRM_MODE;
  });

  it("env 없음 → 'telegram'", () => {
    expect(getDefaultMode()).toBe("telegram");
  });

  it("env 'auto' → 'auto'", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto";
    expect(getDefaultMode()).toBe("auto");
  });

  it("env 'off' → 'off'", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "off";
    expect(getDefaultMode()).toBe("off");
  });

  it("env 'auto-paper' (v1.1.2) → 'telegram' fallback", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto-paper";
    expect(getDefaultMode()).toBe("telegram");
  });

  it("env 잘못된 값 → 'telegram' fallback", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "invalid";
    expect(getDefaultMode()).toBe("telegram");
  });
});

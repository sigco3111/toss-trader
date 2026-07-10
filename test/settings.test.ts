/**
 * test/settings.test.ts — toss-trader 클라이언트 설정 TDD (v1.1.1)
 *
 * vitest 4 + environment: "node" 환경에서 localStorage mock으로 테스트.
 * 실제 브라우저 동작은 jsdom으로 별도 검증 (e2e).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadConfirmMode,
  saveConfirmMode,
  getDefaultMode,
  TELEGRAM_CONFIRM_MODES,
  type TelegramConfirmMode,
} from "@/lib/settings";

// localStorage mock (jsdom 없이 node 환경에서 동작)
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
  it("3개 옵션 (telegram/auto/off)", () => {
    expect(TELEGRAM_CONFIRM_MODES).toHaveLength(3);
    const values = TELEGRAM_CONFIRM_MODES.map((m) => m.value);
    expect(values).toEqual(["telegram", "auto", "off"]);
  });

  it("각 옵션에 label + description 존재", () => {
    for (const m of TELEGRAM_CONFIRM_MODES) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});

describe("loadConfirmMode", () => {
  beforeEach(() => {
    localStorageMock.clear();
    delete process.env.TELEGRAM_CONFIRM_MODE;
    // window stub
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

  it("env TELEGRAM_CONFIRM_MODE=auto + localStorage 비어있음 → 'auto'", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto";
    expect(loadConfirmMode()).toBe("auto");
  });

  it("env 'off' + localStorage 'telegram' → localStorage 우선 ('telegram')", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "off";
    localStorageMock.setItem("toss-trader:confirm-mode", "telegram");
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

  it("save → load로 읽기 가능", () => {
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

  it("env 잘못된 값 → 'telegram' fallback", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "invalid";
    expect(getDefaultMode()).toBe("telegram");
  });
});

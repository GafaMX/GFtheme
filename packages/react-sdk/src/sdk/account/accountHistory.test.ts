import { describe, expect, it } from "vitest";
import {
  ACCOUNT_HISTORY_CHUNK,
  remainingAccountHistory,
  visibleAccountHistory,
} from "./accountHistory";

describe("visibleAccountHistory", () => {
  const items = Array.from({ length: 16 }, (_, i) => i + 1);

  it("corta el historial en tandas, el badge sigue siendo el total", () => {
    expect(ACCOUNT_HISTORY_CHUNK).toBe(10);
    expect(visibleAccountHistory(items, ACCOUNT_HISTORY_CHUNK)).toEqual(items.slice(0, 10));
    expect(remainingAccountHistory(items.length, ACCOUNT_HISTORY_CHUNK)).toBe(6);
  });

  it("si caben todas, no recorta", () => {
    expect(visibleAccountHistory(items, 20)).toEqual(items);
    expect(remainingAccountHistory(3, 10)).toBe(0);
  });
});

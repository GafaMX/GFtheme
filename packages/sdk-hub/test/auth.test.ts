import { describe, expect, it } from "vitest";
import { issueSessionCookie, readCookie, timingSafeEqual, verifySession } from "../src/auth";

describe("admin session", () => {
  it("compara passwords en tiempo constante", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });

  it("emite una cookie que se puede verificar", async () => {
    const secret = "test-secret";
    const header = await issueSessionCookie(secret, false);
    const cookie = header.split(";")[0] ?? "";
    expect(await verifySession(secret, cookie)).toBe(true);
    expect(await verifySession("other", cookie)).toBe(false);
    expect(readCookie(cookie)?.includes(".")).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTurnstileAccess, turnstileAccessUrl } from "./turnstileAccess";

describe("turnstileAccess", () => {
  afterEach(() => vi.restoreAllMocks());
  it("solo The Base (204) tiene URL; el resto de socios no cambia", () => {
    expect(turnstileAccessUrl(204)).toMatch(/^https:\/\//);
    expect(turnstileAccessUrl(128)).toBeNull();
    expect(turnstileAccessUrl(undefined)).toBeNull();
  });
  it("manda el Bearer del usuario y devuelve null si no autoriza", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await fetchTurnstileAccess("https://x.test", "tok")).toBeNull();
    expect(spy).toHaveBeenCalledWith("https://x.test/qr/sesion", { headers: { Authorization: "Bearer tok" } });
  });
});

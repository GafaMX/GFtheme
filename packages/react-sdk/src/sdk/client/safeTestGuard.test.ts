import { describe, expect, it, vi } from "vitest";
import { evaluateSafeTestRequest, assertSafeTestRequest, SafeTestBlockedError } from "./safeTestGuard";

describe("evaluateSafeTestRequest", () => {
  it("permite GET de catálogo e historial en buq.partners", () => {
    expect(evaluateSafeTestRequest("GET", "https://buq.partners/api/brand")).toEqual({ ok: true });
    expect(evaluateSafeTestRequest("GET", "https://buq.partners/api/brand/the-base/membership")).toEqual({
      ok: true,
    });
    expect(evaluateSafeTestRequest("GET", "https://buq.partners/api/me/brand/the-base/memberships")).toEqual({
      ok: true,
    });
    expect(evaluateSafeTestRequest("GET", "https://buq.partners/api/me/brand/the-base/purchases")).toEqual({
      ok: true,
    });
    expect(evaluateSafeTestRequest("GET", "https://buq.partners/api/me")).toEqual({ ok: true });
  });

  it("permite solo el POST de login /oauth/token", () => {
    expect(evaluateSafeTestRequest("POST", "https://buq.partners/oauth/token")).toEqual({ ok: true });
  });

  it("bloquea reservate, register, GafaPay y el Hub", () => {
    expect(evaluateSafeTestRequest("POST", "https://buq.partners/api/brand/the-base/location/pozuelo-de-alarcon/reservation/reservate").ok).toBe(false);
    expect(evaluateSafeTestRequest("POST", "https://buq.partners/api/register").ok).toBe(false);
    expect(evaluateSafeTestRequest("GET", "https://frontpay.buq.partners/main.js").ok).toBe(false);
    expect(evaluateSafeTestRequest("POST", "https://api.stripe.com/v1/charges").ok).toBe(false);
    expect(evaluateSafeTestRequest("GET", "https://hub.buq.partners/api/config").ok).toBe(false);
    expect(evaluateSafeTestRequest("PUT", "https://buq.partners/api/me").ok).toBe(false);
  });

  it("assert no llama fetch: lanza antes", () => {
    const fetchImpl = vi.fn();
    expect(() =>
      assertSafeTestRequest(
        "POST",
        "https://buq.partners/api/brand/the-base/location/x/reservation/reservate",
      ),
    ).toThrow(SafeTestBlockedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

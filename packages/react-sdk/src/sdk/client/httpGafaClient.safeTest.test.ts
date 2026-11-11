import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { SAFE_TEST_BLOCKED_MESSAGE } from "./safeTestGuard";

function liveClient() {
  return createHttpGafaClient({
    apiBaseUrl: "https://buq.partners",
    companyId: 204,
    publicClientId: 1621,
    clientSecret: "not-saved",
    safeTestMode: true,
  } as Parameters<typeof createHttpGafaClient>[0]);
}

describe("createHttpGafaClient safeTestMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deja pasar GET de catálogo", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await liveClient().listMemberships("the-base");
    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/brand/the-base/membership");
  });

  it("bloquea /reservate antes de fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      liveClient().reservatePurchase?.({
        brandSlug: "the-base",
        locationSlug: "pozuelo-de-alarcon",
        userId: 1,
        lines: [{ id: 1271, type: "membership", amount: 1 }],
        paymentTypeId: 3,
      }),
    ).rejects.toThrow(SAFE_TEST_BLOCKED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloquea register y no toca la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      liveClient().register({
        email: "x@y.z",
        password: "secret",
        passwordConfirmation: "secret",
        firstName: "A",
        lastName: "B",
        captchaToken: "t",
      }),
    ).rejects.toThrow(SAFE_TEST_BLOCKED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

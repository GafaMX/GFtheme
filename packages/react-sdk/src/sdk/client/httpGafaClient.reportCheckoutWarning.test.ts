import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { parseGafaSdkConfig } from "../config";

function client(input: { safeTestMode?: boolean; failureNotifyUrl?: string }) {
  return createHttpGafaClient(
    parseGafaSdkConfig({
      apiBaseUrl: "https://buq.partners",
      companyId: 204,
      safeTestMode: input.safeTestMode,
      membershipEnrollment: input.failureNotifyUrl
        ? { comboId: 3491, membershipIds: [1271], failureNotifyUrl: input.failureNotifyUrl }
        : { comboId: 3491, membershipIds: [1271] },
    }),
  );
}

describe("httpGafaClient.reportCheckoutWarning", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin URL configurable no llama a la red (queda el log)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    client({}).reportCheckoutWarning?.("Matrícula no cobrada");
    expect(error).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("POSTea el aviso a failureNotifyUrl sin secretos", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    client({ failureNotifyUrl: "https://fn.buq.partners/enrollment-failed" }).reportCheckoutWarning?.(
      "Matrícula no cobrada",
      {
        kind: "enrollment_charge_failed",
        customerName: "Gabriel",
        customerEmail: "gabriel@buq.mx",
        membershipName: "Silver",
        enrollmentAmount: 30,
        companyId: 204,
        error: "card declined",
        occurredAt: "2026-11-11T04:38:00.000Z",
        log: "Matrícula no cobrada",
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://fn.buq.partners/enrollment-failed");
    expect(init.method).toBe("POST");
    expect(String(init.headers && (init.headers as Record<string, string>)["Content-Type"])).toMatch(/json/);
    expect(String(init.body)).toContain("gabriel@buq.mx");
    expect(String(init.body)).not.toMatch(/secret|token|webhook/i);
  });

  it("en safeTestMode no sale a la red aunque haya URL", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    client({
      safeTestMode: true,
      failureNotifyUrl: "https://fn.buq.partners/enrollment-failed",
    }).reportCheckoutWarning?.("Matrícula no cobrada");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

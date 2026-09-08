import { describe, expect, it } from "vitest";
import { envFromQuery, hostKind, hostScopeSql, isDevelopmentHost } from "../src/hosts";
import { buildFunnelSteps } from "../src/funnel";

describe("hosts", () => {
  it("marca Replit, localhost y workers como pruebas", () => {
    expect(isDevelopmentHost("fitspin-preview.replit.dev")).toBe(true);
    expect(isDevelopmentHost("localhost")).toBe(true);
    expect(isDevelopmentHost("sdk-hub.workers.dev")).toBe(true);
    expect(isDevelopmentHost("fitspin.mx")).toBe(false);
    expect(hostKind("fitspin.mx")).toBe("prod");
  });

  it("por defecto el admin mira producción", () => {
    expect(envFromQuery(undefined)).toBe("prod");
    expect(envFromQuery("dev")).toBe("dev");
    expect(envFromQuery("all")).toBe("all");
    expect(hostScopeSql("host", "all")).toBeNull();
    expect(hostScopeSql("e.host", "prod")).toContain("replit.dev");
  });
});

describe("funnel", () => {
  it("el porcentaje es sobre el primer paso, no una conversión de las mismas personas", () => {
    const steps = buildFunnelSteps(
      new Map([
        ["calendar.viewed", 100],
        ["auth.login_succeeded", 20],
        ["reservation.confirmed", 15],
        ["checkout.opened", 12],
        ["checkout.paid", 16],
      ]),
    );
    expect(steps[0]).toMatchObject({ share: 100, from_previous: null });
    expect(steps[4]).toMatchObject({ count: 16, share: 16, from_previous: 133 });
  });
});

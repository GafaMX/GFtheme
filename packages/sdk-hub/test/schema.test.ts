import { describe, expect, it } from "vitest";
import {
  installationKey,
  isHubEventName,
  normalizeIncomingEvent,
  parseEventBatch,
  rollupKey,
  widgetsFromHeartbeat,
} from "../src/schema";

describe("hub event schema", () => {
  it("acepta solo nombres conocidos", () => {
    expect(isHubEventName("sdk.heartbeat")).toBe(true);
    expect(isHubEventName("page.view")).toBe(false);
  });

  it("exige company_id y descarta basura", () => {
    expect(normalizeIncomingEvent({ event: "sdk.heartbeat" }, {})).toBeNull();
    expect(
      normalizeIncomingEvent({ event: "sdk.heartbeat", company_id: 80 }, { host: "fitspin.mx" })?.company_id,
    ).toBe(80);
  });

  it("acepta un evento suelto o un batch", () => {
    expect(parseEventBatch({ event: "auth.login_succeeded", company_id: 1 }, {}).length).toBe(1);
    expect(
      parseEventBatch(
        {
          events: [
            { event: "checkout.opened", company_id: 1 },
            { event: "nope", company_id: 1 },
          ],
        },
        {},
      ).map((event) => event.event),
    ).toEqual(["checkout.opened"]);
  });

  it("arma keys estables de instalacion y rollup", () => {
    expect(
      installationKey({ company_id: 80, host: "Fitspin.MX", path: "/calendario?x=1", brand_id: 2 }),
    ).toBe("80|2||fitspin.mx|/calendario");
    expect(rollupKey({ day: "2026-08-25", company_id: 80, event_name: "sdk.heartbeat" })).toBe(
      "2026-08-25|80|0|0|sdk.heartbeat",
    );
  });

  it("lee widgets del heartbeat", () => {
    const event = normalizeIncomingEvent(
      {
        event: "sdk.heartbeat",
        company_id: 80,
        props: { widgets: ["meetings-calendar", "login-register"] },
      },
      {},
    );
    expect(event && widgetsFromHeartbeat(event)).toEqual(["meetings-calendar", "login-register"]);
  });
});

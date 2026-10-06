import { describe, expect, it } from "vitest";
import type { Meeting } from "../client/types";
import {
  cssToken,
  meetingCardHooks,
  meetingDaypart,
  meetingServiceSlug,
} from "./calendarMeetingCard";

function meeting(partial: Partial<Meeting> & Pick<Meeting, "startsAt">): Meeting {
  return {
    id: 1,
    name: "Clase",
    ...partial,
  };
}

describe("cssToken", () => {
  it("sluguea como v1: minúsculas y espacios a guion", () => {
    expect(cssToken("Open Gym")).toBe("open-gym");
    expect(cssToken("Funcional / Hyrox")).toBe("funcional-hyrox");
  });

  it("quita acentos para que Pílates no se vuelva plates", () => {
    expect(cssToken("Pílates")).toBe("pilates");
    expect(cssToken("Funcional / Hyrox")).not.toBe("funcional--hyrox");
  });

  it("si el nombre trae el horario, el slug también lo trae", () => {
    expect(cssToken("Open Gym 9:45-11:30")).toBe("open-gym-9-45-11-30");
  });

  it("vacío o solo símbolos queda vacío", () => {
    expect(cssToken("")).toBe("");
    expect(cssToken("   ")).toBe("");
    expect(cssToken("///")).toBe("");
  });
});

describe("meetingServiceSlug", () => {
  it("prefiere service.name, luego serviceName, luego name", () => {
    expect(
      meetingServiceSlug(
        meeting({
          startsAt: "2026-09-14T07:15:00",
          name: "Pintado",
          serviceName: "Open Gym",
          service: { id: 9, name: "Funcional / Hyrox" },
        }),
      ),
    ).toBe("funcional-hyrox");

    expect(
      meetingServiceSlug(
        meeting({
          startsAt: "2026-09-14T07:15:00",
          name: "Pintado",
          serviceName: "Open Gym",
        }),
      ),
    ).toBe("open-gym");

    expect(meetingServiceSlug(meeting({ startsAt: "2026-09-14T07:15:00", name: "Training" }))).toBe(
      "training",
    );
  });
});

describe("meetingDaypart", () => {
  it("corta AM < 12, Tarde 12–16:59, PM ≥ 17", () => {
    expect(meetingDaypart(meeting({ startsAt: "2026-09-14T07:15:00" }))).toBe("am");
    expect(meetingDaypart(meeting({ startsAt: "2026-09-14T09:45:00" }))).toBe("am");
    expect(meetingDaypart(meeting({ startsAt: "2026-09-14T11:59:00" }))).toBe("am");
    expect(meetingDaypart(meeting({ startsAt: "2026-09-14T12:00:00" }))).toBe("tarde");
    expect(meetingDaypart(meeting({ startsAt: "2026-09-14T16:59:00" }))).toBe("tarde");
    expect(meetingDaypart(meeting({ startsAt: "2026-09-14T17:00:00" }))).toBe("pm");
    expect(meetingDaypart(meeting({ startsAt: "2026-09-14T19:15:00" }))).toBe("pm");
  });

  it("usa la zona de la sede, no la del navegador", () => {
    // 13:15 UTC = 07:15 en Mérida (UTC-6, sin DST).
    expect(
      meetingDaypart(
        meeting({
          startsAt: "2026-09-14T13:15:00.000Z",
          timezone: "America/Merida",
        }),
      ),
    ).toBe("am");
    expect(
      meetingDaypart(
        meeting({
          startsAt: "2026-09-14T23:15:00.000Z",
          timezone: "America/Merida",
        }),
      ),
    ).toBe("pm");
  });
});

describe("meetingCardHooks", () => {
  it("AM y PM del mismo servicio comparten slug y se distinguen por daypart", () => {
    const am = meetingCardHooks(
      meeting({
        startsAt: "2026-09-14T07:15:00",
        serviceName: "Funcional / Hyrox",
        serviceId: 44,
      }),
    );
    const pm = meetingCardHooks(
      meeting({
        startsAt: "2026-09-14T19:15:00",
        serviceName: "Funcional / Hyrox",
        serviceId: 44,
      }),
    );

    expect(am.service).toBe("funcional-hyrox");
    expect(pm.service).toBe("funcional-hyrox");
    expect(am.daypart).toBe("am");
    expect(pm.daypart).toBe("pm");
    expect(am.className).toBe("gafa-meeting-card service-funcional-hyrox");
    expect(am.serviceId).toBe("44");
  });

  it("Open Gym a las 9:45 es am y data-service open-gym a la vez", () => {
    const hooks = meetingCardHooks(
      meeting({
        startsAt: "2026-09-14T09:45:00",
        serviceName: "Open Gym",
        service: { id: 12, name: "Open Gym" },
      }),
    );

    expect(hooks.service).toBe("open-gym");
    expect(hooks.daypart).toBe("am");
    expect(hooks.serviceId).toBe("12");
    expect(hooks.className).toContain("service-open-gym");
  });

  it("sin nombre de servicio no inventa class service-", () => {
    const hooks = meetingCardHooks(meeting({ startsAt: "2026-09-14T07:15:00", name: "  " }));
    expect(hooks.className).toBe("gafa-meeting-card");
    expect(hooks.service).toBe("");
  });
});

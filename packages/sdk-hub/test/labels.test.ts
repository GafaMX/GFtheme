import { describe, expect, it } from "vitest";
import { collapseSites, preferPublicHost } from "../src/directory";
import { eventLabel, personAlias, personLabel, studioName, widgetLabel } from "../src/labels";
import { pageMeta, readPage } from "../src/page";

describe("labels", () => {
  it("nombra estudios por host y path, no por id", () => {
    expect(studioName("fitspin.mx", "/")).toBe("Fitspin");
    expect(studioName("hybrix.mx", "/sdk-v2/")).toBe("Hybrix");
    expect(studioName("web.buq.mx", "/atlic/")).toBe("Atlic");
    expect(studioName("web.buq.mx", "/forza-room/reservar")).toBe("Forza Room");
    expect(studioName("localhost", "/")).toBe("Local");
  });

  it("traduce eventos y widgets", () => {
    expect(eventLabel("reservation.confirmed")).toBe("Reservó");
    expect(widgetLabel("login-register")).toBe("Mi cuenta");
  });

  it("distingue personas sin mostrar el user_id", () => {
    const a = personLabel({ companyId: 80, userId: 44, host: "fitspin.mx" });
    const b = personLabel({ companyId: 80, userId: 99, host: "fitspin.mx" });
    expect(a).toMatch(/^Fitspin · [A-Z2-9]{4}$/);
    expect(a).not.toEqual(b);
    expect(personLabel({ companyId: 80, userId: null, host: "fitspin.mx" })).toBe("Visitante");
    expect(personAlias(80, 44)).toHaveLength(4);
  });
});

describe("directory", () => {
  it("no deja que localhost pise un host público", () => {
    expect(preferPublicHost("fitspin.mx", "localhost")).toBe("fitspin.mx");
    expect(preferPublicHost("localhost", "fitspin.mx")).toBe("fitspin.mx");
  });

  it("colapsa sitios por estudio", () => {
    const sites = collapseSites([
      { company_id: 80, host: "fitspin.mx", path: "/", last_seen_at: "2026-08-31T23:00:00Z" },
      { company_id: 80, host: "fitspin.mx", path: "/reservar", last_seen_at: "2026-08-31T23:10:00Z" },
      { company_id: 80, host: "localhost", path: "/", last_seen_at: "2026-08-31T23:20:00Z" },
    ]);
    expect(sites.filter((site) => site.name === "Fitspin")).toHaveLength(1);
    expect(sites.some((site) => site.name === "Local")).toBe(true);
  });
});

describe("page", () => {
  it("acota pagina y tamaño", () => {
    expect(readPage({ page: "0", per_page: "999" })).toEqual({ page: 1, perPage: 50, offset: 0 });
    expect(pageMeta(83, 2, 25)).toMatchObject({ page: 2, pages: 4, total: 83, offset: 25 });
  });
});

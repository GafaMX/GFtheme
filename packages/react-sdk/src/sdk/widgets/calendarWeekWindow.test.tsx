import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { clearStoredToken } from "../client/tokenStorage";
import { addDays, toIsoDate } from "./calendarRange";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

describe("ventana semanal desde hoy", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
  });

  it("pinta 7 columnas que empiezan hoy, no el lunes civil", async () => {
    sdk = createGafaSdk(CONFIG, { useMockClient: true });
    const root = document.createElement("div");
    document.body.appendChild(root);
    sdk.mountCalendar(root, { view: "week", allowViewChange: false });

    await waitFor(() => {
      expect(root.querySelectorAll(".gafa-week-grid [data-iso]").length).toBe(7);
    });

    const columns = [...root.querySelectorAll(".gafa-week-grid [data-iso]")];
    const today = toIsoDate(new Date());
    expect(columns[0]?.getAttribute("data-iso")).toBe(today);
    expect(columns[6]?.getAttribute("data-iso")).toBe(toIsoDate(addDays(new Date(), 6)));
  });
});

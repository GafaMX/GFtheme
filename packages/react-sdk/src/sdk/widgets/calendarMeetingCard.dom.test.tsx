import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { clearStoredToken } from "../client/tokenStorage";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

describe("ganchos CSS de la tarjeta de clase", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
  });

  it("pinta data-service, data-daypart, service-* y clases de staff/sede", async () => {
    sdk = createGafaSdk(CONFIG, { useMockClient: true });
    const root = document.createElement("div");
    document.body.appendChild(root);
    sdk.mountCalendar(root, { view: "day", allowViewChange: false });

    await waitFor(() => {
      expect(root.querySelectorAll(".gafa-meeting-card").length).toBeGreaterThan(1);
    });

    const cards = Array.from(root.querySelectorAll<HTMLElement>(".gafa-meeting-card"));
    const training = cards.find((card) => card.dataset.service === "training");
    const wellness = cards.find((card) => card.dataset.service === "wellness");

    expect(training).toBeTruthy();
    expect(training?.classList.contains("service-training")).toBe(true);
    expect(training?.getAttribute("data-daypart")).toBe("am");
    expect(training?.querySelector(".gafa-meeting-staff")).toBeTruthy();
    expect(training?.querySelector(".gafa-meeting-location")?.textContent).toContain("Roma Norte");

    expect(wellness).toBeTruthy();
    expect(wellness?.classList.contains("service-wellness")).toBe(true);
    expect(wellness?.getAttribute("data-daypart")).toBe("pm");
    expect(wellness?.querySelector(".gafa-meeting-staff")).toBeTruthy();
    expect(wellness?.querySelector(".gafa-meeting-location")?.textContent).toContain("Condesa");
  });
});

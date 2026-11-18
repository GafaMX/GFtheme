import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { clearStoredToken } from "../client/tokenStorage";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };
const CASA_ONZE = { ...CONFIG, companyId: 146 };

let sdk: GafaSdk | null = null;

function mountCalendar(
  view: "day" | "week",
  options?: { companyId?: number; showWeekMeetingNotes?: boolean },
) {
  sdk = createGafaSdk(
    { ...CONFIG, companyId: options?.companyId ?? CONFIG.companyId },
    { useMockClient: true },
  );
  const root = document.createElement("div");
  document.body.appendChild(root);
  sdk.mountCalendar(root, {
    view,
    allowViewChange: false,
    ...(options?.showWeekMeetingNotes !== undefined
      ? { showWeekMeetingNotes: options.showWeekMeetingNotes }
      : {}),
  });
  return root;
}

describe("notas extra de la clase en el calendario", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
  });

  it("en vista de día pinta una sola línea bajo el nombre, sin la i compacta", async () => {
    const root = mountCalendar("day");

    await waitFor(() => {
      const desc = root.querySelector(".gafa-meeting-desc");
      expect(desc?.textContent).toContain("Trae toalla y zapatos de indoor");
      expect(root.querySelector(".gafa-meeting-extra")).toBeNull();
    });
  });

  it("en vista de semana pinta la i con el texto en tooltip, no el párrafo", async () => {
    const root = mountCalendar("week");

    await waitFor(() => {
      expect(root.querySelector(".gafa-meeting-extra")).toBeTruthy();
      expect(root.querySelector(".gafa-meeting-desc")).toBeNull();
      expect(root.querySelector(".gafa-meeting-extra__tip")?.textContent).toContain(
        "Trae toalla y zapatos de indoor",
      );
      expect(root.querySelector(".gafa-meeting-extra button")).toBeNull();
    });
  });

  it("si la clase no trae nota, no pinta línea ni i", async () => {
    const root = mountCalendar("day");

    await waitFor(() => {
      expect(root.querySelectorAll(".gafa-meeting-card").length).toBeGreaterThan(1);
    });

    const cards = Array.from(root.querySelectorAll(".gafa-meeting-card"));
    const withoutNotes = cards.filter((card) => !card.querySelector(".gafa-meeting-desc"));
    expect(withoutNotes.length).toBeGreaterThan(0);
  });

  it("Casa Onze en semana pinta el texto bajo el nombre y quita la i", async () => {
    const root = mountCalendar("week", { companyId: CASA_ONZE.companyId });

    await waitFor(() => {
      expect(root.querySelector(".gafa-meeting-desc")?.textContent).toContain(
        "Trae toalla y zapatos de indoor",
      );
    });

    expect(root.querySelector(".gafa-meeting-extra")).toBeNull();
    expect(root.querySelector(".gafa-meeting-card[data-week-notes='inline']")).toBeTruthy();
    const withoutNotes = Array.from(root.querySelectorAll(".gafa-meeting-card")).filter(
      (card) => !card.querySelector(".gafa-meeting-desc"),
    );
    expect(withoutNotes.length).toBeGreaterThan(0);
  });

  it("Casa Onze en día sigue igual: una línea, sin i", async () => {
    const root = mountCalendar("day", { companyId: CASA_ONZE.companyId });

    await waitFor(() => {
      const desc = root.querySelector(".gafa-meeting-desc");
      expect(desc?.textContent).toContain("Trae toalla y zapatos de indoor");
      expect(root.querySelector(".gafa-meeting-extra")).toBeNull();
      expect(root.querySelector(".gafa-meeting-card[data-compact='true']")).toBeNull();
    });
  });

  it("SHOW_WEEK_MEETING_NOTES prende el texto en otra marca", async () => {
    const root = mountCalendar("week", { companyId: 80, showWeekMeetingNotes: true });

    await waitFor(() => {
      expect(root.querySelector(".gafa-meeting-desc")?.textContent).toContain(
        "Trae toalla y zapatos de indoor",
      );
    });
    expect(root.querySelector(".gafa-meeting-extra")).toBeNull();
  });

  it("false explícito deja la i aunque sea Casa Onze", async () => {
    const root = mountCalendar("week", { companyId: 146, showWeekMeetingNotes: false });

    await waitFor(() => {
      expect(root.querySelector(".gafa-meeting-extra")).toBeTruthy();
    });
    expect(root.querySelector(".gafa-meeting-desc")).toBeNull();
  });
});

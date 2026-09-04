import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { clearStoredToken } from "../client/tokenStorage";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

function mountCalendar(view: "day" | "week") {
  sdk = createGafaSdk(CONFIG, { useMockClient: true });
  const root = document.createElement("div");
  document.body.appendChild(root);
  sdk.mountCalendar(root, { view, allowViewChange: false });
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
});

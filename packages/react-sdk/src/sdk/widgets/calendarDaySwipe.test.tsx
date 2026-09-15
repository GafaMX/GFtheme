import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { clearStoredToken } from "../client/tokenStorage";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };
const widgetsCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "widgets.css"), "utf8");

let sdk: GafaSdk | null = null;

function mountDayCalendar() {
  sdk = createGafaSdk(CONFIG, { useMockClient: true });
  const root = document.createElement("div");
  document.body.appendChild(root);
  sdk.mountCalendar(root, { view: "day", allowViewChange: false });
  return root;
}

describe("transición al cambiar de día", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
  });

  it("al montar no anima: el primer día aparece quieto", async () => {
    const root = mountDayCalendar();
    await waitFor(() => {
      expect(root.querySelector(".gafa-day-pane")).toBeTruthy();
    });
    expect(root.querySelector(".gafa-day-pane")?.getAttribute("data-enter")).toBeNull();
  });

  it("la flecha siguiente entra el día desde la derecha", async () => {
    const root = mountDayCalendar();
    await waitFor(() => {
      expect(root.querySelector('button[aria-label="Día siguiente"]')).toBeTruthy();
    });

    fireEvent.click(root.querySelector('button[aria-label="Día siguiente"]')!);

    await waitFor(() => {
      expect(root.querySelector(".gafa-day-pane")?.getAttribute("data-enter")).toBe("next");
    });
  });

  it("swipe a la izquierda también entra como next", async () => {
    const root = mountDayCalendar();
    await waitFor(() => {
      expect(root.querySelector(".gafa-day-swipe")).toBeTruthy();
    });

    const surface = root.querySelector(".gafa-day-swipe")!;
    fireEvent.touchStart(surface, { touches: [{ clientX: 220, clientY: 90 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 80, clientY: 94 }] });

    await waitFor(() => {
      expect(root.querySelector(".gafa-day-pane")?.getAttribute("data-enter")).toBe("next");
    });
  });

  it("después de ir adelante, el swipe a la derecha entra como prev", async () => {
    const root = mountDayCalendar();
    await waitFor(() => {
      expect(root.querySelector('button[aria-label="Día siguiente"]')).toBeTruthy();
    });
    fireEvent.click(root.querySelector('button[aria-label="Día siguiente"]')!);
    await waitFor(() => {
      expect(root.querySelector(".gafa-day-pane")?.getAttribute("data-enter")).toBe("next");
    });

    const surface = root.querySelector(".gafa-day-swipe")!;
    fireEvent.touchStart(surface, { touches: [{ clientX: 80, clientY: 90 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 220, clientY: 88 }] });

    await waitFor(() => {
      expect(root.querySelector(".gafa-day-pane")?.getAttribute("data-enter")).toBe("prev");
    });
  });
});

describe("CSS del slide de día", () => {
  it("tiene slide next/prev y respeta reduced-motion", () => {
    expect(widgetsCss).toContain("@keyframes gafa-day-enter-next");
    expect(widgetsCss).toContain("@keyframes gafa-day-enter-prev");
    expect(widgetsCss).toContain("prefers-reduced-motion");
    expect(widgetsCss).toMatch(/\.gafa-day-pane\[data-enter="next"\][\s\S]{0,80}gafa-day-enter-next/);
  });
});

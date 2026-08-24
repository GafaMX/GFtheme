import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../../docs/v2-embed/wp-v2-overlay.css"),
  "utf8",
);

const widgetsCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../widgets/widgets.css"), "utf8");

describe("overlay CSS WP v2", () => {
  it("mapea las superficies v2, no las clases GFSDK de v1", () => {
    const withoutComments = overlay.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(overlay).toContain(".gafa-header-account");
    expect(overlay).toContain(".gafa-meeting-card");
    expect(overlay).toContain(".gafa-calendar-filter");
    expect(overlay).toContain(".gafa-checkout__cta");
    expect(overlay).toContain(".gafa-account-modal");
    expect(overlay).toContain(".gafa-catalog-card");
    expect(overlay).toContain(".gafa-confirm");
    expect(overlay).toContain(".gafa-reservation-sheet");
    expect(withoutComments).not.toMatch(/#CreateReservationFancyTemplate/);
    expect(withoutComments).not.toMatch(/\.GFSDK-/);
    expect(withoutComments).not.toMatch(/\.gafapay-form__group[^{]*\{[^}]*display:\s*flex/);
  });

  it("conserva las variables de marca que ya usa Elementor", () => {
    expect(overlay).toContain("--sdk-main-color");
    expect(overlay).toContain("--sdk-hover-color");
    expect(overlay).toContain("--sdk-text-color");
    expect(overlay).toContain("--sdk-background-color");
    expect(overlay).toContain("--sdk-secondary-color");
  });

  it("el checkout del SDK queda por encima del header sticky de Elementor", () => {
    expect(widgetsCss).toMatch(/\.gafa-checkout-overlay[\s\S]*?z-index:\s*2147483000/);
  });
});

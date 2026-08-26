import { describe, expect, it } from "vitest";
import { WIDGET_BY_SHORTCODE, WIDGET_CATALOG, bootstrapableWidgets } from "./registry";

describe("widget registry", () => {
  it("incluye el calendario y deja hueco para concierge", () => {
    expect(WIDGET_BY_SHORTCODE.get("meetings-calendar")?.status).toBe("stable");
    expect(WIDGET_BY_SHORTCODE.get("concierge")?.status).toBe("preview");
    expect(WIDGET_BY_SHORTCODE.get("concierge")?.mount).toBeUndefined();
  });

  it("solo arranca widgets con mount (concierge queda fuera hasta que exista)", () => {
    const shortcodes = bootstrapableWidgets().map((widget) => widget.shortcode);
    expect(shortcodes).toContain("meetings-calendar");
    expect(shortcodes).not.toContain("concierge");
    expect(WIDGET_CATALOG.length).toBeGreaterThan(shortcodes.length);
  });
});

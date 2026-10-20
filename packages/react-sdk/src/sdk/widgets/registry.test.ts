import { describe, expect, it } from "vitest";
import { WIDGET_BY_SHORTCODE, WIDGET_CATALOG, bootstrapableWidgets } from "./registry";

describe("widget registry", () => {
  it("incluye el calendario y monta Concierge como widget opt-in", () => {
    expect(WIDGET_BY_SHORTCODE.get("meetings-calendar")?.status).toBe("stable");
    expect(WIDGET_BY_SHORTCODE.get("concierge")?.status).toBe("stable");
    expect(WIDGET_BY_SHORTCODE.get("concierge")?.mount).toEqual(expect.any(Function));
    expect(WIDGET_BY_SHORTCODE.get("cross-sell")?.status).toBe("preview");
    expect(WIDGET_BY_SHORTCODE.get("cross-sell")?.mount).toBeUndefined();
  });

  it("arranca Concierge junto al calendario; cross-sell sigue fuera", () => {
    const shortcodes = bootstrapableWidgets().map((widget) => widget.shortcode);
    expect(shortcodes).toContain("meetings-calendar");
    expect(shortcodes).toContain("concierge");
    expect(shortcodes).not.toContain("cross-sell");
    expect(WIDGET_CATALOG.length).toBeGreaterThan(shortcodes.length);
  });
});

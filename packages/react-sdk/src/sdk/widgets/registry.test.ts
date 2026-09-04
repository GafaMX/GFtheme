import { describe, expect, it } from "vitest";
import { WIDGET_BY_SHORTCODE, WIDGET_CATALOG, bootstrapableWidgets } from "./registry";

describe("widget registry", () => {
  it("incluye el calendario y monta Concierge como widget opt-in", () => {
    expect(WIDGET_BY_SHORTCODE.get("meetings-calendar")?.status).toBe("stable");
    expect(WIDGET_BY_SHORTCODE.get("concierge")?.status).toBe("stable");
    expect(WIDGET_BY_SHORTCODE.get("concierge")?.mount).toEqual(expect.any(Function));
  });

  it("arranca Concierge junto al calendario cuando el shortcode tiene mount", () => {
    const shortcodes = bootstrapableWidgets().map((widget) => widget.shortcode);
    expect(shortcodes).toContain("meetings-calendar");
    expect(shortcodes).toContain("concierge");
    expect(WIDGET_CATALOG.length).toBe(shortcodes.length);
  });
});

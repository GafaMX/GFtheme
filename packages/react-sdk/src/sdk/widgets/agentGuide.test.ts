import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WIDGET_CATALOG } from "./registry";

const guide = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../../docs/v2-agente.md"),
  "utf8",
);

describe("docs/v2-agente.md", () => {
  it("lista todos los shortcodes del registry", () => {
    for (const widget of WIDGET_CATALOG) {
      expect(guide, widget.shortcode).toContain(`\`${widget.shortcode}\``);
    }
  });

  it("deja clara la URL canónica y lo que no hay que hacer", () => {
    expect(guide).toContain("@cdn-live/docs/v2-sdk/gafa-sdk.js");
    expect(guide).toContain("No pulses Republish");
    expect(guide).toContain("THEME");
    expect(guide).toContain("headerControls");
    expect(guide).toContain("filter-bq-location");
    expect(guide).toContain("data-gf-buy");
    expect(guide).toContain("allowUserColorScheme");
  });
});

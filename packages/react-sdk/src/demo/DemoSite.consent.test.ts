import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("demo consent button", () => {
  it("vive en el header, no en el footer, y no se esconde en móvil", () => {
    const tsx = readFileSync(join(here, "DemoSite.tsx"), "utf8");
    const css = readFileSync(join(here, "demo.css"), "utf8");
    const header = tsx.slice(tsx.indexOf('className="demo-header"'), tsx.indexOf('className="demo-main"'));
    const footer = tsx.slice(tsx.indexOf('className="demo-footer"'), tsx.indexOf("PixelDebugPanel"));
    expect(header).toContain("Dar consentimiento de marketing");
    expect(header).toContain("demo-consent");
    expect(footer).not.toContain("Dar consentimiento de marketing");
    expect(css).toMatch(/\.demo-consent[\s\S]*z-index:\s*10050/);
    const mobileHide = css.slice(css.indexOf("@media (max-width: 620px)"));
    expect(mobileHide).toContain(".demo-brand-select");
    expect(mobileHide).toMatch(/\.demo-consent\s*\{[\s\S]*display:\s*inline-flex/);
  });
});

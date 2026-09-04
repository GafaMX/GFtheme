import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

const widgetsCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "widgets.css"), "utf8");

describe("ConfirmDialog mark", () => {
  afterEach(() => cleanup());

  it("usa un icono SVG, no un '?' de texto que se pierde en el circulo", () => {
    render(
      <ConfirmDialog title="Acepta los términos" onConfirm={() => undefined} onDismiss={() => undefined} />,
    );
    const mark = document.querySelector(".gafa-confirm__mark");
    expect(mark?.querySelector("svg")).toBeTruthy();
    expect(mark?.textContent?.trim()).toBe("");
  });

  it("pinta el sello con el color de marca, no un circulo casi blanco", () => {
    expect(widgetsCss).toMatch(/\.gafa-confirm__mark \{[^}]*background: var\(--gafa-color-primary\)/);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./theme";

describe("ThemeProvider sigue el theme de la página", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.className = "";
    document.documentElement.style.removeProperty("--sdk-background-color");
    localStorage.removeItem("gafa-sdk-color-scheme");
    localStorage.removeItem("fitspin-theme");
  });

  it("html.fitspin-dark pone el SDK en dark aunque THEME diga light", async () => {
    document.documentElement.className = "fitspin-dark";
    const view = render(
      <ThemeProvider theme={{ colorScheme: "light", colors: { brand: "#FFD420" } }}>
        <span>calendario</span>
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("dark");
    });
    expect(view.container.querySelector(".gafa-sdk")?.getAttribute("style") ?? "").toContain(
      "var(--sdk-text-color",
    );
    const style = view.container.querySelector(".gafa-sdk")?.getAttribute("style") ?? "";
    expect(style).toMatch(/--gafa-color-modal:\s*hsl\(/);
    expect(style).not.toMatch(/--gafa-color-modal:\s*var\(--sdk-/);
  });

  it("al quitar fitspin-dark vuelve al THEME light", async () => {
    document.documentElement.className = "fitspin-dark";
    const view = render(
      <ThemeProvider theme={{ colorScheme: "light" }}>
        <span>calendario</span>
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("dark");
    });

    act(() => {
      document.documentElement.classList.remove("fitspin-dark");
    });
    await waitFor(() => {
      expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("light");
    });
  });

  it("sigue el localStorage de Fitspin si la clase llega después", async () => {
    localStorage.setItem("fitspin-theme", "dark");
    const view = render(
      <ThemeProvider theme={{ colorScheme: "light" }}>
        <span>calendario</span>
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("dark");
    });
  });

  it("reacts when html.fitspin-dark is added after mount", async () => {
    const view = render(
      <ThemeProvider theme={{ colorScheme: "light" }}>
        <span>calendario</span>
      </ThemeProvider>,
    );
    expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("light");

    act(() => {
      document.documentElement.classList.add("fitspin-dark");
    });
    await waitFor(() => {
      expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("dark");
    });
  });

  it("el setItem de Fitspin en la misma pestaña cambia el scheme", async () => {
    const view = render(
      <ThemeProvider theme={{ colorScheme: "light" }}>
        <span>calendario</span>
      </ThemeProvider>,
    );
    expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("light");

    act(() => {
      localStorage.setItem("fitspin-theme", "dark");
    });
    await waitFor(() => {
      expect(view.container.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("dark");
    });
  });
});

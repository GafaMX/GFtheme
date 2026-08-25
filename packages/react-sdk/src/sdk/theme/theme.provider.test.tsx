import { afterEach, describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./theme";

describe("ThemeProvider sigue el theme de la página", () => {
  afterEach(() => {
    document.documentElement.className = "";
    localStorage.removeItem("gafa-sdk-color-scheme");
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
});

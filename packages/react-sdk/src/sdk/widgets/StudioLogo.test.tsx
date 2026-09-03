import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../theme/theme";
import { StudioLogo } from "./StudioLogo";

afterEach(() => {
  cleanup();
  localStorage.removeItem("gafa-sdk-color-scheme");
});

function mount(theme: { logoUrl?: string; logoUrlDark?: string; colorScheme?: "light" | "dark" }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={{ ...theme, allowUserColorScheme: false }}>
        <StudioLogo />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("StudioLogo sigue el esquema", () => {
  it("en light usa logoUrl", () => {
    const view = mount({
      colorScheme: "light",
      logoUrl: "https://cdn.example/logo-light.png",
      logoUrlDark: "https://cdn.example/logo-dark.png",
    });
    expect(view.container.querySelector(".gafa-studio-logo")?.getAttribute("src")).toBe(
      "https://cdn.example/logo-light.png",
    );
  });

  it("en dark usa logoUrlDark", () => {
    const view = mount({
      colorScheme: "dark",
      logoUrl: "https://cdn.example/logo-light.png",
      logoUrlDark: "https://cdn.example/logo-dark.png",
    });
    expect(view.container.querySelector(".gafa-studio-logo")?.getAttribute("src")).toBe(
      "https://cdn.example/logo-dark.png",
    );
  });

  it("en dark sin logoUrlDark se queda con logoUrl", () => {
    const view = mount({
      colorScheme: "dark",
      logoUrl: "https://cdn.example/logo-light.png",
    });
    expect(view.container.querySelector(".gafa-studio-logo")?.getAttribute("src")).toBe(
      "https://cdn.example/logo-light.png",
    );
  });
});

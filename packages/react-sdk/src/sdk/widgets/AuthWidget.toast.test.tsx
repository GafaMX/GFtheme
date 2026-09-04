import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GafaClient } from "../client/types";
import { ThemeProvider } from "../theme/theme";
import { resetToastHostForTests } from "../toast/ToastHost";
import { clearToasts } from "../toast/toastStore";
import { AuthWidget } from "./AuthWidget";

afterEach(() => {
  cleanup();
  clearToasts();
  resetToastHostForTests();
});

function mockClient(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    login: async () => {
      throw new Error("Credenciales inválidas.");
    },
    register: async () => undefined,
    listBrands: async () => [],
    listRegistrationFields: async () => [],
    ...overrides,
  } as unknown as GafaClient;
}

function renderAuth(client: GafaClient = mockClient()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={{ colorScheme: "dark", allowUserColorScheme: false }}>
        <AuthWidget client={client} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("AuthWidget toasts (login/registro)", () => {
  it("login vacío: toast arriba, bordes rojos, sin banner que empuje el form", () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const toast = document.querySelector(".gafa-toast");
    expect(toast?.textContent).toMatch(/marcados en rojo/);
    expect(document.body.querySelector(":scope > .gafa-toast-stack")).toBeTruthy();
    expect(document.querySelector(".gafa-sdk-form .gafa-sdk-state--error")).toBeNull();
    expect(document.querySelectorAll('.gafa-float[data-invalid="true"]').length).toBeGreaterThan(0);
  });

  it("error del server de login va al toast, no al banner", async () => {
    renderAuth();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@buq.mx" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(document.querySelector(".gafa-toast")?.textContent).toMatch(/Credenciales inválidas/);
    });
    expect(document.querySelector(".gafa-sdk-form .gafa-sdk-state--error")).toBeNull();
  });

  it("registro vacío también toastea y deja los campos en rojo", () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    fireEvent.submit(document.querySelector(".gafa-sdk-form") as HTMLFormElement);

    expect(document.querySelector(".gafa-toast")?.textContent).toMatch(/marcados en rojo/);
    expect(document.querySelector(".gafa-sdk-form .gafa-sdk-state--error")).toBeNull();
    expect(document.querySelectorAll('.gafa-float[data-invalid="true"]').length).toBeGreaterThan(0);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GafaClient } from "../client/types";
import { ThemeProvider } from "../theme/theme";
import { resetToastHostForTests } from "../toast/ToastHost";
import { clearToasts } from "../toast/toastStore";
import { AccountModal } from "./AccountModal";
import { AuthWidget } from "./AuthWidget";

afterEach(() => {
  cleanup();
  clearToasts();
  resetToastHostForTests();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

function mockClient(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    getProfile: async () => ({ id: 1, email: "ana@buq.mx", first_name: "Ana" }),
    login: async () => undefined,
    register: async () => undefined,
    listBrands: async () => [],
    listRegistrationFields: async () => [],
    requestPasswordReset: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as GafaClient;
}

function wrap(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={{ colorScheme: "dark", allowUserColorScheme: false }}>{node}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("reset de contraseña", () => {
  it("con sesión abierta y link roto (#hash), muestra el cambio de contraseña, no el perfil", async () => {
    window.history.replaceState(null, "", "/reservar#horario?token=tok123&email=ana+1@buq.mx");
    const client = mockClient();
    wrap(<AccountModal client={client} open onClose={() => undefined} />);

    expect(await screen.findByLabelText("Nueva contraseña")).toBeTruthy();
    expect(document.querySelector(".gafa-account-modal")?.getAttribute("data-state")).toBe("auth");

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña y entrar" }));

    await waitFor(() => {
      expect(client.resetPassword).toHaveBeenCalledWith({
        email: "ana+1@buq.mx",
        password: "secret1",
        passwordConfirmation: "secret1",
        token: "tok123",
      });
    });
    await waitFor(() => {
      expect(window.location.hash).toBe("#horario");
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Nueva contraseña")).toBeNull();
    });
  });

  it("olvidé mi contraseña manda return_url limpio (sin query ni hash)", async () => {
    window.history.replaceState(null, "", "/reservar?location=centro#horario");
    const client = mockClient();
    wrap(<AuthWidget client={client} initialView="password-recovery" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@buq.mx" } });
    fireEvent.submit(document.querySelector("form.gafa-sdk-form") as HTMLFormElement);

    await waitFor(() => {
      expect(client.requestPasswordReset).toHaveBeenCalledWith({
        email: "ana@buq.mx",
        returnUrl: `${window.location.origin}/reservar`,
      });
    });
  });
});

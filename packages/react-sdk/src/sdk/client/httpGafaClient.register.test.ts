import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import {
  DEFAULT_CAPTCHA_SECRET_KEY,
  parseGafaSdkConfig,
} from "../config";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("httpGafaClient.register captcha payload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("manda g-recaptcha-response y el secret default cuando no hay llaves propias", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ url: "/" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpGafaClient(
      parseGafaSdkConfig({
        apiBaseUrl: "https://buq.partners",
        companyId: 1,
        publicClientId: "10",
        clientSecret: "secret",
      }),
    );

    await client.register({
      email: "ana@buq.mx",
      password: "secret1",
      passwordConfirmation: "secret1",
      firstName: "Ana",
      captchaToken: "tok-from-grecaptcha",
    });

    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0][0]).toBe("https://buq.partners/api/register");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("g-recaptcha-response")).toBe("tok-from-grecaptcha");
    expect(body.get("g_recaptcha_response")).toBe("tok-from-grecaptcha");
    expect(body.get("captcha_secret_key")).toBe(DEFAULT_CAPTCHA_SECRET_KEY);
    expect(body.get("username")).toBe("ana@buq.mx");
  });

  it("manda el secret del socio cuando el par está completo", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ url: "/" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpGafaClient(
      parseGafaSdkConfig({
        apiBaseUrl: "https://buq.partners",
        companyId: 1,
        captchaPublicKey: "partner-public",
        captchaSecretKey: "partner-secret",
      }),
    );

    await client.register({
      email: "ana@buq.mx",
      password: "secret1",
      passwordConfirmation: "secret1",
      firstName: "Ana",
      captchaToken: "tok",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get("captcha_secret_key")).toBe("partner-secret");
    expect(body.get("g-recaptcha-response")).toBe("tok");
  });

  it("403 sin message/errors no muestra «gafa.fit API 403» y loguea method/url/status/excerpt", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>error code: 1010</html>", { status: 403 })),
    );

    const client = createHttpGafaClient(
      parseGafaSdkConfig({ apiBaseUrl: "https://buq.partners", companyId: 1 }),
    );

    await expect(
      client.register({
        email: "ana@buq.mx",
        password: "secret1",
        passwordConfirmation: "secret1",
        firstName: "Ana",
        captchaToken: "tok",
      }),
    ).rejects.toMatchObject({
      message: "No tienes permiso para completar esta acción. Recarga e inténtalo de nuevo.",
      status: 403,
    });

    expect(error).toHaveBeenCalled();
    const [, payload] = error.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toMatchObject({
      method: "POST",
      url: "https://buq.partners/api/register",
      status: 403,
      body: "<html>error code: 1010</html>",
    });
    expect(JSON.stringify(payload)).not.toMatch(/secret1/);
    expect(JSON.stringify(payload)).not.toMatch(/Authorization/i);
  });

  it("red sin respuesta: mensaje de conexión y log con status 0", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const client = createHttpGafaClient(
      parseGafaSdkConfig({ apiBaseUrl: "https://buq.partners", companyId: 1 }),
    );

    await expect(
      client.register({
        email: "ana@buq.mx",
        password: "secret1",
        passwordConfirmation: "secret1",
        firstName: "Ana",
        captchaToken: "tok",
      }),
    ).rejects.toMatchObject({
      message: "No pudimos conectar. Revisa tu internet e inténtalo de nuevo.",
      status: 0,
    });

    expect(error.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      url: "https://buq.partners/api/register",
      status: 0,
      body: "Failed to fetch",
    });
  });

  it("422 de recaptcha se traduce a español corto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            message: "The given data was invalid.",
            errors: { "g-recaptcha-response": ["The g-recaptcha-response field is required."] },
          },
          422,
        ),
      ),
    );

    const client = createHttpGafaClient(
      parseGafaSdkConfig({ apiBaseUrl: "https://buq.partners", companyId: 1 }),
    );

    await expect(
      client.register({
        email: "ana@buq.mx",
        password: "secret1",
        passwordConfirmation: "secret1",
        firstName: "Ana",
        captchaToken: "",
      }),
    ).rejects.toMatchObject({
      message: "No pudimos validar el captcha. Recarga e inténtalo de nuevo.",
      status: 422,
    });
  });
});

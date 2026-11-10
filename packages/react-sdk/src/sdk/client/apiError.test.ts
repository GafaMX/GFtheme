import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fallbackMessageForStatus,
  logFailedApiCall,
  parseApiErrorPayload,
  redactRequestUrl,
  responseBodyExcerpt,
  userFacingApiErrorMessage,
} from "./apiError";

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { Sentry?: unknown }).Sentry;
});

describe("userFacingApiErrorMessage", () => {
  it("conserva message/errors del server (traducidos si hay equivalencia)", () => {
    expect(
      userFacingApiErrorMessage({
        status: 401,
        message: "The user credentials were incorrect.",
      }),
    ).toBe("Correo o contraseña incorrectos.");
    expect(
      userFacingApiErrorMessage({
        status: 422,
        message: "The given data was invalid.",
        fieldError: "The email has already been taken.",
      }),
    ).toBe("Ese correo ya está registrado.");
    expect(
      userFacingApiErrorMessage({
        status: 403,
        message: "Esta marca no admite registros públicos.",
      }),
    ).toBe("Esta marca no admite registros públicos.");
  });

  it("mapea 401/403/422/5xx/red cuando no hay message ni errors", () => {
    expect(userFacingApiErrorMessage({ status: 401 })).toBe("Tu sesión expiró, entra de nuevo.");
    expect(userFacingApiErrorMessage({ status: 403 })).toBe(
      "No tienes permiso para completar esta acción. Recarga e inténtalo de nuevo.",
    );
    expect(userFacingApiErrorMessage({ status: 422 })).toBe("Revisa los datos ingresados.");
    expect(userFacingApiErrorMessage({ status: 500 })).toBe("Error del servidor, inténtalo de nuevo.");
    expect(userFacingApiErrorMessage({ status: 502 })).toBe("Error del servidor, inténtalo de nuevo.");
    expect(userFacingApiErrorMessage({ status: 0 })).toBe(
      "No pudimos conectar. Revisa tu internet e inténtalo de nuevo.",
    );
    expect(fallbackMessageForStatus(0)).toBe(
      "No pudimos conectar. Revisa tu internet e inténtalo de nuevo.",
    );
  });

  it("no deja el fallback crudo «gafa.fit API 403»", () => {
    expect(userFacingApiErrorMessage({ status: 403, message: "  " })).not.toMatch(/gafa\.fit API/i);
  });
});

describe("redactRequestUrl", () => {
  it("deja la URL completa y tapa tokens/passwords/secretos del query", () => {
    expect(
      redactRequestUrl(
        "https://buq.partners/api/password/reset?email=ana@buq.mx&token=abc123&password=secret1",
      ),
    ).toBe(
      "https://buq.partners/api/password/reset?email=ana%40buq.mx&token=%5Bredacted%5D&password=%5Bredacted%5D",
    );
    expect(
      redactRequestUrl(
        "https://buq.partners/api/brand/fitspin/reservation/initial-purchase-status?checkout_token=chk_live&pending_purchase_id=88",
      ),
    ).toBe(
      "https://buq.partners/api/brand/fitspin/reservation/initial-purchase-status?checkout_token=%5Bredacted%5D&pending_purchase_id=88",
    );
  });

  it("no toca URLs sin secretos", () => {
    expect(redactRequestUrl("https://buq.partners/api/register")).toBe(
      "https://buq.partners/api/register",
    );
  });
});

describe("responseBodyExcerpt", () => {
  it("corta a ~300 caracteres y tapa passwords / Bearer", () => {
    const long = `password="hunter2" Authorization: Bearer eyJhbGciOi.secret ${"x".repeat(400)}`;
    const excerpt = responseBodyExcerpt(long);
    expect(excerpt.length).toBeLessThanOrEqual(300);
    expect(excerpt).not.toContain("hunter2");
    expect(excerpt).not.toContain("eyJhbGciOi.secret");
    expect(excerpt).toMatch(/Bearer \[redacted\]/);
  });
});

describe("parseApiErrorPayload", () => {
  it("rescata JSON detrás de un Warning HTML", () => {
    const text = '<br /><b>Warning</b>: x<br />{"message":"Nope","errors":{"email":["tomado"]}}';
    expect(parseApiErrorPayload(text)).toEqual({
      message: "Nope",
      errors: { email: ["tomado"] },
    });
  });

  it("HTML o vacío no inventa message", () => {
    expect(parseApiErrorPayload("")).toBeNull();
    expect(parseApiErrorPayload("<html>Forbidden</html>")).toBeNull();
  });
});

describe("logFailedApiCall", () => {
  it("console.error: method, URL redactada, status, excerpt; sin Authorization ni request body", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logFailedApiCall({
      method: "POST",
      url: "https://buq.partners/api/register?client_secret=super-secret",
      status: 403,
      bodyExcerpt: "<html>error code: 1010</html>",
    });

    expect(error).toHaveBeenCalledTimes(1);
    const [label, payload] = error.mock.calls[0] as [string, Record<string, unknown>];
    expect(label).toBe("[gafa-sdk] API error");
    expect(payload).toEqual({
      method: "POST",
      url: "https://buq.partners/api/register?client_secret=%5Bredacted%5D",
      status: 403,
      body: "<html>error code: 1010</html>",
    });
    expect(JSON.stringify(payload)).not.toMatch(/Authorization/i);
    expect(JSON.stringify(payload)).not.toMatch(/super-secret/);
    expect(payload).not.toHaveProperty("headers");
    expect(payload).not.toHaveProperty("requestBody");
  });

  it("si la página ya tiene Sentry, reenvía el mismo payload; no agrega vendor", () => {
    const captureException = vi.fn();
    (globalThis as { Sentry?: { captureException: typeof captureException } }).Sentry = {
      captureException,
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logFailedApiCall({
      method: "POST",
      url: "https://buq.partners/api/register",
      status: 403,
      bodyExcerpt: "forbidden",
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, ctx] = captureException.mock.calls[0] as [
      Error,
      { extra: Record<string, unknown> },
    ];
    expect(err.name).toBe("GafaSdkApiError");
    expect(ctx.extra).toMatchObject({
      method: "POST",
      url: "https://buq.partners/api/register",
      status: 403,
      body: "forbidden",
    });
  });
});

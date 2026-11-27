import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTCHA_PUBLIC_KEY, resolveCaptchaKeys } from "../config";
import { createCaptchaProvider } from "./CaptchaProvider";

describe("createCaptchaProvider", () => {
  it("nunca devuelve undefined: sin llave usa el default de Buq", () => {
    const provider = createCaptchaProvider();
    expect(provider).toEqual(expect.objectContaining({ execute: expect.any(Function) }));
  });

  it("llave en blanco también cae al default", () => {
    expect(createCaptchaProvider("recaptcha-v3", "  ")).toEqual(
      expect.objectContaining({ execute: expect.any(Function) }),
    );
    expect(createCaptchaProvider("recaptcha-v3", "")).toEqual(
      expect.objectContaining({ execute: expect.any(Function) }),
    );
  });
});

describe("resolveCaptchaKeys", () => {
  it("par incompleto (Hub público, secret vacío) vuelve al default", () => {
    expect(
      resolveCaptchaKeys({ captchaPublicKey: DEFAULT_CAPTCHA_PUBLIC_KEY, captchaSecretKey: "" }),
    ).toEqual({
      captchaPublicKey: DEFAULT_CAPTCHA_PUBLIC_KEY,
      captchaSecretKey: expect.any(String),
    });
    const resolved = resolveCaptchaKeys({ CAPTCHA_PUBLIC_KEY: "solo-publica" });
    expect(resolved.captchaPublicKey).toBe(DEFAULT_CAPTCHA_PUBLIC_KEY);
    expect(resolved.captchaSecretKey).toBeTruthy();
    expect(resolved.captchaSecretKey).not.toBe("solo-publica");
  });

  it("par completo del socio se respeta", () => {
    expect(resolveCaptchaKeys({ captchaPublicKey: " pub ", captchaSecretKey: " sec " })).toEqual({
      captchaPublicKey: "pub",
      captchaSecretKey: "sec",
    });
  });
});

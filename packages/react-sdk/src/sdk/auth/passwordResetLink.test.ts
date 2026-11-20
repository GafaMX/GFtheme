import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PASSWORD_RESET_STORAGE_KEY,
  capturePasswordResetLink,
  clearPasswordResetLink,
  parsePasswordResetLink,
  passwordResetReturnUrl,
  readPasswordResetLink,
  stripPasswordResetParams,
} from "./passwordResetLink";

const TOKEN = "a1b2c3d4e5";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  sessionStorage.removeItem(PASSWORD_RESET_STORAGE_KEY);
  vi.unstubAllGlobals();
});

describe("parsePasswordResetLink", () => {
  it("link bien armado", () => {
    expect(parsePasswordResetLink(`?token=${TOKEN}&email=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });

  it("token pegado despues de #fragment (INSIGHT / KIN KIN)", () => {
    expect(parsePasswordResetLink(`#horario?token=${TOKEN}&email=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });

  it("doble ? cuando la URL ya traia query", () => {
    expect(parsePasswordResetLink(`?location=centro?token=${TOKEN}&email=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });

  it("query + hash + token al final del hash", () => {
    expect(
      parsePasswordResetLink(`?location=centro#horario?token=${TOKEN}&email=ana@buq.mx`),
    ).toEqual({ token: TOKEN, email: "ana@buq.mx" });
  });

  it("email sin codificar con + no se vuelve espacio", () => {
    expect(parsePasswordResetLink(`?token=${TOKEN}&email=ana+1@buq.mx`)?.email).toBe("ana+1@buq.mx");
  });

  it("email codificado se decodifica", () => {
    expect(parsePasswordResetLink(`?token=${TOKEN}&email=ana%2B1%40buq.mx`)?.email).toBe("ana+1@buq.mx");
  });

  it("si se repite, gana el ultimo (lo que agrega gafa.fit)", () => {
    expect(parsePasswordResetLink(`?token=viejo&email=x@y.mx?token=${TOKEN}&email=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });

  it("sin token o sin email no es link de reset", () => {
    expect(parsePasswordResetLink(`?token=${TOKEN}`)).toBeNull();
    expect(parsePasswordResetLink("?email=ana@buq.mx")).toBeNull();
    expect(parsePasswordResetLink("?token=&email=ana@buq.mx")).toBeNull();
    expect(parsePasswordResetLink("?buq-env=staging&mytoken=1&email=a@b.mx")).toBeNull();
    expect(parsePasswordResetLink("")).toBeNull();
  });

  it("encoding roto no truena", () => {
    expect(parsePasswordResetLink(`?token=${TOKEN}&email=ana%E0@buq.mx`)?.email).toBe("ana%E0@buq.mx");
  });

  it("hash marker de correos nuevos (sobrevive redirect de idioma)", () => {
    expect(parsePasswordResetLink(`#gafa-pw-reset?token=${TOKEN}&email=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });

  it("HTML &amp;email= del correo", () => {
    expect(parsePasswordResetLink(`?token=${TOKEN}&amp;email=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });

  it("TOKEN/EMAIL en mayúsculas", () => {
    expect(parsePasswordResetLink(`?TOKEN=${TOKEN}&EMAIL=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });

  it("query encoded en el path (WAF / click tracker)", () => {
    expect(
      parsePasswordResetLink(`https://studio.mx/es/reservar%3Ftoken%3D${TOKEN}%26email%3Dana%40buq.mx`),
    ).toEqual({ token: TOKEN, email: "ana@buq.mx" });
  });

  it("hash router #/reset?token=", () => {
    expect(parsePasswordResetLink(`#/reset?token=${TOKEN}&email=ana@buq.mx`)).toEqual({
      token: TOKEN,
      email: "ana@buq.mx",
    });
  });
});

describe("stripPasswordResetParams", () => {
  it.each([
    [`?token=${TOKEN}&email=a@b.mx`, { search: "", hash: "" }],
    [`?location=centro&token=${TOKEN}&email=a@b.mx`, { search: "?location=centro", hash: "" }],
    [`?location=centro?token=${TOKEN}&email=a@b.mx`, { search: "?location=centro", hash: "" }],
    [`#horario?token=${TOKEN}&email=a@b.mx`, { search: "", hash: "#horario" }],
    [`?brand=fitspin#horario?token=${TOKEN}&email=a@b.mx`, { search: "?brand=fitspin", hash: "#horario" }],
    [`#token=${TOKEN}&email=a@b.mx`, { search: "", hash: "" }],
    [`?token=${TOKEN}&brand=fitspin&email=a@b.mx`, { search: "?brand=fitspin", hash: "" }],
    [`#gafa-pw-reset?token=${TOKEN}&email=a@b.mx`, { search: "", hash: "" }],
  ])("%s", (input, expected) => {
    expect(stripPasswordResetParams(input)).toEqual(expected);
  });
});

describe("window helpers", () => {
  it("lee y limpia un link roto con hash", () => {
    window.history.replaceState(null, "", `/reservar?brand=fitspin#horario?token=${TOKEN}&email=ana@buq.mx`);
    expect(readPasswordResetLink()).toEqual({ token: TOKEN, email: "ana@buq.mx" });
    clearPasswordResetLink();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/reservar?brand=fitspin#horario",
    );
    expect(readPasswordResetLink()).toBeNull();
  });

  it("return_url usa #gafa-pw-reset para que el idioma no tire el token", () => {
    expect(
      passwordResetReturnUrl({ origin: "https://insight.mx", pathname: "/reservar" }),
    ).toBe("https://insight.mx/reservar#gafa-pw-reset");
    window.history.replaceState(null, "", "/reservar?location=centro#horario");
    expect(passwordResetReturnUrl()).toBe(`${window.location.origin}/reservar#gafa-pw-reset`);
  });

  it("snapshot en sessionStorage sobrevive a Weglot/SPA reescribiendo la URL", () => {
    window.history.replaceState(null, "", `/?token=${TOKEN}&email=ana@buq.mx`);
    capturePasswordResetLink();
    window.history.replaceState(null, "", "/es/");
    expect(readPasswordResetLink()).toEqual({ token: TOKEN, email: "ana@buq.mx" });
  });

  it("PerformanceNavigationTiming.name cubre replaceState del tema", () => {
    vi.stubGlobal("performance", {
      getEntriesByType: () => [
        { name: `https://studio.mx/reservar?token=${TOKEN}&email=ana@buq.mx` },
      ],
    });
    window.history.replaceState(null, "", "/reservar");
    expect(readPasswordResetLink()).toEqual({ token: TOKEN, email: "ana@buq.mx" });
  });
});

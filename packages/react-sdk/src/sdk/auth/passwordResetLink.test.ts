import { afterEach, describe, expect, it } from "vitest";
import {
  clearPasswordResetLink,
  parsePasswordResetLink,
  passwordResetReturnUrl,
  readPasswordResetLink,
  stripPasswordResetParams,
} from "./passwordResetLink";

const TOKEN = "a1b2c3d4e5";

afterEach(() => {
  window.history.replaceState(null, "", "/");
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

  it("return_url limpio: solo origin + pathname", () => {
    expect(
      passwordResetReturnUrl({ origin: "https://insight.mx", pathname: "/reservar" }),
    ).toBe("https://insight.mx/reservar");
    window.history.replaceState(null, "", "/reservar?location=centro#horario");
    expect(passwordResetReturnUrl()).toBe(`${window.location.origin}/reservar`);
  });
});

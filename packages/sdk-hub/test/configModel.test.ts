import { describe, expect, it } from "vitest";
import {
  allFields,
  configFromDraft,
  draftFromConfig,
  sameConfig,
  summarizeConfig,
  unmanagedPaths,
  validateDraft,
} from "../public/configModel.js";
import { sanitizeHubRemoteConfig } from "../src/remoteConfig";

const roundTrip = (config: Record<string, unknown>) => configFromDraft(config, draftFromConfig(config));

describe("catálogo de opciones", () => {
  it("solo usa claves que el Worker acepta", () => {
    const roots = new Set(allFields().map((field) => field.path[0]));
    const sample: Record<string, unknown> = {};
    for (const root of roots) sample[root] = "x";
    expect(Object.keys(sanitizeHubRemoteConfig(sample)).sort()).toEqual([...roots].sort());
  });

  it("cada campo trae etiqueta y explicación para humanos", () => {
    for (const field of allFields()) {
      expect(field.label.length, field.key).toBeGreaterThan(2);
      expect(field.help.length, field.key).toBeGreaterThan(20);
    }
  });

  it("no expone ningún secreto", () => {
    const keys = allFields().flatMap((field) => field.path);
    expect(keys).not.toContain("API_SECRET");
    expect(keys).not.toContain("CAPTCHA_SECRET_KEY");
  });
});

describe("formulario -> partial", () => {
  it("un partial vacío se queda vacío", () => {
    expect(roundTrip({})).toEqual({});
  });

  it("prende Concierge con true cuando no hay nada que ajustar", () => {
    const draft = draftFromConfig({});
    draft.conciergeEnabled = true;
    expect(configFromDraft({}, draft)).toEqual({ CONCIERGE: true });
  });

  it("guarda el WhatsApp dentro de Concierge", () => {
    const draft = draftFromConfig({});
    draft.conciergeEnabled = true;
    draft["concierge.contact.whatsapp"] = " 5215512345678 ";
    expect(configFromDraft({}, draft)).toEqual({ CONCIERGE: { contact: { whatsapp: "5215512345678" } } });
  });

  it("apagar Concierge guarda los textos para prenderlo después", () => {
    const base = {
      CONCIERGE: {
        displayName: "Eight Flow Yoga",
        contact: { whatsapp: "525512027855" },
        copy: { assistantName: "Flow" },
      },
    };
    const draft = draftFromConfig(base);
    expect(draft.conciergeEnabled).toBe(true);
    expect(draft["concierge.displayName"]).toBe("Eight Flow Yoga");
    draft.conciergeEnabled = false;
    const off = configFromDraft(base, draft);
    expect(off).toEqual({
      CONCIERGE: false,
      CONCIERGE_SAVED: {
        displayName: "Eight Flow Yoga",
        contact: { whatsapp: "525512027855" },
        copy: { assistantName: "Flow" },
      },
    });
    const again = draftFromConfig(off);
    expect(again.conciergeEnabled).toBe(false);
    expect(again["concierge.displayName"]).toBe("Eight Flow Yoga");
    expect(again["concierge.contact.whatsapp"]).toBe("525512027855");
    again.conciergeEnabled = true;
    expect(configFromDraft(off, again)).toEqual(base);
  });

  it("normaliza el alias viejo en minúsculas", () => {
    expect(roundTrip({ concierge: { displayName: "Bunker" } })).toEqual({ CONCIERGE: { displayName: "Bunker" } });
  });

  it("vaciar un campo borra la clave y limpia el objeto padre", () => {
    const base = { THEME: { colors: { brand: "#c8ff2e" } } };
    const draft = draftFromConfig(base);
    expect(draft["theme.colors.brand"]).toBe("#c8ff2e");
    draft["theme.colors.brand"] = "";
    expect(configFromDraft(base, draft)).toEqual({});
  });

  it("los sí/no se guardan como booleanos y 'sin cambio' no guarda nada", () => {
    const draft = draftFromConfig({});
    draft.ANALYTICS = "false";
    draft.SHOW_MEMBERSHIP_OPTIONS = "true";
    expect(configFromDraft({}, draft)).toEqual({ ANALYTICS: false, SHOW_MEMBERSHIP_OPTIONS: true });
    draft.ANALYTICS = "";
    draft.SHOW_MEMBERSHIP_OPTIONS = "";
    expect(configFromDraft({}, draft)).toEqual({});
  });

  it("los redondeos se escriben en píxeles y se leen sin la unidad", () => {
    const draft = draftFromConfig({});
    draft["radius.md"] = "18";
    const config = configFromDraft({}, draft);
    expect(config).toEqual({ THEME: { radius: { md: "18px" } } });
    expect(draftFromConfig(config)["radius.md"]).toBe("18");
  });

  it("la marca por defecto se guarda como número", () => {
    const draft = draftFromConfig({});
    draft.BRAND_ID = "171";
    expect(configFromDraft({}, draft)).toEqual({ BRAND_ID: 171 });
  });

  it("conserva los ajustes avanzados que el formulario no pinta", () => {
    const base = {
      CONCIERGE: {
        displayName: "Bunker",
        experience: { groups: [{ id: "paquetes", label: "Paquetes" }] },
      },
      THEME: { preset: "boutique" },
    };
    const draft = draftFromConfig(base);
    draft["concierge.displayName"] = "Bunker Indoor Golf";
    const next = configFromDraft(base, draft) as typeof base;
    expect(next.CONCIERGE.experience).toEqual(base.CONCIERGE.experience);
    expect(next.CONCIERGE.displayName).toBe("Bunker Indoor Golf");
  });

  it("no inventa cambios al abrir y cerrar sin tocar nada", () => {
    const base = {
      CONCIERGE: { contact: { whatsapp: "5215512345678" } },
      THEME: { colorScheme: "dark", colors: { brand: "#c8ff2e" } },
      ANALYTICS: false,
    };
    expect(sameConfig(roundTrip(base), base)).toBe(true);
  });
});

describe("avisos para humanos", () => {
  it("marca los datos que no se entienden", () => {
    const draft = draftFromConfig({});
    draft.conciergeEnabled = true;
    draft["theme.colors.brand"] = "verde";
    draft["theme.logoUrl"] = "logo.png";
    draft["concierge.contact.whatsapp"] = "55-1234";
    draft.BRAND_ID = "0";
    const errors = validateDraft(draft);
    expect(Object.keys(errors).sort()).toEqual([
      "BRAND_ID",
      "concierge.contact.whatsapp",
      "theme.colors.brand",
      "theme.logoUrl",
    ]);
    for (const message of Object.values(errors)) expect(message).toMatch(/[a-z]/);
  });

  it("no se queja de lo que está bien", () => {
    const draft = draftFromConfig({});
    draft["theme.colors.brand"] = "#C8FF2E";
    draft["theme.logoUrl"] = "https://buq.mx/logo.svg";
    draft["concierge.contact.whatsapp"] = "5215512345678";
    expect(validateDraft(draft)).toEqual({});
  });

  it("resume en español lo que está prendido", () => {
    const summary = summarizeConfig({
      CONCIERGE: true,
      THEME: { colorScheme: "dark", allowUserColorScheme: false },
    });
    expect(summary).toEqual([
      { label: "Concierge", value: "Encendido con todo automático", section: "concierge" },
      { label: "Modo de color", value: "Siempre oscuro", section: "marca", swatch: null },
      { label: "¿El visitante puede cambiarlo?", value: "No", section: "marca", swatch: null },
    ]);
  });

  it("avisa de lo que se guardó por fuera", () => {
    expect(unmanagedPaths({ CONCIERGE: { studios: [{ id: "centro" }] }, THEME: { colorScheme: "dark" } })).toEqual([
      "CONCIERGE.studios",
    ]);
    expect(unmanagedPaths({ CONCIERGE: true, COMPANY_ID: 190 })).toEqual([]);
  });
});

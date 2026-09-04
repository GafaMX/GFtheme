import { afterEach, describe, expect, it } from "vitest";
import { installStripeCardTheme, mergeStripeCardStyle, STRIPE_CARD_STYLE } from "./stripeCardStyle";

describe("mergeStripeCardStyle", () => {
  it("en dark pinta texto claro, no el #303238 de GafaPay", () => {
    const merged = mergeStripeCardStyle({ base: { color: "#303238" } }, "dark");
    expect(merged.base?.color).toBe(STRIPE_CARD_STYLE.dark.base.color);
    expect(merged.base?.color).not.toBe("#303238");
  });

  it("en light deja texto oscuro legible", () => {
    const merged = mergeStripeCardStyle(undefined, "light");
    expect(merged.base?.color).toBe(STRIPE_CARD_STYLE.light.base.color);
  });
});

describe("installStripeCardTheme", () => {
  afterEach(() => {
    delete window.Stripe;
  });

  it("inyecta style dark al crear un card element", () => {
    const created: Array<{ type: string; options: Record<string, unknown> }> = [];
    window.Stripe = ((..._args: unknown[]) => ({
      elements: () => ({
        create: (type: string, options: Record<string, unknown> = {}) => {
          created.push({ type, options });
          return { type };
        },
      }),
    })) as typeof window.Stripe;

    const stop = installStripeCardTheme("dark");
    const stripe = window.Stripe!("pk_test");
    stripe.elements?.()?.create("card", {});

    expect(created[0]?.options.style).toMatchObject({
      base: { color: STRIPE_CARD_STYLE.dark.base.color },
    });
    stop();
  });

  it("envuelve Stripe aunque el script llegue despues", () => {
    const stop = installStripeCardTheme("dark");
    const created: Array<Record<string, unknown>> = [];
    window.Stripe = ((..._args: unknown[]) => ({
      elements: () => ({
        create: (_type: string, options: Record<string, unknown> = {}) => {
          created.push(options);
          return {};
        },
      }),
    })) as typeof window.Stripe;

    window.Stripe!("pk_test").elements?.()?.create("card");
    expect((created[0]?.style as { base?: { color?: string } })?.base?.color).toBe(
      STRIPE_CARD_STYLE.dark.base.color,
    );
    stop();
  });
});

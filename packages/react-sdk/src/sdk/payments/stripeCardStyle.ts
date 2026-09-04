import type { ColorScheme } from "../theme/palette";

type StripeStyle = {
  base?: Record<string, unknown>;
  invalid?: Record<string, unknown>;
  complete?: Record<string, unknown>;
  empty?: Record<string, unknown>;
};

/**
 * GafaPayFront.CardElement hardcodea `color: #303238` (y a veces ni siquiera
 * lo pasa bien: hace `{...style}` en vez de `style={style}`). En theme oscuro
 * el iframe de Stripe se lee negro sobre negro. Parcheamos `window.Stripe`
 * para inyectar el estilo al crear el Card Element, sin tocar GafaPay.
 */
export const STRIPE_CARD_STYLE = {
  light: {
    base: {
      color: "#18181b",
      iconColor: "#18181b",
      fontSize: "16px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#a1a1aa" },
    },
    invalid: {
      color: "#e5424d",
      ":focus": { color: "#18181b" },
    },
  },
  dark: {
    base: {
      color: "#f4f4f5",
      iconColor: "#f4f4f5",
      fontSize: "16px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#a1a1aa" },
    },
    invalid: {
      color: "#f87171",
      ":focus": { color: "#f4f4f5" },
    },
  },
} as const;

export function mergeStripeCardStyle(existing: unknown, scheme: ColorScheme): StripeStyle {
  const preset = STRIPE_CARD_STYLE[scheme];
  const current = existing && typeof existing === "object" ? (existing as StripeStyle) : {};
  return {
    ...current,
    // El scheme gana al #303238 hardcodeado de GafaPayFront.
    base: { ...(current.base ?? {}), ...preset.base },
    invalid: { ...(current.invalid ?? {}), ...preset.invalid },
  };
}

type StripeLike = {
  (...args: unknown[]): StripeInstance;
  __gafaTheme?: ColorScheme;
};

type StripeInstance = {
  elements?: (options?: unknown) => StripeElements;
};

type StripeElements = {
  create: (type: string, options?: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    Stripe?: StripeLike;
  }
}

/**
 * Envuelve `window.Stripe` para que cada `elements.create('card')` reciba
 * texto claro u oscuro. Idempotente: si ya esta parcheado al mismo scheme, no
 * hace nada. Stripe.js puede llegar DESPUES (GafaPay lo baja on demand).
 */
export function installStripeCardTheme(scheme: ColorScheme): () => void {
  if (typeof window === "undefined") return () => undefined;

  const wrap = (candidate: unknown): StripeLike | undefined => {
    if (typeof candidate !== "function") return undefined;
    const original = candidate as StripeLike;
    if (original.__gafaTheme === scheme) return original;

    const patched = ((...args: unknown[]) => {
      const instance = original(...args);
      return wrapStripeInstance(instance, scheme);
    }) as StripeLike;
    Object.assign(patched, original);
    patched.__gafaTheme = scheme;
    return patched;
  };

  const current = wrap(window.Stripe);
  if (current) window.Stripe = current;

  let stored = window.Stripe;
  const descriptor = Object.getOwnPropertyDescriptor(window, "Stripe");
  Object.defineProperty(window, "Stripe", {
    configurable: true,
    enumerable: true,
    get() {
      return stored;
    },
    set(next: unknown) {
      stored = wrap(next) ?? (next as StripeLike);
    },
  });

  return () => {
    if (descriptor) Object.defineProperty(window, "Stripe", descriptor);
    else delete window.Stripe;
  };
}

function wrapStripeInstance(instance: StripeInstance, scheme: ColorScheme): StripeInstance {
  const originalElements = instance.elements?.bind(instance);
  if (!originalElements) return instance;
  instance.elements = (options?: unknown) => {
    const elements = originalElements(options);
    const originalCreate = elements.create.bind(elements);
    elements.create = (type: string, options: Record<string, unknown> = {}) =>
      originalCreate(type, {
        ...options,
        style: mergeStripeCardStyle(options.style, scheme),
      });
    return elements;
  };
  return instance;
}

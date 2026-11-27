/** Narrow adapter for Stripe Checkout Elements. All other Stripe methods pass through. */
export type StripeSurfaceLifecycle = {
  owns: (secret: string) => boolean;
  mount: (secret: string, node: Element, destroy: () => void, provider: object) => boolean;
  ready: (secret: string, node: Element, provider: object) => void;
  unmount: (secret: string, node: Element, provider: object) => void;
  canConfirm: (secret: string, provider: object) => boolean;
  confirmed: (secret: string, success: boolean | undefined, provider: object) => void;
};

function canonicalStripeOption(value: unknown): unknown {
  if (value == null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return value;
  if (Array.isArray(value)) return value.map(canonicalStripeOption);
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalStripeOption(record[key])]));
  }
  throw new TypeError("Unsupported Stripe option value");
}

function stripeOptionsKey([publishableKey, options = {}, ...rest]: unknown[]): string | undefined {
  try {
    return JSON.stringify([publishableKey, options, ...rest].map(canonicalStripeOption));
  } catch {
    // Let Stripe handle option values the cache cannot compare.
    return undefined;
  }
}

// Stripe.js is loaded by the external IIFE, possibly after this adapter is installed.
export function installStripeSurfaceTracking(lifecycle: StripeSurfaceLifecycle): () => void {
  const globals = window as unknown as Record<string, any>;
  const descriptor = Object.getOwnPropertyDescriptor(window, "Stripe");
  let factory = globals.Stripe;
  const proxies = new WeakMap<object, any>();
  const restoreCachedFactories: Array<() => void> = [];
  const wrapFactory = (value: any): any => {
    if (typeof value !== "function") return value;
    if (proxies.has(value)) return proxies.get(value);
    const instances = new Map<string, object>();
    const proxy = new Proxy(value, {
      apply(target, self, args) {
        const key = stripeOptionsKey(args);
        const cached = key === undefined ? undefined : instances.get(key);
        if (cached) return cached;
        const stripe = Reflect.apply(target, self, args) as object;
        const tracked = new Proxy(stripe, {
          get(instance, property) {
            const original = Reflect.get(instance, property);
            if (property !== "initCheckoutElementsSdk" || typeof original !== "function") return typeof original === "function" ? original.bind(instance) : original;
            return (...params: any[]) => {
              const secret = params[0]?.clientSecret;
              const checkout = original.apply(instance, params);
              if (typeof secret !== "string" || !lifecycle.owns(secret)) return checkout;
              const provider = {};
              return new Proxy(checkout, {
                get(sdk, method) {
                  const fn = Reflect.get(sdk, method);
                  if (method === "loadActions") return async (...actionArgs: any[]) => {
                    const result = await fn.apply(sdk, actionArgs);
                    if (result.type !== "success") return result;
                    return { ...result, actions: new Proxy(result.actions, {
                      get(actions, action) {
                        const call = Reflect.get(actions, action);
                        if (action !== "confirm") return typeof call === "function" ? call.bind(actions) : call;
                        return async (...confirmArgs: any[]) => {
                          if (!lifecycle.canConfirm(secret, provider)) throw new Error("La sesión de Stripe cambió. Espera al formulario vigente.");
                          try {
                            const response = await call.apply(actions, confirmArgs);
                            lifecycle.confirmed(secret, response?.type === "success", provider);
                            return response;
                          } catch (error) { lifecycle.confirmed(secret, undefined, provider); throw error; }
                        };
                      },
                    }) };
                  };
                  if (method === "createPaymentElement") return (...elementArgs: any[]) => {
                    const element = fn.apply(sdk, elementArgs);
                    let node: Element | undefined;
                    let destroyed = false;
                    const destroy = () => {
                      if (destroyed) return;
                      destroyed = true;
                      if (node) lifecycle.unmount(secret, node, provider);
                      node = undefined;
                      element.destroy();
                    };
                    element.on("ready", () => { if (node && !destroyed) lifecycle.ready(secret, node, provider); });
                    return new Proxy(element, {
                      get(payment, action) {
                        const call = Reflect.get(payment, action);
                        if (action === "mount") return (target: string | Element) => {
                          const container = typeof target === "string" ? document.querySelector(target) : target;
                          if (destroyed) return;
                          if (!container || !lifecycle.mount(secret, container, destroy, provider)) { destroy(); return; }
                          node = container;
                          return call.call(payment, container);
                        };
                        if (action === "destroy") return destroy;
                        if (action === "unmount") return (...destroyArgs: any[]) => {
                          if (node) lifecycle.unmount(secret, node, provider);
                          node = undefined;
                          return call.apply(payment, destroyArgs);
                        };
                        return typeof call === "function" ? call.bind(payment) : call;
                      },
                    });
                  };
                  return typeof fn === "function" ? fn.bind(sdk) : fn;
                },
              });
            };
          },
        });
        if (key !== undefined) instances.set(key, tracked);
        return tracked;
      },
    });
    // @stripe/stripe-js eagerly caches the factory at IIFE evaluation and later
    // invokes cached.apply(undefined, args). Cover that retained reference too.
    const applyDescriptor = Object.getOwnPropertyDescriptor(value, "apply");
    if (!applyDescriptor || applyDescriptor.configurable) {
      Object.defineProperty(value, "apply", {
        configurable: true, writable: true,
        value: (self: unknown, args: unknown[]) => Reflect.apply(proxy, self, args),
      });
      restoreCachedFactories.push(() => {
        if (applyDescriptor) Object.defineProperty(value, "apply", applyDescriptor);
        else delete value.apply;
      });
    }
    proxies.set(value, proxy); return proxy;
  };
  // Patch a factory already cached by a preloaded IIFE before any widget mounts.
  wrapFactory(factory);
  if (descriptor?.configurable === false) {
    if (descriptor.writable) globals.Stripe = wrapFactory(factory);
    return () => { for (const restore of restoreCachedFactories) restore(); if (descriptor.writable) globals.Stripe = factory; };
  }
  Object.defineProperty(window, "Stripe", {
    configurable: true, enumerable: descriptor?.enumerable ?? true,
    get: () => wrapFactory(factory), set: (value) => { factory = value; },
  });
  return () => {
    for (const restore of restoreCachedFactories) restore();
    delete globals.Stripe;
    if (descriptor) Object.defineProperty(window, "Stripe", { ...descriptor, ...("value" in descriptor ? { value: factory } : {}) });
    else if (factory !== undefined) globals.Stripe = factory;
  };
}

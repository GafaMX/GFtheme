export type CaptchaProvider = {
  execute(action: string): Promise<string>;
};

export type CaptchaProviderName = "recaptcha-v3" | "turnstile";

/**
 * Abstraccion de captcha: reCAPTCHA v3 es el default (es lo unico que gafa.fit valida hoy
 * en el server, ver App\Rules\Captcha), Turnstile queda listo detras del mismo contrato para
 * el dia que se quiera cambiar de proveedor -- eso sí requiere que gafa.fit tambien agregue
 * verificacion de Turnstile en el backend, cambiar solo esta config no basta.
 */
export function createCaptchaProvider(name: CaptchaProviderName, siteKey?: string): CaptchaProvider | undefined {
  if (!siteKey) return undefined;

  return name === "turnstile" ? createTurnstileProvider(siteKey) : createRecaptchaV3Provider(siteKey);
}

const scriptPromises = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  const existing = scriptPromises.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar el script de captcha: ${src}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; size: "invisible"; action: string; callback: (token: string) => void; "error-callback"?: () => void },
      ) => string;
      execute: (widgetIdOrContainer: string | HTMLElement) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function createRecaptchaV3Provider(siteKey: string): CaptchaProvider {
  return {
    async execute(action: string) {
      await loadScriptOnce(`https://www.google.com/recaptcha/api.js?render=${siteKey}`);

      await new Promise<void>((resolve) => window.grecaptcha!.ready(resolve));

      return window.grecaptcha!.execute(siteKey, { action });
    },
  };
}

function createTurnstileProvider(siteKey: string): CaptchaProvider {
  return {
    execute(action: string) {
      return loadScriptOnce("https://challenges.cloudflare.com/turnstile/v0/api.js").then(
        () =>
          new Promise<string>((resolve, reject) => {
            const container = document.createElement("div");
            container.style.display = "none";
            document.body.appendChild(container);

            const widgetId = window.turnstile!.render(container, {
              sitekey: siteKey,
              size: "invisible",
              action,
              callback: (token) => {
                window.turnstile!.remove(widgetId);
                container.remove();
                resolve(token);
              },
              "error-callback": () => {
                window.turnstile!.remove(widgetId);
                container.remove();
                reject(new Error("Turnstile no pudo generar un token."));
              },
            });

            window.turnstile!.execute(container);
          }),
      );
    },
  };
}

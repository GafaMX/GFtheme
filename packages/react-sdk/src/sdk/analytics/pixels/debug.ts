type PixelWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (...args: unknown[]) => void; page: (...args: unknown[]) => void; load?: (...args: unknown[]) => void };
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  __BUQ_PIXEL_LOG?: PixelLogEntry[];
};

export type PixelLogEntry = {
  provider: "meta" | "tiktok" | "google";
  args: unknown[];
  at: string;
};

/** Instala fbq/ttq/gtag mock y un log en `window.__BUQ_PIXEL_LOG`. */
export function installPixelDebugMocks(target: PixelWindow = window as PixelWindow): PixelLogEntry[] {
  const log: PixelLogEntry[] = target.__BUQ_PIXEL_LOG ?? [];
  target.__BUQ_PIXEL_LOG = log;

  const push = (provider: PixelLogEntry["provider"], args: unknown[]) => {
    log.push({ provider, args: [...args], at: new Date().toISOString() });
  };

  if (typeof target.fbq !== "function") {
    const fbq = (...args: unknown[]) => {
      push("meta", args);
    };
    target.fbq = fbq;
  } else {
    const prev = target.fbq;
    target.fbq = (...args: unknown[]) => {
      push("meta", args);
      prev(...args);
    };
  }

  if (!target.ttq || typeof target.ttq.track !== "function") {
    target.ttq = {
      track: (...args: unknown[]) => {
        push("tiktok", args);
      },
      page: (...args: unknown[]) => {
        push("tiktok", ["page", ...args]);
      },
      load: (...args: unknown[]) => {
        push("tiktok", ["load", ...args]);
      },
    };
  }

  if (typeof target.gtag !== "function") {
    target.dataLayer = target.dataLayer ?? [];
    target.gtag = (...args: unknown[]) => {
      push("google", args);
      target.dataLayer!.push(args);
    };
  }

  return log;
}

export function readPixelDebugLog(target: PixelWindow = window as PixelWindow): PixelLogEntry[] {
  return target.__BUQ_PIXEL_LOG ?? [];
}

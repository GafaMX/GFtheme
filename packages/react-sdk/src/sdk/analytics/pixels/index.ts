import type { TrackInput } from "../events";
import type { SdkTracker } from "../tracker";
import { readPixelsConfig, pixelsHaveAnyId } from "./config";
import { createPixelBridge, noopPixelBridge } from "./bridge";
import type { PixelBridge, PixelConsent, PixelsConfig } from "./types";

export { readPixelsConfig, PIXEL_REMOTE_CONFIG_KEYS, PIXEL_SECRET_KEYS } from "./config";
export { mapTrackerEvent, commerceFromProps, currencyFromUnknown, stripPii, payloadHasPii } from "./map";
export { stablePixelEventId, resetPixelDedupForTests, createPageViewGate } from "./eventId";
export { sha256Hex, hashEmail, hashPhone, normalizeEmail, normalizePhone } from "./hash";
export { installPixelDebugMocks, readPixelDebugLog } from "./debug";
export { hostHasProvider, scriptsInjected } from "./loaders";
export type { PixelEventName, PixelsConfig, PixelConsent, CapiEventHook, MappedPixelEvent } from "./types";

export type PixelRuntime = {
  config: PixelsConfig;
  bridge: PixelBridge;
  wrap(tracker: SdkTracker): SdkTracker;
  setConsent(consent: PixelConsent): void;
  destroy(): void;
};

function emptyRuntime(): PixelRuntime {
  const bridge = noopPixelBridge();
  return {
    config: readPixelsConfig({}),
    bridge,
    wrap: (tracker) => tracker,
    setConsent: bridge.setConsent,
    destroy: bridge.destroy,
  };
}

export function createPixelRuntime(input: {
  analyticsEnabled: boolean;
  options: Record<string, unknown>;
}): PixelRuntime {
  if (input.analyticsEnabled === false) return emptyRuntime();
  const config = readPixelsConfig(input.options);
  if (!config.enabled || !pixelsHaveAnyId(config)) return emptyRuntime();

  const bridge = createPixelBridge(config);

  return {
    config,
    bridge,
    wrap(tracker) {
      const original = tracker.track.bind(tracker);
      const track = (event: TrackInput) => {
        const annotated = bridge.annotate(event);
        original(annotated);
        bridge.handle(annotated);
      };
      tracker.track = track;
      return tracker;
    },
    setConsent: bridge.setConsent,
    destroy: bridge.destroy,
  };
}

export function installConsentSurface(
  pixels: PixelRuntime,
  target: Window = window,
): () => void {
  const setConsent = (consent: PixelConsent) => {
    pixels.setConsent(consent);
    if (consent.marketing === true && typeof target.dispatchEvent === "function") {
      try {
        target.dispatchEvent(new CustomEvent("buq:consent:granted", { detail: consent }));
      } catch {
        // ignore
      }
    }
  };

  const host = target as unknown as { BuqSDK?: { setConsent?(consent: PixelConsent): void } };
  host.BuqSDK = { ...host.BuqSDK, setConsent };

  const onGranted = (event: Event) => {
    const detail = "detail" in event ? (event as CustomEvent<PixelConsent>).detail : undefined;
    pixels.setConsent({ marketing: true, ...detail });
  };
  target.addEventListener("buq:consent:granted", onGranted);
  return () => {
    target.removeEventListener("buq:consent:granted", onGranted);
  };
}

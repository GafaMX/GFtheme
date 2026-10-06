import type { ConciergePartnerConfig } from "./contracts";
import { getConciergeFixture } from "./fixtures";
import { conciergeContextFromOptions, resolveConciergeFromInput } from "./resolveConfig";

export type ConciergeDomConfigSource = {
  config: ConciergePartnerConfig;
  source: "options" | "script" | "fixture";
};

function parseJson(text: string | null | undefined): unknown {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  return JSON.parse(trimmed);
}

function readOptionsRecord(root: ParentNode): Record<string, unknown> | undefined {
  const element =
    (root as Document | Element).querySelector?.("[data-gafa-options]") ??
    (root as Document | Element).querySelector?.("[data-gf-options]");
  const parsed = parseJson(element?.textContent);
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
}

function readScriptConfig(root: ParentNode, host?: Element): unknown {
  const fromHost = host?.querySelector?.("[data-gafa-concierge-config], script[type='application/json']");
  if (fromHost) return parseJson(fromHost.textContent);
  const globalScript = (root as Document | Element).querySelector?.("[data-gafa-concierge-config]");
  return parseJson(globalScript?.textContent);
}

/** Loopback plus Cloudflare Quick Tunnels used for Cloud Agent / remote previews. */
const TRUSTED_PREVIEW_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$|^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i;

export function isTrustedConciergePreviewOrigin(origin: string): boolean {
  return TRUSTED_PREVIEW_ORIGIN.test(origin);
}

export function assertConciergeOriginAllowed(config: ConciergePartnerConfig, origin = typeof window === "undefined" ? "" : window.location.origin): void {
  if (!origin || isTrustedConciergePreviewOrigin(origin)) return;
  if (!config.security.allowedOrigins.length) return;
  if (!config.security.allowedOrigins.includes(origin)) {
    throw new Error(`Concierge origin ${origin} is not allowed for ${config.id}`);
  }
}

export function readConciergeConfigFromDom(
  root: ParentNode = document,
  host?: Element,
  mergedOptions?: Record<string, unknown>,
): ConciergeDomConfigSource {
  const fixtureId = host?.getAttribute("data-gafa-concierge-fixture") || host?.getAttribute("data-gf-concierge-fixture");
  if (fixtureId) {
    const fixture = getConciergeFixture(fixtureId);
    if (!fixture) throw new Error(`Unknown Concierge fixture: ${fixtureId}`);
    return { config: fixture, source: "fixture" };
  }

  const options = mergedOptions ?? readOptionsRecord(root);
  const context = conciergeContextFromOptions(options);

  const scriptConfig = readScriptConfig(root, host);
  if (scriptConfig) {
    return { config: resolveConciergeFromInput(scriptConfig, context), source: "script" };
  }

  const fromOptions = options?.CONCIERGE ?? options?.concierge;
  if (fromOptions) {
    return { config: resolveConciergeFromInput(fromOptions, context), source: "options" };
  }

  throw new Error(
    "Concierge config was not found. Expected CONCIERGE in [data-gf-options], a [data-gafa-concierge-config] script, or data-gafa-concierge-fixture.",
  );
}

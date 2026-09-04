import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ConciergePartnerConfig as ConciergePartnerConfigSchema, type ConciergePartnerConfig } from "./contracts";
import { ConciergeCommandBar, ConciergeWidget } from "./ConciergeWidget";
import {
  createConciergeBrowserAdapter,
  ensureFancySibling,
  type ConciergeSdkBridge,
} from "./adapter";
import { createHttpConciergeAsk, createLocalConciergeAsk, type ConciergeAskFn } from "./ask";
import { assertConciergeOriginAllowed } from "./domConfig";
import { hydrateConciergeCatalog, shouldHydrateConcierge } from "./hydrate";

export type ConciergeHandle = {
  open(): void;
  close(): void;
  destroy(): void;
};

export type ConciergeMountOptions = {
  partnerId?: string;
  config: ConciergePartnerConfig;
  apiBaseUrl?: string;
  ask?: ConciergeAskFn;
  container?: string | Element;
  webview?: boolean;
  navigate?: (path: string) => void;
  resolveHardPath?: (path: string) => string;
  collapsedByDefault?: boolean;
  extraAction?: ReactNode;
  /** Completa catálogo/sedes desde el cliente BUQ. Default: config.catalog.live. */
  hydrateFromClient?: boolean;
};

export type ConciergeController = {
  subscribe(listener: (open: boolean) => void): () => void;
  open(): void;
  close(): void;
};

export function createConciergeController(): ConciergeController {
  let open = false;
  const listeners = new Set<(open: boolean) => void>();
  const publish = (next: boolean) => {
    open = next;
    listeners.forEach((listener) => listener(next));
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(open);
      return () => {
        listeners.delete(listener);
      };
    },
    open() {
      publish(true);
    },
    close() {
      publish(false);
    },
  };
}

export function resolveConciergeConfig(options: ConciergeMountOptions): ConciergePartnerConfig {
  const config = ConciergePartnerConfigSchema.parse(options.config);
  if (options.partnerId && options.partnerId !== config.id) {
    throw new Error(`Concierge partner ${options.partnerId} does not match config ${config.id}`);
  }
  assertConciergeOriginAllowed(config);
  return config;
}

export function ConciergeHost({
  config: initialConfig,
  sdk,
  controller,
  webview,
  navigate,
  resolveHardPath,
  ask,
  apiBaseUrl,
  collapsedByDefault,
  extraAction,
  hydrateFromClient,
}: {
  config: ConciergePartnerConfig;
  sdk?: ConciergeSdkBridge | null;
  controller: ConciergeController;
  webview?: boolean;
  navigate?: (path: string) => void;
  resolveHardPath?: (path: string) => string;
  ask?: ConciergeAskFn;
  apiBaseUrl?: string;
  collapsedByDefault?: boolean;
  extraAction?: ReactNode;
  hydrateFromClient?: boolean;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [open, setOpen] = useState(false);
  const [catalogNonce, setCatalogNonce] = useState(0);
  const openCatalog = useCallback(() => {
    setOpen(true);
    setCatalogNonce((current) => current + 1);
  }, []);
  const go = useCallback((path: string) => {
    if (navigate) {
      navigate(path);
      return;
    }
    if (typeof window !== "undefined") window.location.assign(path);
  }, [navigate]);
  const adapter = useMemo(
    () => createConciergeBrowserAdapter({ config, sdk, webview, navigate: go, resolveHardPath }),
    [config, go, resolveHardPath, sdk, webview],
  );
  const resolvedAsk = useMemo(() => {
    if (ask) return ask;
    if (apiBaseUrl) return createHttpConciergeAsk(apiBaseUrl);
    return createLocalConciergeAsk({ config, adapter });
  }, [adapter, apiBaseUrl, ask, config]);

  useEffect(() => controller.subscribe(setOpen), [controller]);

  useEffect(() => {
    ensureFancySibling();
  }, []);

  useEffect(() => {
    setConfig(initialConfig);
    const client = sdk?.client;
    if (!shouldHydrateConcierge(initialConfig, hydrateFromClient) || !client?.listCombos || !client.listMemberships) {
      return;
    }
    const hydrateClient = {
      listLocations: (brand?: string) => client.listLocations(brand ?? ""),
      listCombos: client.listCombos,
      listMemberships: client.listMemberships,
    };
    let cancelled = false;
    void hydrateConciergeCatalog(initialConfig, hydrateClient).then((next) => {
      if (!cancelled) setConfig(next);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateFromClient, initialConfig, sdk]);

  return (
    <>
      <ConciergeWidget
        config={config}
        open={open}
        onClose={() => setOpen(false)}
        navigate={go}
        sdk={sdk}
        webview={webview}
        resolveHardPath={resolveHardPath}
        ask={resolvedAsk}
        catalogNonce={catalogNonce}
      />
      <ConciergeCommandBar
        config={config}
        navigate={go}
        open={open}
        setOpen={setOpen}
        webview={webview}
        collapsedByDefault={collapsedByDefault}
        extraAction={extraAction}
        onOpenCatalog={openCatalog}
      />
    </>
  );
}

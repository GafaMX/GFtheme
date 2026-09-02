import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ConciergePartnerConfig as ConciergePartnerConfigSchema, type ConciergePartnerConfig } from "./contracts";
import { ConciergeCommandBar, ConciergeWidget } from "./ConciergeWidget";
import {
  createConciergeBrowserAdapter,
  ensureFancySibling,
  type ConciergeSdkBridge,
} from "./adapter";
import { createHttpConciergeAsk, createLocalConciergeAsk, type ConciergeAskFn } from "./ask";

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
  return config;
}

export function ConciergeHost({
  config,
  sdk,
  controller,
  webview,
  navigate,
  resolveHardPath,
  ask,
  apiBaseUrl,
  collapsedByDefault,
  extraAction,
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
}) {
  const [open, setOpen] = useState(false);
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
      />
      <ConciergeCommandBar
        config={config}
        navigate={go}
        open={open}
        setOpen={setOpen}
        webview={webview}
        collapsedByDefault={collapsedByDefault}
        extraAction={extraAction}
      />
    </>
  );
}

/**
 * Ciclo de vida por root: el auto-scan del documento no debe pelear con un
 * `mount(root)` explícito (SPA / cambio de cliente). Un fallo no deja el nodo
 * marcado como montado.
 */

export const SDK_ROOT_ATTR = "data-gafa-sdk-root";
export const SDK_EXPLICIT_ATTR = "data-gafa-sdk-explicit";

export type SdkMountOptions = {
  /**
   * Si el `root` es un contenedor (no el shortcode), se marca para que el
   * auto-scan de la página no vuelva a entrar. Default true salvo Document.
   */
  exclusive?: boolean;
};

export type ReadyLatch<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
  settled: boolean;
};

export function createReadyLatch<T>(): ReadyLatch<T> {
  let settled = false;
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => undefined);
  return {
    get settled() {
      return settled;
    },
    promise,
    resolve(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    },
    reject(error) {
      if (settled) return;
      settled = true;
      reject(error);
    },
  };
}

export function sameSdkIdentity(
  current: { companyId: number; publicClientId?: string | number; apiBaseUrl: string },
  next: { companyId: number; publicClientId?: string | number; apiBaseUrl: string },
): boolean {
  return (
    current.companyId === next.companyId &&
    String(current.publicClientId ?? "") === String(next.publicClientId ?? "") &&
    current.apiBaseUrl.replace(/\/+$/, "") === next.apiBaseUrl.replace(/\/+$/, "")
  );
}

export function isAutoScanEnabled(
  documentRef: Document,
  win?: { GAFA_SDK_AUTOSCAN?: boolean },
): boolean {
  if (win?.GAFA_SDK_AUTOSCAN === false) return false;
  const flag =
    documentRef.documentElement?.getAttribute("data-gf-autoscan") ??
    documentRef.body?.getAttribute("data-gf-autoscan");
  if (flag === "off" || flag === "false") return false;
  return true;
}

export function isSdkRootMounted(element: Element): boolean {
  return element.getAttribute(SDK_ROOT_ATTR) === "1";
}

export function markSdkRoot(element: Element): void {
  element.setAttribute(SDK_ROOT_ATTR, "1");
}

export function clearSdkRoot(element: Element): void {
  element.removeAttribute(SDK_ROOT_ATTR);
  element.removeAttribute(SDK_EXPLICIT_ATTR);
}

export function markExplicitRoot(element: Element): void {
  element.setAttribute(SDK_EXPLICIT_ATTR, "1");
}

export function isInsideExplicitRoot(element: Element): boolean {
  return Boolean(element.closest(`[${SDK_EXPLICIT_ATTR}]`));
}

export function shouldSkipWidgetMount(element: HTMLElement, mode: "auto" | "explicit"): boolean {
  if (isSdkRootMounted(element)) return true;
  if (mode === "auto" && isInsideExplicitRoot(element)) return true;
  return false;
}

/** Páginas v1+v2: `data-gafa-v2` se copia a `data-gf-theme` antes de escanear. */
export function aliasV2Shortcodes(root: ParentNode): void {
  const apply = (element: HTMLElement) => {
    if (element.getAttribute("data-gf-theme")) return;
    const v2 = element.getAttribute("data-gafa-v2");
    if (v2) element.setAttribute("data-gf-theme", v2);
  };
  if (root instanceof HTMLElement) apply(root);
  root.querySelectorAll<HTMLElement>("[data-gafa-v2]").forEach(apply);
}

export function nodeContainsMount(scope: Node, element: Element): boolean {
  if (scope === element) return true;
  if (scope instanceof Document) return scope.documentElement ? scope.documentElement.contains(element) || scope.body?.contains(element) === true : true;
  return scope.contains(element);
}

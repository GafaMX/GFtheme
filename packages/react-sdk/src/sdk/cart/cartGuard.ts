import type { GafaClient } from "../client/types";
import { showToast } from "../toast/toastStore";
import { useCartStore, type CartLine } from "./cartStore";
import { isEligibilityRejection } from "./eligibility";

/**
 * Revisa el carrito guardado contra Buq SIN cobrar (`reservate?test=true`),
 * línea por línea: al cargar el SDK, al iniciar sesión y cada vez que se
 * agrega algo. Lo que Buq rechaza por regla de producto (uso restringido,
 * tope, membresía repetida) se saca del carrito y se avisa. Un fallo de red,
 * 401/5xx o respuesta no JSON NO borra nada: se reintenta en el siguiente
 * disparo.
 */
export type CartGuardDeps = {
  client: Pick<GafaClient, "getProfile" | "previewPurchase" | "getCheckoutConfig" | "listLocations">;
  notify?: (message: string) => void;
  debounceMs?: number;
};

const sig = (userId: number, l: CartLine) => `${userId}|${l.brandSlug}|${l.type}:${l.id}`;

export function startCartGuard({ client, notify = (m) => showToast(m, "error"), debounceMs = 250 }: CartGuardDeps) {
  const okLines = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let stopped = false;

  async function locationFor(line: CartLine): Promise<string | undefined> {
    if (line.locationSlug) return line.locationSlug;
    const other = useCartStore.getState().lines.find((l) => l.brandSlug === line.brandSlug && l.locationSlug);
    if (other?.locationSlug) return other.locationSlug;
    const locations = await client.listLocations(line.brandSlug);
    return locations?.[0]?.slug;
  }

  async function runOnce() {
    if (!client.previewPurchase) return;
    const lines = useCartStore.getState().lines;
    if (!lines.length) return;
    const profile = await client.getProfile().catch(() => null);
    if (!profile || stopped) return;
    const pending = lines.filter((l) => l.brandSlug && !okLines.has(sig(profile.id, l)));
    if (!pending.length) return;
    const configs = new Map<string, Awaited<ReturnType<NonNullable<GafaClient["getCheckoutConfig"]>>> | null>();
    const bad: Array<{ line: CartLine; err: unknown }> = [];
    for (const line of pending) {
      try {
        const locationSlug = await locationFor(line);
        if (!locationSlug) continue;
        const ck = `${line.brandSlug}|${locationSlug}`;
        if (!configs.has(ck)) {
          configs.set(
            ck,
            client.getCheckoutConfig
              ? await client.getCheckoutConfig({ brandSlug: line.brandSlug, locationSlug }).catch(() => null)
              : null,
          );
        }
        const config = configs.get(ck);
        if (client.getCheckoutConfig && !config) continue; // sin config no se juzga
        const membership = line.type === "membership";
        await client.previewPurchase({
          brandSlug: line.brandSlug,
          locationSlug,
          userId: config?.userProfileId ?? profile.id,
          lines: [
            {
              id: line.id,
              type: line.type,
              amount: line.amount,
              name: line.name,
              price: line.price,
              companiesId: config?.companiesId,
              raw: line.raw,
            },
          ],
          paymentTypeId: config?.paymentMethods?.[0]?.id ?? 0,
          csrfToken: config?.csrfToken ?? null,
          subscribe: membership,
          setPayment: membership,
        });
        okLines.add(sig(profile.id, line));
      } catch (err) {
        if (isEligibilityRejection(err)) bad.push({ line, err });
      }
      if (stopped) return;
    }
    if (!bad.length) return;
    const store = useCartStore.getState();
    const keys = new Set(store.lines.map((l) => l.key));
    const removed = bad.filter((b) => keys.has(b.line.key));
    if (!removed.length) return;
    removed.forEach((b) => store.removeItem(b.line.key));
    const names = removed.map((b) => b.line.name).join(", ");
    const reason = (removed[0].err as Error).message.replace(/\s+/g, " ").trim();
    notify(`Quitamos ${names} de tu carrito. ${reason.length <= 220 ? reason : ""}`.trim());
  }

  function run(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = runOnce()
      .catch(() => undefined)
      .finally(() => {
        running = null;
        if (again && !stopped) {
          again = false;
          void run();
        }
      });
    return running;
  }

  function schedule() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, debounceMs);
  }

  let prevKeys = "";
  const unsub = useCartStore.subscribe((state) => {
    const keys = state.lines.map((l) => `${l.type}:${l.id}`).join("|");
    if (keys === prevKeys) return;
    prevKeys = keys;
    schedule();
  });
  prevKeys = useCartStore.getState().lines.map((l) => `${l.type}:${l.id}`).join("|");
  schedule();

  return {
    /** Re-revisar (p. ej. tras login/logout). */
    recheck: schedule,
    run,
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsub();
    },
  };
}

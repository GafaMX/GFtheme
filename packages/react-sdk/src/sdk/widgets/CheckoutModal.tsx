import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CatalogItem,
  CheckoutConfig,
  FrontPaymentMethod,
  GafaClient,
  Meeting,
  UserProfile,
} from "../client/types";
import {
  cartSubtotal,
  formatMoney,
  useCartStore,
  type CartReservationContext,
} from "../cart/cartStore";
import { hasGafaPayRuntime, mountGafaPay, type GafaPayHandle } from "../payments/gafaPay";

export type CheckoutModalProps = {
  client: GafaClient;
  brandSlug: string;
  locationSlug: string;
  locationName?: string;
  /** Si viene del calendario: pre-carga contexto de reserva. */
  meeting?: Meeting | null;
  seatObjectId?: number;
  seatLabel?: string;
  onClose: () => void;
  onCompleted?: (result: { purchaseId?: number | null; reservationId?: number }) => void;
};

type CheckoutStep = "shop" | "pay" | "thanks";
type CatalogTab = "packages" | "memberships";

/**
 * Checkout nativo v2: reemplaza el Fancy legacy en el flujo
 * "Comprar y reservar". Carrito persistente, catálogo de paquetes/membresías,
 * términos del admin, descuento, giftcard y métodos front (Stripe / PayPal).
 */
export function CheckoutModal({
  client,
  brandSlug,
  locationSlug,
  locationName,
  meeting,
  seatObjectId,
  seatLabel,
  onClose,
  onCompleted,
}: CheckoutModalProps) {
  const lines = useCartStore((s) => s.lines);
  const reservation = useCartStore((s) => s.reservation);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const setReservation = useCartStore((s) => s.setReservation);
  const resetAfterPurchase = useCartStore((s) => s.resetAfterPurchase);

  const [step, setStep] = useState<CheckoutStep>("shop");
  const [tab, setTab] = useState<CatalogTab>("packages");
  const [query, setQuery] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState<string>();
  const [discountStatus, setDiscountStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [giftCode, setGiftCode] = useState("");
  const [giftStatus, setGiftStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [giftLabel, setGiftLabel] = useState<string>();
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [payError, setPayError] = useState<string>();
  const [paying, setPaying] = useState(false);
  const [thanks, setThanks] = useState<{
    purchaseId?: number | null;
    reservationId?: number;
    reservationSnapshot: CartReservationContext | null;
    linesSnapshot: typeof lines;
  } | null>(null);

  const payMountRef = useRef<HTMLDivElement | null>(null);
  const payHandleRef = useRef<GafaPayHandle | null>(null);

  // Al abrir desde una clase: anclar el contexto de reserva al carrito.
  useEffect(() => {
    if (!meeting) return;
    const next: CartReservationContext = {
      meetingId: Number(meeting.id),
      meetingName: meeting.name,
      serviceName: meeting.service?.name ?? meeting.serviceName,
      startsAt: meeting.startsAt ?? meeting.start ?? meeting.startTime ?? "",
      timezone: meeting.timezone,
      brandSlug,
      locationSlug,
      locationName: locationName ?? meeting.location?.name,
      staffName: meeting.staffName,
      seatObjectId,
      seatLabel,
    };
    setReservation(next);
  }, [meeting, brandSlug, locationSlug, locationName, seatObjectId, seatLabel, setReservation]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const configQuery = useQuery({
    queryKey: ["checkout", "config", brandSlug, locationSlug, meeting?.id],
    queryFn: () =>
      client.getCheckoutConfig!({
        brandSlug,
        locationSlug,
        meetingId: meeting?.id,
      }),
    enabled: Boolean(client.getCheckoutConfig),
    staleTime: 60_000,
    retry: 1,
  });

  const packagesQuery = useQuery({
    queryKey: ["checkout", "packages", brandSlug],
    queryFn: () => client.listCombos(brandSlug),
    staleTime: 60_000,
  });

  const membershipsQuery = useQuery({
    queryKey: ["checkout", "memberships", brandSlug],
    queryFn: () => client.listMemberships(brandSlug),
    staleTime: 60_000,
  });

  const profileQuery = useQuery({
    queryKey: ["checkout", "profile"],
    queryFn: () => client.getProfile(),
    staleTime: 60_000,
  });

  const config = configQuery.data;
  const currency = config?.currency ?? { prefix: "$", suffix: "MXN", code: "MXN" };
  const paymentMethods = config?.paymentMethods ?? [];

  useEffect(() => {
    if (selectedMethodId != null) return;
    if (paymentMethods[0]) setSelectedMethodId(paymentMethods[0].id);
  }, [paymentMethods, selectedMethodId]);

  const selectedMethod = paymentMethods.find((method) => method.id === selectedMethodId) ?? null;

  const catalogItems = useMemo(() => {
    const source = tab === "packages" ? packagesQuery.data : membershipsQuery.data;
    const list = source ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [tab, packagesQuery.data, membershipsQuery.data, query]);

  const relevantLines = lines.filter((line) => line.brandSlug === brandSlug);
  const subtotal = cartSubtotal(relevantLines);
  const total = Math.max(0, subtotal - discountAmount);

  // Montar Stripe / PayPal cuando entramos a pagar.
  useEffect(() => {
    if (step !== "pay" || !selectedMethod || !payMountRef.current) return;
    payHandleRef.current?.destroy();
    payHandleRef.current = mountGafaPay({
      method: selectedMethod.slug,
      container: payMountRef.current,
      amount: total,
      currencyCode: currency.code,
      gafapayBrandId: undefined,
      customer: {
        email: profileQuery.data?.email,
        firstName: profileQuery.data?.firstName,
        lastName: profileQuery.data?.lastName,
        phone: profileQuery.data?.phone ?? undefined,
      },
      onError: (message) => setPayError(message),
    });
    return () => {
      payHandleRef.current?.destroy();
      payHandleRef.current = null;
    };
  }, [step, selectedMethod, total, currency.code, profileQuery.data]);

  async function applyDiscount() {
    if (!client.checkDiscountCode || !discountCode.trim()) return;
    setDiscountStatus("checking");
    try {
      const result = await client.checkDiscountCode({
        brandSlug,
        locationSlug,
        code: discountCode.trim(),
        meetingId: meeting?.id ?? reservation?.meetingId,
        lines: relevantLines.map((line) => ({ id: line.id, type: line.type })),
      });
      if (!result.valid) {
        setDiscountStatus("error");
        setDiscountAmount(0);
        setDiscountLabel(undefined);
        return;
      }
      setDiscountStatus("ok");
      setDiscountLabel(result.label);
      setDiscountAmount(result.discountAmount ?? 0);
    } catch {
      setDiscountStatus("error");
      setDiscountAmount(0);
    }
  }

  async function applyGift() {
    if (!client.checkGiftCode || !giftCode.trim()) return;
    setGiftStatus("checking");
    try {
      const result = await client.checkGiftCode({
        brandSlug,
        locationSlug,
        code: giftCode.trim(),
      });
      if (!result.valid) {
        setGiftStatus("error");
        setGiftLabel(undefined);
        return;
      }
      setGiftStatus("ok");
      setGiftLabel(result.label ?? (result.balance != null ? `Saldo ${formatMoney(result.balance, currency.prefix, currency.suffix)}` : "Gift card válida"));
    } catch {
      setGiftStatus("error");
    }
  }

  function handleAdd(item: CatalogItem) {
    const type = item.type === "membership" ? "membership" : "combo";
    const price = item.priceFinal ?? item.price ?? 0;
    addItem({
      id: item.id,
      type,
      name: item.name,
      price,
      priceLabel: item.priceLabel ?? formatMoney(price, currency.prefix, currency.suffix),
      brandSlug,
      locationSlug,
      expirationLabel: item.expirationDays ? `Expira en ${item.expirationDays} días` : undefined,
    });
  }

  async function handlePay() {
    setPayError(undefined);
    if (!relevantLines.length) {
      setPayError("Agrega un paquete o membresía para continuar.");
      return;
    }
    if (config?.termsConditionsLink && !termsAccepted) {
      setPayError("Acepta los términos y condiciones para pagar.");
      return;
    }
    if (!selectedMethod) {
      setPayError("Elige un método de pago.");
      return;
    }
    if (!client.initialPurchase) {
      setPayError("Este cliente no soporta compras nativas todavía.");
      return;
    }

    const profile = profileQuery.data;
    if (!profile) {
      setPayError("Inicia sesión para completar la compra.");
      return;
    }

    setPaying(true);
    const reservationSnapshot = reservation;
    const linesSnapshot = relevantLines;

    try {
      let paymentData: Record<string, unknown> = {};
      try {
        paymentData = (await payHandleRef.current?.collectPaymentData()) ?? {};
      } catch (err) {
        // Sin GafaPay en el demo: permitimos avanzar solo si no hay runtime,
        // dejando claro que en produccion el script es obligatorio.
        if (hasGafaPayRuntime()) throw err;
        paymentData = { demo: true };
      }

      const checkoutToken =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `chk_${Date.now()}`;

      const purchase = await client.initialPurchase({
        brandSlug,
        locationSlug,
        userId: profile.id,
        meetingId: reservation?.meetingId,
        lines: relevantLines.map((line) => ({
          id: line.id,
          type: line.type,
          amount: line.amount,
        })),
        paymentTypeId: selectedMethod.id,
        paymentData,
        discountCode: discountStatus === "ok" ? discountCode.trim() : null,
        giftCode: giftStatus === "ok" ? giftCode.trim() : null,
        checkoutToken,
        seatObjectId: reservation?.seatObjectId,
      });

      let reservationId: number | undefined;
      if (purchase.purchaseId && client.pollInitialPurchaseStatus) {
        reservationId = await waitForPurchase(client, {
          brandSlug,
          locationSlug,
          checkoutToken: purchase.checkoutToken ?? checkoutToken,
          pendingPurchaseId: purchase.purchaseId,
        });
      }

      setThanks({
        purchaseId: purchase.purchaseId,
        reservationId,
        reservationSnapshot,
        linesSnapshot,
      });
      resetAfterPurchase();
      setStep("thanks");
      onCompleted?.({ purchaseId: purchase.purchaseId, reservationId });
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "No pudimos completar el pago.");
    } finally {
      setPaying(false);
    }
  }

  const title =
    step === "thanks"
      ? "Listo"
      : reservation
        ? "Compra para reservar"
        : "Tu compra";

  return (
    <div
      className="gafa-checkout-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gafa-checkout-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && step !== "thanks") onClose();
      }}
    >
      <div className="gafa-checkout" data-step={step}>
        <header className="gafa-checkout__top">
          {step === "pay" ? (
            <button className="gafa-checkout__back" type="button" onClick={() => setStep("shop")}>
              ← Seguir eligiendo
            </button>
          ) : step === "shop" && reservation ? (
            <p className="gafa-checkout__context">
              Para: <strong>{reservation.serviceName ?? reservation.meetingName}</strong>
              {reservation.startsAt ? (
                <>
                  {" "}
                  · {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
                </>
              ) : null}
            </p>
          ) : (
            <span />
          )}
          <button className="gafa-checkout__close" type="button" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </header>

        {step !== "thanks" ? (
          <div className="gafa-checkout__layout">
            <section className="gafa-checkout__main">
              <div className="gafa-checkout__hero">
                <span className="gafa-eyebrow">{step === "shop" ? "Elige tu plan" : "Pago"}</span>
                <h2 id="gafa-checkout-title">{title}</h2>
                <p>
                  {step === "shop"
                    ? "Agrega paquetes o membresías. Tu carrito se guarda si sales y vuelves."
                    : "Revisa el total, acepta términos y paga con el método activo de este estudio."}
                </p>
              </div>

              {step === "shop" ? (
                <ShopPanel
                  tab={tab}
                  onTabChange={setTab}
                  query={query}
                  onQueryChange={setQuery}
                  items={catalogItems}
                  loading={tab === "packages" ? packagesQuery.isLoading : membershipsQuery.isLoading}
                  error={tab === "packages" ? packagesQuery.isError : membershipsQuery.isError}
                  onAdd={handleAdd}
                  currency={currency}
                />
              ) : (
                <PayPanel
                  methods={paymentMethods}
                  selectedMethodId={selectedMethodId}
                  onSelectMethod={setSelectedMethodId}
                  config={config}
                  configLoading={configQuery.isLoading}
                  configError={configQuery.isError}
                  payMountRef={payMountRef}
                  hasRuntime={hasGafaPayRuntime()}
                />
              )}
            </section>

            <aside className="gafa-checkout__cart" aria-label="Carrito">
              <div className="gafa-checkout__cart-head">
                <h3>{locationName ?? "Tu pedido"}</h3>
                <span>
                  {relevantLines.length} {relevantLines.length === 1 ? "artículo" : "artículos"}
                </span>
              </div>

              {reservation ? (
                <div className="gafa-checkout__reserve-chip">
                  <span>Clase</span>
                  <strong>{reservation.serviceName ?? reservation.meetingName}</strong>
                  <small>
                    {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
                    {reservation.seatLabel ? ` · Lugar ${reservation.seatLabel}` : ""}
                  </small>
                </div>
              ) : null}

              {relevantLines.length === 0 ? (
                <p className="gafa-checkout__empty">Aún no hay productos. Elige un paquete a la izquierda.</p>
              ) : (
                <ul className="gafa-checkout__lines">
                  {relevantLines.map((line) => (
                    <li key={line.key}>
                      <div>
                        <strong>{line.name}</strong>
                        <span>
                          Cantidad: {line.amount}
                          {line.expirationLabel ? ` · ${line.expirationLabel}` : ""}
                        </span>
                      </div>
                      <div className="gafa-checkout__line-meta">
                        <strong>{line.priceLabel}</strong>
                        <button type="button" onClick={() => removeItem(line.key)}>
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {step === "pay" ? (
                <div className="gafa-checkout__extras">
                  {config?.discountCodesEnabled !== false ? (
                    <PromoField
                      label="Código de descuento"
                      value={discountCode}
                      onChange={setDiscountCode}
                      onApply={applyDiscount}
                      status={discountStatus}
                      hint={
                        discountStatus === "ok"
                          ? discountLabel ?? "Descuento aplicado"
                          : discountStatus === "error"
                            ? "Código no válido"
                            : undefined
                      }
                    />
                  ) : null}

                  {config?.giftCardsEnabled ? (
                    <PromoField
                      label="Gift card"
                      value={giftCode}
                      onChange={setGiftCode}
                      onApply={applyGift}
                      status={giftStatus}
                      hint={
                        giftStatus === "ok"
                          ? giftLabel
                          : giftStatus === "error"
                            ? "Gift card no válida"
                            : undefined
                      }
                    />
                  ) : null}

                  {config?.termsConditionsLink ? (
                    <label className="gafa-checkout__terms">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(event) => setTermsAccepted(event.target.checked)}
                      />
                      <span>
                        Acepto los{" "}
                        <a href={config.termsConditionsLink} target="_blank" rel="noreferrer">
                          términos y condiciones
                        </a>
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className="gafa-checkout__total">
                {discountAmount > 0 ? (
                  <div className="gafa-checkout__total-row">
                    <span>Descuento</span>
                    <span>−{formatMoney(discountAmount, currency.prefix, currency.suffix)}</span>
                  </div>
                ) : null}
                <div className="gafa-checkout__total-row gafa-checkout__total-row--grand">
                  <span>Total</span>
                  <strong>{formatMoney(total, currency.prefix, currency.suffix)}</strong>
                </div>
              </div>

              {payError ? <p className="gafa-checkout__error">{payError}</p> : null}

              {step === "shop" ? (
                <button
                  className="gafa-sdk-button gafa-checkout__cta"
                  type="button"
                  disabled={!relevantLines.length}
                  onClick={() => setStep("pay")}
                >
                  Ir a pagar
                </button>
              ) : (
                <button
                  className="gafa-sdk-button gafa-checkout__cta"
                  type="button"
                  disabled={paying || !relevantLines.length}
                  onClick={() => void handlePay()}
                >
                  {paying ? "Procesando…" : `Pagar ${formatMoney(total, currency.prefix, "")}`}
                </button>
              )}
            </aside>
          </div>
        ) : (
          <ThanksPanel
            thanks={thanks}
            profile={profileQuery.data}
            currency={currency}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function ShopPanel({
  tab,
  onTabChange,
  query,
  onQueryChange,
  items,
  loading,
  error,
  onAdd,
  currency,
}: {
  tab: CatalogTab;
  onTabChange: (tab: CatalogTab) => void;
  query: string;
  onQueryChange: (value: string) => void;
  items: CatalogItem[];
  loading: boolean;
  error: boolean;
  onAdd: (item: CatalogItem) => void;
  currency: { prefix: string; suffix: string };
}) {
  return (
    <div className="gafa-checkout-shop">
      <div className="gafa-checkout-tabs" role="tablist" aria-label="Tipo de producto">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "packages"}
          data-active={tab === "packages" ? "true" : undefined}
          onClick={() => onTabChange("packages")}
        >
          Paquetes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "memberships"}
          data-active={tab === "memberships" ? "true" : undefined}
          onClick={() => onTabChange("memberships")}
        >
          Membresías
        </button>
      </div>

      <label className="gafa-checkout-search">
        <span className="gafa-sr-only">Buscar</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={tab === "packages" ? "Buscar paquetes" : "Buscar membresías"}
        />
      </label>

      {loading ? <p className="gafa-sdk-state">Cargando catálogo…</p> : null}
      {error ? <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar el catálogo.</p> : null}

      <div className="gafa-checkout-grid">
        {items.map((item) => (
          <article className="gafa-checkout-product" key={`${item.type}-${item.id}`}>
            <div className="gafa-checkout-product__price">
              {item.compareAtPriceLabel ? <s>{item.compareAtPriceLabel}</s> : null}
              <strong>{item.priceLabel ?? formatMoney(item.priceFinal ?? item.price ?? 0, currency.prefix, currency.suffix)}</strong>
            </div>
            <h3>{item.name}</h3>
            {item.expirationDays ? <p className="gafa-checkout-product__meta">Expira en {item.expirationDays} días</p> : null}
            {item.description ? <p className="gafa-checkout-product__desc">{item.description}</p> : null}
            {item.subscribable ? <p className="gafa-checkout-product__meta">Pago recurrente</p> : null}
            <button className="gafa-sdk-button" type="button" onClick={() => onAdd(item)}>
              Agregar
            </button>
          </article>
        ))}
      </div>

      {!loading && !error && items.length === 0 ? (
        <p className="gafa-sdk-state">No hay {tab === "packages" ? "paquetes" : "membresías"} para mostrar.</p>
      ) : null}
    </div>
  );
}

function PayPanel({
  methods,
  selectedMethodId,
  onSelectMethod,
  config,
  configLoading,
  configError,
  payMountRef,
  hasRuntime,
}: {
  methods: FrontPaymentMethod[];
  selectedMethodId: number | null;
  onSelectMethod: (id: number) => void;
  config?: CheckoutConfig;
  configLoading: boolean;
  configError: boolean;
  payMountRef: React.RefObject<HTMLDivElement | null>;
  hasRuntime: boolean;
}) {
  return (
    <div className="gafa-checkout-pay">
      {configLoading ? <p className="gafa-sdk-state">Cargando métodos de pago…</p> : null}
      {configError ? (
        <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar los métodos de pago.</p>
      ) : null}

      {methods.length > 0 ? (
        <div className="gafa-checkout-methods" role="tablist" aria-label="Método de pago">
          {methods.map((method) => (
            <button
              key={method.id}
              type="button"
              role="tab"
              aria-selected={method.id === selectedMethodId}
              data-active={method.id === selectedMethodId ? "true" : undefined}
              onClick={() => onSelectMethod(method.id)}
            >
              {method.slug === "stripe" ? "Tarjeta" : method.name}
            </button>
          ))}
        </div>
      ) : !configLoading ? (
        <p className="gafa-sdk-state">Esta sede no tiene métodos de pago front activos.</p>
      ) : null}

      <div className="gafa-checkout-paymount" ref={payMountRef} />

      {!hasRuntime && methods.length > 0 ? (
        <p className="gafa-checkout-payhint">
          Para cobrar en vivo, incluye el script de <strong>GafaPayFront</strong> (o GafaPayElements) en
          la página. El flujo y el diseño ya no dependen del Fancy v1.
        </p>
      ) : null}

      {config?.termsConditionsLink ? null : (
        <p className="gafa-checkout-payhint">Esta marca no tiene link de términos configurado en el admin.</p>
      )}
    </div>
  );
}

function PromoField({
  label,
  value,
  onChange,
  onApply,
  status,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void | Promise<void>;
  status: "idle" | "checking" | "ok" | "error";
  hint?: string;
}) {
  return (
    <div className="gafa-checkout-promo" data-status={status}>
      <label>
        <span>{label}</span>
        <div className="gafa-checkout-promo__row">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onApply();
              }
            }}
            placeholder="Escribe el código"
          />
          <button type="button" onClick={() => void onApply()} disabled={status === "checking" || !value.trim()}>
            {status === "checking" ? "…" : "Aplicar"}
          </button>
        </div>
      </label>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function ThanksPanel({
  thanks,
  profile,
  currency,
  onClose,
}: {
  thanks: {
    purchaseId?: number | null;
    reservationId?: number;
    reservationSnapshot: CartReservationContext | null;
    linesSnapshot: ReturnType<typeof useCartStore.getState>["lines"];
  } | null;
  profile?: UserProfile | null;
  currency: { prefix: string; suffix: string };
  onClose: () => void;
}) {
  const reservation = thanks?.reservationSnapshot;
  const lines = thanks?.linesSnapshot ?? [];

  return (
    <div className="gafa-checkout-thanks">
      <div className="gafa-checkout-thanks__burst" aria-hidden="true" />
      <span className="gafa-eyebrow">Gracias</span>
      <h2 id="gafa-checkout-title">
        {reservation ? "Compra y reserva listas" : "Compra completada"}
      </h2>
      <p>
        {profile?.firstName ? `${profile.firstName}, t` : "T"}u pedido quedó registrado
        {thanks?.purchaseId ? ` (#${thanks.purchaseId})` : ""}.
      </p>

      {reservation ? (
        <div className="gafa-checkout-thanks__card">
          <span>Tu clase</span>
          <strong>{reservation.serviceName ?? reservation.meetingName}</strong>
          <p>
            {formatMeetingWhen(reservation.startsAt, reservation.timezone)}
            {reservation.locationName ? ` · ${reservation.locationName}` : ""}
            {reservation.seatLabel ? ` · Lugar ${reservation.seatLabel}` : ""}
          </p>
          {thanks?.reservationId ? <small>Reserva #{thanks.reservationId}</small> : null}
        </div>
      ) : null}

      {lines.length > 0 ? (
        <ul className="gafa-checkout-thanks__lines">
          {lines.map((line) => (
            <li key={line.key}>
              <span>
                {line.name} × {line.amount}
              </span>
              <strong>{formatMoney(line.price * line.amount, currency.prefix, currency.suffix)}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      <button className="gafa-sdk-button" type="button" onClick={onClose}>
        Volver al calendario
      </button>
    </div>
  );
}

async function waitForPurchase(
  client: GafaClient,
  payload: {
    brandSlug: string;
    locationSlug: string;
    checkoutToken: string;
    pendingPurchaseId: number;
  },
): Promise<number | undefined> {
  if (!client.pollInitialPurchaseStatus) return undefined;
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = await client.pollInitialPurchaseStatus(payload);
    if (status.code === 1) return status.reservationId;
    if (status.code === -1) throw new Error(status.message || "El pago no se pudo confirmar.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  // Compra creada pero el status no resolvió a tiempo: no bloqueamos el thank you.
  return undefined;
}

function formatMeetingWhen(value: string, timeZone?: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

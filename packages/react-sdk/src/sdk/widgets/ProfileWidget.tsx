import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomFieldGroup,
  CustomFieldValues,
  GafaClient,
  UpdateProfilePayload,
  UserActivityTotals,
  UserCredit,
  UserMembership,
  UserProfile,
  UserPurchase,
  UserReservation,
} from "../client/types";
import { subscribeToAuthChanges } from "../client/tokenStorage";
import { fetchLoyaltyBalance, type LoyaltyBalance } from "../analytics/loyalty";
import { RemoteImage } from "../images/ImagesProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { CustomFieldInput } from "./CustomFieldInput";
import { DateField } from "./DateField";
import { defaultExploreClasses, defaultExplorePackages } from "../account/exploreDefaults";
import { WidgetShell } from "./WidgetShell";

export type ProfileWidgetProps = {
  client?: GafaClient;
  brandSlug?: string;
  combineWaitlist?: boolean;
  hubUrl?: string;
  companyId?: number;
  /** En `modal` el contenedor pone el marco y el boton de cerrar. */
  variant?: "page" | "modal";
  onRequestClose?(): void;
  /**
   * CTA de los estados vacios: Reservar (calendario) y Comprar (paquetes).
   * Si el sitio no los pasa, el SDK navega solo al calendario / #paquetes.
   */
  onExploreClasses?(): void;
  onExplorePackages?(): void;
};

type ProfileTab = "overview" | "classes" | "balance" | "purchases" | "profile" | "password";

/** Puntos en el Hub sí se pueden acumular; la card del socio se enciende después. */
const SHOW_LOYALTY_POINTS = false;

const TABS: { id: ProfileTab; label: string; title: string; subtitle: string; icon: ReactNode }[] = [
  {
    id: "overview",
    label: "Mi actividad",
    title: "Mi actividad",
    subtitle: "Tu próxima clase, tu saldo y cómo vas.",
    icon: <ActivityIcon />,
  },
  {
    id: "classes",
    label: "Mis clases",
    title: "Mis clases",
    subtitle: "Próximas reservas, lista de espera e historial.",
    icon: <CalendarIcon />,
  },
  {
    id: "balance",
    label: "Créditos",
    title: "Créditos y membresías",
    subtitle: "Lo que tienes disponible para reservar.",
    icon: <TicketIcon />,
  },
  {
    id: "purchases",
    label: "Compras",
    title: "Mis compras",
    subtitle: "Historial de pagos y paquetes comprados.",
    icon: <ReceiptIcon />,
  },
  {
    id: "profile",
    label: "Mis datos",
    title: "Mis datos",
    subtitle: "Tu información de contacto y facturación.",
    icon: <UserIcon />,
  },
  {
    id: "password",
    label: "Contraseña",
    title: "Contraseña",
    subtitle: "Cambia la contraseña de tu cuenta.",
    icon: <LockIcon />,
  },
];

export function ProfileWidget({
  client,
  brandSlug,
  combineWaitlist = false,
  hubUrl,
  companyId,
  variant = "page",
  onRequestClose,
  onExploreClasses,
  onExplorePackages,
}: ProfileWidgetProps) {
  const goToClasses = onExploreClasses ?? defaultExploreClasses;
  const goToPackages = onExplorePackages ?? defaultExplorePackages;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [qrReservation, setQrReservation] = useState<UserReservation | null>(null);
  const [pendingCancel, setPendingCancel] = useState<UserReservation | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sideRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const side = sideRef.current;
    if (!root || !side) return;
    const sync = () => {
      root.style.setProperty("--gafa-acct-side-h", `${side.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(side);
    return () => observer.disconnect();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => subscribeToAuthChanges(() => queryClient.invalidateQueries({ queryKey: ["profile"] })),
    [queryClient],
  );

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => client!.getProfile(),
    enabled: Boolean(client),
  });

  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", hubUrl, companyId, profileQuery.data?.id],
    queryFn: () =>
      fetchLoyaltyBalance({
        hubUrl: hubUrl!,
        companyId: companyId!,
        userId: profileQuery.data!.id,
      }),
    enabled: SHOW_LOYALTY_POINTS && Boolean(hubUrl && companyId && profileQuery.data?.id),
  });

  const brandsQuery = useQuery({
    queryKey: ["profile", "brands"],
    queryFn: () => client!.listBrands(),
    enabled: Boolean(client) && Boolean(profileQuery.data),
  });

  const brandSlugs = useMemo(() => {
    if (brandSlug) return [brandSlug];
    return (brandsQuery.data ?? []).map((brand) => brand.slug).filter(Boolean);
  }, [brandSlug, brandsQuery.data]);

  const isSignedIn = Boolean(profileQuery.data);
  const canQueryBrandData = Boolean(client) && isSignedIn && brandSlugs.length > 0;

  const futureQuery = useQuery({
    queryKey: ["profile", "reservations", "future", brandSlugs.join(",")],
    queryFn: async () => {
      const batches = await Promise.all(brandSlugs.map((slug) => client!.listUserReservations(slug, "future")));
      return batches.flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },
    enabled: canQueryBrandData,
  });

  const pastQuery = useQuery({
    queryKey: ["profile", "reservations", "past", brandSlugs.join(",")],
    queryFn: async () => {
      const batches = await Promise.all(brandSlugs.map((slug) => client!.listUserReservations(slug, "past")));
      return batches.flat().sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    },
    enabled: canQueryBrandData && tab === "classes",
  });

  const creditsQuery = useQuery({
    queryKey: ["profile", "credits", brandSlugs.join(",")],
    queryFn: async () => {
      const batches = await Promise.all(brandSlugs.map((slug) => client!.listUserCredits(slug)));
      // Dedupe por compra (`purchase_items_id`), no por tipo interno de credito:
      // tres "1 clase" de CDMXnew son tres paquetes, no uno.
      return dedupeById(batches.flat()).sort((a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""));
    },
    enabled: canQueryBrandData,
  });

  const membershipsQuery = useQuery({
    queryKey: ["profile", "memberships", brandSlugs.join(",")],
    queryFn: async () => {
      const batches = await Promise.all(brandSlugs.map((slug) => client!.listUserMemberships(slug)));
      return dedupeById(batches.flat());
    },
    enabled: canQueryBrandData,
  });

  const purchasesQuery = useQuery({
    queryKey: ["profile", "purchases", brandSlugs.join(",")],
    queryFn: async () => {
      const batches = await Promise.all(brandSlugs.map((slug) => client!.listUserPurchases(slug)));
      return batches.flat().sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    },
    enabled: canQueryBrandData && tab === "purchases",
  });

  // gafa.fit solo expone los campos especiales del formulario de registro
  // (`section=register`); no hay una seccion propia de perfil, asi que en la
  // cuenta se muestran esos mismos.
  const customFieldsQuery = useQuery({
    queryKey: ["profile", "custom-fields", brandSlugs[0]],
    queryFn: () => client!.listRegistrationFields(brandSlugs[0]),
    enabled: canQueryBrandData && tab === "profile",
  });

  const activityQuery = useQuery({
    queryKey: ["profile", "activity"],
    queryFn: () => client!.getUserActivityTotals!(),
    enabled: Boolean(client?.getUserActivityTotals) && isSignedIn && tab === "overview",
  });

  const cancelMutation = useMutation({
    mutationFn: (reservation: UserReservation) =>
      reservation.isWaitlist && client?.cancelWaitlist
        ? client.cancelWaitlist(reservation.brandSlug, reservation.id)
        : client!.cancelReservation(reservation.brandSlug, reservation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "activity"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "credits"] });
      setPendingCancel(null);
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => client!.updateProfile!(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", "me"] }),
  });

  const upcoming = useMemo(() => {
    const items = (futureQuery.data ?? []).filter((item) => !item.cancelled);
    return combineWaitlist ? items : items.filter((item) => !item.isWaitlist);
  }, [combineWaitlist, futureQuery.data]);

  const waitlist = useMemo(
    () => (combineWaitlist ? [] : (futureQuery.data ?? []).filter((item) => item.isWaitlist && !item.cancelled)),
    [combineWaitlist, futureQuery.data],
  );

  const cancelledUpcoming = useMemo(
    () => (futureQuery.data ?? []).filter((item) => item.cancelled && !item.isWaitlist),
    [futureQuery.data],
  );

  // El nombre que el socio reconoce es el del paquete que compro; la reserva
  // solo trae el TIPO de credito (interno, ej. "CDMXnew"). Ver
  // docs/creditos-vs-paquetes.md.
  const packageNameByCreditId = useMemo(() => {
    const map = new Map<number, string>();
    (creditsQuery.data ?? []).forEach((credit) => {
      const typeId = credit.creditTypeId ?? credit.id;
      if (!map.has(typeId)) map.set(typeId, credit.name);
    });
    return map;
  }, [creditsQuery.data]);

  const paymentLabel = (reservation: UserReservation): string | null => {
    if (reservation.isWaitlist) return null;
    if (reservation.creditId == null && !reservation.creditTypeName) return "Membresía";
    return (reservation.creditId != null ? packageNameByCreditId.get(reservation.creditId) : undefined) ?? "Paquete";
  };

  if (profileQuery.isLoading) {
    return variant === "modal" ? (
      <div className="gafa-acct__boot">
        <span className="gafa-skeleton gafa-acct__boot-bar" />
        <span className="gafa-skeleton gafa-acct__boot-bar" />
        <span className="gafa-skeleton gafa-acct__boot-bar" />
      </div>
    ) : (
      <WidgetShell eyebrow="Perfil" title="Tu cuenta">
        <div className="gafa-acct__boot" aria-busy="true" aria-live="polite">
          <span className="gafa-sr-only">Cargando tu perfil…</span>
          <span className="gafa-skeleton gafa-acct__boot-bar" />
          <span className="gafa-skeleton gafa-acct__boot-bar" />
          <span className="gafa-skeleton gafa-acct__boot-bar" />
        </div>
      </WidgetShell>
    );
  }

  if (!isSignedIn) {
    return (
      <WidgetShell
        eyebrow="Perfil"
        title="Tu cuenta en un solo lugar"
        description="Inicia sesión para ver tus clases, créditos, compras y actividad."
      >
        <p className="gafa-sdk-state">Aún no has iniciado sesión.</p>
      </WidgetShell>
    );
  }

  const profile = profileQuery.data!;
  const section = TABS.find((item) => item.id === tab)!;

  return (
    <div
      className="gafa-acct"
      data-variant={variant}
      data-menu={menuOpen ? "open" : undefined}
      ref={rootRef}
    >
      <aside className="gafa-acct__side" ref={sideRef}>
        <div className="gafa-acct__user">
          <Avatar profile={profile} />
          <div className="gafa-acct__user-text">
            <strong>{displayName(profile)}</strong>
            <span title={profile.email}>{profile.email}</span>
          </div>
        </div>

        <button
          className="gafa-acct__menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="gafa-acct-nav"
          aria-haspopup="true"
          aria-label={menuOpen ? "Cerrar secciones de tu cuenta" : "Abrir secciones de tu cuenta"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="gafa-acct__nav-icon">{section.icon}</span>
          <span>{section.label}</span>
          <ChevronDownIcon />
        </button>

        <div className="gafa-acct__nav-panel" id="gafa-acct-nav">
          <nav className="gafa-acct__nav" aria-label="Secciones de tu cuenta">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="gafa-acct__nav-item"
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => {
                  setTab(item.id);
                  setMenuOpen(false);
                }}
              >
                <span className="gafa-acct__nav-icon">{item.icon}</span>
                <span className="gafa-acct__nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="gafa-acct__side-foot">
            <button
              className="gafa-acct__logout"
              type="button"
              onClick={() => {
                client?.logout();
                onRequestClose?.();
              }}
            >
              <LogoutIcon />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <section className="gafa-acct__main" inert={menuOpen ? true : undefined}>
        <header className="gafa-acct__head">
          <h2>
            {tab === "overview" ? (
              <>
                ¡Hola, {firstNameOf(profile)}!{" "}
                <span className="gafa-acct__wave" aria-hidden="true">
                  👋
                </span>
              </>
            ) : (
              section.title
            )}
          </h2>
          <p>{section.subtitle}</p>
        </header>

        <div className="gafa-acct__body">
          {tab === "overview" ? (
            <OverviewPanel
              profile={profile}
              nextClass={upcoming[0]}
              upcomingCount={upcoming.length}
              waitlistCount={waitlist.length}
              credits={creditsQuery.data ?? []}
              memberships={membershipsQuery.data ?? []}
              loyalty={loyaltyQuery.data ?? null}
              loadingBalance={creditsQuery.isLoading || membershipsQuery.isLoading}
              loadingNext={futureQuery.isLoading}
              totals={activityQuery.data}
              loadingTotals={activityQuery.isLoading}
              totalsUnsupported={!client?.getUserActivityTotals}
              cancelPendingId={cancelMutation.isPending ? cancelMutation.variables?.id : undefined}
              onCancel={setPendingCancel}
              onShowQr={setQrReservation}
              onGoTo={setTab}
              onExploreClasses={goToClasses}
              onExplorePackages={goToPackages}
            />
          ) : null}

          {tab === "classes" ? (
            <ClassesPanel
              upcoming={upcoming}
              waitlist={waitlist}
              cancelled={cancelledUpcoming}
              history={pastQuery.data ?? []}
              loadingFuture={futureQuery.isLoading}
              loadingPast={pastQuery.isLoading}
              errorFuture={futureQuery.isError}
              errorPast={pastQuery.isError}
              cancelPendingId={cancelMutation.isPending ? cancelMutation.variables?.id : undefined}
              paymentLabel={paymentLabel}
              onCancel={setPendingCancel}
              onShowQr={setQrReservation}
              onExploreClasses={goToClasses}
            />
          ) : null}

          {tab === "balance" ? (
            <BalancePanel
              credits={creditsQuery.data ?? []}
              memberships={membershipsQuery.data ?? []}
              storeCredit={profile.storeCreditTotal}
              loading={creditsQuery.isLoading || membershipsQuery.isLoading}
              error={creditsQuery.isError || membershipsQuery.isError}
              onExplorePackages={goToPackages}
            />
          ) : null}

          {tab === "purchases" ? (
            <PurchasesPanel
              purchases={purchasesQuery.data ?? []}
              loading={purchasesQuery.isLoading}
              error={purchasesQuery.isError}
              onExplorePackages={goToPackages}
            />
          ) : null}

          {tab === "profile" ? (
            <ProfileForm
              profile={profile}
              customFieldGroups={customFieldsQuery.data ?? []}
              loadingCustomFields={customFieldsQuery.isLoading}
              saving={saveProfileMutation.isPending}
              error={saveProfileMutation.isError ? errorMessage(saveProfileMutation.error) : undefined}
              success={saveProfileMutation.isSuccess}
              unsupported={!client?.updateProfile}
              onSave={(payload) => saveProfileMutation.mutate(payload)}
            />
          ) : null}

          {tab === "password" ? (
            <PasswordForm
              saving={saveProfileMutation.isPending}
              error={saveProfileMutation.isError ? errorMessage(saveProfileMutation.error) : undefined}
              success={saveProfileMutation.isSuccess}
              unsupported={!client?.updateProfile}
              onSave={(payload) => saveProfileMutation.mutate(payload)}
            />
          ) : null}

          {cancelMutation.isError && !pendingCancel ? (
            <p className="gafa-sdk-state gafa-sdk-state--error">{errorMessage(cancelMutation.error)}</p>
          ) : null}
        </div>
      </section>

      {qrReservation ? <QrModal reservation={qrReservation} onClose={() => setQrReservation(null)} /> : null}

      {pendingCancel ? (
        <ConfirmDialog
          tone="danger"
          title={pendingCancel.isWaitlist ? "¿Salir de la lista de espera?" : "¿Cancelar tu clase?"}
          description={
            <>
              <span className="gafa-confirm__subject">
                {pendingCancel.serviceName} ·{" "}
                {capitalize(formatWeekday(pendingCancel.startsAt, pendingCancel.timezone))},{" "}
                {formatTime(pendingCancel.startsAt, pendingCancel.timezone)}
              </span>
              {pendingCancel.isWaitlist
                ? "Si vuelves a entrar, pierdes el lugar que tienes en la fila."
                : "Se libera tu lugar y te regresamos la clase a tu paquete."}
            </>
          }
          confirmLabel={pendingCancel.isWaitlist ? "Sí, salir" : "Sí, cancelar"}
          cancelLabel="No, dejarla"
          busy={cancelMutation.isPending}
          error={cancelMutation.isError ? errorMessage(cancelMutation.error) : undefined}
          onConfirm={() => cancelMutation.mutate(pendingCancel)}
          onDismiss={() => {
            cancelMutation.reset();
            setPendingCancel(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ overview */

function OverviewPanel({
  profile,
  nextClass,
  upcomingCount,
  waitlistCount,
  credits,
  memberships,
  loyalty,
  loadingBalance,
  loadingNext,
  totals,
  loadingTotals,
  totalsUnsupported,
  cancelPendingId,
  onCancel,
  onShowQr,
  onGoTo,
  onExploreClasses,
  onExplorePackages,
}: {
  profile: UserProfile;
  nextClass?: UserReservation;
  upcomingCount: number;
  waitlistCount: number;
  credits: UserCredit[];
  memberships: UserMembership[];
  loyalty?: LoyaltyBalance | null;
  loadingBalance: boolean;
  loadingNext: boolean;
  totals?: UserActivityTotals;
  loadingTotals: boolean;
  totalsUnsupported: boolean;
  cancelPendingId?: number;
  onCancel(reservation: UserReservation): void;
  onShowQr(reservation: UserReservation): void;
  onGoTo(tab: ProfileTab): void;
  onExploreClasses(): void;
  onExplorePackages(): void;
}) {
  const creditTotal = credits.reduce((sum, credit) => sum + (Number(credit.total) || 0), 0);

  // El numero grande es SIEMPRE el total. Con mas de un paquete, el mini
  // slider recorre cada compra (nombre + vencimiento) sin esconder el saldo.
  const creditSlides: BalanceSlide[] =
    credits.length > 1
      ? credits.map((credit) => ({
          title: credit.name,
          hint: `${credit.total === 1 ? "1 crédito" : `${credit.total} créditos`} · ${expirationLabel(credit.expiresAt)}`,
        }))
      : [];

  const membershipSlides: BalanceSlide[] =
    memberships.length > 1
      ? memberships.map((membership) => ({
          title: membership.name,
          hint: expirationLabel(membership.expiresAt),
        }))
      : [];

  return (
    <div className="gafa-acct-overview">
      <section className="gafa-acct-next" aria-label="Tu próxima clase">
        <div className="gafa-acct-next__label">
          <span className="gafa-acct-next__label-text">
            <span className="gafa-acct-dot" aria-hidden="true" />
            Tu próxima clase
          </span>
          {nextClass ? (
            <span className="gafa-acct-next__countdown">{countdownLabel(nextClass.startsAt)}</span>
          ) : null}
        </div>

        {loadingNext ? (
          <div className="gafa-acct-next__loading">
            <span className="gafa-skeleton gafa-acct__boot-bar" />
          </div>
        ) : nextClass ? (
          <div className="gafa-acct-next__body">
            <div className="gafa-acct-next__when">
              <strong>{relativeDayLabel(nextClass.startsAt, nextClass.timezone)}</strong>
              <span>{formatTime(nextClass.startsAt, nextClass.timezone)}</span>
            </div>
            <div className="gafa-acct-next__what">
              <h3>{nextClass.serviceName}</h3>
              <p>{describeReservation(nextClass)}</p>
            </div>
            <div className="gafa-acct-next__actions">
              {nextClass.qrHash ? (
                <button className="gafa-sdk-button" type="button" onClick={() => onShowQr(nextClass)}>
                  Ver mi QR
                </button>
              ) : null}
              {nextClass.canCancel !== false ? (
                <button
                  className="gafa-sdk-button gafa-sdk-button--secondary"
                  type="button"
                  disabled={cancelPendingId === nextClass.id}
                  onClick={() => onCancel(nextClass)}
                >
                  {cancelPendingId === nextClass.id ? "Cancelando…" : "Cancelar"}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="gafa-acct-next__empty">
            <span className="gafa-acct-next__empty-emoji" aria-hidden="true">
              🗓️
            </span>
            <div>
              <p>Sin clases reservadas</p>
              <span className="gafa-muted">Reserva desde el calendario y aparecerá aquí con tu QR.</span>
            </div>
            <button className="gafa-sdk-button gafa-acct-next__empty-cta" type="button" onClick={onExploreClasses}>
              Reservar
            </button>
          </div>
        )}

        {upcomingCount > 0 || waitlistCount > 0 ? (
          <button className="gafa-acct-next__more" type="button" onClick={() => onGoTo("classes")}>
            {upcomingCount > 1 ? `Ver mis ${upcomingCount} clases` : "Ver mis clases"}
            {waitlistCount > 0 ? ` · ${waitlistCount} en lista de espera` : ""}
            <ChevronIcon />
          </button>
        ) : null}
      </section>

      <section className="gafa-acct-block" aria-label="Tu saldo">
        <header className="gafa-acct-block__head">
          <h3>Tu saldo</h3>
          <div className="gafa-acct-block__actions">
            {creditTotal === 0 && memberships.length === 0 ? (
              <button type="button" className="gafa-acct-link" onClick={onExplorePackages}>
                Comprar
              </button>
            ) : null}
            <button type="button" className="gafa-acct-link" onClick={() => onGoTo("balance")}>
              Ver detalle
            </button>
          </div>
        </header>
        {loadingBalance ? (
          <span className="gafa-skeleton gafa-acct__boot-bar" />
        ) : (
          <div className="gafa-acct-balance">
            {creditSlides.length > 0 ? (
              <BalanceCard
                emoji="🎟️"
                value={creditTotal}
                label={creditTotal === 1 ? "Clase disponible" : "Clases disponibles"}
                slides={creditSlides}
              />
            ) : (
              <div className="gafa-acct-balance__card">
                <span className="gafa-acct-balance__emoji" aria-hidden="true">
                  🎟️
                </span>
                <span className="gafa-acct-balance__value">{creditTotal}</span>
                <span className="gafa-acct-balance__label">
                  {creditTotal === 1 ? "Clase disponible" : "Clases disponibles"}
                </span>
                {credits[0]?.expiresAt ? (
                  <span className="gafa-acct-balance__hint">{expirationLabel(credits[0].expiresAt)}</span>
                ) : null}
              </div>
            )}

            {membershipSlides.length > 0 ? (
              <BalanceCard
                emoji="♾️"
                value={memberships.length}
                label={memberships.length === 1 ? "Membresía activa" : "Membresías activas"}
                slides={membershipSlides}
              />
            ) : (
              <div className="gafa-acct-balance__card">
                <span className="gafa-acct-balance__emoji" aria-hidden="true">
                  ♾️
                </span>
                <span className="gafa-acct-balance__value">{memberships.length}</span>
                <span className="gafa-acct-balance__label">
                  {memberships.length === 1 ? "Membresía activa" : "Membresías activas"}
                </span>
                {memberships[0] ? <span className="gafa-acct-balance__hint">{memberships[0].name}</span> : null}
              </div>
            )}

            <div className="gafa-acct-balance__card">
              <span className="gafa-acct-balance__emoji" aria-hidden="true">
                💳
              </span>
              <span className="gafa-acct-balance__value">{formatWallet(profile.storeCreditTotal)}</span>
              <span className="gafa-acct-balance__label">Crédito en tienda</span>
            </div>

            {SHOW_LOYALTY_POINTS && loyalty ? (
              <div className="gafa-acct-balance__card">
                <span className="gafa-acct-balance__emoji" aria-hidden="true">
                  ⭐
                </span>
                <span className="gafa-acct-balance__value">{loyalty.points}</span>
                <span className="gafa-acct-balance__label">Puntos {loyalty.tier.label}</span>
                {loyalty.recent[0] ? (
                  <span className="gafa-acct-balance__hint">
                    {loyalty.recent[0].points > 0 ? "+" : ""}
                    {loyalty.recent[0].points} {loyaltyLabel(loyalty.recent[0].event_name)}
                  </span>
                ) : (
                  <span className="gafa-acct-balance__hint">Reserva o compra para sumar</span>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="gafa-acct-block" aria-label="Tus números">
        <header className="gafa-acct-block__head">
          <h3>Tus números</h3>
        </header>

        {totalsUnsupported ? (
          <p className="gafa-sdk-state">Tu actividad no está disponible en este sitio.</p>
        ) : loadingTotals ? (
          <span className="gafa-skeleton gafa-acct__boot-bar" />
        ) : totals ? (
          <>
            <div className="gafa-acct-stats">
              <Stat emoji="🔥" value={totals.attendedCount} label="Clases tomadas" tone="strong" />
              <Stat emoji="📅" value={totals.reservedCount} label="Reservadas" />
              <Stat emoji="⏱️" value={formatMinutes(totals.attendedMinutes)} label="Tiempo entrenando" />
              <Stat emoji="↩️" value={totals.cancelledCount} label="Canceladas" />
              <Stat
                emoji="😴"
                value={totals.noShowCount}
                label="No show"
                tone={totals.noShowCount > 0 ? "warn" : undefined}
              />
            </div>

            {totals.reservedCount > 0 ? (
              <div className="gafa-acct-progress">
                <div className="gafa-acct-progress__head">
                  <span>Asistencia</span>
                  <strong>{attendanceRate(totals)}%</strong>
                </div>
                <div className="gafa-acct-progress__track">
                  <span className="gafa-acct-progress__fill" style={{ width: `${attendanceRate(totals)}%` }} />
                </div>
                <p className="gafa-acct-progress__note">{attendanceNote(totals)}</p>
              </div>
            ) : null}

            <div className="gafa-acct-faves">
              <div>
                <span className="gafa-acct-faves__title">Coaches favoritos</span>
                {totals.favoriteStaff.length ? (
                  <div className="gafa-acct-chips">
                    {totals.favoriteStaff.map((name) => (
                      <span className="gafa-meeting-chip" key={name}>
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="gafa-muted">Aparecerán con tus primeras clases.</p>
                )}
              </div>
              <div>
                <span className="gafa-acct-faves__title">Horarios favoritos</span>
                {totals.favoriteSchedules.length ? (
                  <div className="gafa-acct-chips">
                    {totals.favoriteSchedules.map((slot) => (
                      <span className="gafa-meeting-chip" key={slot}>
                        {slot}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="gafa-muted">Se calculan con tus clases.</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function Stat({
  emoji,
  value,
  label,
  tone,
}: {
  emoji: string;
  value: number | string;
  label: string;
  tone?: "strong" | "warn";
}) {
  return (
    <div className="gafa-acct-stat" data-tone={tone}>
      <span className="gafa-acct-stat__emoji" aria-hidden="true">
        {emoji}
      </span>
      <strong>{value}</strong>
      <span className="gafa-acct-stat__label">{label}</span>
    </div>
  );
}

type BalanceSlide = {
  title?: string;
  hint?: string;
};

/**
 * "Tu saldo" con varios paquetes: el numero grande es el total; el mini
 * slider recorre cada compra. El detalle completo sigue en "Creditos".
 */
function BalanceCard({
  emoji,
  value,
  label,
  slides,
}: {
  emoji: string;
  value: ReactNode;
  label: string;
  slides: BalanceSlide[];
}) {
  const [index, setIndex] = useState(0);
  const current = slides[Math.min(index, slides.length - 1)];
  const multiple = slides.length > 1;

  return (
    <div className="gafa-acct-balance__card" data-carousel={multiple ? "true" : undefined}>
      <span className="gafa-acct-balance__emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="gafa-acct-balance__value">{value}</span>
      <span className="gafa-acct-balance__label">{label}</span>
      {current?.title ? (
        <span className="gafa-acct-balance__title" aria-live="polite">
          {current.title}
        </span>
      ) : null}
      {current?.hint ? <span className="gafa-acct-balance__hint">{current.hint}</span> : null}

      {multiple ? (
        <div className="gafa-acct-balance__nav" aria-label="Elegir paquete">
          <button
            type="button"
            aria-label="Paquete anterior"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
          >
            <ChevronIcon />
          </button>
          {/* Puntos = "hay mas cosas" pero no dicen cuantas ni cual ves: un
              contador "1 / 2" se entiende sin explicarlo. */}
          <span className="gafa-acct-balance__count">
            {index + 1} / {slides.length}
          </span>
          <button
            type="button"
            aria-label="Paquete siguiente"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
          >
            <ChevronIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- clases */

function ClassesPanel({
  upcoming,
  waitlist,
  cancelled,
  history,
  loadingFuture,
  loadingPast,
  errorFuture,
  errorPast,
  cancelPendingId,
  paymentLabel,
  onCancel,
  onShowQr,
  onExploreClasses,
}: {
  upcoming: UserReservation[];
  waitlist: UserReservation[];
  cancelled: UserReservation[];
  history: UserReservation[];
  loadingFuture: boolean;
  loadingPast: boolean;
  errorFuture: boolean;
  errorPast: boolean;
  cancelPendingId?: number;
  paymentLabel(reservation: UserReservation): string | null;
  onCancel(reservation: UserReservation): void;
  onShowQr(reservation: UserReservation): void;
  onExploreClasses(): void;
}) {
  const [scope, setScope] = useState<"upcoming" | "history">("upcoming");

  return (
    <div className="gafa-acct-classes">
      <div className="gafa-acct-switch" role="tablist" aria-label="Próximas o historial">
        <button type="button" role="tab" aria-selected={scope === "upcoming"} onClick={() => setScope("upcoming")}>
          Próximas
        </button>
        <button type="button" role="tab" aria-selected={scope === "history"} onClick={() => setScope("history")}>
          Historial
        </button>
      </div>

      {scope === "upcoming" ? (
        <>
          <ClassGroup
            title="Reservadas"
            loading={loadingFuture}
            error={errorFuture}
            empty={
              <EmptyState
                emoji="🗓️"
                title="No tienes clases reservadas"
                description="Explora el calendario y reserva tu próxima clase."
                actionLabel="Reservar"
                onAction={onExploreClasses}
              />
            }
            count={upcoming.length}
          >
            {upcoming.map((reservation) => (
              <ReservationCard
                key={`up-${reservation.id}`}
                reservation={reservation}
                paymentLabel={paymentLabel(reservation)}
                cancelPending={cancelPendingId === reservation.id}
                onCancel={onCancel}
                onShowQr={onShowQr}
              />
            ))}
          </ClassGroup>

          {/* Se muestra siempre, aunque este vacia: si no, no hay forma de saber
              que la lista de espera vive aqui. */}
          <ClassGroup
            title="Lista de espera"
            loading={loadingFuture}
            error={errorFuture}
            empty="No estás en ninguna lista de espera."
            count={waitlist.length}
          >
            {waitlist.map((reservation) => (
              <ReservationCard
                key={`wl-${reservation.id}`}
                reservation={reservation}
                paymentLabel={paymentLabel(reservation)}
                cancelPending={cancelPendingId === reservation.id}
                onCancel={onCancel}
              />
            ))}
          </ClassGroup>

          {cancelled.length > 0 ? (
            <ClassGroup title="Canceladas" empty="" count={cancelled.length}>
              {cancelled.map((reservation) => (
                <ReservationCard
                  key={`cx-${reservation.id}`}
                  reservation={reservation}
                  paymentLabel={paymentLabel(reservation)}
                />
              ))}
            </ClassGroup>
          ) : null}
        </>
      ) : (
        <ClassGroup
          title="Historial"
          loading={loadingPast}
          error={errorPast}
          empty="Aún no hay clases en tu historial."
          count={history.length}
        >
          {history.map((reservation) => (
            <ReservationCard
              key={`past-${reservation.id}`}
              reservation={reservation}
              paymentLabel={paymentLabel(reservation)}
              historic
            />
          ))}
        </ClassGroup>
      )}
    </div>
  );
}

function ClassGroup({
  title,
  loading,
  error,
  empty,
  count,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: boolean;
  empty: ReactNode;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="gafa-acct-group">
      <h3>
        {title}
        {count > 0 ? <span className="gafa-acct-group__count">{count}</span> : null}
      </h3>
      {loading ? <span className="gafa-skeleton gafa-acct__boot-bar" /> : null}
      {error ? <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar esta sección.</p> : null}
      {!loading && !error && count === 0 && empty ? empty : null}
      {!loading && !error && count > 0 ? <div className="gafa-acct-cards">{children}</div> : null}
    </section>
  );
}

/**
 * Estado vacio compartido: emoji + titulo + explicacion + un CTA opcional que
 * saca de la cuenta y manda a reservar/comprar. Sin `onAction` (el sitio
 * anfitrion no conecto la navegacion) se queda sin boton, no rompe nada.
 */
function EmptyState({
  emoji,
  title,
  description,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?(): void;
}) {
  return (
    <div className="gafa-acct-empty2">
      <span className="gafa-acct-empty2__emoji" aria-hidden="true">
        {emoji}
      </span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {actionLabel && onAction ? (
        <button className="gafa-sdk-button gafa-acct-empty2__cta" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ReservationCard({
  reservation,
  paymentLabel,
  historic = false,
  cancelPending,
  onCancel,
  onShowQr,
}: {
  reservation: UserReservation;
  /** Paquete o membresia con la que se pago; nunca el tipo interno de credito. */
  paymentLabel?: string | null;
  historic?: boolean;
  cancelPending?: boolean;
  onCancel?(reservation: UserReservation): void;
  onShowQr?(reservation: UserReservation): void;
}) {
  const showActions = !historic && !reservation.cancelled && (onCancel || onShowQr);

  return (
    <article
      className="gafa-acct-class"
      data-cancelled={reservation.cancelled ? "true" : undefined}
      data-historic={historic ? "true" : undefined}
    >
      <div className="gafa-acct-class__date" aria-hidden="true">
        <strong>{formatDayNumber(reservation.startsAt, reservation.timezone)}</strong>
        <span>{formatMonthShort(reservation.startsAt, reservation.timezone)}</span>
      </div>

      <div className="gafa-acct-class__info">
        <h4>{reservation.serviceName}</h4>
        {/* Dia y mes ya estan en el bloque de fecha de la izquierda: repetirlos
            aqui + la hora no cabe en una linea en movil y el a.m./p.m. se
            partia solo. Aqui solo va el nombre del dia. */}
        <p className="gafa-acct-class__when">
          {capitalize(formatWeekdayShort(reservation.startsAt, reservation.timezone))} ·{" "}
          {formatTime(reservation.startsAt, reservation.timezone)}
        </p>
        <p className="gafa-acct-class__meta">{describeReservation(reservation)}</p>
        <div className="gafa-acct-class__tags">
          {reservation.isWaitlist ? (
            <span className="gafa-meeting-chip">
              En espera{reservation.waitlistPosition ? ` · lugar ${reservation.waitlistPosition}` : ""}
            </span>
          ) : null}
          {reservation.isOverbooking ? <span className="gafa-meeting-chip">Sobrecupo</span> : null}
          {reservation.cancelled ? <span className="gafa-meeting-chip">Cancelada</span> : null}
          {paymentLabel ? <span className="gafa-meeting-chip">{paymentLabel}</span> : null}
        </div>
      </div>

      {showActions ? (
        <div className="gafa-acct-class__actions">
          {reservation.qrHash && onShowQr ? (
            <button className="gafa-sdk-button" type="button" onClick={() => onShowQr(reservation)}>
              Ver QR
            </button>
          ) : null}
          {reservation.canCancel !== false && onCancel ? (
            <button
              className="gafa-sdk-button gafa-sdk-button--secondary"
              type="button"
              disabled={cancelPending}
              onClick={() => onCancel(reservation)}
            >
              {cancelPending ? "…" : reservation.isWaitlist ? "Salir" : "Cancelar"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------- saldo */

function BalancePanel({
  credits,
  memberships,
  storeCredit,
  loading,
  error,
  onExplorePackages,
}: {
  credits: UserCredit[];
  memberships: UserMembership[];
  storeCredit?: string;
  loading: boolean;
  error: boolean;
  onExplorePackages(): void;
}) {
  if (loading) return <span className="gafa-skeleton gafa-acct__boot-bar" />;
  if (error) return <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar esta sección.</p>;

  if (!credits.length && !memberships.length) {
    return (
      <EmptyState
        emoji="🎟️"
        title="No tienes paquetes ni membresías activos"
        description="Compra un paquete de clases o una membresía para empezar a reservar."
        actionLabel="Comprar"
        onAction={onExplorePackages}
      />
    );
  }

  const creditTotal = credits.reduce((sum, credit) => sum + (Number(credit.total) || 0), 0);

  return (
    <div className="gafa-acct-cards">
      {credits.length > 0 ? (
        <article className="gafa-acct-row gafa-acct-row--hero" aria-label="Total de clases disponibles">
          <div className="gafa-acct-row__icon">
            <TicketIcon />
          </div>
          <div className="gafa-acct-row__info">
            <h4>Total disponible</h4>
            <p>
              {credits.length === 1
                ? "1 paquete activo"
                : `${credits.length} paquetes activos`}
            </p>
          </div>
          <strong className="gafa-acct-row__value">{creditTotal}</strong>
        </article>
      ) : null}

      {credits.map((credit) => (
        <article className="gafa-acct-row" key={`credit-${credit.id}`}>
          <div className="gafa-acct-row__icon">
            <TicketIcon />
          </div>
          <div className="gafa-acct-row__info">
            <h4>{credit.name}</h4>
            <p>{expirationLabel(credit.expiresAt)}</p>
          </div>
          <strong className="gafa-acct-row__value">{credit.total}</strong>
        </article>
      ))}

      {memberships.map((membership) => (
        <article className="gafa-acct-row" key={`membership-${membership.id}`}>
          <div className="gafa-acct-row__icon">
            <InfinityIcon />
          </div>
          <div className="gafa-acct-row__info">
            <h4>{membership.name}</h4>
            <p>{expirationLabel(membership.expiresAt)}</p>
          </div>
          <span className="gafa-meeting-chip">Membresía</span>
        </article>
      ))}

      <article className="gafa-acct-row">
        <div className="gafa-acct-row__icon">
          <WalletIcon />
        </div>
        <div className="gafa-acct-row__info">
          <h4>Crédito en tienda</h4>
          <p>Saldo a favor para tus próximas compras</p>
        </div>
        <strong className="gafa-acct-row__value">{formatWallet(storeCredit)}</strong>
      </article>
    </div>
  );
}

function PurchasesPanel({
  purchases,
  loading,
  error,
  onExplorePackages,
}: {
  purchases: UserPurchase[];
  loading: boolean;
  error: boolean;
  onExplorePackages(): void;
}) {
  if (loading) return <span className="gafa-skeleton gafa-acct__boot-bar" />;
  if (error) return <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar esta sección.</p>;
  if (!purchases.length) {
    return (
      <EmptyState
        emoji="🧾"
        title="Todavía no tienes compras"
        description="Cuando compres un paquete o una membresía, aparecerá aquí."
        actionLabel="Comprar"
        onAction={onExplorePackages}
      />
    );
  }

  return (
    <div className="gafa-acct-cards">
      {purchases.map((purchase) => (
        <article className="gafa-acct-row" key={`purchase-${purchase.id}`}>
          <div className="gafa-acct-row__icon">
            <ReceiptIcon />
          </div>
          <div className="gafa-acct-row__info">
            <h4>{purchase.name}</h4>
            <p>{[formatDate(purchase.createdAt), purchase.locationName, purchase.paymentType].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="gafa-acct-row__end">
            <strong className="gafa-acct-row__value">
              {purchase.currencyPrefix ?? "$"}
              {formatAmount(purchase.total)}
            </strong>
            {purchase.status ? <span className="gafa-acct-row__status">{purchase.status}</span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- mis datos */

function ProfileForm({
  profile,
  customFieldGroups,
  loadingCustomFields,
  saving,
  error,
  success,
  unsupported,
  onSave,
}: {
  profile: UserProfile;
  customFieldGroups: CustomFieldGroup[];
  loadingCustomFields: boolean;
  saving: boolean;
  error?: string;
  success: boolean;
  unsupported: boolean;
  onSave(payload: UpdateProfilePayload): void;
}) {
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birthDate, setBirthDate] = useState((profile.birthDate ?? "").slice(0, 10));
  const [gender, setGender] = useState(profile.gender ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [externalNumber, setExternalNumber] = useState(profile.externalNumber ?? "");
  const [internalNumber, setInternalNumber] = useState(profile.internalNumber ?? "");
  const [postalCode, setPostalCode] = useState(profile.postalCode ?? "");
  const [municipality, setMunicipality] = useState(profile.municipality ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  // Solo lo que el socio edita: si el API no devuelve los valores guardados de
  // los campos especiales, mandar todo en blanco los borraria.
  const [customEdits, setCustomEdits] = useState<CustomFieldValues>({});

  if (unsupported) return <p className="gafa-acct-empty">Editar tus datos no está disponible en este sitio.</p>;

  const customValueFor = (groupId: number, fieldId: number) =>
    customEdits[groupId]?.[fieldId] ?? profile.customFields?.[groupId]?.[fieldId] ?? "";

  const setCustomValue = (groupId: number, fieldId: number, value: string) =>
    setCustomEdits((current) => ({
      ...current,
      [groupId]: { ...(current[groupId] ?? {}), [fieldId]: value },
    }));

  return (
    <form
      className="gafa-sdk-form gafa-acct-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          firstName,
          lastName,
          email,
          phone,
          birthDate,
          gender,
          address,
          externalNumber,
          internalNumber,
          postalCode,
          municipality,
          city,
          customFields: Object.keys(customEdits).length ? customEdits : undefined,
        });
      }}
    >
      {profile.memberSince ? (
        <p className="gafa-acct-form__since">Miembro desde {formatDate(profile.memberSince)}</p>
      ) : null}

      <fieldset className="gafa-acct-fieldset">
        <legend>Datos personales</legend>
        <div className="gafa-field-row">
          <label className="gafa-float">
            <input placeholder=" " value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <span>Nombre</span>
          </label>
          <label className="gafa-float">
            <input placeholder=" " value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <span>Apellido</span>
          </label>
        </div>

        <div className="gafa-field-row">
          <label className="gafa-float">
            <input placeholder=" " type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <span>Email</span>
          </label>
          <label className="gafa-float">
            <input placeholder=" " type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <span>Teléfono</span>
          </label>
        </div>

        <div className="gafa-field-row">
          <DateField label="Fecha de nacimiento" value={birthDate} onChange={setBirthDate} mode="birth" />
          <div className="gafa-acct-choice">
            <span className="gafa-acct-choice__legend">Género</span>
            <div className="gafa-acct-choice__options">
              {(
                [
                  ["male", "Hombre"],
                  ["female", "Mujer"],
                  ["other", "Prefiero no decir"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="gafa-acct-choice__button"
                  aria-pressed={normalizeGender(gender) === value}
                  onClick={() => setGender(value === "other" ? "" : value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="gafa-acct-fieldset">
        <legend>Dirección</legend>
        <label className="gafa-float">
          <input placeholder=" " value={address} onChange={(e) => setAddress(e.target.value)} />
          <span>Calle</span>
        </label>
        <div className="gafa-field-row">
          <label className="gafa-float">
            <input placeholder=" " value={externalNumber} onChange={(e) => setExternalNumber(e.target.value)} />
            <span>Núm. exterior</span>
          </label>
          <label className="gafa-float">
            <input placeholder=" " value={internalNumber} onChange={(e) => setInternalNumber(e.target.value)} />
            <span>Núm. interior</span>
          </label>
        </div>
        <div className="gafa-field-row">
          <label className="gafa-float">
            <input placeholder=" " value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            <span>Código postal</span>
          </label>
          <label className="gafa-float">
            <input placeholder=" " value={municipality} onChange={(e) => setMunicipality(e.target.value)} />
            <span>Municipio</span>
          </label>
        </div>
        <label className="gafa-float">
          <input placeholder=" " value={city} onChange={(e) => setCity(e.target.value)} />
          <span>Ciudad</span>
        </label>
      </fieldset>

      {/* Campos especiales: los que la marca configura en gafa.fit (los mismos
          que pide su registro). Si no tiene ninguno, no se pinta el bloque. */}
      {loadingCustomFields ? <span className="gafa-skeleton gafa-acct__boot-bar" /> : null}
      {customFieldGroups.map((group) =>
        group.fields.length ? (
          <fieldset className="gafa-acct-fieldset" key={group.id}>
            <legend>{group.name}</legend>
            {group.description ? <p className="gafa-acct-form__since">{group.description}</p> : null}
            {group.fields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={{ ...field, required: false }}
                name={`profile-cf-${group.id}-${field.id}`}
                value={customValueFor(group.id, field.id)}
                onChange={(value) => setCustomValue(group.id, field.id, value)}
              />
            ))}
          </fieldset>
        ) : null,
      )}

      {error ? <p className="gafa-sdk-state gafa-sdk-state--error">{error}</p> : null}
      {success ? <p className="gafa-sdk-state gafa-sdk-state--success">Listo, guardamos tus datos.</p> : null}

      <div className="gafa-acct-form__actions">
        <button className="gafa-sdk-button" type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function PasswordForm({
  saving,
  error,
  success,
  unsupported,
  onSave,
}: {
  saving: boolean;
  error?: string;
  success: boolean;
  unsupported: boolean;
  onSave(payload: UpdateProfilePayload): void;
}) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [localError, setLocalError] = useState<string>();

  if (unsupported) return <p className="gafa-acct-empty">Cambiar contraseña no está disponible en este sitio.</p>;

  return (
    <form
      className="gafa-sdk-form gafa-acct-form gafa-acct-form--narrow"
      onSubmit={(event) => {
        event.preventDefault();
        if (password.length < 5) {
          setLocalError("Usa al menos 5 caracteres.");
          return;
        }
        if (password !== passwordConfirmation) {
          setLocalError("Las contraseñas no coinciden.");
          return;
        }
        setLocalError(undefined);
        onSave({ password, passwordConfirmation });
      }}
    >
      <div className="gafa-field-row">
        <label className="gafa-float">
          <input
            placeholder=" "
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={5}
          />
          <span>Nueva contraseña</span>
        </label>
        <label className="gafa-float">
          <input
            placeholder=" "
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
          />
          <span>Confirmar contraseña</span>
        </label>
      </div>

      {localError || error ? <p className="gafa-sdk-state gafa-sdk-state--error">{localError || error}</p> : null}
      {success && !localError ? <p className="gafa-sdk-state gafa-sdk-state--success">Contraseña actualizada.</p> : null}

      <div className="gafa-acct-form__actions">
        <button className="gafa-sdk-button" type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </form>
  );
}

function QrModal({ reservation, onClose }: { reservation: UserReservation; onClose(): void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(
    reservation.qrHash!,
  )}`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="gafa-acct-qr-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="gafa-acct-qr" role="dialog" aria-modal="true" aria-label="Código QR de tu clase">
        <p className="gafa-eyebrow">Muestra este código en recepción</p>
        <h3>{reservation.serviceName}</h3>
        <p className="gafa-acct-qr__when">
          {capitalize(formatWeekday(reservation.startsAt, reservation.timezone))} ·{" "}
          {formatTime(reservation.startsAt, reservation.timezone)}
        </p>
        <img className="gafa-acct-qr__image" src={qrUrl} alt="Código QR de la reserva" />
        {reservation.seatLabel ? <p className="gafa-acct-qr__seat">Lugar {reservation.seatLabel}</p> : null}
        <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function Avatar({ profile }: { profile: UserProfile }) {
  if (profile.photoUrl) {
    return (
      <RemoteImage
        className="gafa-acct__avatar"
        src={profile.photoUrl}
        size={56}
        gravity="face"
        whenUnavailable="original"
        alt=""
      />
    );
  }
  return (
    <span className="gafa-acct__avatar gafa-acct__avatar--initials" aria-hidden="true">
      {initials(profile)}
    </span>
  );
}

/* -------------------------------------------------------------------- iconos */

function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h4l2.5-7 5 14L17 12h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 8v8" stroke="currentColor" strokeWidth="1.7" strokeDasharray="2 3" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21V3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 8 6 12l4 4M6 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M16.5 14.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function InfinityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 9a3 3 0 1 0 0 6c2.5 0 4-6 7-6a3 3 0 1 1 0 6c-3 0-4.5-6-7-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ helpers */

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function toDate(value: string): Date | null {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayName(profile: UserProfile): string {
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return full || profile.name || profile.email;
}

function firstNameOf(profile: UserProfile): string {
  return profile.firstName || displayName(profile).split(/\s+/)[0] || "hola";
}

function attendanceRate(totals: UserActivityTotals): number {
  if (!totals.reservedCount) return 0;
  return Math.min(100, Math.round((totals.attendedCount / totals.reservedCount) * 100));
}

function attendanceNote(totals: UserActivityTotals): string {
  const rate = attendanceRate(totals);
  if (rate >= 90) return "Impecable: casi no fallas a una clase.";
  if (rate >= 70) return "Vas bien, sigue así.";
  if (rate >= 40) return "Hay margen para no perderte tus reservas.";
  return "Reserva solo lo que vas a tomar y este número sube solo.";
}

/** "Faltan 3 días" / "En 2 h" / "¡Es en un rato!" para la proxima clase. */
function countdownLabel(value: string): string {
  const date = toDate(value);
  if (!date) return "";
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "¡Está por empezar!";

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `Faltan ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "Falta 1 hora" : `Faltan ${hours} horas`;

  const days = Math.round(hours / 24);
  return days === 1 ? "Falta 1 día" : `Faltan ${days} días`;
}

function initials(profile: UserProfile): string {
  const source = displayName(profile);
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  return letters.join("").toUpperCase() || source.slice(0, 2).toUpperCase();
}

function describeReservation(reservation: UserReservation): string {
  return (
    [
      reservation.staffName,
      reservation.locationName,
      reservation.seatLabel ? `Lugar ${reservation.seatLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Sin detalles"
  );
}

/**
 * Las clases se cuentan en la hora de la SEDE. Fitspin vende Cancún (UTC-5) y
 * CDMX (UTC-6) en la misma cuenta: sin `timeZone` el navegador pintaba las de
 * Cancún una hora antes de la real.
 */
function dateParts(value: string, timeZone?: string) {
  const date = toDate(value);
  if (!date) return null;
  const options: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};
  return { date, options };
}

function formatTime(value: string, timeZone?: string): string {
  const parts = dateParts(value, timeZone);
  if (!parts) return value;
  return parts.date.toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    ...parts.options,
  });
}

function formatWeekdayShort(value: string, timeZone?: string): string {
  const parts = dateParts(value, timeZone);
  if (!parts) return value;
  return parts.date.toLocaleDateString("es-MX", { weekday: "long", ...parts.options });
}

function formatWeekday(value: string, timeZone?: string): string {
  const parts = dateParts(value, timeZone);
  if (!parts) return value;
  return parts.date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...parts.options,
  });
}

function formatDayNumber(value: string, timeZone?: string): string {
  const parts = dateParts(value, timeZone);
  if (!parts) return "–";
  return parts.date.toLocaleDateString("es-MX", { day: "numeric", ...parts.options });
}

function formatMonthShort(value: string, timeZone?: string): string {
  const parts = dateParts(value, timeZone);
  if (!parts) return "";
  return parts.date.toLocaleDateString("es-MX", { month: "short", ...parts.options }).replace(".", "");
}

function relativeDayLabel(value: string, timeZone?: string): string {
  const parts = dateParts(value, timeZone);
  if (!parts) return value;
  // "Hoy"/"Mañana" se comparan por el día en la zona de la sede, no por epoch.
  const dayKey = (input: Date) =>
    input.toLocaleDateString("en-CA", timeZone ? { timeZone } : undefined);
  const today = new Date();
  if (dayKey(parts.date) === dayKey(today)) return "Hoy";
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (dayKey(parts.date) === dayKey(tomorrow)) return "Mañana";
  return capitalize(
    parts.date.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...parts.options,
    }),
  );
}

function loyaltyLabel(eventName: string): string {
  const labels: Record<string, string> = {
    "auth.registered": "por registrarte",
    "auth.login_succeeded": "por entrar hoy",
    "reservation.confirmed": "por reservar",
    "reservation.waitlisted": "por lista de espera",
    "reservation.cancelled": "por cancelar",
    "checkout.paid": "por comprar",
    "admin.grant": "ajuste del estudio",
  };
  return labels[eventName] ?? eventName.replace(/[._]/g, " ");
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = toDate(value);
  if (!date) return value;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function expirationLabel(value?: string): string {
  const formatted = formatDate(value);
  return formatted ? `Vence el ${formatted}` : "Sin vencimiento";
}

function formatAmount(total: number): string {
  return total.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatWallet(value?: string): string {
  if (value == null || value === "") return "$0";
  if (String(value).trim().startsWith("$")) return String(value);
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return `$${formatAmount(numeric)}`;
  return String(value);
}

function formatMinutes(minutes: number): string {
  if (!minutes) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Algo salió mal. Vuelve a intentarlo.";
}

function normalizeGender(value?: string | null): "male" | "female" | "other" {
  const v = (value || "").toLowerCase();
  if (v === "male" || v === "m" || v === "hombre" || v === "h") return "male";
  if (v === "female" || v === "f" || v === "mujer") return "female";
  return "other";
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GafaClient,
  UpdateProfilePayload,
  UserCredit,
  UserMembership,
  UserPurchase,
  UserReservation,
} from "../client/types";
import { subscribeToAuthChanges } from "../client/tokenStorage";
import { WidgetShell } from "./WidgetShell";

export type ProfileWidgetProps = {
  client?: GafaClient;
  brandSlug?: string;
  combineWaitlist?: boolean;
};

type ProfileTab = "classes" | "balance" | "purchases" | "activity" | "profile" | "password";

export function ProfileWidget({ client, brandSlug, combineWaitlist = false }: ProfileWidgetProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProfileTab>("classes");
  const [qrReservation, setQrReservation] = useState<UserReservation | null>(null);

  useEffect(
    () => subscribeToAuthChanges(() => queryClient.invalidateQueries({ queryKey: ["profile"] })),
    [queryClient],
  );

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => client!.getProfile(),
    enabled: Boolean(client),
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
      return dedupeById(batches.flat());
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

  const activityQuery = useQuery({
    queryKey: ["profile", "activity"],
    queryFn: () => client!.getUserActivityTotals!(),
    enabled: Boolean(client?.getUserActivityTotals) && isSignedIn && tab === "activity",
  });

  const cancelMutation = useMutation({
    mutationFn: (reservation: UserReservation) =>
      reservation.isWaitlist && client?.cancelWaitlist
        ? client.cancelWaitlist(reservation.brandSlug, reservation.id)
        : client!.cancelReservation(reservation.brandSlug, reservation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "activity"] });
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

  if (profileQuery.isLoading) {
    return (
      <WidgetShell eyebrow="Perfil" title="Tu cuenta">
        <p className="gafa-sdk-state">Cargando tu perfil...</p>
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
  const firstName = profile.firstName || profile.name.split(" ")[0] || "hola";

  return (
    <section className="gafa-profile">
      <header className="gafa-profile__hero">
        <div className="gafa-profile__identity">
          {profile.photoUrl ? <img className="gafa-profile__avatar" src={profile.photoUrl} alt="" /> : null}
          <div>
            <p className="gafa-eyebrow">Tu cuenta</p>
            <h2>¡Hola {firstName}!</h2>
            <p className="gafa-muted">{profile.email}</p>
          </div>
        </div>
        <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button" onClick={() => client?.logout()}>
          Cerrar sesión
        </button>
      </header>

      <ProfileSummary
        credits={creditsQuery.data ?? []}
        memberships={membershipsQuery.data ?? []}
        storeCredit={profile.storeCreditTotal}
        loading={creditsQuery.isLoading || membershipsQuery.isLoading}
      />

      <nav className="gafa-profile__tabs" role="tablist" aria-label="Secciones del perfil">
        {(
          [
            ["classes", "Clases"],
            ["balance", "Créditos"],
            ["purchases", "Compras"],
            ["activity", "Actividad"],
            ["profile", "Mi perfil"],
            ["password", "Contraseña"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="gafa-profile__panel">
        {tab === "classes" ? (
          <ClassesPanel
            upcoming={upcoming}
            waitlist={combineWaitlist ? [] : waitlist}
            cancelled={cancelledUpcoming}
            history={pastQuery.data ?? []}
            loadingFuture={futureQuery.isLoading}
            loadingPast={pastQuery.isLoading}
            errorFuture={futureQuery.isError}
            errorPast={pastQuery.isError}
            cancelPendingId={cancelMutation.isPending ? cancelMutation.variables?.id : undefined}
            onCancel={(reservation) => {
              if (window.confirm(reservation.isWaitlist ? "¿Salir de la lista de espera?" : "¿Cancelar esta clase?")) {
                cancelMutation.mutate(reservation);
              }
            }}
            onShowQr={setQrReservation}
          />
        ) : null}

        {tab === "balance" ? (
          <BalancePanel
            credits={creditsQuery.data ?? []}
            memberships={membershipsQuery.data ?? []}
            storeCredit={profile.storeCreditTotal}
            loading={creditsQuery.isLoading || membershipsQuery.isLoading}
            error={creditsQuery.isError || membershipsQuery.isError}
          />
        ) : null}

        {tab === "purchases" ? (
          <PurchasesPanel
            purchases={purchasesQuery.data ?? []}
            loading={purchasesQuery.isLoading}
            error={purchasesQuery.isError}
          />
        ) : null}

        {tab === "activity" ? (
          <ActivityPanel
            loading={activityQuery.isLoading}
            error={activityQuery.isError}
            totals={activityQuery.data}
            unsupported={!client?.getUserActivityTotals}
          />
        ) : null}

        {tab === "profile" ? (
          <ProfileForm
            profile={profile}
            saving={saveProfileMutation.isPending}
            error={saveProfileMutation.isError ? String(saveProfileMutation.error) : undefined}
            success={saveProfileMutation.isSuccess}
            unsupported={!client?.updateProfile}
            onSave={(payload) => saveProfileMutation.mutate(payload)}
          />
        ) : null}

        {tab === "password" ? (
          <PasswordForm
            saving={saveProfileMutation.isPending}
            error={saveProfileMutation.isError ? String(saveProfileMutation.error) : undefined}
            success={saveProfileMutation.isSuccess}
            unsupported={!client?.updateProfile}
            onSave={(payload) => saveProfileMutation.mutate(payload)}
          />
        ) : null}

        {cancelMutation.isError ? (
          <p className="gafa-sdk-state gafa-sdk-state--error">
            {cancelMutation.error instanceof Error ? cancelMutation.error.message : "No pudimos cancelar."}
          </p>
        ) : null}
      </div>

      {qrReservation ? <QrModal reservation={qrReservation} onClose={() => setQrReservation(null)} /> : null}
    </section>
  );
}

function ProfileSummary({
  credits,
  memberships,
  storeCredit,
  loading,
}: {
  credits: UserCredit[];
  memberships: UserMembership[];
  storeCredit?: string;
  loading: boolean;
}) {
  if (loading) {
    return <p className="gafa-sdk-state gafa-profile__summary-loading">Cargando tu saldo…</p>;
  }

  const hasBalance = credits.length > 0 || memberships.length > 0 || storeCredit != null;

  return (
    <div className="gafa-profile__summary" aria-label="Resumen de saldo">
      {credits.map((credit) => (
        <div className="gafa-profile__pill" key={`c-${credit.id}`}>
          <strong className="gafa-profile__pill-count">{credit.total}</strong>
          <div>
            <span className="gafa-profile__pill-name">{credit.name}</span>
            <span className="gafa-muted">{expirationLabel(credit.expiresAt)}</span>
          </div>
        </div>
      ))}
      {memberships.map((membership) => (
        <div className="gafa-profile__pill" key={`m-${membership.id}`}>
          <strong className="gafa-profile__pill-badge">∞</strong>
          <div>
            <span className="gafa-profile__pill-name">{membership.name}</span>
            <span className="gafa-muted">{expirationLabel(membership.expiresAt)}</span>
          </div>
        </div>
      ))}
      <div className="gafa-profile__pill gafa-profile__pill--wallet">
        <div>
          <span className="gafa-profile__pill-name">Crédito en tienda</span>
          <strong>{formatWallet(storeCredit)}</strong>
        </div>
      </div>
      {!hasBalance ? <p className="gafa-muted">Sin paquetes ni membresías activos.</p> : null}
    </div>
  );
}

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
  onCancel,
  onShowQr,
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
  onCancel(reservation: UserReservation): void;
  onShowQr(reservation: UserReservation): void;
}) {
  return (
    <div className="gafa-profile__classes">
      <ClassSection
        title="Próximas clases"
        loading={loadingFuture}
        error={errorFuture}
        empty="No tienes clases próximas."
      >
        {upcoming.map((reservation) => (
          <ReservationRow
            key={`up-${reservation.id}`}
            reservation={reservation}
            cancelPending={cancelPendingId === reservation.id}
            onCancel={onCancel}
            onShowQr={onShowQr}
          />
        ))}
      </ClassSection>

      <ClassSection
        title="Lista de espera"
        loading={loadingFuture}
        error={errorFuture}
        empty="No estás en ninguna lista de espera."
      >
        {waitlist.map((reservation) => (
          <ReservationRow
            key={`wl-${reservation.id}`}
            reservation={reservation}
            cancelPending={cancelPendingId === reservation.id}
            onCancel={onCancel}
          />
        ))}
      </ClassSection>

      {cancelled.length > 0 ? (
        <ClassSection title="Canceladas (próximas)" empty="">
          {cancelled.map((reservation) => (
            <ReservationRow key={`cx-${reservation.id}`} reservation={reservation} />
          ))}
        </ClassSection>
      ) : null}

      <ClassSection
        title="Historial"
        loading={loadingPast}
        error={errorPast}
        empty="Aún no hay clases en tu historial."
      >
        {history.map((reservation) => (
          <ReservationRow key={`past-${reservation.id}`} reservation={reservation} historic />
        ))}
      </ClassSection>
    </div>
  );
}

function ClassSection({
  title,
  loading,
  error,
  empty,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  return (
    <section className="gafa-profile__section">
      <h3>{title}</h3>
      {loading ? <p className="gafa-sdk-state">Cargando...</p> : null}
      {error ? <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar esta sección.</p> : null}
      {!loading && !error && items.length === 0 && empty ? <p className="gafa-sdk-state">{empty}</p> : null}
      {!loading && !error && items.length > 0 ? <div className="gafa-profile-list">{children}</div> : null}
    </section>
  );
}

function ReservationRow({
  reservation,
  historic = false,
  cancelPending,
  onCancel,
  onShowQr,
}: {
  reservation: UserReservation;
  historic?: boolean;
  cancelPending?: boolean;
  onCancel?(reservation: UserReservation): void;
  onShowQr?(reservation: UserReservation): void;
}) {
  return (
    <article className="gafa-profile-item" data-cancelled={reservation.cancelled ? "true" : undefined}>
      <div>
        <h4>{reservation.serviceName}</h4>
        <p className="gafa-profile-item-time">{formatDateTime(reservation.startsAt)}</p>
        <p className="gafa-muted">
          {[reservation.staffName, reservation.locationName, reservation.seatLabel ? `Lugar ${reservation.seatLabel}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="gafa-profile-tags">
          {reservation.isWaitlist ? (
            <span className="gafa-meeting-chip">
              Lista de espera{reservation.waitlistPosition ? ` #${reservation.waitlistPosition}` : ""}
            </span>
          ) : null}
          {reservation.isOverbooking ? <span className="gafa-meeting-chip">Sobrecupo</span> : null}
          {reservation.cancelled ? <span className="gafa-meeting-chip">Cancelada</span> : null}
          {reservation.creditName ? <span className="gafa-meeting-chip">{reservation.creditName}</span> : null}
          {!reservation.creditName && !reservation.isWaitlist ? (
            <span className="gafa-meeting-chip">Membresía</span>
          ) : null}
        </div>
      </div>

      {!historic && !reservation.cancelled ? (
        <div className="gafa-profile-item__actions">
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
              {cancelPending ? "Cancelando…" : reservation.isWaitlist ? "Salir" : "Cancelar"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function BalancePanel({
  credits,
  memberships,
  storeCredit,
  loading,
  error,
}: {
  credits: UserCredit[];
  memberships: UserMembership[];
  storeCredit?: string;
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <p className="gafa-sdk-state">Cargando...</p>;
  if (error) return <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar esta sección.</p>;
  if (!credits.length && !memberships.length) {
    return <p className="gafa-sdk-state">No tienes créditos ni membresías activos.</p>;
  }

  return (
    <div className="gafa-profile-list">
      {credits.map((credit) => (
        <article className="gafa-profile-item" key={`credit-${credit.id}`}>
          <div>
            <h4>{credit.name}</h4>
            <p className="gafa-muted">{expirationLabel(credit.expiresAt)}</p>
          </div>
          <strong className="gafa-profile-amount">{credit.total}</strong>
        </article>
      ))}
      {memberships.map((membership) => (
        <article className="gafa-profile-item" key={`membership-${membership.id}`}>
          <div>
            <h4>{membership.name}</h4>
            <p className="gafa-muted">{expirationLabel(membership.expiresAt)}</p>
          </div>
          <span className="gafa-meeting-chip">Membresía</span>
        </article>
      ))}
      <article className="gafa-profile-item">
        <div>
          <h4>Crédito en tienda</h4>
          <p className="gafa-muted">Wallet disponible para compras</p>
        </div>
        <strong className="gafa-profile-amount">{formatWallet(storeCredit)}</strong>
      </article>
    </div>
  );
}

function PurchasesPanel({
  purchases,
  loading,
  error,
}: {
  purchases: UserPurchase[];
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <p className="gafa-sdk-state">Cargando...</p>;
  if (error) return <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar esta sección.</p>;
  if (!purchases.length) return <p className="gafa-sdk-state">Todavía no tienes compras.</p>;

  return (
    <div className="gafa-profile-list">
      {purchases.map((purchase) => (
        <article className="gafa-profile-item" key={`purchase-${purchase.id}`}>
          <div>
            <h4>{purchase.name}</h4>
            <p className="gafa-muted">
              {[formatDate(purchase.createdAt), purchase.locationName, purchase.status, purchase.paymentType]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <strong className="gafa-profile-amount">
            {purchase.currencyPrefix ?? "$"}
            {formatAmount(purchase.total)}
          </strong>
        </article>
      ))}
    </div>
  );
}

function ActivityPanel({
  loading,
  error,
  totals,
  unsupported,
}: {
  loading: boolean;
  error: boolean;
  totals?: {
    reservedCount: number;
    attendedCount: number;
    noShowCount: number;
    cancelledCount: number;
    attendedMinutes: number;
    favoriteStaff: string[];
    favoriteSchedules: string[];
  };
  unsupported: boolean;
}) {
  if (unsupported) return <p className="gafa-sdk-state">La actividad no está disponible en este cliente.</p>;
  if (loading) return <p className="gafa-sdk-state">Cargando...</p>;
  if (error) return <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar tu actividad.</p>;
  if (!totals) return null;

  const stats = [
    { label: "Clases reservadas", value: totals.reservedCount },
    { label: "Clases asistidas", value: totals.attendedCount },
    { label: "No show", value: totals.noShowCount },
    { label: "Canceladas", value: totals.cancelledCount },
    { label: "Minutos asistidos", value: totals.attendedMinutes },
  ];

  return (
    <div className="gafa-profile__activity">
      <div className="gafa-profile__stats">
        {stats.map((stat) => (
          <div className="gafa-profile__stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
      <div className="gafa-profile__favorites">
        <div>
          <h4>Instructores favoritos</h4>
          <p className="gafa-muted">
            {totals.favoriteStaff.length ? totals.favoriteStaff.join(", ") : "Aún sin favoritos"}
          </p>
        </div>
        <div>
          <h4>Horarios favoritos</h4>
          <p className="gafa-muted">
            {totals.favoriteSchedules.length ? totals.favoriteSchedules.join(", ") : "Aún sin favoritos"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileForm({
  profile,
  saving,
  error,
  success,
  unsupported,
  onSave,
}: {
  profile: {
    firstName?: string;
    lastName?: string;
    email: string;
    birthDate?: string | null;
    gender?: string | null;
    phone?: string | null;
    address?: string | null;
    externalNumber?: string | null;
    internalNumber?: string | null;
    postalCode?: string | null;
    municipality?: string | null;
    city?: string | null;
    memberSince?: string;
  };
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

  if (unsupported) return <p className="gafa-sdk-state">Editar perfil no está disponible en este cliente.</p>;

  return (
    <form
      className="gafa-sdk-form gafa-profile__form"
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
        });
      }}
    >
      {profile.memberSince ? (
        <p className="gafa-muted">Miembro desde {formatDate(profile.memberSince)}</p>
      ) : null}

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

      <label className="gafa-float">
        <input placeholder=" " type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <span>Email</span>
      </label>

      <div className="gafa-field-row">
        <label className="gafa-float">
          <input placeholder=" " type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <span>Teléfono</span>
        </label>
        <label className="gafa-float">
          <input placeholder=" " type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <span>Fecha de nacimiento</span>
        </label>
      </div>

      <fieldset className="gafa-profile__gender">
        <legend>Género</legend>
        {(
          [
            ["male", "Hombre"],
            ["female", "Mujer"],
            ["other", "Otro / sin especificar"],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="gender"
              checked={normalizeGender(gender) === value}
              onChange={() => setGender(value === "other" ? "" : value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <h4 className="gafa-profile__form-title">Dirección</h4>
      <label className="gafa-float">
        <input placeholder=" " value={address} onChange={(e) => setAddress(e.target.value)} />
        <span>Calle</span>
      </label>
      <div className="gafa-field-row">
        <label className="gafa-float">
          <input placeholder=" " value={externalNumber} onChange={(e) => setExternalNumber(e.target.value)} />
          <span>Exterior</span>
        </label>
        <label className="gafa-float">
          <input placeholder=" " value={internalNumber} onChange={(e) => setInternalNumber(e.target.value)} />
          <span>Interior</span>
        </label>
      </div>
      <div className="gafa-field-row">
        <label className="gafa-float">
          <input placeholder=" " value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          <span>C.P.</span>
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

      {error ? <p className="gafa-sdk-state gafa-sdk-state--error">{error}</p> : null}
      {success ? <p className="gafa-sdk-state gafa-sdk-state--success">Perfil guardado.</p> : null}

      <button className="gafa-sdk-button" type="submit" disabled={saving}>
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
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

  if (unsupported) return <p className="gafa-sdk-state">Cambiar contraseña no está disponible en este cliente.</p>;

  return (
    <form
      className="gafa-sdk-form gafa-profile__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (password.length < 5) {
          setLocalError("Mínimo 5 caracteres.");
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

      {localError || error ? (
        <p className="gafa-sdk-state gafa-sdk-state--error">{localError || error}</p>
      ) : null}
      {success && !localError ? (
        <p className="gafa-sdk-state gafa-sdk-state--success">Contraseña actualizada.</p>
      ) : null}

      <button className="gafa-sdk-button" type="submit" disabled={saving}>
        {saving ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}

function QrModal({ reservation, onClose }: { reservation: UserReservation; onClose(): void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(reservation.qrHash!)}`;

  return (
    <div className="gafa-reservation-overlay" role="dialog" aria-modal="true" aria-label="Código QR">
      <div className="gafa-reservation-sheet gafa-profile__qr-sheet">
        <button className="gafa-reservation-close" type="button" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
        <p className="gafa-eyebrow">Acceso a clase</p>
        <h2>{reservation.serviceName}</h2>
        <p className="gafa-muted">{formatDateTime(reservation.startsAt)}</p>
        <img className="gafa-profile__qr" src={qrUrl} alt="Código QR de la reserva" />
        {reservation.seatLabel ? <p className="gafa-profile__qr-seat">Lugar {reservation.seatLabel}</p> : null}
        <button className="gafa-sdk-button" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
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

function normalizeGender(value?: string | null): "male" | "female" | "other" {
  const v = (value || "").toLowerCase();
  if (v === "male" || v === "m" || v === "hombre" || v === "h") return "male";
  if (v === "female" || v === "f" || v === "mujer") return "female";
  return "other";
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GafaClient, UserReservation } from "../client/types";
import { subscribeToAuthChanges } from "../client/tokenStorage";
import { WidgetShell } from "./WidgetShell";

export type ProfileWidgetProps = {
  client?: GafaClient;
  brandSlug?: string;
  combineWaitlist?: boolean;
};

type ProfileTab = "reservations" | "balance" | "purchases";

export function ProfileWidget({ client, brandSlug, combineWaitlist = false }: ProfileWidgetProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProfileTab>("reservations");

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
    enabled: Boolean(client) && !brandSlug && Boolean(profileQuery.data),
  });

  const activeBrandSlug = brandSlug ?? brandsQuery.data?.[0]?.slug;
  const isSignedIn = Boolean(profileQuery.data);
  const canQueryBrandData = Boolean(client) && isSignedIn && Boolean(activeBrandSlug);

  const reservationsQuery = useQuery({
    queryKey: ["profile", "reservations", activeBrandSlug],
    queryFn: () => client!.listUserReservations(activeBrandSlug!, "future"),
    enabled: canQueryBrandData,
  });

  const creditsQuery = useQuery({
    queryKey: ["profile", "credits", activeBrandSlug],
    queryFn: () => client!.listUserCredits(activeBrandSlug!),
    enabled: canQueryBrandData,
  });

  const membershipsQuery = useQuery({
    queryKey: ["profile", "memberships", activeBrandSlug],
    queryFn: () => client!.listUserMemberships(activeBrandSlug!),
    enabled: canQueryBrandData,
  });

  const purchasesQuery = useQuery({
    queryKey: ["profile", "purchases", activeBrandSlug],
    queryFn: () => client!.listUserPurchases(activeBrandSlug!),
    enabled: canQueryBrandData && tab === "purchases",
  });

  const cancelMutation = useMutation({
    mutationFn: (reservation: UserReservation) => client!.cancelReservation(reservation.brandSlug, reservation.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", "reservations"] }),
  });

  const reservations = useMemo(
    () => (reservationsQuery.data ?? []).filter((item) => (item.isWaitlist ? combineWaitlist : true)),
    [combineWaitlist, reservationsQuery.data],
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
        description="Inicia sesion para ver tus reservas, creditos, membresias y compras."
      >
        <p className="gafa-sdk-state">Aun no has iniciado sesion.</p>
      </WidgetShell>
    );
  }

  const profile = profileQuery.data!;

  return (
    <WidgetShell
      eyebrow="Perfil"
      title={profile.name || "Tu cuenta"}
      description={profile.email}
      logoUrl={profile.photoUrl}
      actions={
        <button
          className="gafa-sdk-button gafa-sdk-button--secondary"
          type="button"
          onClick={() => client?.logout()}
        >
          Cerrar sesion
        </button>
      }
    >
      {profile.storeCreditTotal ? (
        <p className="gafa-profile-store-credit">
          Saldo en tienda <strong>{profile.storeCreditTotal}</strong>
        </p>
      ) : null}

      <div className="gafa-sdk-auth-tabs" role="tablist" aria-label="Secciones del perfil">
        <button type="button" aria-pressed={tab === "reservations"} onClick={() => setTab("reservations")}>
          Proximas
        </button>
        <button type="button" aria-pressed={tab === "balance"} onClick={() => setTab("balance")}>
          Creditos
        </button>
        <button type="button" aria-pressed={tab === "purchases"} onClick={() => setTab("purchases")}>
          Compras
        </button>
      </div>

      {tab === "reservations" ? (
        <ProfileList
          isLoading={reservationsQuery.isLoading}
          isError={reservationsQuery.isError}
          isEmpty={!reservations.length}
          emptyLabel="No tienes reservas proximas."
        >
          {reservations.map((reservation) => (
            <article className="gafa-sdk-panel gafa-profile-item" key={`${reservation.isWaitlist}-${reservation.id}`}>
              <div>
                <h3>{reservation.serviceName}</h3>
                <p className="gafa-profile-item-time">{formatDateTime(reservation.startsAt)}</p>
                <p className="gafa-muted">
                  {[reservation.staffName, reservation.locationName].filter(Boolean).join(" - ")}
                </p>
                <div className="gafa-profile-tags">
                  {reservation.isWaitlist ? (
                    <span className="gafa-meeting-chip">
                      Lista de espera{reservation.waitlistPosition ? ` #${reservation.waitlistPosition}` : ""}
                    </span>
                  ) : null}
                  {reservation.isOverbooking ? <span className="gafa-meeting-chip">Sobrecupo</span> : null}
                  <span className="gafa-meeting-chip">{reservation.creditName ?? "Membresia"}</span>
                </div>
              </div>
              {!reservation.isWaitlist ? (
                <button
                  className="gafa-sdk-button gafa-sdk-button--secondary"
                  type="button"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(reservation)}
                >
                  {cancelMutation.isPending && cancelMutation.variables?.id === reservation.id
                    ? "Cancelando..."
                    : "Cancelar"}
                </button>
              ) : null}
            </article>
          ))}
        </ProfileList>
      ) : null}

      {tab === "balance" ? (
        <ProfileList
          isLoading={creditsQuery.isLoading || membershipsQuery.isLoading}
          isError={creditsQuery.isError || membershipsQuery.isError}
          isEmpty={!creditsQuery.data?.length && !membershipsQuery.data?.length}
          emptyLabel="No tienes creditos ni membresias activas."
        >
          {(creditsQuery.data ?? []).map((credit) => (
            <article className="gafa-sdk-panel gafa-profile-item" key={`credit-${credit.id}`}>
              <div>
                <h3>{credit.name}</h3>
                <p className="gafa-muted">{expirationLabel(credit.expiresAt)}</p>
              </div>
              <strong className="gafa-profile-amount">{credit.total}</strong>
            </article>
          ))}
          {(membershipsQuery.data ?? []).map((membership) => (
            <article className="gafa-sdk-panel gafa-profile-item" key={`membership-${membership.id}`}>
              <div>
                <h3>{membership.name}</h3>
                <p className="gafa-muted">{expirationLabel(membership.expiresAt)}</p>
              </div>
              <span className="gafa-meeting-chip">Membresia</span>
            </article>
          ))}
        </ProfileList>
      ) : null}

      {tab === "purchases" ? (
        <ProfileList
          isLoading={purchasesQuery.isLoading}
          isError={purchasesQuery.isError}
          isEmpty={!purchasesQuery.data?.length}
          emptyLabel="Todavia no tienes compras."
        >
          {(purchasesQuery.data ?? []).map((purchase) => (
            <article className="gafa-sdk-panel gafa-profile-item" key={`purchase-${purchase.id}`}>
              <div>
                <h3>{purchase.name}</h3>
                <p className="gafa-muted">{formatDate(purchase.createdAt)}</p>
              </div>
              <strong className="gafa-profile-amount">
                {purchase.currencyPrefix ?? "$"}
                {formatAmount(purchase.total)}
              </strong>
            </article>
          ))}
        </ProfileList>
      ) : null}

      {cancelMutation.isError ? (
        <p className="gafa-sdk-state gafa-sdk-state--error">
          {cancelMutation.error instanceof Error ? cancelMutation.error.message : "No pudimos cancelar la reserva."}
        </p>
      ) : null}
    </WidgetShell>
  );
}

function ProfileList({
  isLoading,
  isError,
  isEmpty,
  emptyLabel,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (isLoading) return <p className="gafa-sdk-state">Cargando...</p>;
  if (isError) return <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar esta seccion.</p>;
  if (isEmpty) return <p className="gafa-sdk-state">{emptyLabel}</p>;

  return <div className="gafa-profile-list">{children}</div>;
}

function formatDateTime(value: string): string {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
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
  return formatted ? `Vence el ${formatted}` : "Sin fecha de vencimiento";
}

function formatAmount(total: number): string {
  return total.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

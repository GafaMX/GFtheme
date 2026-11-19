import { normalizeClassRating, type ClassRating } from "./classRatings";

export const DEFAULT_HUB_URL = "https://hub.buq.partners";

export type HubRatingSubmitInput = {
  companyId: number;
  brandSlug: string;
  brandId?: number;
  reservationId: number;
  meetingId?: number;
  meetingName?: string;
  staffId?: number;
  staffName?: string;
  userId: number;
  customerName?: string;
  customerEmail?: string;
  classStars?: number | null;
  staffStars?: number | null;
  comment?: string;
};

function hubBase(hubUrl: string | undefined | null): string {
  const raw = (hubUrl || DEFAULT_HUB_URL).trim();
  return raw.replace(/\/+$/, "") || DEFAULT_HUB_URL;
}

export function hubRatingsCreateUrl(hubUrl?: string | null): string {
  return `${hubBase(hubUrl)}/v1/ratings`;
}

export function hubRatingsMineUrl(
  hubUrl: string | undefined | null,
  input: { companyId: number; reservationId: number; userId: number },
): string {
  const params = new URLSearchParams({
    company_id: String(input.companyId),
    reservation_id: String(input.reservationId),
    user_id: String(input.userId),
  });
  return `${hubBase(hubUrl)}/v1/ratings/mine?${params}`;
}

export async function fetchHubReservationRating(input: {
  hubUrl?: string | null;
  companyId: number;
  reservationId: number;
  userId: number;
  fetchImpl?: typeof fetch;
}): Promise<ClassRating | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = hubRatingsMineUrl(input.hubUrl, input);
  const response = await fetchImpl(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (response.status === 429) {
    throw Object.assign(new Error("Demasiados intentos. Espera un momento."), { status: 429 });
  }
  if (response.status === 503) {
    throw Object.assign(new Error("El estudio aún no puede guardar calificaciones."), { status: 503 });
  }
  if (!response.ok) {
    throw Object.assign(new Error("No pudimos leer tu calificación."), { status: response.status });
  }
  const data = (await response.json()) as { rating?: unknown };
  return normalizeClassRating(data.rating ?? data, input.reservationId);
}

export async function submitHubReservationRating(input: {
  hubUrl?: string | null;
  payload: HubRatingSubmitInput;
  fetchImpl?: typeof fetch;
}): Promise<ClassRating> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = hubRatingsCreateUrl(input.hubUrl);
  const body = {
    company_id: input.payload.companyId,
    brand_slug: input.payload.brandSlug,
    brand_id: input.payload.brandId,
    reservation_id: input.payload.reservationId,
    meeting_id: input.payload.meetingId,
    meeting_name: input.payload.meetingName,
    staff_id: input.payload.staffId,
    staff_name: input.payload.staffName,
    user_id: input.payload.userId,
    customer_name: input.payload.customerName,
    customer_email: input.payload.customerEmail,
    class_stars: input.payload.classStars ?? null,
    staff_stars: input.payload.staffStars ?? null,
    comment: input.payload.comment ?? null,
  };
  const response = await fetchImpl(url, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw Object.assign(new Error(messageForHubStatus(response.status, await readHubError(response))), {
      status: response.status,
    });
  }
  const data = (await response.json()) as { rating?: unknown };
  return (
    normalizeClassRating(data.rating ?? data, input.payload.reservationId) ?? {
      reservationId: input.payload.reservationId,
      meetingId: input.payload.meetingId,
      staffId: input.payload.staffId,
      classStars: input.payload.classStars,
      staffStars: input.payload.staffStars,
      comment: input.payload.comment ?? null,
      submittedAt: new Date().toISOString(),
    }
  );
}

function messageForHubStatus(status: number, serverMessage?: string): string {
  if (status === 401) return "Inicia sesión para calificar.";
  if (status === 403) return "El estudio no acepta calificaciones.";
  if (status === 409) return "Ya calificaste esta clase.";
  if (status === 422) return serverMessage || "Revisa las estrellas o el comentario.";
  if (status === 429) return "Demasiados intentos. Espera un momento.";
  if (status === 503) return "El estudio aún no puede guardar calificaciones.";
  return serverMessage || "No pudimos guardar tu calificación. Inténtalo de nuevo.";
}

async function readHubError(response: Response): Promise<string | undefined> {
  try {
    const data = (await response.json()) as { error?: string; errors?: Record<string, string[]> };
    const first = data.errors ? Object.values(data.errors).flat()[0] : undefined;
    if (typeof first === "string" && first.trim()) return first;
    if (data.error === "ratings_disabled") return "El estudio no acepta calificaciones.";
    if (data.error === "already_rated") return "Ya calificaste esta clase.";
    if (data.error === "rate_limited") return "Demasiados intentos. Espera un momento.";
  } catch {
    return undefined;
  }
  return undefined;
}

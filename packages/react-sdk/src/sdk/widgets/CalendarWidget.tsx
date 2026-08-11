import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WidgetShell } from "./WidgetShell";
import { FancyOverlay } from "./FancyOverlay";
import type { Brand, GafaClient, Location, Meeting, Service, StaffMember } from "../client/types";
import {
  addDays,
  daysInRange,
  fetchRangeFor,
  isToday,
  matchesTimeOfDay,
  parseIsoDate,
  rangeForView,
  shiftAnchor,
  toIsoDate,
  TIME_OF_DAY_LABELS,
  type CalendarView,
  type DateRange,
  type TimeOfDay,
} from "./calendarRange";

export type CalendarWidgetProps = {
  client?: GafaClient;
  limit?: number;
  filters?: {
    brand?: boolean | string;
    location?: boolean | string;
    service?: boolean | string;
    staff?: boolean | string;
    room?: boolean | string;
    brandId?: number;
    locationId?: number;
    serviceId?: number;
    staffId?: number;
  };
  /** Vista inicial. El usuario puede cambiarla si `allowViewChange` esta activo. */
  view?: CalendarView;
  allowViewChange?: boolean;
  showDescription?: boolean;
  title?: string;
  description?: string;
};

type CalendarFiltersState = {
  brandSlug?: string;
  locationId?: number;
  serviceId?: number;
  staffId?: number;
};

export function CalendarWidget({
  client,
  filters = {},
  limit,
  view: initialView = "week",
  allowViewChange = true,
  showDescription = false,
  title = "Reserva tu lugar",
  description,
}: CalendarWidgetProps) {
  const queryClient = useQueryClient();
  const [selectedFilters, setSelectedFilters] = useState<CalendarFiltersState>({});
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [fancyMeeting, setFancyMeeting] = useState<Meeting | null>(null);
  const [view, setView] = useState<CalendarView>(initialView);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("all");
  const [anchorIso, setAnchorIso] = useState(() => toIsoDate(new Date()));

  const anchor = useMemo(() => parseIsoDate(anchorIso), [anchorIso]);
  const range = useMemo(() => rangeForView(anchor, view), [anchor, view]);

  const brandsQuery = useQuery({
    queryKey: ["calendar", "brands"],
    queryFn: async () => (client ? client.listBrands() : demoBrands()),
  });

  const activeBrand = useMemo(
    () => findActiveBrand(brandsQuery.data ?? [], selectedFilters.brandSlug, filters.brandId),
    [brandsQuery.data, filters.brandId, selectedFilters.brandSlug],
  );

  const locationsQuery = useQuery({
    enabled: Boolean(activeBrand) || !client,
    queryKey: ["calendar", "locations", activeBrand?.slug],
    queryFn: async () => (client ? client.listLocations(activeBrand?.slug) : demoLocations()),
  });

  const activeLocation = useMemo(
    () => findActiveLocation(locationsQuery.data ?? [], selectedFilters.locationId, filters.locationId),
    [filters.locationId, locationsQuery.data, selectedFilters.locationId],
  );

  const servicesQuery = useQuery({
    enabled: Boolean(activeBrand) || !client,
    queryKey: ["calendar", "services", activeBrand?.slug],
    queryFn: async () => (client ? client.listServices(activeBrand?.slug) : demoServices()),
  });

  const staffQuery = useQuery({
    enabled: Boolean(activeBrand) || !client,
    queryKey: ["calendar", "staff", activeBrand?.slug],
    queryFn: async () => (client ? client.listStaff(activeBrand?.slug) : demoStaff()),
  });

  const locationId = activeLocation?.id;

  function meetingsQueryOptions(target: DateRange) {
    const fetchRange = fetchRangeFor(target);
    return {
      queryKey: ["calendar", "meetings", locationId, fetchRange.from, fetchRange.to],
      queryFn: async () =>
        client ? client.listMeetings({ locationId, from: fetchRange.from, to: fetchRange.to }) : demoMeetings(target),
    };
  }

  const meetingsQuery = useQuery({
    ...meetingsQueryOptions(range),
    enabled: Boolean(locationId) || !client,
    // Los horarios de una semana ya vista no cambian de un minuto a otro; mantenerlos
    // en cache es lo que hace que ir y volver entre semanas sea instantaneo.
    staleTime: 2 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  // La ventana siguiente se trae en segundo plano: cuando el usuario pulsa
  // "siguiente" casi siempre ya esta en cache y el cambio se siente inmediato.
  useEffect(() => {
    if (!client || !locationId) return;

    const next = rangeForView(shiftAnchor(anchor, view, 1), view);
    const previous = rangeForView(shiftAnchor(anchor, view, -1), view);

    [next, previous].forEach((target) => {
      queryClient.prefetchQuery({ ...meetingsQueryOptions(target), staleTime: 2 * 60 * 1000 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, view, locationId, client, queryClient]);

  const visibleMeetings = useMemo(() => {
    const meetings = applyLocalMeetingFilters(meetingsQuery.data ?? [], {
      serviceId: selectedFilters.serviceId ?? filters.serviceId,
      staffId: selectedFilters.staffId ?? filters.staffId,
    }).filter((meeting) => matchesTimeOfDay(getMeetingStart(meeting), timeOfDay));

    const sorted = [...meetings].sort((a, b) => getMeetingStart(a).localeCompare(getMeetingStart(b)));
    return limit ? sorted.slice(0, limit) : sorted;
  }, [
    filters.serviceId,
    filters.staffId,
    limit,
    meetingsQuery.data,
    selectedFilters.serviceId,
    selectedFilters.staffId,
    timeOfDay,
  ]);

  const days = useMemo(() => daysInRange(range), [range]);
  const meetingsByIsoDay = useMemo(() => {
    const groups = new Map<string, Meeting[]>();
    visibleMeetings.forEach((meeting) => {
      const key = toIsoDate(new Date(getMeetingStart(meeting).replace(" ", "T")));
      groups.set(key, [...(groups.get(key) ?? []), meeting]);
    });
    return groups;
  }, [visibleMeetings]);

  const isLoading = meetingsQuery.isLoading || locationsQuery.isLoading;
  const isRefreshing = meetingsQuery.isFetching && !meetingsQuery.isLoading;
  const hasError = brandsQuery.isError || locationsQuery.isError || meetingsQuery.isError;

  function handleReserve(meeting: Meeting) {
    if (!client || isSoldOut(meeting)) return;
    setSelectedMeeting(null);
    setFancyMeeting(meeting);
  }

  return (
    <WidgetShell
      eyebrow="Reservas"
      title={title}
      description={description}
      actions={
        allowViewChange ? (
          <div className="gafa-segmented" role="group" aria-label="Vista del calendario">
            <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>
              Día
            </button>
            <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>
              Semana
            </button>
          </div>
        ) : null
      }
    >
      <CalendarToolbar
        anchor={anchor}
        range={range}
        view={view}
        onPrev={() => setAnchorIso(toIsoDate(shiftAnchor(anchor, view, -1)))}
        onNext={() => setAnchorIso(toIsoDate(shiftAnchor(anchor, view, 1)))}
        onToday={() => setAnchorIso(toIsoDate(new Date()))}
        isRefreshing={isRefreshing}
      />

      <CalendarFilterBar
        activeBrandSlug={activeBrand?.slug}
        activeLocationId={activeLocation?.id}
        brands={brandsQuery.data ?? []}
        filters={filters}
        locations={locationsQuery.data ?? []}
        onChange={setSelectedFilters}
        selected={selectedFilters}
        services={servicesQuery.data ?? []}
        staff={staffQuery.data ?? []}
        timeOfDay={timeOfDay}
        onTimeOfDayChange={setTimeOfDay}
      />

      {hasError ? <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar el calendario.</p> : null}

      {isLoading ? (
        <CalendarSkeleton view={view} />
      ) : view === "day" ? (
        <DayColumn
          date={anchor}
          meetings={meetingsByIsoDay.get(toIsoDate(anchor)) ?? []}
          onSelect={setSelectedMeeting}
          showDescription={showDescription}
        />
      ) : (
        <div className="gafa-week-grid">
          {days.map((day) => (
            <DayColumn
              key={toIsoDate(day)}
              compact
              date={day}
              meetings={meetingsByIsoDay.get(toIsoDate(day)) ?? []}
              onSelect={setSelectedMeeting}
              showDescription={showDescription}
            />
          ))}
        </div>
      )}

      {selectedMeeting ? (
        <ReservationPreviewModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          onContinue={() => handleReserve(selectedMeeting)}
        />
      ) : null}

      {fancyMeeting && client ? (
        <FancyOverlay
          key={fancyMeeting.id}
          title={fancyMeeting.name}
          description="Termina tu reserva: inicia sesion si falta y usa un credito o compra uno nuevo."
          run={() =>
            client.openReservationCheckout({
              meetingId: fancyMeeting.id,
              brandSlug: getMeetingBrandSlug(fancyMeeting, activeBrand),
              locationSlug: getMeetingLocationSlug(fancyMeeting, activeLocation),
              targetSelector: '[data-gf-theme="fancy"]',
            })
          }
          onClose={() => setFancyMeeting(null)}
        />
      ) : null}
    </WidgetShell>
  );
}

function CalendarToolbar({
  anchor,
  range,
  view,
  onPrev,
  onNext,
  onToday,
  isRefreshing,
}: {
  anchor: Date;
  range: DateRange;
  view: CalendarView;
  onPrev(): void;
  onNext(): void;
  onToday(): void;
  isRefreshing: boolean;
}) {
  const label =
    view === "day"
      ? new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(anchor)
      : formatRangeLabel(range);

  return (
    <div className="gafa-calendar-toolbar">
      <button className="gafa-icon-button" type="button" onClick={onPrev} aria-label="Anterior">
        ‹
      </button>
      <div className="gafa-calendar-toolbar__label">
        <strong>{label}</strong>
        {isRefreshing ? <span className="gafa-calendar-toolbar__hint">actualizando…</span> : null}
      </div>
      <button className="gafa-icon-button" type="button" onClick={onNext} aria-label="Siguiente">
        ›
      </button>
      <button className="gafa-sdk-button gafa-sdk-button--secondary gafa-calendar-today" type="button" onClick={onToday}>
        Hoy
      </button>
    </div>
  );
}

function DayColumn({
  date,
  meetings,
  onSelect,
  compact = false,
  showDescription = false,
}: {
  date: Date;
  meetings: Meeting[];
  onSelect(meeting: Meeting): void;
  compact?: boolean;
  showDescription?: boolean;
}) {
  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: compact ? "short" : "long" }).format(date);

  return (
    <section className="gafa-day-column" data-today={isToday(date) ? "true" : undefined}>
      <header className="gafa-day-column__header">
        <span className="gafa-day-column__weekday">{weekday}</span>
        <span className="gafa-day-column__number">{date.getDate()}</span>
      </header>

      {meetings.length === 0 ? (
        <p className="gafa-day-column__empty">Sin clases</p>
      ) : (
        <div className="gafa-day-column__list">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              compact={compact}
              meeting={meeting}
              onSelect={onSelect}
              showDescription={showDescription}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MeetingCard({
  meeting,
  onSelect,
  compact,
  showDescription,
}: {
  meeting: Meeting;
  onSelect(meeting: Meeting): void;
  compact: boolean;
  showDescription: boolean;
}) {
  const soldOut = isSoldOut(meeting);

  return (
    <button
      className="gafa-meeting-card"
      data-sold-out={soldOut ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
      type="button"
      onClick={() => onSelect(meeting)}
    >
      <span className="gafa-meeting-time">{formatTime(getMeetingStart(meeting), meeting.timezone)}</span>
      <span className="gafa-meeting-name">{meeting.service?.name ?? meeting.serviceName ?? meeting.name}</span>
      <span className="gafa-meeting-staff">{getStaffName(meeting)}</span>
      {showDescription && meeting.description ? <span className="gafa-meeting-desc">{meeting.description}</span> : null}
      <AvailabilityPill meeting={meeting} />
    </button>
  );
}

function CalendarSkeleton({ view }: { view: CalendarView }) {
  const columns = view === "week" ? 7 : 1;

  return (
    <div className={view === "week" ? "gafa-week-grid" : ""} aria-hidden="true">
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <section className="gafa-day-column" key={columnIndex}>
          <header className="gafa-day-column__header">
            <span className="gafa-skeleton gafa-skeleton--line" style={{ width: "60%" }} />
          </header>
          <div className="gafa-day-column__list">
            {Array.from({ length: view === "week" ? 3 : 6 }).map((__, cardIndex) => (
              <span className="gafa-skeleton gafa-skeleton--card" key={cardIndex} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CalendarFilterBar({
  activeBrandSlug,
  activeLocationId,
  brands,
  filters,
  locations,
  onChange,
  selected,
  services,
  staff,
  timeOfDay,
  onTimeOfDayChange,
}: {
  activeBrandSlug?: string;
  activeLocationId?: number;
  brands: Brand[];
  filters: NonNullable<CalendarWidgetProps["filters"]>;
  locations: Location[];
  onChange: React.Dispatch<React.SetStateAction<CalendarFiltersState>>;
  selected: CalendarFiltersState;
  services: Service[];
  staff: StaffMember[];
  timeOfDay: TimeOfDay;
  onTimeOfDayChange(value: TimeOfDay): void;
}) {
  const showFilters = filters.brand || filters.location || filters.service || filters.staff;

  return (
    <div className="gafa-calendar-filters">
      {showFilters ? (
        <div className="gafa-calendar-filters__selects" aria-label="Filtros de calendario">
          {filters.brand && brands.length > 1 ? (
            <label className="gafa-calendar-filter">
              <span>Marca</span>
              <select
                value={selected.brandSlug ?? activeBrandSlug ?? ""}
                onChange={(event) =>
                  onChange((current) => ({ ...current, brandSlug: event.target.value, locationId: undefined }))
                }
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.slug}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {filters.location && locations.length > 1 ? (
            <label className="gafa-calendar-filter">
              <span>Ubicación</span>
              <select
                value={selected.locationId ?? activeLocationId ?? ""}
                onChange={(event) =>
                  onChange((current) => ({ ...current, locationId: toOptionalNumber(event.target.value) }))
                }
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {filters.service && services.length > 0 ? (
            <label className="gafa-calendar-filter">
              <span>Servicio</span>
              <select
                value={selected.serviceId ?? ""}
                onChange={(event) =>
                  onChange((current) => ({ ...current, serviceId: toOptionalNumber(event.target.value) }))
                }
              >
                <option value="">Todos</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {filters.staff && staff.length > 0 ? (
            <label className="gafa-calendar-filter">
              <span>Staff</span>
              <select
                value={selected.staffId ?? ""}
                onChange={(event) =>
                  onChange((current) => ({ ...current, staffId: toOptionalNumber(event.target.value) }))
                }
              >
                <option value="">Todos</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {[member.name, member.lastname].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="gafa-chip-row" role="group" aria-label="Franja horaria">
        {(Object.keys(TIME_OF_DAY_LABELS) as TimeOfDay[]).map((value) => (
          <button
            key={value}
            type="button"
            className="gafa-chip"
            aria-pressed={timeOfDay === value}
            onClick={() => onTimeOfDayChange(value)}
          >
            {TIME_OF_DAY_LABELS[value]}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatRangeLabel(range: DateRange): string {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  const sameMonth = from.getMonth() === to.getMonth();

  const dayMonth = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
  const monthYear = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

  if (sameMonth) {
    return `${from.getDate()} – ${to.getDate()} ${monthYear.format(from)}`;
  }

  return `${dayMonth.format(from)} – ${dayMonth.format(to)}`;
}

function ReservationPreviewModal({
  meeting,
  onClose,
  onContinue,
}: {
  meeting: Meeting;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="gafa-reservation-overlay" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
      <div className="gafa-reservation-sheet">
        <button className="gafa-reservation-close" type="button" aria-label="Cerrar reserva" onClick={onClose}>
          x
        </button>

        <div className="gafa-reservation-hero">
          <span className="gafa-eyebrow">Detalle de reserva</span>
          <h3 id="reservation-title">{meeting.name}</h3>
          <p>
            {formatDate(getMeetingStart(meeting))} · {formatTime(getMeetingStart(meeting), meeting.timezone)}
          </p>
        </div>

        <div className="gafa-reservation-summary">
          <div>
            <span>Servicio</span>
            <strong>{meeting.service?.name ?? meeting.serviceName ?? "Servicio"}</strong>
          </div>
          <div>
            <span>Coach</span>
            <strong>{getStaffName(meeting)}</strong>
          </div>
          <div>
            <span>Sede</span>
            <strong>{meeting.location?.name ?? "Por confirmar"}</strong>
          </div>
          <div>
            <span>Disponibilidad</span>
            <strong>{getAvailabilityText(meeting)}</strong>
          </div>
        </div>

        <ol className="gafa-reservation-steps">
          <li>
            <strong>1. Confirma tu clase</strong>
            <span>Revisa sede, coach, horario y disponibilidad.</span>
          </li>
          <li>
            <strong>2. Inicia sesion</strong>
            <span>Si el cliente no esta logueado, aqui se muestra login o registro.</span>
          </li>
          <li>
            <strong>3. Usa credito o compra</strong>
            <span>Si no tiene creditos, el flujo ofrece paquete, membresia o pago.</span>
          </li>
        </ol>

        <div className="gafa-reservation-actions">
          <button className="gafa-sdk-button" type="button" disabled={isSoldOut(meeting)} onClick={onContinue}>
            Continuar reserva
          </button>
          <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button" onClick={onClose}>
            Seguir viendo horarios
          </button>
        </div>
      </div>
    </div>
  );
}

function groupMeetingsByDay(meetings: Meeting[]) {
  return meetings.reduce<Record<string, Meeting[]>>((groups, meeting) => {
    const day = new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(getMeetingStart(meeting)));

    groups[day] = groups[day] ?? [];
    groups[day].push(meeting);
    return groups;
  }, {});
}

/**
 * La hora se muestra en la zona de la SEDE, no en la del visitante: alguien que
 * reserva desde otro pais tiene que ver "8:00 am" igual que en la recepcion.
 * La API manda la zona por reunion; si falta, se cae a la del navegador.
 */
function formatTime(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function getMeetingStart(meeting: Meeting): string {
  return meeting.startsAt ?? meeting.start ?? meeting.startTime ?? new Date().toISOString();
}

function getStaffName(meeting: Meeting): string {
  if (meeting.staffName) return meeting.staffName;
  if (!meeting.staff) return "Staff por confirmar";

  return [meeting.staff.name, meeting.staff.lastname].filter(Boolean).join(" ");
}

function getMeetingBrandSlug(meeting: Meeting, activeBrand?: Brand): string {
  const brandSlug = meeting.location?.brand?.slug ?? meeting.brandSlug ?? activeBrand?.slug;

  if (!brandSlug) {
    throw new Error("No se encontro la marca para abrir la reserva.");
  }

  return brandSlug;
}

function getMeetingLocationSlug(meeting: Meeting, activeLocation?: Location): string {
  const locationSlug = meeting.location?.slug ?? meeting.locationSlug ?? activeLocation?.slug;

  if (!locationSlug) {
    throw new Error("No se encontro la ubicacion para abrir la reserva.");
  }

  return locationSlug;
}

function isSoldOut(meeting: Meeting): boolean {
  if (meeting.availability === "sold-out") return true;
  if (typeof meeting.available === "number") return meeting.available <= 0 && !meeting.isReserved;
  if (typeof meeting.availability === "object" && meeting.availability.capacity) {
    return (meeting.availability.reserved ?? 0) >= meeting.availability.capacity;
  }

  return false;
}

function getAvailabilityText(meeting: Meeting): string {
  if (meeting.isReserved) return "Ya reservado";
  if (typeof meeting.available === "number" && typeof meeting.capacity === "number") {
    return `${meeting.available}/${meeting.capacity} lugares`;
  }
  if (meeting.availability === "waitlist") return "Lista de espera";
  if (isSoldOut(meeting)) return "Sin lugares";
  return "Disponible";
}

function AvailabilityPill({ meeting }: { meeting: Meeting }) {
  if (meeting.isReserved) {
    return <span className="gafa-availability-pill gafa-availability-pill--reserved">Reservado</span>;
  }

  if (typeof meeting.available === "number" && typeof meeting.capacity === "number") {
    return (
      <span className="gafa-availability-pill">
        {meeting.available}/{meeting.capacity} lugares
      </span>
    );
  }

  if (meeting.availability === "waitlist") {
    return <span className="gafa-availability-pill gafa-availability-pill--waitlist">Waitlist</span>;
  }

  if (isSoldOut(meeting)) {
    return <span className="gafa-availability-pill gafa-availability-pill--sold-out">Sin lugares</span>;
  }

  return <span className="gafa-availability-pill">Disponible</span>;
}

function applyLocalMeetingFilters(
  meetings: Meeting[],
  filters: Pick<CalendarFiltersState, "serviceId" | "staffId">,
): Meeting[] {
  return meetings.filter((meeting) => {
    if (filters.serviceId && meeting.service?.id !== filters.serviceId && meeting.serviceId !== filters.serviceId) {
      return false;
    }

    if (filters.staffId && meeting.staff?.id !== filters.staffId && meeting.staffId !== filters.staffId) {
      return false;
    }

    return true;
  });
}

function findActiveBrand(brands: Brand[], selectedSlug?: string, defaultId?: number): Brand | undefined {
  if (selectedSlug) {
    return brands.find((brand) => brand.slug === selectedSlug);
  }

  if (defaultId) {
    return brands.find((brand) => brand.id === defaultId);
  }

  return brands[0];
}

function findActiveLocation(locations: Location[], selectedId?: number, defaultId?: number): Location | undefined {
  if (selectedId) {
    return locations.find((location) => location.id === selectedId);
  }

  if (defaultId) {
    return locations.find((location) => location.id === defaultId);
  }

  return locations[0];
}

function toOptionalNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function demoMeetings(range: DateRange): Meeting[] {
  const first = parseIsoDate(range.from);
  first.setHours(8, 0, 0, 0);

  const second = addDays(parseIsoDate(range.from), 1);
  second.setHours(18, 30, 0, 0);

  return [
    {
      id: 1,
      name: "Functional Training",
      startsAt: first.toISOString(),
      durationMinutes: 50,
      available: 6,
      capacity: 14,
      location: demoLocations()[0],
      staff: { id: 1, name: "Coach Demo" },
      service: { id: 1, name: "Training" },
      availability: "available",
    },
    {
      id: 2,
      name: "Yoga Flow",
      startsAt: second.toISOString(),
      durationMinutes: 45,
      available: 0,
      capacity: 12,
      location: demoLocations()[0],
      staff: { id: 2, name: "Coach Wellness" },
      service: { id: 2, name: "Yoga" },
      availability: "waitlist",
    },
  ];
}

function demoBrands(): Brand[] {
  return [{ id: 1, name: "Demo Studio", slug: "demo-studio" }];
}

function demoLocations(): Location[] {
  return [{ id: 1, name: "Roma Norte", slug: "roma-norte", brandSlug: "demo-studio" }];
}

function demoServices(): Service[] {
  return [
    { id: 1, name: "Training", durationMinutes: 50 },
    { id: 2, name: "Yoga", durationMinutes: 45 },
  ];
}

function demoStaff(): StaffMember[] {
  return [
    { id: 1, name: "Coach Demo" },
    { id: 2, name: "Coach Wellness" },
  ];
}

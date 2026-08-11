import { useEffect, useMemo, useRef, useState } from "react";
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
  timeOfDayFor,
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
  view: initialView = "day",
  allowViewChange = true,
  showDescription = false,
  // El calendario embebido ya vive dentro del sitio del socio: no repetimos
  // "Reservas / Reserva tu lugar / ..." arriba. title/description se ignoran
  // a proposito para dejar el chrome en dos lineas compactas.
  title: _title,
  description: _description,
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

  const brandSlugs = (brandsQuery.data ?? []).map((brand) => brand.slug).join(",");

  // Una compania puede tener varias marcas (Fitspin tiene fitspin y
  // fitspin-cancun): las sedes se juntan de TODAS, como hace el theme legacy.
  // Si el sitio fija filters.brandId, solo esa marca.
  const locationsQuery = useQuery({
    enabled: (brandsQuery.data ?? []).length > 0 || !client,
    queryKey: ["calendar", "locations", brandSlugs, filters.brandId ?? null, selectedFilters.brandSlug ?? null],
    queryFn: async () => {
      if (!client) return demoLocations();

      let brands = brandsQuery.data ?? [];
      if (selectedFilters.brandSlug) brands = brands.filter((brand) => brand.slug === selectedFilters.brandSlug);
      else if (filters.brandId) brands = brands.filter((brand) => brand.id === filters.brandId);

      const perBrand = await Promise.all(brands.map((brand) => client.listLocations(brand.slug)));
      return perBrand.flat();
    },
  });

  // Igual que el calendar legacy: el selector NO lista el catalogo de sedes,
  // solo las que realmente publican meetings en su horizonte (calendar_days).
  // Guardamos tambien esos meetings: sirven para saltar al primer dia con
  // cupo cuando "hoy" ya no tiene disponibilidad.
  const bookableLocationsQuery = useQuery({
    enabled: (locationsQuery.data?.length ?? 0) > 0 || !client,
    queryKey: [
      "calendar",
      "bookable-locations",
      brandSlugs,
      filters.brandId ?? null,
      selectedFilters.brandSlug ?? null,
      (locationsQuery.data ?? []).map((location) => location.id).join(","),
    ],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BookableLocationsResult> => {
      const all = locationsQuery.data ?? [];
      if (!client) {
        return { locations: all, horizonMeetings: demoMeetings({ from: toIsoDate(new Date()), to: toIsoDate(new Date()) }) };
      }

      const today = new Date();
      const from = toIsoDate(today);
      const checks = await Promise.all(
        all.map(async (location) => {
          const horizonDays = Math.max(1, location.calendarDays ?? 30);
          // end exclusivo: today + N cubre N dias de horarios publicados.
          const to = toIsoDate(addDays(today, horizonDays));
          const meetings = await client.listMeetings({ locationId: location.id, from, to });
          return { location, meetings };
        }),
      );
      const withMeetings = checks.filter((entry) => entry.meetings.length > 0);
      const byId = new Map<string | number, Meeting>();
      for (const entry of withMeetings) {
        for (const meeting of entry.meetings) byId.set(meeting.id, meeting);
      }
      return {
        locations: withMeetings.map((entry) => entry.location),
        horizonMeetings: [...byId.values()],
      };
    },
  });

  const bookableLocations = bookableLocationsQuery.data?.locations ?? [];
  const horizonMeetings = bookableLocationsQuery.data?.horizonMeetings ?? [];

  // Homónimas entre marcas (mismo nombre, distinto id): una sola opción; al
  // elegirla se piden meetings de todos los ids bookable con ese nombre.
  const locationsByName = useMemo(() => {
    const map = new Map<string, Location[]>();
    for (const location of bookableLocations) {
      const key = locationNameKey(location.name);
      map.set(key, [...(map.get(key) ?? []), location]);
    }
    return map;
  }, [bookableLocations]);

  const locations = useMemo(() => {
    const seen = new Set<string>();
    const unique: Location[] = [];
    for (const location of bookableLocations) {
      const key = locationNameKey(location.name);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(location);
    }
    return unique;
  }, [bookableLocations]);

  // Marcas que aparecen en sedes con clases: no ofrecer un filtro muerto.
  const bookableBrands = useMemo(() => {
    const slugs = new Set(bookableLocations.map((location) => location.brandSlug).filter(Boolean) as string[]);
    if (slugs.size === 0) return brandsQuery.data ?? [];
    return (brandsQuery.data ?? []).filter((brand) => slugs.has(brand.slug));
  }, [bookableLocations, brandsQuery.data]);

  // undefined = "Todos" (como el calendar legacy). Solo se fija una sede si el
  // sitio manda filters.locationId o el usuario elige una en el select.
  const selectedLocationId = selectedFilters.locationId ?? filters.locationId;
  const showAllLocations = selectedLocationId == null;

  const activeLocation = useMemo(() => {
    if (showAllLocations) return undefined;
    const match = bookableLocations.find((location) => location.id === selectedLocationId);
    if (!match) return undefined;
    // El <select> solo tiene el representante (primer id) de cada nombre.
    return locations.find((location) => locationNameKey(location.name) === locationNameKey(match.name)) ?? match;
  }, [bookableLocations, locations, selectedLocationId, showAllLocations]);

  const activeLocationGroup = useMemo(() => {
    if (showAllLocations) return bookableLocations;
    if (!activeLocation) return [];
    return locationsByName.get(locationNameKey(activeLocation.name)) ?? [activeLocation];
  }, [activeLocation, bookableLocations, locationsByName, showAllLocations]);

  // Si la sede elegida deja de ser bookable (o venia de un id fantasma), volver
  // a "Todos" para no quedarse en un select invalido.
  useEffect(() => {
    if (!bookableLocationsQuery.isSuccess) return;
    const selectedId = selectedFilters.locationId;
    if (selectedId == null) return;
    const stillThere = bookableLocations.some((location) => location.id === selectedId);
    if (!stillThere) {
      setSelectedFilters((current) => ({ ...current, locationId: undefined }));
    }
  }, [bookableLocations, bookableLocationsQuery.isSuccess, selectedFilters.locationId]);

  const locationGroupIds = activeLocationGroup.map((location) => location.id).join(",");

  function meetingsQueryOptions(target: DateRange) {
    const fetchRange = fetchRangeFor(target);
    return {
      queryKey: ["calendar", "meetings", locationGroupIds, fetchRange.from, fetchRange.to],
      queryFn: async () => {
        if (!client) return demoMeetings(target);
        const batches = await Promise.all(
          activeLocationGroup.map((location) =>
            client.listMeetings({ locationId: location.id, from: fetchRange.from, to: fetchRange.to }),
          ),
        );
        const byId = new Map<string | number, Meeting>();
        for (const batch of batches) {
          for (const meeting of batch) byId.set(meeting.id, meeting);
        }
        return [...byId.values()].sort((a, b) => getMeetingStart(a).localeCompare(getMeetingStart(b)));
      },
    };
  }

  const meetingsQuery = useQuery({
    ...meetingsQueryOptions(range),
    enabled: activeLocationGroup.length > 0 || !client,
    // Los horarios de una semana ya vista no cambian de un minuto a otro; mantenerlos
    // en cache es lo que hace que ir y volver entre semanas sea instantaneo.
    staleTime: 2 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  // La ventana siguiente se trae en segundo plano: cuando el usuario pulsa
  // "siguiente" casi siempre ya esta en cache y el cambio se siente inmediato.
  useEffect(() => {
    if (!client || !locationGroupIds) return;

    const next = rangeForView(shiftAnchor(anchor, view, 1), view);
    const previous = rangeForView(shiftAnchor(anchor, view, -1), view);
    const today = toIsoDate(new Date());

    [next, previous]
      .filter((target) => target.to >= today)
      .forEach((target) => {
        queryClient.prefetchQuery({ ...meetingsQueryOptions(target), staleTime: 2 * 60 * 1000 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, view, locationGroupIds, client, queryClient, activeLocationGroup]);

  const visibleMeetings = useMemo(() => {
    const meetings = applyLocalMeetingFilters(meetingsQuery.data ?? [], {
      serviceId: selectedFilters.serviceId ?? filters.serviceId,
      staffId: selectedFilters.staffId ?? filters.staffId,
    }).filter((meeting) => matchesTimeOfDay(getMeetingStart(meeting), timeOfDay, meeting.timezone));

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

  // Las opciones de los filtros salen de las clases ya cargadas, no del catalogo
  // completo de la marca: asi nunca se ofrece un servicio o un coach que no tiene
  // clases en la ventana visible (elegirlo solo podia dar "sin resultados"), y de
  // paso sobran dos llamadas a la API.
  const serviceOptions = useMemo(() => {
    const names = new Map<number, string>();
    (meetingsQuery.data ?? []).forEach((meeting) => {
      const id = meeting.service?.id ?? meeting.serviceId;
      const name = meeting.service?.name ?? meeting.serviceName;
      if (id && name) names.set(Number(id), name);
    });
    return [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [meetingsQuery.data]);

  const staffOptions = useMemo(() => {
    const names = new Map<number, string>();
    (meetingsQuery.data ?? []).forEach((meeting) => {
      const id = meeting.staff?.id ?? meeting.staffId;
      if (id) names.set(Number(id), getStaffName(meeting));
    });
    return [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [meetingsQuery.data]);

  // Franjas con clases en la ventana cargada: no mostrar "Noche" si no hay ninguna.
  const timeOfDayOptions = useMemo(() => {
    const present = new Set<Exclude<TimeOfDay, "all">>();
    (meetingsQuery.data ?? []).forEach((meeting) => {
      const slot = timeOfDayFor(getMeetingStart(meeting), meeting.timezone);
      if (slot) present.add(slot);
    });
    return present;
  }, [meetingsQuery.data]);

  useEffect(() => {
    if (timeOfDay === "all") return;
    if (!timeOfDayOptions.has(timeOfDay)) setTimeOfDay("all");
  }, [timeOfDay, timeOfDayOptions]);

  const hasActiveFilters = Boolean(selectedFilters.serviceId) || Boolean(selectedFilters.staffId) || timeOfDay !== "all";

  function clearFilters() {
    setSelectedFilters((current) => ({ ...current, serviceId: undefined, staffId: undefined }));
    setTimeOfDay("all");
  }

  // Limites de navegacion: hacia atras no tiene sentido ir antes de hoy (solo
  // habria clases finalizadas) y hacia adelante la sede solo publica horarios
  // hasta su horizonte (calendar_days). Fuera de eso, la flecha se deshabilita
  // en vez de llevar a una semana vacia.
  const todayIso = toIsoDate(new Date());
  const horizonDays = useMemo(() => {
    if (activeLocation?.calendarDays != null) return Math.max(1, activeLocation.calendarDays);
    const fromBookable = bookableLocations
      .map((location) => location.calendarDays)
      .filter((value): value is number => typeof value === "number" && value > 0);
    return Math.max(1, ...(fromBookable.length ? fromBookable : [30]));
  }, [activeLocation?.calendarDays, bookableLocations]);
  const horizonIso = useMemo(
    () => toIsoDate(addDays(new Date(), horizonDays - 1)),
    [horizonDays],
  );
  const canGoPrev = rangeForView(shiftAnchor(anchor, view, -1), view).to >= todayIso;
  const canGoNext = rangeForView(shiftAnchor(anchor, view, 1), view).from <= horizonIso;

  const activeLocationIdSet = useMemo(
    () => new Set(activeLocationGroup.map((location) => location.id)),
    [activeLocationGroup],
  );

  const firstBookableDayIso = useMemo(() => {
    const days = new Set<string>();
    for (const meeting of horizonMeetings) {
      if (meeting.passed) continue;
      if (activeLocationIdSet.size > 0) {
        const locationId = meeting.location?.id;
        if (locationId == null || !activeLocationIdSet.has(locationId)) continue;
      }
      const day = meetingDayIso(meeting);
      if (day && day >= todayIso) days.add(day);
    }
    return [...days].sort()[0] ?? null;
  }, [activeLocationIdSet, horizonMeetings, todayIso]);

  // Si el dia anclado no tiene cupo (hoy ya finalizado, o sede sin horarios
  // ese dia), salta al primer dia con disponibilidad. Las flechas desactivan
  // este auto-salto para no pelearse con la navegacion manual.
  const allowAutoSkipRef = useRef(true);
  useEffect(() => {
    if (view !== "day") return;
    if (!bookableLocationsQuery.isSuccess) return;
    if (!allowAutoSkipRef.current) return;
    if (!firstBookableDayIso) return;

    if (dayHasBookableMeetings(horizonMeetings, activeLocationIdSet, anchorIso)) {
      allowAutoSkipRef.current = false;
      return;
    }

    if (firstBookableDayIso !== anchorIso) {
      setAnchorIso(firstBookableDayIso);
    }
    allowAutoSkipRef.current = false;
  }, [
    activeLocationIdSet,
    anchorIso,
    bookableLocationsQuery.isSuccess,
    firstBookableDayIso,
    horizonMeetings,
    view,
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

  // En v5 un query deshabilitado no marca isLoading: hay que esperar a que el
  // probe de sedes bookable termine (o falle) antes de pintar el calendario.
  const discoveringLocations =
    locationsQuery.isLoading ||
    bookableLocationsQuery.isLoading ||
    (Boolean(client) && locationsQuery.isSuccess && !bookableLocationsQuery.isFetched);
  const isLoading = discoveringLocations || (activeLocationGroup.length > 0 && meetingsQuery.isLoading);
  const isRefreshing = meetingsQuery.isFetching && !meetingsQuery.isLoading;
  // Al cambiar de semana el placeholder es la ventana anterior: los dias nuevos
  // salen vacios y parecia "Sin clases" mientras aun cargaba.
  const isUpdating =
    isRefreshing || (meetingsQuery.isFetching && Boolean(meetingsQuery.isPlaceholderData));
  const hasError =
    brandsQuery.isError || locationsQuery.isError || bookableLocationsQuery.isError || meetingsQuery.isError;

  function handleReserve(meeting: Meeting) {
    if (!client || isSoldOut(meeting)) return;
    setSelectedMeeting(null);
    setFancyMeeting(meeting);
  }

  function goPrev() {
    allowAutoSkipRef.current = false;
    setAnchorIso(toIsoDate(shiftAnchor(anchor, view, -1)));
  }

  function goNext() {
    allowAutoSkipRef.current = false;
    setAnchorIso(toIsoDate(shiftAnchor(anchor, view, 1)));
  }

  // Swipe horizontal en la vista dia (movil): deslizar cambia de dia, igual
  // que las flechas. Solo se dispara con gestos claramente horizontales para
  // no pelearse con el scroll vertical de la lista.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;

    if (dx < 0 && canGoNext) goNext();
    else if (dx > 0 && canGoPrev) goPrev();
  }

  const viewToggle =
    allowViewChange ? (
      <div className="gafa-segmented gafa-segmented--compact" role="group" aria-label="Vista del calendario">
        <button
          type="button"
          aria-pressed={view === "day"}
          onClick={() => {
            allowAutoSkipRef.current = true;
            setView("day");
          }}
        >
          Día
        </button>
        <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>
          Semana
        </button>
      </div>
    ) : null;

  return (
    <WidgetShell>
      <CalendarToolbar
        anchor={anchor}
        range={range}
        view={view}
        viewToggle={viewToggle}
        onPrev={goPrev}
        onNext={goNext}
        onToday={() => {
          allowAutoSkipRef.current = true;
          // Hoy sin cupo → el primer dia con disponibilidad (no un dia vacio).
          setAnchorIso(firstBookableDayIso && firstBookableDayIso !== todayIso ? firstBookableDayIso : todayIso);
        }}
        isRefreshing={isUpdating}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        filterBar={
          <CalendarFilterBar
            activeBrandSlug={activeBrand?.slug}
            brands={bookableBrands}
            filters={filters}
            locations={locations}
            onChange={(updater) => {
              allowAutoSkipRef.current = true;
              setSelectedFilters(updater);
            }}
            selected={selectedFilters}
            serviceOptions={serviceOptions}
            staffOptions={staffOptions}
            timeOfDay={timeOfDay}
            timeOfDayOptions={timeOfDayOptions}
            onTimeOfDayChange={setTimeOfDay}
          />
        }
      />

      {hasError ? <p className="gafa-sdk-state gafa-sdk-state--error">No pudimos cargar el calendario.</p> : null}

      {isLoading || (visibleMeetings.length === 0 && isUpdating) ? (
        <CalendarSkeleton view={view} />
      ) : visibleMeetings.length === 0 ? (
        // Un solo estado vacio con el mismo alto que el calendario: siete columnas
        // vacias no aportan nada y el brinco de alto se nota feo.
        <div className="gafa-empty-state gafa-empty-state--calendar">
          <strong>{hasActiveFilters ? "Sin horarios con estos filtros" : "Sin horarios en estas fechas"}</strong>
          <span>
            {hasActiveFilters
              ? "Prueba quitando algun filtro o cambiando de fecha."
              : "Prueba con otra fecha u otra ubicacion."}
          </span>
          {hasActiveFilters ? (
            <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : view === "day" ? (
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <DayColumn
            date={anchor}
            emptyLabel={isUpdating ? "Cargando..." : "Sin horarios"}
            meetings={meetingsByIsoDay.get(toIsoDate(anchor)) ?? []}
            onSelect={setSelectedMeeting}
            showDescription={showDescription}
          />
        </div>
      ) : (
        <div className="gafa-week-grid">
          {days.map((day) => (
            <DayColumn
              key={toIsoDate(day)}
              compact
              date={day}
              emptyLabel={isUpdating ? "Cargando..." : "Sin horarios"}
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
  viewToggle,
  onPrev,
  onNext,
  onToday,
  isRefreshing,
  canGoPrev,
  canGoNext,
  filterBar,
}: {
  anchor: Date;
  range: DateRange;
  view: CalendarView;
  viewToggle: React.ReactNode;
  onPrev(): void;
  onNext(): void;
  onToday(): void;
  isRefreshing: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  filterBar: React.ReactNode;
}) {
  // Corto a proposito: en movil "Martes, 11 de agosto" se comia toda una fila.
  const label =
    view === "day"
      ? new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" }).format(anchor)
      : formatRangeLabel(range);

  return (
    <div className="gafa-calendar-toolbar">
      {/* Fila 1: vista + sede/filtros */}
      <div className="gafa-calendar-toolbar__row">
        {viewToggle}
        <div className="gafa-calendar-toolbar__filters">{filterBar}</div>
      </div>

      {/* Fila 2: flechas + Hoy + fecha compacta */}
      <div className="gafa-calendar-toolbar__row gafa-calendar-toolbar__row--nav">
        <div className="gafa-calendar-toolbar__nav">
          <button
            className="gafa-icon-button"
            type="button"
            disabled={!canGoPrev}
            onClick={onPrev}
            aria-label={view === "day" ? "Día anterior" : "Semana anterior"}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            className="gafa-icon-button"
            type="button"
            disabled={!canGoNext}
            onClick={onNext}
            aria-label={view === "day" ? "Día siguiente" : "Semana siguiente"}
            title={canGoNext ? undefined : "La sede aún no publica horarios más adelante"}
          >
            <ChevronIcon direction="right" />
          </button>
          <button
            className="gafa-sdk-button gafa-sdk-button--secondary gafa-calendar-today"
            type="button"
            onClick={onToday}
          >
            Hoy
          </button>
        </div>

        <div className="gafa-calendar-toolbar__label" aria-live="polite">
          <strong>{label}</strong>
          {/* Spinner de ancho fijo: el texto "actualizando..." hacia brincar
              la fila a tres lineas mientras cargaba. */}
          {isRefreshing ? (
            <span className="gafa-toolbar-spinner" role="status" aria-label="Actualizando" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5"}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DayColumn({
  date,
  meetings,
  onSelect,
  compact = false,
  showDescription = false,
  emptyLabel = "Sin horarios",
}: {
  date: Date;
  meetings: Meeting[];
  onSelect(meeting: Meeting): void;
  compact?: boolean;
  showDescription?: boolean;
  emptyLabel?: string;
}) {
  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: compact ? "short" : "long" }).format(date);

  return (
    <section
      className="gafa-day-column"
      data-today={isToday(date) ? "true" : undefined}
      data-standalone={compact ? undefined : "true"}
    >
      {compact ? (
        <header className="gafa-day-column__header">
          <span className="gafa-day-column__weekday">{weekday}</span>
          <span className="gafa-day-column__number">{date.getDate()}</span>
        </header>
      ) : null}

      {meetings.length === 0 ? (
        <p className="gafa-day-column__empty">{emptyLabel}</p>
      ) : compact ? (
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
      ) : (
        <StandaloneDaySections meetings={meetings} onSelect={onSelect} showDescription={showDescription} />
      )}
    </section>
  );
}

/**
 * Vista de un solo dia, agrupada por franja como subtitulos.
 *
 * Cuando el dia es HOY y ya pasaron clases, lo reservable va ARRIBA (empezando
 * por la franja en la que estas) y lo finalizado se manda al fondo bajo su
 * propio subtitulo: abrir el calendario a las 7pm y tener que scrollear entre
 * todo lo que ya paso para encontrar que puedes reservar era lo primero que se
 * sentia mal.
 */
function StandaloneDaySections({
  meetings,
  onSelect,
  showDescription,
}: {
  meetings: Meeting[];
  onSelect(meeting: Meeting): void;
  showDescription: boolean;
}) {
  const upcoming = meetings.filter((meeting) => !meeting.passed);
  const finished = meetings.filter((meeting) => meeting.passed);
  const splitDay = upcoming.length > 0 && finished.length > 0;

  const sections = groupByTimeOfDay(splitDay ? upcoming : meetings).map(([slot, slotMeetings]) => ({
    key: slot as string,
    title: TIME_OF_DAY_LABELS[slot],
    meetings: slotMeetings,
  }));

  if (splitDay) {
    sections.push({ key: "finished", title: "Ya finalizadas", meetings: finished });
  }

  return (
    <>
      {sections.map((section) => (
        <section className="gafa-day-slot" key={section.key}>
          <h3 className="gafa-day-slot__title">{section.title}</h3>
          <div className="gafa-day-column__list">
            {section.meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                compact={false}
                meeting={meeting}
                onSelect={onSelect}
                showDescription={showDescription}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function groupByTimeOfDay(meetings: Meeting[]): Array<[Exclude<TimeOfDay, "all">, Meeting[]]> {
  const slots: Array<Exclude<TimeOfDay, "all">> = ["morning", "afternoon", "evening"];

  return slots
    .map((slot): [Exclude<TimeOfDay, "all">, Meeting[]] => [
      slot,
      meetings.filter((meeting) => matchesTimeOfDay(getMeetingStart(meeting), slot, meeting.timezone)),
    ])
    .filter(([, slotMeetings]) => slotMeetings.length > 0);
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
  const duration = getDurationMinutes(meeting);
  // El legacy directamente oculta las clases que ya pasaron; aqui se dejan
  // visibles pero apagadas, para que el dia se entienda completo.
  const passed = Boolean(meeting.passed);

  return (
    <button
      className="gafa-meeting-card"
      data-sold-out={soldOut ? "true" : undefined}
      data-passed={passed ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
      type="button"
      disabled={passed}
      onClick={() => onSelect(meeting)}
    >
      <span className="gafa-meeting-card__top">
        <span className="gafa-meeting-time">{formatTime(getMeetingStart(meeting), meeting.timezone)}</span>
        {duration && !compact ? <span className="gafa-meeting-duration">{duration} min</span> : null}
      </span>

      <span className="gafa-meeting-name">{meeting.service?.name ?? meeting.serviceName ?? meeting.name}</span>

      <span className="gafa-meeting-detail">
        <PersonIcon />
        {getStaffName(meeting)}
      </span>
      {meeting.location?.name ? (
        <span className="gafa-meeting-detail">
          <LocationIcon />
          {meeting.location.name}
        </span>
      ) : null}
      {showDescription && meeting.description ? <span className="gafa-meeting-desc">{meeting.description}</span> : null}

      {passed ? <span className="gafa-availability-pill gafa-availability-pill--passed">Finalizada</span> : <AvailabilityPill meeting={meeting} />}
    </button>
  );
}

function PersonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * La duracion no viene como campo propio: se calcula del inicio y el fin,
 * que es lo mismo que muestra el theme legacy.
 */
function getDurationMinutes(meeting: Meeting): number | null {
  if (meeting.durationMinutes) return meeting.durationMinutes;
  if (!meeting.endsAt) return null;

  const start = new Date(getMeetingStart(meeting)).getTime();
  const end = new Date(meeting.endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  return Math.round((end - start) / 60000);
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
  brands,
  filters,
  locations,
  onChange,
  selected,
  serviceOptions,
  staffOptions,
  timeOfDay,
  timeOfDayOptions,
  onTimeOfDayChange,
}: {
  activeBrandSlug?: string;
  brands: Brand[];
  filters: NonNullable<CalendarWidgetProps["filters"]>;
  locations: Location[];
  onChange: React.Dispatch<React.SetStateAction<CalendarFiltersState>>;
  selected: CalendarFiltersState;
  serviceOptions: Array<{ id: number; name: string }>;
  staffOptions: Array<{ id: number; name: string }>;
  timeOfDay: TimeOfDay;
  timeOfDayOptions: Set<Exclude<TimeOfDay, "all">>;
  onTimeOfDayChange(value: TimeOfDay): void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount =
    Number(Boolean(selected.serviceId)) + Number(Boolean(selected.staffId)) + Number(timeOfDay !== "all");

  // Cerrar al hacer click fuera: el panel flota encima del calendario.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Con una sola sede el select no aporta; con varias, "Todos" es el default.
  const showLocation = Boolean(filters.location) && locations.length > 1;
  const showBrand = Boolean(filters.brand) && brands.length > 1;
  // El boton solo aparece cuando hay algo real que filtrar: con un unico
  // servicio y sin coaches distintos no aporta nada. Si hay filtros activos se
  // muestra siempre, para poder limpiarlos.
  const showService = Boolean(filters.service) && serviceOptions.length > 1;
  const showStaff = Boolean(filters.staff) && staffOptions.length > 1;
  const showTimeOfDay = timeOfDayOptions.size > 1 || timeOfDay !== "all";
  const hasPanelFilters = showService || showStaff || showBrand || showTimeOfDay || activeCount > 0;

  const timeChips: TimeOfDay[] = ["all", ...(["morning", "afternoon", "evening"] as const).filter((slot) =>
    timeOfDayOptions.has(slot),
  )];

  return (
    <div className="gafa-filterbar" ref={panelRef}>
      {/* La sede es EL filtro que todo el mundo usa: se queda a la vista. */}
      {showLocation ? (
        <label className="gafa-filterbar-location">
          <LocationIcon />
          <select
            aria-label="Ubicación"
            value={selected.locationId ?? ""}
            onChange={(event) => onChange((current) => ({ ...current, locationId: toOptionalNumber(event.target.value) }))}
          >
            <option value="">Todos</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {hasPanelFilters ? (
        <button
          className="gafa-filterbar-toggle"
          type="button"
          aria-expanded={open}
          aria-label="Filtros"
          onClick={() => setOpen(!open)}
        >
          <FilterIcon />
          <span className="gafa-filterbar-toggle__label">Filtros</span>
          {activeCount > 0 ? <span className="gafa-filterbar-count">{activeCount}</span> : null}
        </button>
      ) : null}

      {open ? (
        <div className="gafa-filterbar-panel" role="group" aria-label="Filtros de calendario">
          {showBrand ? (
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

          {showService || selected.serviceId ? (
            <label className="gafa-calendar-filter">
              <span>Servicio</span>
              <select
                value={selected.serviceId ?? ""}
                onChange={(event) =>
                  onChange((current) => ({ ...current, serviceId: toOptionalNumber(event.target.value) }))
                }
              >
                <option value="">Todos</option>
                {serviceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
                {selected.serviceId && !serviceOptions.some((option) => option.id === selected.serviceId) ? (
                  <option value={selected.serviceId}>Sin horarios en estas fechas</option>
                ) : null}
              </select>
            </label>
          ) : null}

          {showStaff || selected.staffId ? (
            <label className="gafa-calendar-filter">
              <span>Staff</span>
              <select
                value={selected.staffId ?? ""}
                onChange={(event) =>
                  onChange((current) => ({ ...current, staffId: toOptionalNumber(event.target.value) }))
                }
              >
                <option value="">Todos</option>
                {staffOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
                {selected.staffId && !staffOptions.some((option) => option.id === selected.staffId) ? (
                  <option value={selected.staffId}>Sin horarios en estas fechas</option>
                ) : null}
              </select>
            </label>
          ) : null}

          {showTimeOfDay ? (
            <div className="gafa-calendar-filter">
              <span>Horario</span>
              <div className="gafa-chip-row" role="group" aria-label="Franja horaria">
                {timeChips.map((value) => (
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
          ) : null}

          {activeCount > 0 ? (
            <button
              className="gafa-sdk-button gafa-sdk-button--secondary"
              type="button"
              onClick={() => {
                onChange((current) => ({ ...current, serviceId: undefined, staffId: undefined }));
                onTimeOfDayChange("all");
              }}
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-6.5-5.3-6.5-10.2a6.5 6.5 0 1 1 13 0C18.5 15.7 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10.5" r="2.3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function formatRangeLabel(range: DateRange): string {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  const sameMonth = from.getMonth() === to.getMonth();
  const monthShort = new Intl.DateTimeFormat("es-MX", { month: "short" });

  if (sameMonth) {
    return `${from.getDate()}–${to.getDate()} ${monthShort.format(from)}`;
  }

  return `${from.getDate()} ${monthShort.format(from)} – ${to.getDate()} ${monthShort.format(to)}`;
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

type BookableLocationsResult = {
  locations: Location[];
  horizonMeetings: Meeting[];
};

/** Clave estable para agrupar sedes homónimas entre marcas (Cancún / Cancun). */
function locationNameKey(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function meetingDayIso(meeting: Meeting): string | null {
  const raw = getMeetingStart(meeting);
  if (!raw) return null;
  const date = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    const fallback = raw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : null;
  }
  return toIsoDate(date);
}

function dayHasBookableMeetings(
  meetings: Meeting[],
  locationIds: Set<number>,
  dayIso: string,
): boolean {
  return meetings.some((meeting) => {
    if (meeting.passed) return false;
    if (locationIds.size > 0) {
      const locationId = meeting.location?.id;
      if (locationId == null || !locationIds.has(locationId)) return false;
    }
    return meetingDayIso(meeting) === dayIso;
  });
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

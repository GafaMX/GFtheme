import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WidgetShell } from "./WidgetShell";
import { FancyOverlay } from "./FancyOverlay";
import { AuthWidget } from "./AuthWidget";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import { readStoredToken, subscribeToAuthChanges } from "../client/tokenStorage";
import type {
  Brand,
  CreateReservationResult,
  GafaClient,
  Location,
  Meeting,
  SeatMap,
  SeatMapObject,
  Service,
  StaffMember,
  UserCredit,
} from "../client/types";
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
  /** Necesario solo para permitir registro dentro del flujo de reserva. */
  captcha?: CaptchaProvider;
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
  captcha,
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
  // Meeting que el usuario quiere reservar pero aun no tiene sesion: dispara el
  // login/registro DENTRO del flujo, sin sacarlo del calendario. Al autenticar
  // se continua solo hacia el checkout.
  const [authGateMeeting, setAuthGateMeeting] = useState<Meeting | null>(null);
  const [view, setView] = useState<CalendarView>(initialView);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("all");
  const [anchorIso, setAnchorIso] = useState(() => toIsoDate(new Date()));

  const anchor = useMemo(() => parseIsoDate(anchorIso), [anchorIso]);
  const range = useMemo(() => rangeForView(anchor, view), [anchor, view]);

  const brandsQuery = useQuery({
    queryKey: ["calendar", "brands"],
    queryFn: async () => (client ? client.listBrands() : demoBrands()),
  });

  // Sesion actual: decide si el clic en una clase pide login o abre el detalle.
  // Se deriva DIRECTO del token almacenado (sincrono y compartido con el resto
  // de widgets), actualizado por el evento de auth; una query aqui podia quedar
  // cacheada en null despues de un login hecho en otro widget.
  const [isSignedIn, setIsSignedIn] = useState(() => Boolean(readStoredToken()));

  useEffect(() => {
    return subscribeToAuthChanges(() => {
      setIsSignedIn(Boolean(readStoredToken()));
      queryClient.invalidateQueries({ queryKey: ["calendar", "reservation-context"] });
      queryClient.invalidateQueries({ queryKey: ["calendar", "user-credits"] });
    });
  }, [queryClient]);

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

  // Dias del horizonte que SI tienen clases reservables para la seleccion
  // actual de sede: alimenta el salto automatico y el date-picker.
  const bookableDays = useMemo(() => {
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
    return days;
  }, [activeLocationIdSet, horizonMeetings, todayIso]);

  const firstBookableDayIso = useMemo(() => [...bookableDays].sort()[0] ?? null, [bookableDays]);

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

  /**
   * Clic en una clase: sin sesion pide login AHI MISMO (nada de abrir un
   * detalle que luego vuelve a pedir clic); con sesion abre el detalle con
   * mapa y confirmacion en un solo paso.
   */
  function openMeeting(meeting: Meeting) {
    if (!isSignedIn && client) {
      setAuthGateMeeting(meeting);
      return;
    }
    setSelectedMeeting(meeting);
  }

  /** Camino de compra: sin creditos compatibles se va al checkout de compra. */
  function handleBuy(meeting: Meeting) {
    if (!client) return;
    setSelectedMeeting(null);
    setFancyMeeting(meeting);
  }

  // Al autenticarse desde el gate, abrir el detalle de la clase que estaba
  // intentando reservar (ya con mapa y creditos de SU cuenta).
  useEffect(() => {
    if (isSignedIn && authGateMeeting) {
      const meeting = authGateMeeting;
      setAuthGateMeeting(null);
      setSelectedMeeting(meeting);
    }
  }, [authGateMeeting, isSignedIn]);

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
        bookableDays={bookableDays}
        minIso={todayIso}
        maxIso={horizonIso}
        onPickDate={(iso) => {
          allowAutoSkipRef.current = false;
          setAnchorIso(iso);
        }}
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
            onSelect={openMeeting}
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
              onSelect={openMeeting}
              showDescription={showDescription}
            />
          ))}
        </div>
      )}

      {selectedMeeting ? (
        <ReservationPreviewModal
          client={client}
          meeting={selectedMeeting}
          isSignedIn={isSignedIn}
          onClose={() => setSelectedMeeting(null)}
          onContinue={() => handleBuy(selectedMeeting)}
          onReserved={() => {
            // La clase reservada cambia la disponibilidad visible y el perfil.
            queryClient.invalidateQueries({ queryKey: ["calendar", "meetings"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }}
        />
      ) : null}

      {authGateMeeting && client ? (
        <ReservationAuthGate
          client={client}
          captcha={captcha}
          meeting={authGateMeeting}
          brandSlug={getMeetingBrandSlug(authGateMeeting, activeBrand)}
          onClose={() => setAuthGateMeeting(null)}
          onAuthenticated={() => {
            // Directo del login al detalle de la clase que estaba reservando.
            const meeting = authGateMeeting;
            setAuthGateMeeting(null);
            queryClient.invalidateQueries({ queryKey: ["calendar", "session"] });
            setSelectedMeeting(meeting);
          }}
        />
      ) : null}

      {fancyMeeting && client ? (
        <FancyOverlay
          key={fancyMeeting.id}
          title={fancyMeeting.name}
          description="Termina tu reserva: elige tu lugar en el salón y confirma con crédito o compra."
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
  bookableDays,
  minIso,
  maxIso,
  onPickDate,
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
  bookableDays: Set<string>;
  minIso: string;
  maxIso: string;
  onPickDate(iso: string): void;
  onPrev(): void;
  onNext(): void;
  onToday(): void;
  isRefreshing: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  filterBar: React.ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen]);

  // Corto a proposito: en movil "Martes, 11 de agosto" se comia toda una fila.
  const label =
    view === "day"
      ? new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" }).format(anchor)
      : formatRangeLabel(range);

  // El estado "seleccionado" de Hoy solo aplica en vista dia: en semana el
  // boton es solo un atajo para volver, no un estado.
  const todayIso = toIsoDate(new Date());
  const viewingToday = view === "day" && toIsoDate(anchor) === todayIso;

  return (
    // Movil: dos filas (vista+filtros / navegacion). Desktop: una sola fila con
    // la navegacion y la fecha AL CENTRO. Mismo DOM, lo acomoda el CSS.
    <div className="gafa-calendar-toolbar">
      <div className="gafa-calendar-toolbar__view">{viewToggle}</div>

      <div className="gafa-calendar-toolbar__nav-group">
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
            className="gafa-calendar-today"
            type="button"
            aria-pressed={viewingToday}
            onClick={onToday}
            title={viewingToday ? "Estás viendo hoy" : "Volver a hoy"}
          >
            Hoy
          </button>
        </div>

        <div className="gafa-calendar-toolbar__label" ref={pickerRef}>
          <button
            className="gafa-calendar-date-button"
            type="button"
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            title="Elegir fecha"
            onClick={() => setPickerOpen((open) => !open)}
          >
            <CalendarIcon />
            <strong aria-live="polite">{label}</strong>
          </button>
          {/* Spinner de ancho fijo: el texto "actualizando..." hacia brincar
              la fila a tres lineas mientras cargaba. */}
          {isRefreshing ? (
            <span className="gafa-toolbar-spinner" role="status" aria-label="Actualizando" />
          ) : null}

          {pickerOpen ? (
            <DatePickerPopover
              anchor={anchor}
              bookableDays={bookableDays}
              minIso={minIso}
              maxIso={maxIso}
              onPick={(iso) => {
                setPickerOpen(false);
                onPickDate(iso);
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="gafa-calendar-toolbar__filters">{filterBar}</div>
    </div>
  );
}

const WEEKDAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Mini calendario para saltar a una fecha: dias con clases activos, el resto
 * deshabilitado. Acotado a hoy → horizonte publicado (calendar_days).
 */
function DatePickerPopover({
  anchor,
  bookableDays,
  minIso,
  maxIso,
  onPick,
}: {
  anchor: Date;
  bookableDays: Set<string>;
  minIso: string;
  maxIso: string;
  onPick(iso: string): void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));

  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(monthCursor);
  const anchorIso = toIsoDate(anchor);
  const todayIso = toIsoDate(new Date());

  const prevMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
  const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
  const lastOfPrev = toIsoDate(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 0));
  const firstOfNext = toIsoDate(nextMonth);
  const canPrevMonth = lastOfPrev >= minIso;
  const canNextMonth = firstOfNext <= maxIso;

  // Celdas del mes alineadas a semana de lunes.
  const cells: Array<Date | null> = [];
  const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const leading = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < leading; i++) cells.push(null);
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
  }

  return (
    <div className="gafa-datepicker" role="dialog" aria-label="Elegir fecha">
      <div className="gafa-datepicker__header">
        <button
          className="gafa-icon-button"
          type="button"
          disabled={!canPrevMonth}
          onClick={() => setMonthCursor(prevMonth)}
          aria-label="Mes anterior"
        >
          <ChevronIcon direction="left" />
        </button>
        <strong>{monthLabel}</strong>
        <button
          className="gafa-icon-button"
          type="button"
          disabled={!canNextMonth}
          onClick={() => setMonthCursor(nextMonth)}
          aria-label="Mes siguiente"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div className="gafa-datepicker__weekdays" aria-hidden="true">
        {WEEKDAY_HEADERS.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>

      <div className="gafa-datepicker__grid">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const iso = toIsoDate(date);
          const inRange = iso >= minIso && iso <= maxIso;
          const hasClasses = bookableDays.has(iso);
          const enabled = inRange && hasClasses;

          return (
            <button
              key={iso}
              type="button"
              className="gafa-datepicker__day"
              disabled={!enabled}
              data-selected={iso === anchorIso ? "true" : undefined}
              data-today={iso === todayIso ? "true" : undefined}
              data-has-classes={hasClasses ? "true" : undefined}
              onClick={() => onPick(iso)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <p className="gafa-datepicker__hint">Solo los días con clases se pueden elegir.</p>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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
  const slots: Array<Exclude<TimeOfDay, "all">> = ["am", "tarde", "pm"];

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
  // Foto del coach SOLO si la marca la tiene cargada (Fitspin sí, Bunker no):
  // sin foto la tarjeta se queda exactamente igual que antes.
  const staffPhoto = meeting.staff?.photoUrl;

  return (
    <button
      className="gafa-meeting-card"
      data-sold-out={soldOut ? "true" : undefined}
      data-passed={passed ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
      data-has-photo={staffPhoto ? "true" : undefined}
      type="button"
      disabled={passed}
      onClick={() => onSelect(meeting)}
    >
      {staffPhoto ? (
        <img className="gafa-meeting-staff-photo" src={staffPhoto} alt="" aria-hidden="true" loading="lazy" />
      ) : null}
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

      {passed ? (
        <span className="gafa-availability-pill gafa-availability-pill--passed">Finalizada</span>
      ) : (
        <AvailabilityPill meeting={meeting} compact={compact} />
      )}
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

  const timeChips: TimeOfDay[] = [
    "all",
    ...(["am", "tarde", "pm"] as const).filter((slot) => timeOfDayOptions.has(slot)),
  ];

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

type ReservationStep = "detail" | "processing" | "done";

/**
 * Flujo de reserva NATIVO en UN SOLO PASO: el detalle y el mapa de salon (si la
 * clase lo usa) viven en el mismo modal; eliges lugar y confirmas ahi mismo.
 * Solo cae al fancy legacy cuando hay que comprar (sin creditos).
 */
function ReservationPreviewModal({
  client,
  meeting,
  isSignedIn,
  onClose,
  onContinue,
  onReserved,
}: {
  client?: GafaClient;
  meeting: Meeting;
  isSignedIn: boolean;
  onClose: () => void;
  /** Camino de compra / login: lo maneja el padre (gate o fancy). */
  onContinue: () => void;
  onReserved?: () => void;
}) {
  const brandSlug = meeting.location?.brand?.slug ?? meeting.brandSlug;
  const locationSlug = meeting.location?.slug ?? meeting.locationSlug;

  const [step, setStep] = useState<ReservationStep>("detail");
  const [selectedSeat, setSelectedSeat] = useState<SeatMapObject | null>(null);
  const [result, setResult] = useState<CreateReservationResult | null>(null);
  const [flowError, setFlowError] = useState<string>();

  // El contexto trae LO REAL del servidor para este meeting: creditos que
  // aplican, mapa con lugares ocupados y si hay lista de espera.
  const contextQuery = useQuery({
    queryKey: ["calendar", "reservation-context", brandSlug, locationSlug, meeting.id],
    queryFn: () =>
      client!.getReservationContext!({
        meetingId: meeting.id,
        brandSlug: brandSlug!,
        locationSlug: locationSlug!,
      }),
    enabled: Boolean(client?.getReservationContext && brandSlug && locationSlug && isSignedIn),
    staleTime: 30_000,
    retry: 0,
  });

  const context = contextQuery.data;
  const seatMap = context?.seatMap ?? null;
  const paymentOptions = context?.paymentOptions ?? [];
  // Con UNA sola opcion no se pregunta nada; con varias el usuario decide.
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const needsPaymentChoice = paymentOptions.length > 1;
  const activeOption = needsPaymentChoice
    ? (paymentOptions.find((option) => option.id === selectedOptionId) ?? null)
    : (paymentOptions[0] ?? null);
  const canReserveNative = Boolean(client?.createReservation && context && paymentOptions.length > 0);
  const soldOut = isSoldOut(meeting);
  // Clase llena: nada de mapa; el boton se convierte en "unirme a la lista".
  const waitlistMode = Boolean(canReserveNative && soldOut && context?.waitlistAvailable);
  const needsSeat = Boolean(canReserveNative && seatMap && !waitlistMode);

  async function confirmReservation(seat: SeatMapObject | null) {
    if (!client?.createReservation || !context) return;
    setStep("processing");
    setFlowError(undefined);
    try {
      const created = await client.createReservation({
        brandSlug: context.brandSlug,
        locationSlug: context.locationSlug,
        meetingId: context.meetingId,
        userProfileId: context.userProfileId,
        seatObjectId: seat?.id,
        // Solo se manda cuando el usuario eligio entre varias; con una sola
        // el servidor la resuelve igual que siempre.
        selectedCredit: needsPaymentChoice ? (activeOption?.id ?? undefined) : undefined,
      });
      setResult(created);
      setStep("done");
      onReserved?.();
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : "No pudimos completar la reserva.");
      setStep("detail");
    }
  }

  function handlePrimary() {
    if (!isSignedIn || !canReserveNative) {
      // Login o compra: los resuelve el padre (gate de auth o fancy).
      onContinue();
      return;
    }
    void confirmReservation(needsSeat ? selectedSeat : null);
  }

  const primaryDisabled =
    step === "processing" ||
    (isSignedIn && contextQuery.isLoading) ||
    (needsSeat && !selectedSeat) ||
    (needsPaymentChoice && !activeOption);

  const primaryLabel = !isSignedIn
    ? "Continuar reserva"
    : contextQuery.isLoading
      ? "Revisando tus paquetes…"
      : canReserveNative
        ? needsPaymentChoice && !activeOption
          ? "Elige cómo reservar"
          : waitlistMode
            ? "Unirme a la lista de espera"
            : needsSeat
              ? selectedSeat
                ? `Reservar lugar ${selectedSeat.label}`
                : "Elige tu lugar en el mapa"
              : activeOption?.kind === "membership"
                ? "Reservar con mi membresía"
                : "Reservar con mi paquete"
        : "Comprar y reservar";

  return (
    <div className="gafa-reservation-overlay" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
      <div className="gafa-reservation-sheet" data-step={step} data-has-map={needsSeat ? "true" : undefined}>
        <button className="gafa-reservation-close" type="button" aria-label="Cerrar reserva" onClick={onClose}>
          x
        </button>

        {step !== "done" ? (
          <>
            <div className="gafa-reservation-hero">
              <span className="gafa-eyebrow">Detalle de reserva</span>
              <h3 id="reservation-title">{meeting.name}</h3>
              <p>
                {formatDate(getMeetingStart(meeting))} · {formatTime(getMeetingStart(meeting), meeting.timezone)} ·{" "}
                {meeting.location?.name ?? ""}
              </p>
            </div>

            <div className="gafa-reservation-body">
              <div className="gafa-reservation-info">
                <CoachInfo meeting={meeting} />

                <div className="gafa-reservation-summary">
                  <div>
                    <span>Servicio</span>
                    <strong>{meeting.service?.name ?? meeting.serviceName ?? "Servicio"}</strong>
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

                {isSignedIn ? (
                  contextQuery.isLoading ? (
                    <p className="gafa-reservation-hint">Revisando tus paquetes…</p>
                  ) : needsPaymentChoice ? (
                    <div className="gafa-payment-choice" role="radiogroup" aria-label="¿Con qué quieres reservar?">
                      <span className="gafa-payment-choice__title">¿Con qué quieres reservar?</span>
                      {paymentOptions.map((option) => (
                        <label className="gafa-payment-option" key={option.id} data-selected={option.id === selectedOptionId ? "true" : undefined}>
                          <input
                            type="radio"
                            name="gafa-payment-option"
                            checked={option.id === selectedOptionId}
                            onChange={() => setSelectedOptionId(option.id)}
                          />
                          <span className="gafa-payment-option__body">
                            <strong>
                              {option.kind === "membership" ? "Membresía: " : ""}
                              {option.name}
                            </strong>
                            <span>
                              {option.kind === "credit" && typeof option.remaining === "number"
                                ? `${option.remaining} ${option.remaining === 1 ? "crédito" : "créditos"}`
                                : "Ilimitada"}
                              {option.expiresAt ? ` · vence ${formatShortDate(option.expiresAt)}` : ""}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : activeOption ? (
                    <p className="gafa-reservation-hint gafa-reservation-hint--ok">
                      {activeOption.kind === "membership" ? (
                        <>
                          Reservas con tu membresía: <strong>{activeOption.name}</strong>
                        </>
                      ) : (
                        <>
                          Reservas con tu paquete: <strong>{activeOption.name}</strong>
                          {typeof activeOption.remaining === "number"
                            ? ` (${activeOption.remaining} ${activeOption.remaining === 1 ? "crédito" : "créditos"})`
                            : ""}
                        </>
                      )}
                    </p>
                  ) : contextQuery.isError ? (
                    <p className="gafa-reservation-hint">
                      {contextQuery.error instanceof Error
                        ? contextQuery.error.message
                        : "No pudimos revisar tus paquetes."}
                    </p>
                  ) : (
                    <p className="gafa-reservation-hint">
                      No tienes paquetes para esta clase: en el siguiente paso puedes comprar uno.
                    </p>
                  )
                ) : (
                  <p className="gafa-reservation-hint">
                    Inicia sesión para reservar; te lo pedimos en el siguiente paso.
                  </p>
                )}
              </div>

              {needsSeat && seatMap ? (
                <SeatMapInline map={seatMap} selected={selectedSeat} onSelect={setSelectedSeat} />
              ) : null}

              {waitlistMode ? (
                <p className="gafa-reservation-hint">
                  La clase está llena. Únete a la lista de espera y te avisamos si se libera un lugar.
                </p>
              ) : null}
            </div>

            {flowError ? <p className="gafa-sdk-state gafa-sdk-state--error">{flowError}</p> : null}

            <div className="gafa-reservation-actions">
              <button className="gafa-sdk-button" type="button" disabled={primaryDisabled} onClick={handlePrimary}>
                {step === "processing" ? "Reservando…" : primaryLabel}
              </button>
              <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button" onClick={onClose}>
                Seguir viendo horarios
              </button>
            </div>
          </>
        ) : null}

        {step === "done" && result ? (
          <div className="gafa-reservation-success">
            <span className="gafa-reservation-success__icon" aria-hidden="true">
              ✓
            </span>
            <h3>{result.isWaitlist ? "Estás en la lista de espera" : "¡Reserva confirmada!"}</h3>
            <p>
              {meeting.name} · {formatDate(getMeetingStart(meeting))} ·{" "}
              {formatTime(getMeetingStart(meeting), meeting.timezone)}
            </p>
            {selectedSeat?.label ? (
              <p className="gafa-reservation-success__seat">
                Tu lugar: <strong>{selectedSeat.label}</strong>
              </p>
            ) : null}
            {activeOption ? (
              <p className="gafa-muted">
                {activeOption.kind === "membership" ? (
                  <>
                    Reservaste con tu membresía <strong>{activeOption.name}</strong>.
                  </>
                ) : typeof activeOption.remaining === "number" ? (
                  <>
                    Usaste tu paquete <strong>{activeOption.name}</strong>: te{" "}
                    {activeOption.remaining - 1 === 1 ? "queda" : "quedan"}{" "}
                    <strong>{activeOption.remaining - 1}</strong>{" "}
                    {activeOption.remaining - 1 === 1 ? "crédito" : "créditos"}.
                  </>
                ) : (
                  <>
                    Reservaste con tu paquete <strong>{activeOption.name}</strong>.
                  </>
                )}
              </p>
            ) : null}
            <AddToCalendarRow meeting={meeting} seatLabel={selectedSeat?.label} />

            <div className="gafa-reservation-actions">
              <button className="gafa-sdk-button" type="button" onClick={onClose}>
                Listo
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- agregar a calendario */

function calendarEventFor(meeting: Meeting, seatLabel?: string) {
  const start = new Date(getMeetingStart(meeting).replace(" ", "T"));
  const durationMinutes = getDurationMinutes(meeting) ?? 60;
  const end = meeting.endsAt ? new Date(meeting.endsAt.replace(" ", "T")) : new Date(start.getTime() + durationMinutes * 60_000);

  const title = `${meeting.service?.name ?? meeting.serviceName ?? meeting.name}${
    meeting.location?.name ? ` · ${meeting.location.name}` : ""
  }`;
  const detailParts = [
    `Coach: ${getStaffName(meeting)}`,
    seatLabel ? `Tu lugar: ${seatLabel}` : null,
    meeting.location?.name ? `Sede: ${meeting.location.name}` : null,
  ].filter(Boolean);

  return {
    start,
    end,
    title,
    description: detailParts.join("\n"),
    location: meeting.location?.name ?? "",
  };
}

/** UTC compacto (20260814T120000Z), el formato que Google y el .ics esperan. */
function toCalendarUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function AddToCalendarRow({ meeting, seatLabel }: { meeting: Meeting; seatLabel?: string }) {
  const event = calendarEventFor(meeting, seatLabel);

  const googleUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(event.title)}` +
    `&dates=${toCalendarUtc(event.start)}/${toCalendarUtc(event.end)}` +
    `&details=${encodeURIComponent(event.description)}` +
    `&location=${encodeURIComponent(event.location)}`;

  const outlookUrl =
    "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent" +
    `&subject=${encodeURIComponent(event.title)}` +
    `&startdt=${encodeURIComponent(event.start.toISOString())}` +
    `&enddt=${encodeURIComponent(event.end.toISOString())}` +
    `&body=${encodeURIComponent(event.description)}` +
    `&location=${encodeURIComponent(event.location)}`;

  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Buq//SDK v2//ES",
      "BEGIN:VEVENT",
      `UID:buq-reserva-${meeting.id}@buq.mx`,
      `DTSTAMP:${toCalendarUtc(new Date())}`,
      `DTSTART:${toCalendarUtc(event.start)}`,
      `DTEND:${toCalendarUtc(event.end)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      `LOCATION:${escapeIcsText(event.location)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reserva.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="gafa-addtocal">
      <span className="gafa-addtocal__title">Agrégala a tu calendario</span>
      <div className="gafa-addtocal__row">
        <a className="gafa-addtocal__button" href={googleUrl} target="_blank" rel="noreferrer">
          <GoogleCalIcon />
          Google
        </a>
        {/* Apple abre el .ics directo en Calendario (iOS/macOS). */}
        <button className="gafa-addtocal__button" type="button" onClick={downloadIcs}>
          <AppleIcon />
          Apple
        </button>
        <a className="gafa-addtocal__button" href={outlookUrl} target="_blank" rel="noreferrer">
          <OutlookIcon />
          Outlook
        </a>
        <button className="gafa-addtocal__button" type="button" onClick={downloadIcs}>
          <DownloadIcon />
          .ics
        </button>
      </div>
    </div>
  );
}

function GoogleCalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.33Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M12 21.6c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A9.99 9.99 0 0 0 12 21.6Z"
        fill="currentColor"
        opacity="0.65"
      />
      <path
        d="M6.41 13.5a6 6 0 0 1 0-3.83V7.06H3.06a10 10 0 0 0 0 8.97l3.35-2.53Z"
        fill="currentColor"
        opacity="0.45"
      />
      <path
        d="M12 6.55c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2.4a9.99 9.99 0 0 0-8.94 5.53l3.35 2.6C7.2 8.31 9.4 6.55 12 6.55Z"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.9c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.16-2.06-3.84-2.09-1.63-.17-3.19.96-4.02.96-.83 0-2.11-.94-3.47-.91-1.78.03-3.43 1.04-4.35 2.64-1.86 3.22-.48 7.98 1.33 10.59.88 1.28 1.93 2.71 3.31 2.66 1.33-.05 1.83-.86 3.44-.86s2.06.86 3.47.83c1.43-.02 2.34-1.3 3.21-2.58 1.01-1.48 1.43-2.92 1.45-2.99-.03-.01-2.78-1.07-2.8-4.25ZM13.72 5.06c.73-.89 1.23-2.13 1.09-3.36-1.06.04-2.34.7-3.1 1.59-.68.79-1.28 2.05-1.12 3.26 1.18.09 2.4-.6 3.13-1.49Z" />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5.5" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="8.5" cy="12" rx="2.6" ry="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 9h5.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H15" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 10 3 2.4a1 1 0 0 0 1.2 0l1.8-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5v11m0 0 4.2-4.2M12 14.5 7.8 10.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Coach con foto; si no hay foto (o no carga), solo el nombre, sin circulo roto. */
function CoachInfo({ meeting }: { meeting: Meeting }) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const photo = meeting.staff?.photoUrl;

  return (
    <div className="gafa-reservation-coach">
      {photo && !photoBroken ? (
        <img src={photo} alt="" aria-hidden="true" onError={() => setPhotoBroken(true)} />
      ) : null}
      <div>
        <span>Coach</span>
        <strong>{getStaffName(meeting)}</strong>
      </div>
    </div>
  );
}

/**
 * Mapa de salon inline (mismo paso que el detalle). Usa las imagenes de spot
 * que la marca sube en gafa.fit: vacio / ocupado / elegido. Sin imagen, cae a
 * los circulos con estilo del tema.
 */
function SeatMapInline({
  map,
  selected,
  onSelect,
}: {
  map: SeatMap;
  selected: SeatMapObject | null;
  onSelect(seat: SeatMapObject | null): void;
}) {
  // La leyenda usa las MISMAS imagenes de la marca que el mapa: nuestros
  // circulos genericos mentian (en Fitspin el gris es disponible, no ocupado).
  const sample = map.objects.find((seat) => seat.type === "public" && seat.image);

  return (
    <div className="gafa-seatmap">
      <div className="gafa-seatmap__legend">
        <span>
          {sample?.image ? <img src={sample.image} alt="" /> : <i className="gafa-seatmap__dot" />} Disponible
        </span>
        <span>
          {sample?.imageDisabled ? (
            <img src={sample.imageDisabled} alt="" />
          ) : (
            <i className="gafa-seatmap__dot gafa-seatmap__dot--taken" />
          )}{" "}
          Ocupado
        </span>
        <span>
          {sample?.imageSelected ? (
            <img src={sample.imageSelected} alt="" />
          ) : (
            <i className="gafa-seatmap__dot gafa-seatmap__dot--selected" />
          )}{" "}
          Tu lugar
        </span>
      </div>

      <div
        className="gafa-seatmap__grid"
        role="listbox"
        aria-label="Lugares del salón"
        style={{ gridTemplateColumns: `repeat(${map.columns}, 1fr)` }}
      >
        {map.objects.map((seat) => {
          const style: React.CSSProperties = {
            gridColumn: `${seat.column + 1} / span ${seat.width}`,
            gridRow: `${seat.row + 1} / span ${seat.height}`,
          };

          if (seat.type !== "public") {
            // Objetos decorativos (coach, bocinas...): con su imagen si existe.
            return seat.image ? (
              <img className="gafa-seatmap__fixture-img" key={seat.id} src={seat.image} alt="" style={style} />
            ) : (
              <div className="gafa-seatmap__fixture" key={seat.id} style={style} title={seat.type}>
                {seat.type === "coach" ? "COACH" : ""}
              </div>
            );
          }

          const disabled = seat.isBlocked || seat.isOccupied;
          const isSelected = selected?.id === seat.id;
          const stateImage = disabled
            ? seat.imageDisabled || seat.image
            : isSelected
              ? seat.imageSelected || seat.image
              : seat.image;

          return (
            <button
              key={seat.id}
              type="button"
              className="gafa-seatmap__seat"
              style={style}
              role="option"
              aria-selected={isSelected}
              aria-label={`Lugar ${seat.label}`}
              data-taken={disabled ? "true" : undefined}
              data-selected={isSelected ? "true" : undefined}
              data-has-image={stateImage ? "true" : undefined}
              disabled={disabled}
              onClick={() => onSelect(isSelected ? null : seat)}
            >
              {stateImage ? <img src={stateImage} alt="" loading="lazy" /> : null}
              <span className="gafa-seatmap__seat-label">{seat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Login/registro DENTRO del flujo de reserva: aparece sobre el calendario, y al
 * autenticarse el componente padre continua solo hacia el checkout. Asi el
 * usuario nunca "sale" de la clase que estaba reservando.
 */
function ReservationAuthGate({
  client,
  captcha,
  meeting,
  brandSlug,
  onClose,
  onAuthenticated,
}: {
  client: GafaClient;
  captcha?: CaptchaProvider;
  meeting: Meeting;
  brandSlug: string;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  return (
    <div className="gafa-reservation-overlay" role="dialog" aria-modal="true" aria-labelledby="reservation-auth-title">
      <div className="gafa-reservation-sheet">
        <button className="gafa-reservation-close" type="button" aria-label="Cerrar" onClick={onClose}>
          x
        </button>

        <div className="gafa-reservation-hero">
          <span className="gafa-eyebrow">Casi listo</span>
          <h3 id="reservation-auth-title">Inicia sesión para reservar</h3>
          <p>
            {meeting.name} · {formatDate(getMeetingStart(meeting))} ·{" "}
            {formatTime(getMeetingStart(meeting), meeting.timezone)}
          </p>
        </div>

        <AuthWidget
          client={client}
          captcha={captcha}
          brandSlug={brandSlug}
          initialView="login"
          onAuthenticated={onAuthenticated}
        />
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

function formatShortDate(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(date);
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

/** Semaforo: verde 70%+ libre, amarillo 30–69%, rojo menos del 30%. */
function availabilityLevel(available: number, capacity: number): "green" | "yellow" | "red" {
  if (capacity <= 0) return "red";
  const freeRatio = available / capacity;
  if (freeRatio >= 0.7) return "green";
  if (freeRatio >= 0.3) return "yellow";
  return "red";
}

function AvailabilityPill({ meeting, compact = false }: { meeting: Meeting; compact?: boolean }) {
  if (meeting.isReserved) {
    return <span className="gafa-availability-pill gafa-availability-pill--reserved">Reservado</span>;
  }

  if (typeof meeting.available === "number" && typeof meeting.capacity === "number") {
    return (
      <span className="gafa-availability-pill" data-level={availabilityLevel(meeting.available, meeting.capacity)}>
        {meeting.available}/{meeting.capacity}
        {compact ? "" : " lugares"}
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

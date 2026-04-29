import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WidgetShell } from "./WidgetShell";
import type { Brand, GafaClient, Location, Meeting, Service, StaffMember } from "../client/types";

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
  visualization?: string;
  showDescription?: boolean;
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
  visualization = "agenda",
  showDescription = false,
}: CalendarWidgetProps) {
  const [selectedFilters, setSelectedFilters] = useState<CalendarFiltersState>({});
  const range = useMemo(() => defaultMeetingRange(), []);

  const brandsQuery = useQuery({
    queryKey: ["calendar", "brands"],
    queryFn: async () => {
      if (!client) return demoBrands();
      return client.listBrands();
    },
  });

  const activeBrand = useMemo(
    () => findActiveBrand(brandsQuery.data ?? [], selectedFilters.brandSlug, filters.brandId),
    [brandsQuery.data, filters.brandId, selectedFilters.brandSlug],
  );

  const locationsQuery = useQuery({
    enabled: Boolean(activeBrand) || !client,
    queryKey: ["calendar", "locations", activeBrand?.slug],
    queryFn: async () => {
      if (!client) return demoLocations();
      return client.listLocations(activeBrand?.slug);
    },
  });

  const activeLocation = useMemo(
    () => findActiveLocation(locationsQuery.data ?? [], selectedFilters.locationId, filters.locationId),
    [filters.locationId, locationsQuery.data, selectedFilters.locationId],
  );

  const servicesQuery = useQuery({
    enabled: Boolean(activeBrand) || !client,
    queryKey: ["calendar", "services", activeBrand?.slug],
    queryFn: async () => {
      if (!client) return demoServices();
      return client.listServices(activeBrand?.slug);
    },
  });

  const staffQuery = useQuery({
    enabled: Boolean(activeBrand) || !client,
    queryKey: ["calendar", "staff", activeBrand?.slug],
    queryFn: async () => {
      if (!client) return demoStaff();
      return client.listStaff(activeBrand?.slug);
    },
  });

  const meetingsQuery = useQuery({
    enabled: Boolean(activeLocation) || !client,
    queryKey: [
      "calendar",
      "meetings",
      activeLocation?.id,
      selectedFilters.serviceId,
      selectedFilters.staffId,
      range.from,
      range.to,
    ],
    queryFn: async () => {
      if (!client) return demoMeetings();
      return client.listMeetings({
        locationId: activeLocation?.id,
        serviceId: selectedFilters.serviceId ?? filters.serviceId,
        staffId: selectedFilters.staffId ?? filters.staffId,
        ...range,
      });
    },
  });

  const filteredMeetings = useMemo(
    () =>
      applyLocalMeetingFilters(meetingsQuery.data ?? [], {
        serviceId: selectedFilters.serviceId ?? filters.serviceId,
        staffId: selectedFilters.staffId ?? filters.staffId,
      }).slice(0, limit),
    [filters.serviceId, filters.staffId, limit, meetingsQuery.data, selectedFilters.serviceId, selectedFilters.staffId],
  );

  const meetingsByDay = useMemo(() => groupMeetingsByDay(filteredMeetings), [filteredMeetings]);
  const isLoading = brandsQuery.isLoading || locationsQuery.isLoading || meetingsQuery.isLoading;
  const hasError = brandsQuery.isError || locationsQuery.isError || servicesQuery.isError || staffQuery.isError || meetingsQuery.isError;

  return (
    <WidgetShell
      eyebrow="Reservas"
      title="Calendario de servicios"
      description="Una agenda mobile-first para encontrar clases, servicios y horarios disponibles."
    >
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
      />

      {isLoading ? <p className="gafa-sdk__state">Cargando calendario...</p> : null}
      {hasError ? (
        <p className="gafa-sdk__state gafa-sdk__state--error">No pudimos cargar el calendario.</p>
      ) : null}
      <div className="gafa-calendar" data-visualization={visualization}>
        {!isLoading && Object.entries(meetingsByDay).length === 0 ? (
          <div className="gafa-empty-state">
            <strong>No hay horarios disponibles</strong>
            <span>Prueba cambiando los filtros o seleccionando otra ubicacion.</span>
          </div>
        ) : (
          Object.entries(meetingsByDay).map(([day, meetings]) => (
            <section className="gafa-day-group" key={day}>
              <h3>{day}</h3>
              <div className="gafa-meeting-list">
                {meetings.map((meeting) => (
                  <article className="gafa-meeting-card" key={meeting.id}>
                    <div className="gafa-meeting-card__body">
                      <span className="gafa-meeting-time">{formatTime(getMeetingStart(meeting))}</span>
                      <h4>{meeting.name}</h4>
                      <p>{meeting.service?.name ?? meeting.serviceName ?? meeting.staff?.name ?? "Servicio"}</p>
                      <p className="gafa-meeting-meta">
                        {getStaffName(meeting)}
                        {meeting.location?.name ? ` · ${meeting.location.name}` : ""}
                      </p>
                      {showDescription && meeting.description ? <p>{meeting.description}</p> : null}
                    </div>
                    <div className="gafa-meeting-card__aside">
                      <AvailabilityPill meeting={meeting} />
                      <button className="gafa-sdk-button" disabled={isSoldOut(meeting)} type="button">
                        {meeting.isReserved ? "Reservado" : isSoldOut(meeting) ? "Sin lugares" : "Reservar"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </WidgetShell>
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
}) {
  const shouldShowFilters = filters.brand || filters.location || filters.service || filters.staff;

  if (!shouldShowFilters) {
    return null;
  }

  return (
    <div className="gafa-calendar-filters" aria-label="Filtros de calendario">
      {filters.brand ? (
        <label>
          Marca
          <select
            value={selected.brandSlug ?? activeBrandSlug ?? ""}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                brandSlug: event.target.value || undefined,
                locationId: undefined,
              }))
            }
          >
            {brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {filters.location ? (
        <label>
          Ubicacion
          <select
            value={selected.locationId ?? activeLocationId ?? ""}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                locationId: toOptionalNumber(event.target.value),
              }))
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

      {filters.service ? (
        <label>
          Servicio
          <select
            value={selected.serviceId ?? ""}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                serviceId: toOptionalNumber(event.target.value),
              }))
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

      {filters.staff ? (
        <label>
          Staff
          <select
            value={selected.staffId ?? ""}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                staffId: toOptionalNumber(event.target.value),
              }))
            }
          >
            <option value="">Todos</option>
            {staff.map((staffMember) => (
              <option key={staffMember.id} value={staffMember.id}>
                {staffMember.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
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

function isSoldOut(meeting: Meeting): boolean {
  if (meeting.availability === "sold-out") return true;
  if (typeof meeting.available === "number") return meeting.available <= 0 && !meeting.isReserved;
  if (typeof meeting.availability === "object" && meeting.availability.capacity) {
    return (meeting.availability.reserved ?? 0) >= meeting.availability.capacity;
  }

  return false;
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

function defaultMeetingRange() {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 14);

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function demoMeetings(): Meeting[] {
  const first = new Date();
  first.setHours(8, 0, 0, 0);

  const second = new Date();
  second.setDate(second.getDate() + 1);
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

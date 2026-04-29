import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WidgetShell } from "./WidgetShell";
import type { GafaClient, Meeting } from "../client/types";

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

export function CalendarWidget({
  client,
  filters = {},
  visualization = "agenda",
  showDescription = false,
}: CalendarWidgetProps) {
  const query = useQuery({
    queryKey: ["meetings", filters],
    queryFn: async () => {
      if (!client) {
        return demoMeetings();
      }

      const brands = await client.listBrands();
      const brand = brands[0];
      if (!brand) {
        return [];
      }

      const locations = await client.listLocations(brand.slug);
      const location = locations[0];
      if (!location) {
        return [];
      }

      return client.listMeetings({
        locationId: location.id,
        ...defaultMeetingRange(),
      });
    },
  });

  const meetingsByDay = useMemo(() => groupMeetingsByDay(query.data ?? []), [query.data]);

  return (
    <WidgetShell
      eyebrow="Reservas"
      title="Calendario de servicios"
      description="Una agenda mobile-first para encontrar clases, servicios y horarios disponibles."
    >
      {query.isLoading ? <p className="gafa-sdk__state">Cargando calendario...</p> : null}
      {query.isError ? (
        <p className="gafa-sdk__state gafa-sdk__state--error">No pudimos cargar el calendario.</p>
      ) : null}
      <div className="gafa-calendar" data-visualization={visualization}>
        {Object.entries(meetingsByDay).length === 0 ? (
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
                    <div>
                      <span className="gafa-meeting-time">{formatTime(meeting.startsAt)}</span>
                      <h4>{meeting.name}</h4>
                      <p>{meeting.service?.name ?? meeting.serviceName ?? meeting.staff?.name ?? "Servicio"}</p>
                      {showDescription && meeting.description ? <p>{meeting.description}</p> : null}
                    </div>
                    <button className="gafa-button" type="button">
                      Reservar
                    </button>
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

function groupMeetingsByDay(meetings: Meeting[]) {
  return meetings.reduce<Record<string, Meeting[]>>((groups, meeting) => {
    const day = new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(meeting.startsAt));

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
      staff: { id: 1, name: "Coach Demo" },
      service: { id: 1, name: "Training" },
      availability: "available",
    },
    {
      id: 2,
      name: "Yoga Flow",
      startsAt: second.toISOString(),
      staff: { id: 2, name: "Coach Wellness" },
      service: { id: 2, name: "Yoga" },
      availability: "waitlist",
    },
  ];
}

import type { Meeting } from "../client/types";
import { timeOfDayFor, type TimeOfDay } from "./calendarRange";

/**
 * Token CSS estable a partir de un nombre de servicio (v1: `service-open-gym`).
 * Quita acentos para que "Pílates" no se convierta en "plates".
 */
export function cssToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function meetingServiceName(meeting: Meeting): string {
  return (meeting.service?.name ?? meeting.serviceName ?? meeting.name ?? "").trim();
}

export function meetingServiceSlug(meeting: Meeting): string {
  return cssToken(meetingServiceName(meeting));
}

function meetingStart(meeting: Meeting): string {
  return meeting.startsAt ?? meeting.start ?? meeting.startTime ?? "";
}

export function meetingDaypart(meeting: Meeting): Exclude<TimeOfDay, "all"> | null {
  return timeOfDayFor(meetingStart(meeting), meeting.timezone);
}

export function meetingCardHooks(meeting: Meeting): {
  className: string;
  service: string;
  serviceId: string;
  daypart: string;
} {
  const service = meetingServiceSlug(meeting);
  const id = meeting.service?.id ?? meeting.serviceId;
  const daypart = meetingDaypart(meeting);
  return {
    className: ["gafa-meeting-card", service ? `service-${service}` : ""].filter(Boolean).join(" "),
    service,
    serviceId: id == null || String(id).trim() === "" ? "" : String(id),
    daypart: daypart ?? "",
  };
}

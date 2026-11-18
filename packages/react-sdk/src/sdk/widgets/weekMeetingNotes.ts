import { coerceFlag } from "../cart/membershipPayOptions";

/**
 * Compañía gafa.fit de Casa Onze (marcas CDMX `cdmx` / 158 y Mérida `merida` / 159).
 * Sitio: Buq-Webs `/casa-onze`. El HTML inyecta `COMPANY_ID: 146`.
 */
export const CASA_ONZE_COMPANY_ID = 146;

/**
 * Vista semanal: por default la nota extra va en la `i` (tooltip). Casa Onze
 * la pide como texto bajo el nombre. Opt-in para el resto:
 * `SHOW_WEEK_MEETING_NOTES` en Hub / `data-gf-options`, o el atributo
 * `data-bq-show-week-notes` del calendario.
 *
 * `false` explícito apaga incluso a Casa Onze.
 */
export function resolveShowWeekMeetingNotes(input: {
  showWeekMeetingNotes?: boolean;
  companyId?: number;
}): boolean {
  if (input.showWeekMeetingNotes === true) return true;
  if (input.showWeekMeetingNotes === false) return false;
  return Number(input.companyId) === CASA_ONZE_COMPANY_ID;
}

export function readShowWeekMeetingNotesFlag(value: unknown): boolean | undefined {
  return coerceFlag(value);
}

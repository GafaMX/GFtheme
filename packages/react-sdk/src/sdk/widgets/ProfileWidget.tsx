import type { GafaClient } from "../client/types";
import { WidgetShell } from "./WidgetShell";

export type ProfileWidgetProps = {
  client?: GafaClient;
  combineWaitlist?: boolean;
};

export function ProfileWidget({ combineWaitlist = false }: ProfileWidgetProps) {
  return (
    <WidgetShell
      eyebrow="Perfil"
      title="Tu cuenta en un solo lugar"
      description="Datos personales, creditos, membresias, reservas futuras, historial y metodos de pago preparados para la nueva experiencia."
    >
      <div className="gafa-sdk-profile-grid">
        <section className="gafa-sdk-panel">
          <span className="gafa-sdk-label">Datos</span>
          <strong>Perfil editable</strong>
          <p>Nombre, contacto, direccion y preferencias.</p>
        </section>
        <section className="gafa-sdk-panel">
          <span className="gafa-sdk-label">Actividad</span>
          <strong>Reservas y waitlist</strong>
          <p>
            {combineWaitlist
              ? "Waitlist combinado con proximas reservas."
              : "Waitlist separado para mantener el contrato actual."}
          </p>
        </section>
      </div>
    </WidgetShell>
  );
}

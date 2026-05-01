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
      description="Perfil moderno para que cada cliente consulte reservas, creditos, membresias y metodos de pago sin salir del sitio."
    >
      <div className="gafa-sdk-profile-grid">
        <section className="gafa-sdk-panel">
          <span className="gafa-sdk-label">Datos</span>
          <h3>Perfil editable</h3>
          <p>Nombre, contacto, direccion y preferencias.</p>
          <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button">
            Editar perfil
          </button>
        </section>
        <section className="gafa-sdk-panel">
          <span className="gafa-sdk-label">Actividad</span>
          <h3>Reservas y waitlist</h3>
          <p>
            {combineWaitlist
              ? "Waitlist combinado con proximas reservas."
              : "Waitlist separado para mantener el contrato actual."}
          </p>
          <div className="gafa-profile-stats">
            <span>5 creditos</span>
            <span>2 reservas</span>
          </div>
        </section>
      </div>
    </WidgetShell>
  );
}

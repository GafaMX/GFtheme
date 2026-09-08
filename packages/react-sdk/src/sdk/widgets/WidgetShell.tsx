import type { PropsWithChildren, ReactNode } from "react";
import { RemoteImage } from "../images/ImagesProvider";

type WidgetShellProps = PropsWithChildren<{
  eyebrow?: string;
  title?: string;
  description?: string;
  logoUrl?: string;
  actions?: ReactNode;
}>;

export function WidgetShell({
  eyebrow,
  title,
  description,
  logoUrl,
  actions,
  children,
}: WidgetShellProps) {
  const showHeader = Boolean(eyebrow || title || description || logoUrl || actions);

  return (
    <section className="gafa-widget-card" data-header={showHeader ? "true" : "false"}>
      {showHeader ? (
        <header className="gafa-widget-header">
          <div className="gafa-widget-heading">
            {/* El "logo" del perfil es la foto que sube el usuario, del mismo
                storage que las de coach: se pide en miniatura, pero si no hay
                transformaciones se deja el original (es una sola imagen). */}
            <RemoteImage
              className="gafa-widget-logo"
              src={logoUrl}
              height={42}
              fit="scale-down"
              whenUnavailable="original"
              alt=""
              aria-hidden="true"
            />
            <div>
              {eyebrow ? <p className="gafa-eyebrow">{eyebrow}</p> : null}
              {title ? <h2>{title}</h2> : null}
              {description ? <p className="gafa-muted">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="gafa-widget-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

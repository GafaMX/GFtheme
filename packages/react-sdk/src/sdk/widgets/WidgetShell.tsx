import type { PropsWithChildren, ReactNode } from "react";

type WidgetShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
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
  return (
    <section className="gafa-widget-card">
      <header className="gafa-widget-header">
        <div className="gafa-widget-heading">
          {logoUrl ? (
            <img className="gafa-widget-logo" src={logoUrl} alt="" aria-hidden="true" />
          ) : null}
          <div>
            {eyebrow ? <p className="gafa-eyebrow">{eyebrow}</p> : null}
            <h2>{title}</h2>
            {description ? <p className="gafa-muted">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="gafa-widget-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

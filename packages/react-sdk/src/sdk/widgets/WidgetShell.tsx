import type { PropsWithChildren, ReactNode } from "react";

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
            {logoUrl ? (
              <img className="gafa-widget-logo" src={logoUrl} alt="" aria-hidden="true" />
            ) : null}
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

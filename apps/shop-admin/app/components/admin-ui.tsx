import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

type MetricItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Exclude<Tone, "info" | "accent">;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function buttonClassName(variant: ButtonVariant = "primary") {
  return cx("admin-button", variant !== "primary" && `admin-button-${variant}`);
}

export function AdminPage(props: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { eyebrow, title, description, actions, children } = props;

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="admin-page-copy">
          {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
          <h1 className="admin-page-title">{title}</h1>
          {description ? <div className="admin-page-description">{description}</div> : null}
        </div>
        {actions ? <div className="admin-page-actions">{actions}</div> : null}
      </header>

      <div className="admin-page-sections">{children}</div>
    </div>
  );
}

export function AdminPanel(props: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "forest";
  children: ReactNode;
}) {
  const { title, subtitle, actions, tone = "default", children } = props;

  return (
    <section className={cx("admin-panel", tone === "forest" && "admin-panel-forest")}>
      <div className="admin-panel-header">
        <div className="admin-panel-copy">
          <h2 className="admin-panel-title">{title}</h2>
          {subtitle ? <div className="admin-panel-subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="admin-panel-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricGrid(props: {
  items: readonly MetricItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const { items, columns = 3, className } = props;

  return (
    <div className={cx("admin-metric-grid", `admin-metric-grid-cols-${columns}`, className)}>
      {items.map((item) => (
        <article
          key={item.label}
          className={cx("admin-metric-card", item.tone && `admin-metric-card-${item.tone}`)}
        >
          <p className="admin-metric-label">{item.label}</p>
          <div className="admin-metric-value">{item.value}</div>
          {item.detail ? <div className="admin-metric-detail">{item.detail}</div> : null}
        </article>
      ))}
    </div>
  );
}

export function InlineMessage(props: {
  tone?: Tone;
  children: ReactNode;
}) {
  const { tone = "info", children } = props;

  return <div className={cx("admin-message", `admin-message-${tone}`)}>{children}</div>;
}

export function StatusBadge(props: {
  tone?: Tone;
  children: ReactNode;
}) {
  const { tone = "neutral", children } = props;

  return <span className={cx("admin-badge", `admin-badge-${tone}`)}>{children}</span>;
}

export function Field(props: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const { label, htmlFor, children } = props;

  return (
    <label className="admin-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

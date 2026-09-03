type PageHeaderMeta = {
  label: string;
  tone?: "brand" | "warning";
};

type PageHeaderTone = "applications" | "interviews" | "analytics";

export function PageHeader({
  kicker,
  title,
  description,
  meta = [],
  actions,
  toolsLayout = "inline",
  tone = "applications",
}: {
  kicker: string;
  title: string;
  description: string;
  meta?: PageHeaderMeta[];
  actions?: React.ReactNode;
  toolsLayout?: "inline" | "stacked";
  tone?: PageHeaderTone;
}) {
  return (
    <header
      className={`workspace-page-header tone-${tone}${meta.length ? " has-meta" : ""}${actions ? " has-actions" : ""}`}
    >
      <div className="workspace-page-header-copy">
        <p className="workspace-page-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="lead">{description}</p>
      </div>
      {meta.length || actions ? (
        <div
          className={`workspace-page-tools${meta.length ? " has-meta" : ""}${actions ? " has-actions" : ""}${toolsLayout === "stacked" ? " is-stacked" : ""}`}
        >
          {meta.length ? (
            <ul className="workspace-page-meta" aria-label={`${title}摘要`}>
              {meta.map((item) => (
                <li
                  className={item.tone ? `is-${item.tone}` : undefined}
                  key={item.label}
                >
                  <span aria-hidden="true" />
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}
          {actions ? (
            <div className="actions workspace-page-actions">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

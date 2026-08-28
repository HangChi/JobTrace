type PageHeaderMeta = {
  label: string;
  tone?: "brand" | "warning";
};

export function PageHeader({
  kicker,
  title,
  description,
  meta = [],
  actions,
}: {
  kicker: string;
  title: string;
  description: string;
  meta?: PageHeaderMeta[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="workspace-page-header">
      <div className="workspace-page-header-copy">
        <p className="workspace-page-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="lead">{description}</p>
        {meta.length ? (
          <ul className="workspace-page-meta" aria-label={`${title}摘要`}>
            {meta.map((item) => (
              <li
                className={item.tone ? `is-${item.tone}` : undefined}
                key={item.label}
              >
                {item.tone ? <span aria-hidden="true" /> : null}
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {actions ? (
        <div className="actions workspace-page-actions">{actions}</div>
      ) : null}
    </header>
  );
}

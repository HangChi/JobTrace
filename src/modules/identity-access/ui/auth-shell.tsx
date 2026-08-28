import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  eyebrow?: string;
};

export function AuthShell({
  title,
  description,
  children,
  footer,
  eyebrow,
}: AuthShellProps) {
  return (
    <section className="auth-page">
      <div className="auth-main">
        <div className="auth-main-inner">
          <Link className="auth-brand" href="/" aria-label="JobTrace 职迹首页">
            <span className="auth-brand-mark" aria-hidden="true">
              J
            </span>
            <span>
              <strong>JobTrace</strong>
              <small>职迹</small>
            </span>
          </Link>
          <header className="auth-heading">
            {eyebrow && <p className="auth-kicker">{eyebrow}</p>}
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
          <footer className="auth-footer">{footer}</footer>
        </div>
      </div>
    </section>
  );
}

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
  eyebrow = "你的求职工作台",
}: AuthShellProps) {
  return (
    <section className="auth-page">
      <aside className="auth-story" aria-label="JobTrace 产品介绍">
        <Link className="auth-brand" href="/" aria-label="JobTrace 职迹首页">
          <span className="auth-brand-mark" aria-hidden="true">
            J
          </span>
          <span>
            <strong>JobTrace</strong>
            <small>职迹</small>
          </span>
        </Link>

        <div className="auth-story-copy">
          <p className="auth-story-kicker">把每一次投递，都变成清晰的下一步</p>
          <h2>
            求职路很长，
            <br />
            <span>别让机会走丢。</span>
          </h2>
          <p>从投递到面试，从跟进到 Offer，所有进展都在一条清晰的轨迹里。</p>
        </div>

        <ol className="auth-track" aria-label="求职流程">
          <li className="is-complete">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>记录投递</strong>
              <small>公司、岗位和来源</small>
            </div>
          </li>
          <li className="is-current">
            <span aria-hidden="true">2</span>
            <div>
              <strong>跟进进展</strong>
              <small>面试节点一目了然</small>
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <strong>复盘选择</strong>
              <small>找到更适合的机会</small>
            </div>
          </li>
        </ol>

        <p className="auth-story-note">为认真对待每一次机会的你而做</p>
      </aside>

      <div className="auth-main">
        <div className="auth-main-inner">
          <header className="auth-heading">
            <p className="auth-kicker">
              <span aria-hidden="true" />
              {eyebrow}
            </p>
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

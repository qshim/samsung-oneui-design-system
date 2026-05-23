import Link from "next/link";

export default function PageShell({ title, description, backHref, children }) {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          {backHref ? (
            <Link href={backHref} className="back-link">
              Back
            </Link>
          ) : (
            <div />
          )}
          {(title || description) && (
            <div style={{ marginTop: "12px" }}>
              <div className="app-brand">Samsung One UI Refactor</div>
              {title && <h1>{title}</h1>}
              {description ? <p className="app-description">{description}</p> : null}
            </div>
          )}
        </div>

        <nav className="app-nav">
          <Link href="/prototype">Prototype</Link>
          <Link href="/theme">Theme</Link>
        </nav>
      </header>

      {children}
    </main>
  );
}

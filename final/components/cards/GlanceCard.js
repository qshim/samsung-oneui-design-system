export default function GlanceCard({
  eyebrow,
  title,
  body,
  meta,
  accent = "#64e9e3",
}) {
  const isReminder = eyebrow && eyebrow.includes("TODAY");

  return (
    <article className="glance-card">
      {eyebrow ? <div className="glance-eyebrow">{eyebrow}</div> : null}
      {title ? <h3 className={`glance-title ${isReminder ? 'with-icon' : ''}`}>{title}</h3> : null}
      {body ? <p className="glance-body">{body}</p> : null}
      <div className="glance-footer">
        {meta ? <span className="glance-meta">{meta}</span> : <span />}
        <span className="glance-accent" style={{ background: accent }} />
      </div>
    </article>
  );
}

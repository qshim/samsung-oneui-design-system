export default function ThemePreviewBoard({ theme, cards, compact = false, previewBg }) {
  const vars = theme?.vars || {};
  const pageBg = previewBg || vars["--page-bg"] || "#2f7b80";
  const surfaceBg = vars["--surface-bg"] || "rgba(23,23,26,0.6)";
  const textPrimary = vars["--text-primary"] || "#efeef2";
  const textSecondary = vars["--text-secondary"] || "rgba(239,238,242,0.72)";
  const border = vars["--surface-border"] || "1px solid rgba(255,255,255,0.12)";
  const radius = vars["--card-radius"] || "20px";
  const paddingV = vars["--card-padding-v"] || "14px";
  const paddingH = vars["--card-padding-h"] || "16px";

  return (
    <section className="theme-preview-board-wrap">
      <div className="theme-preview-board" style={{ background: pageBg }}>
        <div className="theme-preview-board-inner">
          <div className="theme-preview-board-header">
            <div className="theme-preview-board-kicker">Live Preview · All Themed Cards</div>
            <strong>{theme?.name || "Theme Preview"}</strong>
          </div>

          <div className={`theme-preview-grid${compact ? " is-compact" : ""}`}>
            {cards.map((card) => (
              <article
                key={card.id}
                className={`theme-preview-glance-card is-${card.size || "card"}`}
                style={{
                  background: surfaceBg,
                  color: textPrimary,
                  border,
                  borderRadius: radius,
                  padding: `${paddingV} ${paddingH}`,
                }}
              >
                <div className="theme-preview-card-eyebrow">{card.eyebrow}</div>
                {card.icon ? (
                  <div className="theme-preview-card-icon">
                    <img src={card.icon} alt="" />
                  </div>
                ) : null}
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <span style={{ color: textSecondary }}>{card.meta}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

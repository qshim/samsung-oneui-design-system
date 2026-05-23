export default function ThemePreviewCard({ theme, active, onActivate }) {
  const vars = theme.vars || {};
  const pageBg = vars["--page-bg"] || "#0a0a0c";
  const surfaceBg = vars["--surface-bg"] || "rgba(23,23,26,0.6)";
  const textPrimary = vars["--text-primary"] || "#ffffff";
  const weatherAccent = vars["--card-weather-accent"] || "#FBBF24";
  const calendarAccent = vars["--card-calendar-accent"] || "#A78BFA";

  return (
    <article className="theme-card">
      <div className="theme-card-preview" style={{ background: pageBg }}>
        <div className="theme-preview-surface" style={{ background: surfaceBg, color: textPrimary }}>
          <div className="theme-preview-row">
            <span className="theme-preview-dot" style={{ background: weatherAccent }} />
            <span>Weather</span>
          </div>
          <div className="theme-preview-row">
            <span className="theme-preview-dot" style={{ background: calendarAccent }} />
            <span>Calendar</span>
          </div>
        </div>
      </div>

      <div className="theme-card-body">
        <div>
          <div className="theme-card-title-row">
            <strong>{theme.name}</strong>
            {active ? <span className="theme-active-badge">Active</span> : null}
          </div>
          <p>{theme.description || "설명 없음"}</p>
        </div>

        <button type="button" className="theme-activate-button" onClick={() => onActivate(theme.id)}>
          {active ? "사용 중" : "활성화"}
        </button>
      </div>
    </article>
  );
}

export default function MlpTile({ category, title, description, gradient }) {
  return (
    <article className="mlp-tile" style={{ background: gradient }}>
      <div className="mlp-tile-overlay" />
      <div className="mlp-tile-content">
        <div className="mlp-tile-category">{category}</div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

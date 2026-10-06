export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <div className="skel" style={{ width: 260, height: 48, marginTop: 18 }} />
      <div className="skel" style={{ width: "60%", height: 14, marginTop: 18 }} />
      <div style={{ marginTop: 36, borderTop: "1px solid var(--rule)" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ padding: "18px 0", borderBottom: "1px solid var(--rule)" }}>
            <div className="skel" style={{ width: "40%", height: 18 }} />
            <div className="skel" style={{ width: "75%", height: 12, marginTop: 10 }} />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

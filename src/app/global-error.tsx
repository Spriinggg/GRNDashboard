"use client";

// The last safety net: when even the layout breaks, so nothing else can draw. It has its own html and body and plain styles,
// because the theme, the menu and the data providers may be the thing that failed.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#faf7f3", color: "#2b1d14" }}>
        <div role="alert" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>The app could not start</h1>
          <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.75 }}>Something broke while loading. Your saved data is safe. Try again, and if it keeps happening, tell the person who looks after the system.</p>
          <button type="button" onClick={reset} style={{ height: 36, padding: "0 16px", border: 0, borderRadius: 8, background: "#c1272d", color: "#fff", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
          <p style={{ marginTop: 16, fontSize: 12, opacity: 0.6 }}>{error.digest ? `Reference ${error.digest}` : error.message}</p>
        </div>
      </body>
    </html>
  );
}

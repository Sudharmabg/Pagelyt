export default function NotFound() {
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", padding: "2rem" }}>
      <div>
        <h1>This report isn’t available</h1>
        <p>The link may have expired or been withdrawn. Please ask the person who sent it for a new one.</p>
      </div>
    </main>
  );
}

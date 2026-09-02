export function LoadingScreen({ label = 'Kopplar upp trafikledningen…' }: { label?: string }) {
  return <main className="loading-screen"><span className="loader" /><p>{label}</p></main>
}

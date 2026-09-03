export function LoadingScreen({ label = 'Kopplar upp trafikledningen…' }: { label?: string }) {
  return <main className="flex min-h-screen flex-col items-center justify-center bg-white text-[#666]"><span className="size-9 animate-spin rounded-full border-[3px] border-[#ddd] border-t-[#d70000]" /><p className="text-[12px] tracking-[0.05em]">{label}</p></main>
}

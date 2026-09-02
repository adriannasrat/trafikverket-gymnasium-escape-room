export function formatElapsed(milliseconds: number) {
  const value = Math.max(0, milliseconds)
  const minutes = Math.floor(value / 60_000)
  const seconds = Math.floor((value % 60_000) / 1_000)
  const tenths = Math.floor((value % 1_000) / 100)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

export function timerTone(remaining: number, total: number) {
  const ratio = total > 0 ? remaining / total : 0
  if (ratio <= 0.2) return 'danger'
  if (ratio <= 0.5) return 'warning'
  return 'safe'
}

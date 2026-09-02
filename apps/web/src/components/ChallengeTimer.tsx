import { timerTone } from '../lib/time'

export function ChallengeTimer({ remaining, total }: { remaining: number; total: number }) {
  const tone = timerTone(remaining, total)
  const percent = Math.max(0, Math.min(100, (remaining / total) * 100))
  return (
    <div className={`challenge-timer ${tone}`} aria-live="polite">
      <div className="timer-copy"><span>TID KVAR PÅ UPPDRAGET</span><strong>{Math.max(0, Math.ceil(remaining))} SEK</strong></div>
      <div className="timer-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

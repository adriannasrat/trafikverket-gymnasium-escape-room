import { timerTone } from '../lib/time'
import { barlow } from '../uiStyles'

const toneStyles = {
  safe: { bar: 'bg-[#23845e]', text: 'text-[#23845e]' },
  warning: { bar: 'bg-[#d59a00]', text: 'text-[#9c7000]' },
  danger: { bar: 'bg-[#c7352d]', text: 'text-[#c7352d]' },
}

export function ChallengeTimer({ remaining, total, complete = false }: { remaining: number; total: number; complete?: boolean }) {
  const tone = complete ? 'safe' : timerTone(remaining, total)
  const percent = complete ? 100 : Math.max(0, Math.min(100, (remaining / total) * 100))
  return (
    <div className="my-7 mb-8" aria-live="polite">
      <div className="mb-[9px] flex items-end justify-between"><span className="text-[9px] font-extrabold tracking-[0.15em] text-[#656565]">{complete ? 'FRÅGAN ÄR BESVARAD' : 'TID KVAR PÅ UPPDRAGET'}</span><strong className={`${barlow} text-[23px] ${toneStyles[tone].text}`}>{complete ? 'KLAR' : `${Math.max(0, Math.ceil(remaining))} SEK`}</strong></div>
      <div className="h-[9px] overflow-hidden bg-[#ddd]"><span className={`block h-full transition-[width] duration-100 ${toneStyles[tone].bar}`} style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

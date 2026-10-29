import { Heart, LockKeyhole, Star, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { barlow, focusRing } from '../uiStyles'

type Props = {
  mode?: 'player' | 'admin'
  playerName?: string
  elapsed?: string
  score?: number
  livesRemaining?: number
}

export function BrandHeader({ mode = 'player', playerName, elapsed, score, livesRemaining }: Props) {
  return (
    <header className="relative z-10 flex h-[72px] items-center justify-between border-b border-[#e4e4e4] bg-white px-[clamp(24px,4vw,68px)] max-[720px]:h-[66px] max-[720px]:px-4">
      <Link className={`flex items-center gap-[13px] ${focusRing}`} to="/" aria-label="Till startsidan">
        <span className="relative block h-[37px] w-11 -skew-y-12 max-[720px]:-mr-[7px] max-[720px]:w-[35px] max-[720px]:origin-left max-[720px]:scale-80" aria-hidden="true">
          <i className="my-1 block h-[7px] w-11 rounded-[1px] bg-[#d70000]" />
          <i className="my-1 ml-[5px] block h-[7px] w-[35px] rounded-[1px] bg-[#d70000]" />
          <i className="my-1 ml-[10px] block h-[7px] w-[25px] rounded-[1px] bg-[#d70000]" />
        </span>
        <span className="grid leading-none max-[520px]:hidden">
          <strong className={`${barlow} text-[23px] tracking-[0.08em] text-[#202020] max-[720px]:text-[18px]`}>TRAFIKVERKET</strong>
          <small className="mt-[5px] text-[9px] font-bold tracking-[0.26em] text-[#d70000] max-[720px]:text-[7px]">ESCAPE ROOM</small>
        </span>
      </Link>
      {mode === 'player' ? (
        <div className="flex shrink-0 items-center gap-3 max-[420px]:gap-1.5">
          {playerName && <span className="w-[150px] overflow-hidden border-l border-[#dedede] px-[18px] py-[3px] text-[13px] text-[#686868] whitespace-nowrap max-[900px]:w-[120px] max-[720px]:hidden">Spelare <strong className="ml-[5px] text-[#202020]">{playerName}</strong></span>}
          {score !== undefined && <span className="grid w-[76px] shrink-0 justify-items-end border-l border-[#dedede] px-[14px] py-[3px] max-[520px]:w-[48px] max-[520px]:border-0 max-[520px]:p-0" aria-label={`${score} poäng`}><small className="flex items-center gap-1 text-[8px] tracking-[0.14em] text-[#686868] max-[520px]:hidden"><Star size={9} fill="currentColor" /> POÄNG</small><strong className={`${barlow} w-full text-right text-[23px] leading-none text-[#23845e] tabular-nums max-[420px]:text-[18px]`}>{score.toLocaleString('sv-SE')}</strong></span>}
          {livesRemaining !== undefined && <span className="flex w-[108px] shrink-0 justify-center border-l border-[#dedede] px-[14px] py-[8px] max-[520px]:w-[76px] max-[520px]:border-0 max-[520px]:p-0" aria-label={`${livesRemaining} av 5 liv kvar`}>{Array.from({ length: 5 }, (_, index) => <Heart key={index} className={`size-[15px] shrink-0 max-[420px]:size-[11px] ${index < livesRemaining ? 'text-[#d70000]' : 'text-[#d5d5d5]'}`} fill="currentColor" strokeWidth={1.8} />)}</span>}
          {elapsed && <span className="grid w-[102px] shrink-0 justify-items-end border-l border-[#dedede] px-[12px] py-[3px] max-[520px]:w-[70px] max-[520px]:border-0 max-[520px]:p-0"><small className="text-[8px] tracking-[0.18em] text-[#686868]">TOTAL TID</small><strong className={`${barlow} w-full text-right text-[23px] tracking-[0.04em] tabular-nums max-[420px]:text-[18px]`}>{elapsed}</strong></span>}
          <Link className={`grid size-10 place-items-center rounded-full bg-[#f9eeee] text-[#d70000] max-[720px]:size-9 ${focusRing}`} to="/leaderboard" aria-label="Topplista"><Trophy size={19} /></Link>
        </div>
      ) : (
        <span className="flex items-center gap-[7px] px-[18px] py-[3px] text-[11px] font-bold uppercase tracking-[0.09em] text-[#555] max-[720px]:p-0"><LockKeyhole size={15} /><span className="max-[720px]:hidden">Säker administration</span></span>
      )}
    </header>
  )
}

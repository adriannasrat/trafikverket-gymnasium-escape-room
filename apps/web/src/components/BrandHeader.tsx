import { LockKeyhole, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { barlow, focusRing } from '../uiStyles'

type Props = { mode?: 'player' | 'admin'; playerName?: string; elapsed?: string }

export function BrandHeader({ mode = 'player', playerName, elapsed }: Props) {
  return (
    <header className="relative z-10 flex h-[72px] items-center justify-between border-b border-[#e4e4e4] bg-white px-[clamp(24px,4vw,68px)] max-[720px]:h-[66px] max-[720px]:px-4">
      <Link className={`flex items-center gap-[13px] ${focusRing}`} to="/" aria-label="Till startsidan">
        <span className="relative block h-[37px] w-11 -skew-y-12 max-[720px]:-mr-[7px] max-[720px]:w-[35px] max-[720px]:origin-left max-[720px]:scale-80" aria-hidden="true">
          <i className="my-1 block h-[7px] w-11 rounded-[1px] bg-[#d70000]" />
          <i className="my-1 ml-[5px] block h-[7px] w-[35px] rounded-[1px] bg-[#d70000]" />
          <i className="my-1 ml-[10px] block h-[7px] w-[25px] rounded-[1px] bg-[#d70000]" />
        </span>
        <span className="grid leading-none">
          <strong className={`${barlow} text-[23px] tracking-[0.08em] text-[#202020] max-[720px]:text-[18px]`}>TRAFIKVERKET</strong>
          <small className="mt-[5px] text-[9px] font-bold tracking-[0.26em] text-[#d70000] max-[720px]:text-[7px]">ESCAPE ROOM</small>
        </span>
      </Link>
      {mode === 'player' ? (
        <div className="flex items-center gap-3 max-[420px]:gap-[7px]">
          {playerName && <span className="border-l border-[#dedede] px-[18px] py-[3px] text-[13px] text-[#686868] max-[720px]:hidden">Spelare <strong className="ml-[5px] text-[#202020]">{playerName}</strong></span>}
          {elapsed && <span className="grid border-l border-[#dedede] px-[18px] py-[3px] pr-[6px] max-[720px]:border-0 max-[720px]:p-0"><small className="text-[8px] tracking-[0.18em] text-[#686868]">TOTAL TID</small><strong className={`${barlow} text-[23px] tracking-[0.06em] max-[420px]:text-[19px]`}>{elapsed}</strong></span>}
          <Link className={`grid size-10 place-items-center rounded-full bg-[#f9eeee] text-[#d70000] max-[720px]:size-9 ${focusRing}`} to="/leaderboard" aria-label="Topplista"><Trophy size={19} /></Link>
        </div>
      ) : (
        <span className="flex items-center gap-[7px] px-[18px] py-[3px] text-[11px] font-bold uppercase tracking-[0.09em] text-[#555] max-[720px]:p-0"><LockKeyhole size={15} /><span className="max-[720px]:hidden">Säker administration</span></span>
      )}
    </header>
  )
}

import { ArrowLeft, Medal, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { LoadingScreen } from '../components/LoadingScreen'
import { api } from '../lib/api'
import { formatElapsed } from '../lib/time'
import type { LeaderboardEntry } from '../types'
import { backLink, barlow, cx, eventFooter, eyebrow, focusRing } from '../uiStyles'

const podiumStyle = (rank: number) => {
  if (rank === 1) return 'border-l-[5px] border-l-[#d70000] bg-[#fffafa]'
  if (rank === 2) return 'border-l-[5px] border-l-[#777]'
  if (rank === 3) return 'border-l-[5px] border-l-[#b6b6b6]'
  return ''
}

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  useEffect(() => { api.leaderboard().then(setEntries).catch(() => setEntries([])) }, [])
  if (!entries) return <LoadingScreen label="Hämtar topplistan…" />
  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] bg-[#f5f5f5]">
      <BrandHeader />
      <main className="mx-auto w-[min(980px,100%)] px-[35px] py-[55px] max-[720px]:px-[18px] max-[720px]:py-[38px]">
        <Link className={`${backLink} mb-[38px]`} to="/"><ArrowLeft size={16} /> Nytt uppdrag</Link>
        <div className="mb-[30px]"><p className={eyebrow}><Trophy size={15} /> EVENTRESULTAT</p><h1 className={`${barlow} mb-2 text-[50px] leading-none text-[#202020] uppercase max-[720px]:text-[41px]`}>Snabbast genom systemet</h1><p className="text-[#686868]">Lägst totaltid placerar spelaren högst.</p></div>
        <section className="border border-[#dedede] bg-white shadow-[0_16px_45px_rgba(30,30,30,0.05)]">
          {entries.length === 0 ? <div className="px-[30px] py-[70px] text-center text-[#777]"><Medal className="mx-auto text-[#d70000]" size={34} /><h2 className={`${barlow} mt-[15px] mb-[5px] text-[30px] text-[#202020] uppercase`}>Första platsen väntar</h2><p className="text-[13px]">Slutför ett uppdrag för att sätta eventets första tid.</p></div> : (
            <ol className="m-0 list-none p-0">{entries.map((entry) => <li key={entry.id} className={cx('grid grid-cols-[60px_1fr_auto] items-center border-b border-[#e7e7e7] px-[25px] py-5 last:border-b-0 max-[720px]:grid-cols-[45px_1fr_auto] max-[720px]:px-[15px] max-[720px]:py-[17px]', podiumStyle(entry.rank))}><span className={`${barlow} text-[22px] ${entry.rank === 1 ? 'text-[#d70000]' : 'text-[#888]'}`}>{entry.rank.toString().padStart(2, '0')}</span><strong className="text-[15px]">{entry.playerName}</strong><time className={`${barlow} text-[23px] font-bold tracking-[0.05em] max-[420px]:text-[19px]`}>{formatElapsed(entry.elapsedMilliseconds)}</time></li>)}</ol>
          )}
        </section>
      </main>
      <footer className={eventFooter}><span className="max-[720px]:hidden">TRAFIKVERKET · GYMNASIUM</span><nav className="flex gap-[25px]"><Link className={`flex items-center gap-[5px] text-[#555] ${focusRing}`} to="/">Starta uppdrag</Link><Link className={`flex items-center gap-[5px] text-[#555] ${focusRing}`} to="/admin/login">Admin</Link></nav></footer>
    </div>
  )
}

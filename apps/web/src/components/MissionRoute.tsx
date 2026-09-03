import { Check, Circle } from 'lucide-react'
import { barlow, cx, eyebrow } from '../uiStyles'

const labels = ['Digital trafikledning', 'Säkra vägar', 'Järnvägens signaler', 'Slutkontroll']

export function MissionRoute({ current = 1, total = 4 }: { current?: number; total?: number }) {
  return (
    <aside className="border-r border-[#dedede] bg-white px-8 py-[43px] text-[#202020] max-[980px]:px-[22px] max-[980px]:py-[38px] max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:px-[18px] max-[720px]:py-[15px]" aria-label="Uppdragsrutt">
      <p className={`${eyebrow} max-[720px]:hidden`}>UPPDRAGSRUTT</p>
      <h2 className={`${barlow} mb-[38px] text-[27px] leading-[1.05] uppercase max-[720px]:hidden`}>Sveriges transportsystem</h2>
      <ol className="m-0 list-none p-0 max-[720px]:flex max-[720px]:items-center max-[720px]:justify-center max-[720px]:gap-5">
        {Array.from({ length: total }, (_, index) => {
          const number = index + 1
          const state = number < current ? 'done' : number === current ? 'current' : 'next'
          return (
            <li
              className={cx(
                "relative grid min-h-[82px] grid-cols-[28px_1fr] gap-3 text-[#a1a1a1] after:absolute after:top-[26px] after:left-3 after:h-[52px] after:border-l after:border-[#d0d0d0] after:content-[''] last:after:hidden max-[720px]:block max-[720px]:min-h-0 max-[720px]:after:top-3 max-[720px]:after:left-[25px] max-[720px]:after:h-0 max-[720px]:after:w-5 max-[720px]:after:border-t max-[720px]:after:border-l-0",
                state === 'current' && 'text-[#202020]',
                state === 'done' && 'text-[#4e4e4e]',
              )}
              key={number}
            >
              <span className={cx(
                'relative z-1 grid size-[25px] place-items-center rounded-full border border-[#bdbdbd] bg-white text-[#aaa]',
                state === 'current' && 'border-[#d70000] text-[#d70000] shadow-[0_0_0_5px_rgba(215,0,0,0.08)]',
                state === 'done' && 'border-[#23845e] bg-[#23845e] text-white',
              )}>{state === 'done' ? <Check size={14} /> : <Circle size={12} />}</span>
              <div className="grid content-start gap-[5px] max-[720px]:hidden"><small className="text-[8px] tracking-[0.13em]">ETAPP {number}</small><strong className={`${barlow} tracking-[0.03em] uppercase`}>{labels[index] ?? `Uppdrag ${number}`}</strong></div>
            </li>
          )
        })}
      </ol>
      <div className="mt-[18px] border-l-[3px] border-[#d70000] bg-[#f5f5f5] p-4 max-[720px]:hidden"><span className="text-[8px] font-extrabold tracking-[0.16em] text-[#d70000]">LIVE</span><p className="mt-2 mb-0 text-[11px] leading-[1.55] text-[#666]">Varje rätt svar tar dig närmare målet. Totaltiden avgör placeringen.</p></div>
    </aside>
  )
}

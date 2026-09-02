import { Check, Circle } from 'lucide-react'

const labels = ['Digital trafikledning', 'Säkra vägar', 'Järnvägens signaler', 'Slutkontroll']

export function MissionRoute({ current = 1, total = 4 }: { current?: number; total?: number }) {
  return (
    <aside className="mission-route" aria-label="Uppdragsrutt">
      <p className="eyebrow">UPPDRAGSRUTT</p>
      <h2>Sveriges transportsystem</h2>
      <ol>
        {Array.from({ length: total }, (_, index) => {
          const number = index + 1
          const state = number < current ? 'done' : number === current ? 'current' : 'next'
          return (
            <li className={state} key={number}>
              <span>{state === 'done' ? <Check size={14} /> : <Circle size={12} />}</span>
              <div><small>ETAPP {number}</small><strong>{labels[index] ?? `Uppdrag ${number}`}</strong></div>
            </li>
          )
        })}
      </ol>
      <div className="route-note"><span>LIVE</span><p>Varje rätt svar tar laget närmare målet. Totaltiden avgör placeringen.</p></div>
    </aside>
  )
}

import { ArrowRight, Clock3, LockKeyhole, RadioTower, Route, TrainFront, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { api } from '../lib/api'
import { formatElapsed } from '../lib/time'
import type { GameSummary, LeaderboardEntry } from '../types'

export function StartPage() {
  const [playerName, setPlayerName] = useState('')
  const [game, setGame] = useState<GameSummary | null>(null)
  const [leaders, setLeaders] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.games().then((games) => setGame(games[0] ?? null)).catch(() => undefined)
    api.leaderboard().then((entries) => setLeaders(entries.slice(0, 3))).catch(() => setLeaders([]))
  }, [])

  async function start(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStarting(true)
    try {
      const session = await api.startSession(playerName)
      navigate(`/play/${session.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Spelet kunde inte startas.')
      setStarting(false)
    }
  }

  return (
    <div className="app-shell start-shell">
      <BrandHeader />
      <main className="landing-main">
        <div className="landing-symbols" aria-hidden="true">
          <span className="symbol-card symbol-train"><TrainFront /></span>
          <span className="symbol-card symbol-route"><Route /></span>
          <span className="symbol-card symbol-radio"><RadioTower /></span>
          <span className="symbol-card symbol-trophy"><Trophy /></span>
        </div>

        <section className="landing-hero">
          <p className="eyebrow">TRAFIKVERKET · ESCAPE ROOM</p>
          <h1>Håll Sverige<br /><mark>i rörelse.</mark></h1>
          <p className="hero-intro">Ta plats i Trafikverkets digitala kontrollrum. Lös uppdragen, slå klockan och upptäck tekniken bakom resan.</p>

          <form className="landing-form" onSubmit={start}>
            <label htmlFor="playerName">DITT NAMN</label>
            <div className="start-control">
              <input id="playerName" value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Skriv ditt namn" minLength={2} maxLength={80} autoComplete="off" autoFocus />
              <button className="primary-button" disabled={starting || playerName.trim().length < 2}>
                {starting ? 'Startar…' : 'Starta uppdraget'} <ArrowRight size={18} />
              </button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <small><Clock3 size={14} /> Totaltiden börjar när du startar.</small>
          </form>

          {game && <p className="active-mission"><span>AKTIVT UPPDRAG</span>{game.title}</p>}
        </section>

        <section className="landing-leaderboard" aria-labelledby="best-times-title">
          <header><div><p className="eyebrow">TOPPLISTA</p><h2 id="best-times-title">Bästa tider</h2></div><Link to="/leaderboard">Visa alla <ArrowRight size={14} /></Link></header>
          {leaders === null ? <div className="leaderboard-loading">Hämtar tider…</div> : leaders.length === 0 ? <div className="landing-empty"><Trophy size={21} /><span><strong>Första rekordet väntar.</strong> Din tid kan bli den första.</span></div> : <ol>{leaders.map((entry) => <li key={entry.id}><span>{entry.rank}</span><strong>{entry.playerName}</strong><time>{formatElapsed(entry.elapsedMilliseconds)}</time></li>)}</ol>}
        </section>
      </main>
      <footer className="event-footer"><span>TRAFIKVERKET · GYMNASIUM</span><nav><Link to="/leaderboard">Topplista</Link><Link to="/admin/login"><LockKeyhole size={13} /> Admin</Link></nav></footer>
    </div>
  )
}

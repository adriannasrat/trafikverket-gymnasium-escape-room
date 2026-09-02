import { ArrowRight, Gauge, LockKeyhole, Radio, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { api } from '../lib/api'
import type { GameSummary } from '../types'

export function StartPage() {
  const [teamName, setTeamName] = useState('')
  const [games, setGames] = useState<GameSummary[]>([])
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { api.games().then(setGames).catch(() => setError('Systemet kunde inte nå spelservern.')) }, [])

  async function start(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStarting(true)
    try {
      const session = await api.startSession(teamName)
      navigate(`/play/${session.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Spelet kunde inte startas.')
      setStarting(false)
    }
  }

  return (
    <div className="app-shell start-shell">
      <BrandHeader />
      <main className="start-main">
        <section className="hero-copy">
          <p className="eyebrow"><Radio size={14} /> EVENTLÄGE · SYSTEM ONLINE</p>
          <h1>Håll Sverige<br /><em>i rörelse.</em></h1>
          <p className="hero-intro">Ta plats i Trafikverkets digitala kontrollrum. Lös uppdragen, slå klockan och upptäck tekniken bakom resan.</p>
          <div className="feature-row">
            <span><Gauge /> Tidtagning i realtid</span>
            <span><Trophy /> Snabbast lag vinner</span>
          </div>
        </section>
        <section className="start-card">
          <div className="card-number">01</div>
          <p className="eyebrow">STARTA NYTT UPPDRAG</p>
          <h2>Vilka antar utmaningen?</h2>
          <p>{games[0]?.summary ?? 'Ett aktivt uppdrag laddas från kontrollrummet.'}</p>
          <form onSubmit={start}>
            <label htmlFor="teamName">LAGNAMN</label>
            <input id="teamName" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Skriv lagets namn" minLength={2} maxLength={80} autoComplete="off" autoFocus />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" disabled={starting || teamName.trim().length < 2}>
              {starting ? 'Startar…' : 'Starta uppdraget'} <ArrowRight size={18} />
            </button>
          </form>
          <small className="start-hint">När ni startar börjar totaltiden direkt.</small>
        </section>
      </main>
      <footer className="event-footer"><span>TRAFIKVERKET · GYMNASIUM</span><nav><Link to="/leaderboard">Topplista</Link><Link to="/admin/login"><LockKeyhole size={13} /> Admin</Link></nav></footer>
    </div>
  )
}

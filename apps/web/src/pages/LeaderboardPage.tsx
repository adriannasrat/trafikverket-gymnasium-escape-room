import { ArrowLeft, Medal, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { LoadingScreen } from '../components/LoadingScreen'
import { api } from '../lib/api'
import { formatElapsed } from '../lib/time'
import type { LeaderboardEntry } from '../types'

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  useEffect(() => { api.leaderboard().then(setEntries).catch(() => setEntries([])) }, [])
  if (!entries) return <LoadingScreen label="Hämtar topplistan…" />
  return (
    <div className="app-shell leaderboard-shell">
      <BrandHeader />
      <main className="leaderboard-page content-page">
        <Link className="back-link" to="/"><ArrowLeft size={16} /> Nytt uppdrag</Link>
        <div className="page-heading"><p className="eyebrow"><Trophy size={15} /> EVENTRESULTAT</p><h1>Snabbast genom systemet</h1><p>Lägst totaltid placerar spelaren högst.</p></div>
        <section className="leaderboard-card">
          {entries.length === 0 ? <div className="empty-state"><Medal size={34} /><h2>Första platsen väntar</h2><p>Slutför ett uppdrag för att sätta eventets första tid.</p></div> : (
            <ol>{entries.map((entry) => <li key={entry.id} className={entry.rank <= 3 ? `rank-${entry.rank}` : ''}><span className="rank">{entry.rank.toString().padStart(2, '0')}</span><strong>{entry.playerName}</strong><time>{formatElapsed(entry.elapsedMilliseconds)}</time></li>)}</ol>
          )}
        </section>
      </main>
      <footer className="event-footer"><span>TRAFIKVERKET · GYMNASIUM</span><nav><Link to="/">Starta uppdrag</Link><Link to="/admin/login">Admin</Link></nav></footer>
    </div>
  )
}

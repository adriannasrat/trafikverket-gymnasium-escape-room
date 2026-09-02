import { LockKeyhole, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

type Props = { mode?: 'player' | 'admin'; playerName?: string; elapsed?: string }

export function BrandHeader({ mode = 'player', playerName, elapsed }: Props) {
  return (
    <header className="brand-header">
      <Link className="brand" to="/" aria-label="Till startsidan">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><strong>TRAFIKVERKET</strong><small>ESCAPE ROOM</small></span>
      </Link>
      {mode === 'player' ? (
        <div className="header-tools">
          {playerName && <span className="team-chip">Spelare <strong>{playerName}</strong></span>}
          {elapsed && <span className="elapsed-chip"><small>TOTAL TID</small><strong>{elapsed}</strong></span>}
          <Link className="icon-link" to="/leaderboard" aria-label="Topplista"><Trophy size={19} /></Link>
        </div>
      ) : <span className="secure-chip"><LockKeyhole size={15} /> Säker administration</span>}
    </header>
  )
}

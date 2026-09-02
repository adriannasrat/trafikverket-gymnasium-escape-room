import { ArrowRight, CheckCircle2, RotateCcw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { ChallengeTimer } from '../components/ChallengeTimer'
import { LoadingScreen } from '../components/LoadingScreen'
import { MissionRoute } from '../components/MissionRoute'
import { api } from '../lib/api'
import { formatElapsed } from '../lib/time'
import type { Challenge } from '../types'

export function GamePage() {
  const { sessionId = '' } = useParams()
  const [data, setData] = useState<Challenge | null>(null)
  const [selected, setSelected] = useState('')
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null)
  const [completed, setCompleted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadChallenge = useCallback(async () => {
    const result = await api.currentChallenge(sessionId)
    if (result.completed) { setCompleted(true); return }
    setData(result)
    setRemaining(result.challenge.secondsRemaining)
  }, [sessionId])

  // oxlint-disable-next-line react/set-state-in-effect -- this effect synchronizes the UI with the server session.
  useEffect(() => { loadChallenge().catch(() => setError('Uppdraget kunde inte laddas.')) }, [loadChallenge])
  useEffect(() => {
    if (!data || completed) return
    const tick = () => {
      setElapsed(Date.now() - new Date(data.startedAtUtc).getTime())
      const challengeElapsed = (Date.now() - new Date(data.challenge.challengeStartedAtUtc).getTime()) / 1000
      setRemaining(Math.max(0, data.challenge.timeLimitSeconds - challengeElapsed))
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [data, completed])

  async function submit() {
    if (!data || !selected) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const result = await api.answer(sessionId, data.challenge.id, selected)
      setFeedback({ correct: result.correct, text: result.successMessage ?? result.message ?? '' })
      if (result.completed) {
        setElapsed(result.elapsedMilliseconds ?? elapsed)
        setCompleted(true)
      } else if (result.correct) {
        window.setTimeout(() => { setSelected(''); setFeedback(null); loadChallenge() }, 1200)
      } else if (result.challengeStartedAtUtc) {
        setData({ ...data, challenge: { ...data.challenge, challengeStartedAtUtc: result.challengeStartedAtUtc } })
        setSelected('')
      }
    } catch (caught) {
      setFeedback({ correct: false, text: caught instanceof Error ? caught.message : 'Svaret kunde inte skickas.' })
    } finally { setSubmitting(false) }
  }

  if (error) return <div className="fatal-state"><h1>Kontakten bröts</h1><p>{error}</p><Link to="/">Till startsidan</Link></div>
  if (completed) return (
    <div className="app-shell completion-shell">
      <BrandHeader playerName={data?.playerName} elapsed={formatElapsed(elapsed)} />
      <main className="completion-card"><span className="completion-icon"><CheckCircle2 /></span><p className="eyebrow">UPPDRAG SLUTFÖRT</p><h1>Systemet är säkrat.</h1><p>Bra jobbat, <strong>{data?.playerName}</strong>! Din totaltid är registrerad.</p><div className="final-time"><small>SLUTTID</small><strong>{formatElapsed(elapsed)}</strong></div><div className="completion-actions"><Link className="primary-button" to="/leaderboard"><Trophy size={18} /> Visa topplistan</Link><Link className="secondary-button" to="/"><RotateCcw size={17} /> Nästa spelare</Link></div></main>
    </div>
  )
  if (!data) return <LoadingScreen />

  return (
    <div className="app-shell game-shell">
      <BrandHeader playerName={data.playerName} elapsed={formatElapsed(elapsed)} />
      <div className="game-layout">
        <MissionRoute current={data.challenge.number} total={data.challenge.total} />
        <main className="challenge-stage">
          <div className="challenge-heading"><div><p className="eyebrow">ETAPP {data.challenge.number.toString().padStart(2, '0')} · {data.game.title.toUpperCase()}</p><h1>{data.challenge.prompt}</h1></div><span className="challenge-index">{data.challenge.number.toString().padStart(2, '0')}<span>/{data.challenge.total.toString().padStart(2, '0')}</span></span></div>
          {data.challenge.imagePath && <img className="challenge-image" src={data.challenge.imagePath} alt="Ledtråd till uppdraget" />}
          <ChallengeTimer remaining={remaining} total={data.challenge.timeLimitSeconds} />
          <fieldset className="answer-grid"><legend>Välj ett svar</legend>{data.challenge.options.map((option, index) => <label className={selected === option.id ? 'selected' : ''} key={option.id}><input type="radio" name="answer" value={option.id} checked={selected === option.id} onChange={() => { setSelected(option.id); setFeedback(null) }} /><span>{String.fromCharCode(65 + index)}</span><strong>{option.text}</strong></label>)}</fieldset>
          <div className="answer-footer"><div>{feedback && <p className={feedback.correct ? 'feedback success' : 'feedback error'} role="status">{feedback.text}</p>}</div><button className="primary-button" disabled={!selected || submitting} onClick={submit}>{submitting ? 'Kontrollerar…' : 'Bekräfta svar'} <ArrowRight size={18} /></button></div>
        </main>
      </div>
    </div>
  )
}

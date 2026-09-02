import { Check, ChevronRight, Gamepad2, ImagePlus, LayoutDashboard, LogOut, Save, Settings2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { LoadingScreen } from '../components/LoadingScreen'
import { ApiError, api } from '../lib/api'
import type { AdminGame } from '../types'

export function AdminPage() {
  const [games, setGames] = useState<AdminGame[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const game = games?.find((candidate) => candidate.id === selectedId) ?? games?.[0]

  useEffect(() => {
    api.adminGames().then((result) => { setGames(result); setSelectedId(result[0]?.id ?? '') })
      .catch((error) => { if (error instanceof ApiError && error.status === 401) navigate('/admin/login', { replace: true }) })
  }, [navigate])

  function updateGame(change: Partial<AdminGame>) {
    if (!game) return
    setGames((current) => current?.map((candidate) => candidate.id === game.id ? { ...candidate, ...change } : candidate) ?? null)
    setStatus('')
  }

  async function save() {
    if (!game) return
    setSaving(true); setStatus('')
    try {
      const saved = await api.updateGame(game)
      setGames((current) => current?.map((candidate) => candidate.id === saved.id ? saved : candidate) ?? null)
      setStatus('Ändringarna är sparade och klara för eventet.')
    } catch (caught) { setStatus(caught instanceof Error ? caught.message : 'Ändringarna kunde inte sparas.') }
    finally { setSaving(false) }
  }

  async function logout() { await api.logout(); navigate('/admin/login') }
  async function uploadImage(challengeId: string, image?: File) {
    if (!game || !image) return
    setStatus('Laddar upp bilden…')
    try {
      const result = await api.uploadChallengeImage(challengeId, image)
      updateGame({ challenges: game.challenges.map((challenge) => challenge.id === challengeId ? { ...challenge, imagePath: result.imagePath } : challenge) })
      setStatus('Bilden är uppladdad och syns nu i uppdraget.')
    } catch (caught) { setStatus(caught instanceof Error ? caught.message : 'Bilden kunde inte laddas upp.') }
  }
  if (!games) return <LoadingScreen label="Öppnar kontrollrummet…" />

  return (
    <div className="app-shell admin-shell">
      <BrandHeader mode="admin" />
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p className="sidebar-label">KONTROLLRUM</p>
          <nav><button disabled title="Kommer i nästa etapp"><LayoutDashboard /> Översikt</button><button className="active"><Gamepad2 /> Uppdrag <ChevronRight /></button><button disabled title="Kommer i nästa etapp"><ShieldCheck /> Händelselogg</button><button disabled title="Kommer i nästa etapp"><Settings2 /> Inställningar</button></nav>
          <div className="sidebar-bottom"><span className="system-ok"><i /> SYSTEM ONLINE</span><button onClick={logout}><LogOut /> Logga ut</button></div>
        </aside>
        <main className="admin-main">
          <div className="admin-heading"><div><p className="eyebrow">INNEHÅLL & SPELFLÖDE</p><h1>Hantera uppdrag</h1><p>Ändra vad deltagarna ser utan att röra koden.</p></div><button className="primary-button" onClick={save} disabled={!game || saving}><Save size={17} /> {saving ? 'Sparar…' : 'Spara ändringar'}</button></div>
          {status && <p className="save-status" role="status"><Check size={16} /> {status}</p>}
          {game && <section className="image-management"><div><p className="eyebrow">UPPDRAGSBILDER</p><span>Valfria ledtrådsbilder som visas för deltagarna.</span></div>{game.challenges.map((challenge, index) => <div className="image-editor" key={challenge.id}>{challenge.imagePath ? <img src={challenge.imagePath} alt={`Bild för uppdrag ${index + 1}`} /> : <span><ImagePlus /> Ingen bild</span>}<label className="secondary-upload"><ImagePlus size={15} /> {challenge.imagePath ? 'Byt bild' : 'Ladda upp'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadImage(challenge.id, event.target.files?.[0])} /></label><small>Uppdrag {index + 1} · max 5 MB</small></div>)}</section>}
          <div className="admin-workspace">
            <section className="game-list"><h2>Spel</h2>{games.map((candidate) => <button key={candidate.id} className={candidate.id === game?.id ? 'selected' : ''} onClick={() => setSelectedId(candidate.id)}><span><strong>{candidate.title}</strong><small>{candidate.challenges.length} uppdrag · {candidate.isActive ? 'Aktivt' : 'Pausat'}</small></span><ChevronRight size={16} /></button>)}</section>
            {game && <section className="editor-panel">
              <div className="editor-topline"><div><p className="eyebrow">SPELINSTÄLLNINGAR</p><h2>{game.title}</h2></div><label className="switch-label"><span>{game.isActive ? 'Aktivt' : 'Pausat'}</span><input type="checkbox" checked={game.isActive} onChange={(event) => updateGame({ isActive: event.target.checked })} /><i /></label></div>
              <div className="form-grid"><label>TITEL<input value={game.title} onChange={(event) => updateGame({ title: event.target.value })} /></label><label>TID PER UPPDRAG (SEK)<input type="number" min="5" max="900" value={game.defaultTimeLimitSeconds} onChange={(event) => updateGame({ defaultTimeLimitSeconds: Number(event.target.value) })} /></label><label className="full">INTRODUKTION<textarea value={game.summary} onChange={(event) => updateGame({ summary: event.target.value })} /></label><label className="full">MEDDELANDE VID RÄTT SVAR<textarea value={game.successMessage} onChange={(event) => updateGame({ successMessage: event.target.value })} /></label></div>
              <div className="challenge-editors">{game.challenges.map((challenge, challengeIndex) => <article className="challenge-editor" key={challenge.id}><header><span>{(challengeIndex + 1).toString().padStart(2, '0')}</span><div><small>UPPDRAG</small><strong>{challenge.prompt}</strong></div></header><label>FRÅGA / INSTRUKTION<textarea value={challenge.prompt} onChange={(event) => updateGame({ challenges: game.challenges.map((item) => item.id === challenge.id ? { ...item, prompt: event.target.value } : item) })} /></label><div className="answer-editor"><p>SVARSALTERNATIV <small>Markera det korrekta svaret.</small></p>{challenge.options.map((option, optionIndex) => <div className="answer-row" key={option.id}><span>{String.fromCharCode(65 + optionIndex)}</span><textarea rows={2} aria-label={`Svar ${optionIndex + 1}`} value={option.text} onChange={(event) => updateGame({ challenges: game.challenges.map((item) => item.id === challenge.id ? { ...item, options: item.options.map((candidate) => candidate.id === option.id ? { ...candidate, text: event.target.value } : candidate) } : item) })} /><label className="correct-radio"><input type="radio" name={`correct-${challenge.id}`} checked={option.isCorrect} onChange={() => updateGame({ challenges: game.challenges.map((item) => item.id === challenge.id ? { ...item, options: item.options.map((candidate) => ({ ...candidate, isCorrect: candidate.id === option.id })) } : item) })} /><i><Check size={13} /></i><span>Korrekt</span></label></div>)}</div></article>)}</div>
            </section>}
          </div>
        </main>
      </div>
    </div>
  )
}

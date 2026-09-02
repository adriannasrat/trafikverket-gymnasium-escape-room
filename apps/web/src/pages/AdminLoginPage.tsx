import { ArrowRight, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { api } from '../lib/api'

export function AdminLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { api.me().then(() => navigate('/admin', { replace: true })).catch(() => undefined) }, [navigate])

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await api.login(username, password); navigate('/admin') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Inloggningen misslyckades.'); setBusy(false) }
  }

  return (
    <div className="app-shell admin-login-shell">
      <BrandHeader mode="admin" />
      <main className="login-card">
        <span className="login-icon"><LockKeyhole /></span><p className="eyebrow">KONTROLLRUM</p><h1>Administratör</h1><p>Logga in för att aktivera och ändra eventets uppdrag.</p>
        <form onSubmit={login}><label htmlFor="username">ANVÄNDARNAMN</label><input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /><label htmlFor="password">LÖSENORD</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy || !username || !password}>{busy ? 'Loggar in…' : 'Öppna kontrollrummet'} <ArrowRight size={18} /></button></form>
        <Link className="back-link" to="/">Tillbaka till spelet</Link>
      </main>
      <footer className="event-footer"><span>TRAFIKVERKET · GYMNASIUM</span><nav><Link to="/">Spelarvy</Link></nav></footer>
    </div>
  )
}

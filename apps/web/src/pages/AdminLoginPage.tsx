import { ArrowRight, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandHeader } from '../components/BrandHeader'
import { api } from '../lib/api'
import { backLink, barlow, eventFooter, eyebrow, field, fieldLabel, focusRing, formError, primaryButton } from '../uiStyles'

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
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] bg-[#f5f5f5]">
      <BrandHeader mode="admin" />
      <main className="mx-auto my-[clamp(45px,8vh,90px)] w-[min(440px,calc(100%_-_35px))] border-t-4 border-[#d70000] bg-white p-[42px] shadow-[0_20px_55px_rgba(30,30,30,0.08)] max-[720px]:my-[35px] max-[720px]:px-[25px] max-[720px]:py-[34px]">
        <span className="mb-6 grid size-12 place-items-center bg-[#f9eeee] text-[#d70000]"><LockKeyhole /></span><p className={eyebrow}>KONTROLLRUM</p><h1 className={`${barlow} mb-4 text-[42px] leading-none text-[#202020] uppercase`}>Administratör</h1><p className="text-[13px] leading-[1.6] text-[#686868]">Logga in för att aktivera och ändra eventets uppdrag.</p>
        <form className="my-[25px] grid gap-[11px]" onSubmit={login}><label className={fieldLabel} htmlFor="username">ANVÄNDARNAMN</label><input className={field} id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /><label className={`${fieldLabel} mt-[6px]`} htmlFor="password">LÖSENORD</label><input className={field} id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />{error && <p className={formError} role="alert">{error}</p>}<button className={`${primaryButton} mt-2 w-full`} disabled={busy || !username || !password}>{busy ? 'Loggar in…' : 'Öppna kontrollrummet'} <ArrowRight size={18} /></button></form>
        <Link className={backLink} to="/">Tillbaka till spelet</Link>
      </main>
      <footer className={eventFooter}><span className="max-[720px]:hidden">TRAFIKVERKET · GYMNASIUM</span><nav className="flex gap-[25px]"><Link className={`flex items-center gap-[5px] text-[#555] ${focusRing}`} to="/">Spelarvy</Link></nav></footer>
    </div>
  )
}

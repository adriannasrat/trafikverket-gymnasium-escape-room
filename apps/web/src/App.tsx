import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { GamePage } from './pages/GamePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { StartPage } from './pages/StartPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/play/:sessionId" element={<GamePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

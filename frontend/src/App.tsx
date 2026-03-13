import { Routes, Route } from 'react-router-dom'
import { cn } from '@/lib/utils'
import HomePage from './app/page'
import SettingsPage from './app/settings/page'

export default function App() {
  return (
    <div
      className={cn('font-sans antialiased')}
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  )
}

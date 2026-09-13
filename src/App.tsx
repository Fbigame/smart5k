import { useCallback, useEffect, useState } from 'react'
import TriangleBoard, { type LevelClearRecord } from './components/TriangleBoard'
import './App.css'

interface ClearStats {
  totalClears: number
  uniqueSolutions: number
}

const API_BASE = '/api'

function App() {
  const [started, setStarted] = useState(false)
  const [stats, setStats] = useState<ClearStats>({ totalClears: 0, uniqueSolutions: 0 })
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`)
      if (!response.ok) return
      const data = (await response.json()) as ClearStats
      setStats(data)
    } catch {
      // Ignore transient API errors and keep UI usable.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const handleLevelCleared = useCallback(async (record: LevelClearRecord) => {
    try {
      const response = await fetch(`${API_BASE}/clears`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      })
      if (!response.ok) {
        await loadStats()
        return
      }

      const data = (await response.json()) as { stats?: ClearStats }
      if (data.stats) {
        setStats(data.stats)
      } else {
        await loadStats()
      }
    } catch {
      await loadStats()
    }
  }, [loadStats])

  return (
    <main className="app-shell">
      <section className="lobby-card">
        <p className="lobby-label">Triangle Challenge</p>
        <h1 className="lobby-title">通关记录中心</h1>
        <div className="lobby-stats">
          <div className="stat-item">
            <span>通关次数</span>
            <strong>{loading ? '...' : stats.totalClears}</strong>
          </div>
          <div className="stat-item">
            <span>唯一解法</span>
            <strong>{loading ? '...' : stats.uniqueSolutions}</strong>
          </div>
        </div>
        <button type="button" className="start-btn" onClick={() => setStarted(true)}>
          开始游戏
        </button>
      </section>

      {started && (
        <section className="game-stage">
          <TriangleBoard onLevelCleared={handleLevelCleared} />
        </section>
      )}
    </main>
  )
}

export default App


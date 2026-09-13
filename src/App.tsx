import { useCallback, useEffect, useState } from 'react'
import TriangleBoard, { type LevelClearRecord } from './components/TriangleBoard'
import './App.css'

interface ClearStats {
  totalSolutions: number
}

interface SolutionSummary {
  hash: string
  level: number
  solvers: number
  firstSolvedAt: string
  lastSolvedAt: string
}

interface SolutionsResponse {
  total: number
  page: number
  pageSize: number
  totalPages: number
  solutions: SolutionSummary[]
}

const API_BASE = '/api'

function App() {
  const [started, setStarted] = useState(false)
  const [stats, setStats] = useState<ClearStats>({ totalSolutions: 0 })
  const [solutions, setSolutions] = useState<SolutionSummary[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSolutions, setTotalSolutions] = useState(0)
  const [showSolutions, setShowSolutions] = useState(false)
  const [loading, setLoading] = useState(true)
  const pageSize = 9

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`)
      if (!response.ok) return
      const data = (await response.json()) as ClearStats
      setStats({ totalSolutions: data.totalSolutions ?? 0 })
    } catch {
      // Ignore transient API errors and keep UI usable.
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSolutions = useCallback(async (page: number) => {
    try {
      const response = await fetch(`${API_BASE}/solutions?page=${page}&pageSize=${pageSize}`)
      if (!response.ok) return
      const data = (await response.json()) as SolutionsResponse
      setSolutions(Array.isArray(data.solutions) ? data.solutions : [])
      setCurrentPage(typeof data.page === 'number' ? data.page : page)
      setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : 1)
      setTotalSolutions(typeof data.total === 'number' ? data.total : 0)
    } catch {
      // Ignore transient API errors and keep UI usable.
    }
  }, [pageSize])

  useEffect(() => {
    void loadStats()
    void loadSolutions(1)
  }, [loadStats, loadSolutions])

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
        setStats({ totalSolutions: data.stats.totalSolutions ?? 0 })
      } else {
        await loadStats()
      }
      await loadSolutions(currentPage)
    } catch {
      await loadStats()
      await loadSolutions(currentPage)
    }
  }, [loadStats, loadSolutions, currentPage])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('zh-CN', { hour12: false })
  }

  return (
    <main className="app-shell">
      <section className="lobby-card">
        <div className="lobby-copy">
          <p className="lobby-label">Smart5k Puzzle</p>
          <h1 className="lobby-title">智力五千通</h1>
          <p className="lobby-subtitle">一个拥有 5000 多种解法的图形拼放挑战，每一步都可能通向全新的通关路径。</p>
        </div>
        <div className="lobby-stats">
          <div className="stat-item">
            <span>总解法数量</span>
            <strong>{loading ? '...' : stats.totalSolutions}</strong>
          </div>
        </div>
        <button type="button" className="start-btn" onClick={() => setStarted(true)}>
          {started ? '继续游戏' : '开始游戏'}
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setShowSolutions(prev => !prev)
            if (!showSolutions) {
              void loadSolutions(1)
            }
          }}
        >
          {showSolutions ? '收起解法' : '查看解法'}
        </button>
      </section>

      {showSolutions && (
        <section className="solutions-card">
          <div className="solutions-head">
            <h2>解法列表（按首次通关）</h2>
            <p>共 {totalSolutions} 条</p>
          </div>
          {solutions.length === 0 ? (
            <p className="empty-tip">还没有解法记录，快成为第一个通关者。</p>
          ) : (
            <div className="solutions-list">
              {solutions.map((item, index) => (
                <article key={item.hash} className="solution-item">
                  <p className="solution-rank">#{index + 1}</p>
                  <p><strong>Hash：</strong>{item.hash}</p>
                  <p><strong>关卡：</strong>{item.level}</p>
                  <p><strong>总人数：</strong>{item.solvers}</p>
                  <p><strong>首次解出：</strong>{formatTime(item.firstSolvedAt)}</p>
                </article>
              ))}
            </div>
          )}
          <div className="pagination-bar">
            <button
              type="button"
              className="page-btn"
              disabled={currentPage <= 1}
              onClick={() => void loadSolutions(currentPage - 1)}
            >
              上一页
            </button>
            <span>第 {currentPage} / {totalPages} 页</span>
            <button
              type="button"
              className="page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => void loadSolutions(currentPage + 1)}
            >
              下一页
            </button>
          </div>
        </section>
      )}

      {started && (
        <section className="game-stage">
          <TriangleBoard onLevelCleared={handleLevelCleared} />
        </section>
      )}
    </main>
  )
}

export default App


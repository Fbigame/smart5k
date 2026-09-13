import { useCallback, useEffect, useState } from 'react'
import TriangleBoard, { type LevelClearRecord } from './components/TriangleBoard'
import './App.css'

interface LayoutDetails {
  shapeLayouts: Array<{
    shapeId: number
    rotation: number
    flipped: boolean
    triangles: number[]
  }>
  cellStacks: Array<{
    cellId: number
    shapeIds: number[]
  }>
}

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

interface SolutionDetail extends SolutionSummary {
  firstLayout: LayoutDetails | null
  latestLayout: LayoutDetails | null
}

interface SolutionsResponse {
  total: number
  page: number
  pageSize: number
  totalPages: number
  solutions: SolutionSummary[]
}

const API_BASE = '/api'
const SHAPE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E2', '#F8B88B', '#52C0A1', '#E59866', '#AED6F1',
]
const DISABLED_CELLS = new Set([0, 49, 64, 65, 66, 63, 78, 79, 80])

interface MiniTriangleCell {
  id: number
  row: number
  col: number
  direction: 'UP' | 'DOWN'
}

function createMiniBoardCells(rows: number = 9): MiniTriangleCell[] {
  const cells: MiniTriangleCell[] = []
  let id = 0

  for (let r = 0; r < rows; r++) {
    const count = 2 * r + 1
    for (let c = 0; c < count; c++) {
      cells.push({
        id,
        row: r,
        col: c,
        direction: c % 2 === 0 ? 'UP' : 'DOWN',
      })
      id += 1
    }
  }

  return cells
}

const MINI_BOARD_CELLS = createMiniBoardCells(9)

function getMiniTrianglePoints(cell: MiniTriangleCell, size: number): string {
  const h = (size * Math.sqrt(3)) / 2
  const rowY = cell.row * h
  const offsetX = (10 - cell.row - 1) * (size / 2)
  const colX = offsetX + cell.col * (size / 2)

  if (cell.direction === 'UP') {
    return `${colX},${rowY} ${colX - size / 2},${rowY + h} ${colX + size / 2},${rowY + h}`
  }
  return `${colX - size / 2},${rowY} ${colX + size / 2},${rowY} ${colX},${rowY + h}`
}

function hasLayoutContent(layout: LayoutDetails | null): boolean {
  if (!layout) return false
  const hasStacks = Array.isArray(layout.cellStacks) && layout.cellStacks.length > 0
  const hasShapes = Array.isArray(layout.shapeLayouts) && layout.shapeLayouts.length > 0
  return hasStacks || hasShapes
}

function App() {
  const [started, setStarted] = useState(false)
  const [stats, setStats] = useState<ClearStats>({ totalSolutions: 0 })
  const [solutions, setSolutions] = useState<SolutionSummary[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSolutions, setTotalSolutions] = useState(0)
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SolutionDetail | null>(null)
  const [detailMode, setDetailMode] = useState<'first' | 'latest'>('first')
  const [detailLoading, setDetailLoading] = useState(false)
  const [page, setPage] = useState<'home' | 'solutions'>(() =>
    window.location.pathname === '/solutions' ? 'solutions' : 'home'
  )
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
      setSelectedHash(null)
      setSelectedDetail(null)
    } catch {
      // Ignore transient API errors and keep UI usable.
    }
  }, [pageSize])

  const loadSolutionDetail = useCallback(async (hash: string) => {
    setSelectedHash(hash)
    setDetailLoading(true)
    try {
      const response = await fetch(`${API_BASE}/solutions/${hash}`)
      if (!response.ok) {
        setSelectedDetail(null)
        return
      }
      const data = (await response.json()) as SolutionDetail
      setSelectedDetail(data)
      setDetailMode('first')
    } catch {
      setSelectedDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
    void loadSolutions(1)
  }, [loadStats, loadSolutions])

  useEffect(() => {
    const handlePopState = () => {
      setPage(window.location.pathname === '/solutions' ? 'solutions' : 'home')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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

  const openSolutionsPage = () => {
    setPage('solutions')
    void loadSolutions(1)
    if (window.location.pathname !== '/solutions') {
      window.history.pushState({}, '', '/solutions')
    }
  }

  const backToHome = () => {
    setPage('home')
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
    }
  }

  const renderLayoutBoard = (layout: LayoutDetails | null) => {
    const size = 20
    const h = (size * Math.sqrt(3)) / 2
    const svgHeight = 9 * h + 40
    const svgWidth = 18 * size / 2 + 40
    const stackMap = new Map<number, number[]>()

    if (layout?.cellStacks) {
      for (const item of layout.cellStacks) {
        stackMap.set(item.cellId, item.shapeIds)
      }
    }

    return (
      <svg
        className="solution-board-preview"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {MINI_BOARD_CELLS.map(cell => {
          const stack = stackMap.get(cell.id) ?? []
          const topShapeId = stack.length > 0 ? stack[stack.length - 1] : 0
          const disabled = DISABLED_CELLS.has(cell.id)
          const fill = disabled
            ? 'transparent'
            : topShapeId > 0
            ? SHAPE_COLORS[(topShapeId - 1) % SHAPE_COLORS.length]
            : '#ffffff'

          return (
            <polygon
              key={`layout-cell-${cell.id}`}
              points={getMiniTrianglePoints(cell, size)}
              fill={fill}
              stroke="none"
              strokeWidth={0}
              opacity={disabled ? 0 : 0.95}
            />
          )
        })}
      </svg>
    )
  }

  const getDisplayLayout = (detail: SolutionDetail, mode: 'first' | 'latest'): LayoutDetails | null => {
    if (mode === 'first') {
      return hasLayoutContent(detail.firstLayout) ? detail.firstLayout : detail.latestLayout
    }
    return hasLayoutContent(detail.latestLayout) ? detail.latestLayout : detail.firstLayout
  }

  return (
    <main className="app-shell">
      {page === 'home' && (
        <>
          <section className="lobby-card">
            <div className="lobby-copy">
              <p className="lobby-label">Smart5k Puzzle</p>
              <h1 className="lobby-title">智力五千通</h1>
              <p className="lobby-subtitle">一个拥有 5000 多种解法的图形拼放挑战，每一步都可能通向全新的通关路径。</p>
            </div>
            <div className="lobby-stats">
              <button type="button" className="stat-item stat-link" onClick={openSolutionsPage}>
                <span>总解法数量（点击查看）</span>
                <strong>{loading ? '...' : stats.totalSolutions}</strong>
              </button>
            </div>
            <button type="button" className="start-btn" onClick={() => setStarted(true)}>
              {started ? '继续游戏' : '开始游戏'}
            </button>
          </section>

          {started && (
            <section className="game-stage">
              <TriangleBoard onLevelCleared={handleLevelCleared} />
            </section>
          )}
        </>
      )}

      {page === 'solutions' && (
        <section className="solutions-page">
          <div className="solutions-head">
            <div className="solutions-title-row">
              <h2>解法列表</h2>
              <span className="solutions-subtitle">（按首次通关）</span>
              <p>共 {totalSolutions} 条</p>
            </div>
            <button type="button" className="ghost-btn" onClick={backToHome}>返回首页</button>
          </div>
          {solutions.length === 0 ? (
            <p className="empty-tip">还没有解法记录，快成为第一个通关者。</p>
          ) : (
            <div className="solutions-list">
              {solutions.map((item, index) => (
                <article
                  key={item.hash}
                  className={`solution-item ${selectedHash === item.hash ? 'selected' : ''}`}
                  onClick={() => void loadSolutionDetail(item.hash)}
                >
                  <p className="solution-rank">#{(currentPage - 1) * pageSize + index + 1}</p>
                  <p><strong>Hash：</strong>{item.hash}</p>
                  <p><strong>关卡：</strong>{item.level}</p>
                  <p><strong>总人数：</strong>{item.solvers}</p>
                  <p><strong>首次解出：</strong>{formatTime(item.firstSolvedAt)}</p>
                </article>
              ))}
            </div>
          )}

          <section className="solution-detail-panel">
            <div className="solution-detail-head">
              <h3>解法布局详情</h3>
              {selectedDetail && (
                <div className="layout-switch">
                  <button
                    type="button"
                    className={`switch-btn ${detailMode === 'first' ? 'active' : ''}`}
                    onClick={() => setDetailMode('first')}
                  >
                    首次布局
                  </button>
                  <button
                    type="button"
                    className={`switch-btn ${detailMode === 'latest' ? 'active' : ''}`}
                    onClick={() => setDetailMode('latest')}
                  >
                    最近布局
                  </button>
                </div>
              )}
            </div>

            {detailLoading && <p className="empty-tip">正在加载布局...</p>}

            {!detailLoading && !selectedDetail && (
              <p className="empty-tip">点击上面的某条解法，即可查看具体布局。</p>
            )}

            {!detailLoading && selectedDetail && (
              <div className="solution-detail-content">
                <p><strong>Hash：</strong>{selectedDetail.hash}</p>
                <p><strong>首次解出：</strong>{formatTime(selectedDetail.firstSolvedAt)}</p>
                <p><strong>总人数：</strong>{selectedDetail.solvers}</p>
                {renderLayoutBoard(getDisplayLayout(selectedDetail, detailMode))}
              </div>
            )}
          </section>

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
    </main>
  )
}

export default App


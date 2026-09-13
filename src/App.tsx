import { useCallback, useEffect, useState } from 'react'
import TriangleBoard, { type LevelClearRecord } from './components/TriangleBoard'
import AppHeader from './components/AppHeader'
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

interface ClearResponse {
  stats?: ClearStats
  solution?: {
    hash: string
  } | null
}

const API_BASE = '/api'
const FIRST_PLAY_GUIDE_SEEN_KEY = 'smart5k-first-play-guide-seen'
const SHAPE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E2', '#F8B88B', '#52C0A1', '#E59866', '#AED6F1',
]

function getShapeOutlineColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return '#1f4f7f'

  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16)))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16)))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16)))

  const darken = (value: number) => Math.max(0, Math.round(value * 0.6))
  const toHex = (value: number) => value.toString(16).padStart(2, '0')

  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`
}
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

function expandPolygonPoints(points: string, expandBy: number): string {
  const parsed = points
    .trim()
    .split(/\s+/)
    .map(point => point.split(',').map(Number) as [number, number])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))

  if (parsed.length < 3 || expandBy <= 0) {
    return points
  }

  const center = parsed.reduce(
    (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }),
    { x: 0, y: 0 }
  )
  const cx = center.x / parsed.length
  const cy = center.y / parsed.length

  return parsed
    .map(([x, y]) => {
      const dx = x - cx
      const dy = y - cy
      const length = Math.hypot(dx, dy) || 1
      const nx = x + (dx / length) * expandBy
      const ny = y + (dy / length) * expandBy
      return `${nx},${ny}`
    })
    .join(' ')
}

function hasLayoutContent(layout: LayoutDetails | null): boolean {
  if (!layout) return false
  const hasStacks = Array.isArray(layout.cellStacks) && layout.cellStacks.length > 0
  const hasShapes = Array.isArray(layout.shapeLayouts) && layout.shapeLayouts.length > 0
  return hasStacks || hasShapes
}

function App() {
  const [started, setStarted] = useState(false)
  const [showFirstPlayGuide, setShowFirstPlayGuide] = useState(false)
  const [showClearSolutionGuide, setShowClearSolutionGuide] = useState(false)
  const [pendingSolvedHash, setPendingSolvedHash] = useState<string | null>(null)
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

  const findSolutionPageByHash = useCallback(async (hash: string) => {
    let page = 1
    let totalPagesToScan = 1

    while (page <= totalPagesToScan) {
      const response = await fetch(`${API_BASE}/solutions?page=${page}&pageSize=${pageSize}`)
      if (!response.ok) return null

      const data = (await response.json()) as SolutionsResponse
      const list = Array.isArray(data.solutions) ? data.solutions : []
      if (list.some(item => item.hash === hash)) {
        return typeof data.page === 'number' ? data.page : page
      }

      totalPagesToScan = typeof data.totalPages === 'number' ? data.totalPages : page
      page += 1
    }

    return null
  }, [pageSize])

  const goToSolutionDetail = useCallback(async (hash: string) => {
    const targetPage = await findSolutionPageByHash(hash)

    setPage('solutions')
    if (window.location.pathname !== '/solutions') {
      window.history.pushState({}, '', '/solutions')
    }

    await loadSolutions(targetPage ?? 1)
    await loadSolutionDetail(hash)
  }, [findSolutionPageByHash, loadSolutions, loadSolutionDetail])

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

      const data = (await response.json()) as ClearResponse
      if (data.stats) {
        setStats({ totalSolutions: data.stats.totalSolutions ?? 0 })
      } else {
        await loadStats()
      }

      const solvedHash = data.solution?.hash ?? record.hash
      setPendingSolvedHash(solvedHash)
      setShowClearSolutionGuide(true)
    } catch {
      await loadStats()
    }
  }, [loadStats])

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

  const handleStartGame = () => {
    setStarted(true)

    try {
      const seen = window.localStorage.getItem(FIRST_PLAY_GUIDE_SEEN_KEY) === '1'
      if (!seen) {
        setShowFirstPlayGuide(true)
      }
    } catch {
      setShowFirstPlayGuide(true)
    }
  }

  const closeFirstPlayGuide = () => {
    setShowFirstPlayGuide(false)
    try {
      window.localStorage.setItem(FIRST_PLAY_GUIDE_SEEN_KEY, '1')
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }

  const closeClearSolutionGuide = () => {
    setShowClearSolutionGuide(false)
  }

  const handleViewSolvedDetail = async () => {
    if (!pendingSolvedHash) return

    const hash = pendingSolvedHash
    setShowClearSolutionGuide(false)
    setPendingSolvedHash(null)
    await goToSolutionDetail(hash)
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

    const placedCellsByShape = Array.from({ length: 12 }).map((_, index) => {
      const shapeId = index + 1
      const cells = MINI_BOARD_CELLS.filter(cell => {
        if (DISABLED_CELLS.has(cell.id)) return false
        const stack = stackMap.get(cell.id) ?? []
        if (stack.length === 0) return false
        const topShapeId = stack[stack.length - 1]
        return topShapeId === shapeId
      })

      return {
        shapeId,
        cells,
      }
    }).filter(item => item.cells.length > 0)

    return (
      <svg
        className="solution-board-preview"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {Array.from({ length: 12 }).map((_, index) => {
            const shapeId = index + 1
            const outlineColor = getShapeOutlineColor(SHAPE_COLORS[index])

            return (
              <filter
                key={`detail-outline-filter-${shapeId}`}
                id={`detail-shape-outline-${shapeId}`}
                x="-12%"
                y="-12%"
                width="124%"
                height="124%"
                colorInterpolationFilters="sRGB"
              >
                <feMorphology in="SourceAlpha" operator="erode" radius="0.75" result="eroded" />
                <feComposite in="SourceAlpha" in2="eroded" operator="out" result="ring" />
                <feFlood floodColor={outlineColor} floodOpacity="0.9" result="ringColor" />
                <feComposite in="ringColor" in2="ring" operator="in" result="coloredRing" />
              </filter>
            )
          })}
        </defs>

        {MINI_BOARD_CELLS.map(cell => {
          const stack = stackMap.get(cell.id) ?? []
          const topShapeId = stack.length > 0 ? stack[stack.length - 1] : 0
          const disabled = DISABLED_CELLS.has(cell.id)
          const fill = disabled
            ? 'transparent'
            : topShapeId > 0
            ? SHAPE_COLORS[(topShapeId - 1) % SHAPE_COLORS.length]
            : '#ffffff'
          const basePoints = getMiniTrianglePoints(cell, size)
          const points = !disabled && topShapeId > 0
            ? expandPolygonPoints(basePoints, 0.45)
            : basePoints

          return (
            <polygon
              key={`layout-cell-${cell.id}`}
              points={points}
              fill={fill}
              stroke="none"
              strokeWidth={0}
              opacity={disabled ? 0 : 0.95}
            />
          )
        })}

        {placedCellsByShape.map(item => (
          <g key={`detail-outline-${item.shapeId}`} filter={`url(#detail-shape-outline-${item.shapeId})`}>
            {item.cells.map(cell => (
              <polygon
                key={`detail-outline-cell-${item.shapeId}-${cell.id}`}
                points={expandPolygonPoints(getMiniTrianglePoints(cell, size), 0.45)}
                fill="#000"
                stroke="none"
                strokeWidth={0}
                opacity={1}
              />
            ))}
          </g>
        ))}
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
      <AppHeader
        page={page}
        loading={loading}
        totalSolutions={stats.totalSolutions}
        started={started}
        onOpenSolutions={openSolutionsPage}
        onStartGame={handleStartGame}
        onBackHome={backToHome}
      />

      {page === 'home' && (
        <>
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

      {page === 'home' && started && showFirstPlayGuide && (
        <div className="first-play-guide-backdrop" role="presentation" onClick={closeFirstPlayGuide}>
          <section
            className="first-play-guide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-play-guide-title"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="first-play-guide-title">操作说明</h2>
            <p>第一次游玩，先看这三个关键操作：</p>
            <ul>
              <li>右侧图形：点击弹出菜单可旋转/翻转，拖动可放到左侧棋盘。</li>
              <li>左侧已放置图形：拖动可移动位置，点按可再次旋转/翻转。</li>
              <li>目标：填满所有可用三角格后即通关，系统会自动记录解法。</li>
            </ul>
            <button type="button" className="first-play-guide-btn" onClick={closeFirstPlayGuide}>
              我知道了，开始挑战
            </button>
          </section>
        </div>
      )}

      {page === 'home' && started && showClearSolutionGuide && (
        <div className="clear-solution-guide-backdrop" role="presentation" onClick={closeClearSolutionGuide}>
          <section
            className="clear-solution-guide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-solution-guide-title"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="clear-solution-guide-title">通关成功</h2>
            <p>你的这套摆法已经生成解法详情，可查看首次时间、总人数和布局图。</p>
            <div className="clear-solution-guide-actions">
              <button type="button" className="clear-solution-guide-ghost" onClick={closeClearSolutionGuide}>
                继续游戏
              </button>
              <button type="button" className="clear-solution-guide-btn" onClick={() => void handleViewSolvedDetail()}>
                查看详情
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App


interface AppHeaderProps {
  page: 'home' | 'solutions'
  loading: boolean
  totalSolutions: number
  started: boolean
  onOpenSolutions: () => void
  onStartGame: () => void
  onBackHome: () => void
}

function AppHeader({
  page,
  loading,
  totalSolutions,
  started,
  onOpenSolutions,
  onStartGame,
  onBackHome,
}: AppHeaderProps) {
  return (
    <section className="app-header-card">
      <div className="lobby-copy">
        <p className="lobby-label">Smart5k Puzzle</p>
        <h1 className="lobby-title">智力五千通</h1>
        <p className="lobby-subtitle">一个拥有 5000 多种解法的图形拼放挑战，每一步都可能通向全新的通关路径。</p>
      </div>

      <div className="lobby-stats">
        <button type="button" className="stat-item stat-link" onClick={onOpenSolutions}>
          <span>总解法数量（点击查看）</span>
          <strong>{loading ? '...' : totalSolutions}</strong>
        </button>
      </div>

      {page === 'home' ? (
        <button type="button" className="start-btn" onClick={onStartGame}>
          {started ? '继续游戏' : '开始游戏'}
        </button>
      ) : (
        <button type="button" className="ghost-btn" onClick={onBackHome}>返回首页</button>
      )}
    </section>
  )
}

export default AppHeader

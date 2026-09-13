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

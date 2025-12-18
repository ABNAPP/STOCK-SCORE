import React from 'react'
import './ItemList.css'

export default function ItemList({ items, title, watchlist, onToggleWatchlist, t }) {
  if (!items || items.length === 0) {
    return (
      <div className="item-list">
        <h2>{title}</h2>
        <div className="item-list-empty">{t.noData}</div>
      </div>
    )
  }

  const isInWatchlist = (id) => watchlist.includes(id)

  return (
    <div className="item-list">
      <h2>{title}</h2>
      <div className="item-list-grid">
        {items.map((item, idx) => (
          <div key={item.id || idx} className="item-card">
            <div className="item-header">
              <div className="item-name">
                <strong>{item.name}</strong>
                {item.ticker && <span className="item-ticker">{item.ticker}</span>}
              </div>
              <button
                className={`watchlist-btn ${isInWatchlist(item.id) ? 'active' : ''}`}
                onClick={() => onToggleWatchlist(item.id)}
                title={isInWatchlist(item.id) ? t.removeFromWatchlist : t.addToWatchlist}
              >
                {isInWatchlist(item.id) ? '★' : '☆'}
              </button>
            </div>
            <div className="item-score">
              <span className="score-label">{t.score}:</span>
              <span className="score-value">
                {typeof item.score === 'number' ? item.score.toFixed(2) : item.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


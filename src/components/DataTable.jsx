import React from 'react'
import './DataTable.css'

export default function DataTable({ data, columns, watchlist, onToggleWatchlist, t }) {
  if (!data || data.length === 0) {
    return <div className="data-table-empty">{t.noData}</div>
  }

  const isInWatchlist = (id) => watchlist.includes(id)

  return (
    <div className="data-table-container">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.ticker}</th>
              <th>{t.name}</th>
              <th>{t.score}</th>
              {columns.otherColumns.map(col => (
                <th key={col}>{col}</th>
              ))}
              <th>{t.watchlist}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={item.id || idx}>
                <td>{item.ticker || '-'}</td>
                <td>{item.name}</td>
                <td className="score-cell">
                  {typeof item.score === 'number' ? item.score.toFixed(2) : item.score}
                </td>
                {columns.otherColumns.map(col => (
                  <td key={col}>
                    {item.raw && item.raw[col] !== undefined ? String(item.raw[col]) : '-'}
                  </td>
                ))}
                <td>
                  <button
                    className={`watchlist-btn ${isInWatchlist(item.id) ? 'active' : ''}`}
                    onClick={() => onToggleWatchlist(item.id)}
                    title={isInWatchlist(item.id) ? t.removeFromWatchlist : t.addToWatchlist}
                  >
                    {isInWatchlist(item.id) ? '★' : '☆'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


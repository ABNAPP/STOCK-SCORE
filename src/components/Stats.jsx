import React from 'react'
import './Stats.css'

export default function Stats({ stats, t, locale = 'sv' }) {
  if (!stats || stats.length === 0) {
    return null
  }

  return (
    <div className="stats-container">
      <h2>{t.otherStats}</h2>
      <div className="stats-grid">
        {stats.map(stat => (
          <div key={stat.column} className="stat-card">
            <div className="stat-header">
              <h3>{stat.column}</h3>
            </div>
            <div className="stat-values">
              <div className="stat-item">
                <span className="stat-label">{t.sum}:</span>
                <span className="stat-value">{formatNumber(stat.sum, locale)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t.average}:</span>
                <span className="stat-value">{formatNumber(stat.average, locale)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t.count}:</span>
                <span className="stat-value">{stat.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatNumber(num, locale) {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}


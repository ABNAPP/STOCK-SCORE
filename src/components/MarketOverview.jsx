import React from 'react'
import './MarketOverview.css'

export default function MarketOverview({ distribution, t }) {
  return (
    <div className="market-overview">
      <h2>{t.marketOverview}</h2>
      <div className="distribution-grid">
        <div className="distribution-card high">
          <div className="distribution-label">{t.high}</div>
          <div className="distribution-value">
            <span className="count">{distribution.high.count}</span>
            <span className="percent">{distribution.high.percent}%</span>
          </div>
        </div>
        <div className="distribution-card medium">
          <div className="distribution-label">{t.medium}</div>
          <div className="distribution-value">
            <span className="count">{distribution.medium.count}</span>
            <span className="percent">{distribution.medium.percent}%</span>
          </div>
        </div>
        <div className="distribution-card low">
          <div className="distribution-label">{t.low}</div>
          <div className="distribution-value">
            <span className="count">{distribution.low.count}</span>
            <span className="percent">{distribution.low.percent}%</span>
          </div>
        </div>
        <div className="distribution-card total">
          <div className="distribution-label">{t.total}</div>
          <div className="distribution-value">
            <span className="count">{distribution.total.count}</span>
            <span className="percent">{distribution.total.percent}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

